/* Ledger behaviours: client-side DOM mechanics attached by data-ds-* attributes. Holds no state and makes no server calls. */
(function () {
  var tracked = new Map();

  function listen(target, type, handler, capture) {
    target.addEventListener(type, handler, capture === true);
    return function () {
      target.removeEventListener(type, handler, capture === true);
    };
  }

  function elementsWith(root, attribute) {
    var found = Array.prototype.slice.call(root.querySelectorAll("[" + attribute + "]"));
    if (root.hasAttribute && root.hasAttribute(attribute)) found.unshift(root);
    return found;
  }

  function emit(target, type, detail) {
    target.dispatchEvent(new CustomEvent(type, { bubbles: true, detail: detail }));
  }

  function bindPopover(container) {
    var doc = container.ownerDocument;
    var cleanups = [];

    function panel() {
      return container.querySelector("[data-ds-popover-panel]");
    }

    function isOpen() {
      var current = panel();
      return current !== null && !current.hasAttribute("hidden");
    }

    var wasOpen = isOpen();

    function focusLeftWithPanel() {
      var active = doc.activeElement;
      return !active || active === doc.body || container.contains(active);
    }

    function restoreFocus() {
      var nowOpen = isOpen();
      var trigger = container.querySelector("[data-ds-popover-trigger]");
      if (wasOpen && !nowOpen && trigger && focusLeftWithPanel()) trigger.focus();
      wasOpen = nowOpen;
    }

    cleanups.push(
      listen(doc, "keydown", function (event) {
        if (event.key === "Escape" && isOpen()) emit(container, "ds:dismiss", {});
      }),
    );
    cleanups.push(
      listen(
        doc,
        "pointerdown",
        function (event) {
          if (isOpen() && !container.contains(event.target)) emit(container, "ds:dismiss", {});
        },
        true,
      ),
    );

    if (typeof MutationObserver === "function") {
      var observer = new MutationObserver(restoreFocus);
      observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["hidden"],
      });
      cleanups.push(function () {
        observer.disconnect();
      });
    }

    return function () {
      cleanups.forEach(function (cleanup) {
        cleanup();
      });
    };
  }

  function bindGrid(grid) {
    var cleanups = [];
    var current = null;

    function cells() {
      return Array.prototype.slice.call(grid.querySelectorAll("[data-ds-grid-cell]"));
    }

    function columns() {
      return parseInt(grid.getAttribute("data-ds-grid-columns"), 10) || 1;
    }

    function initialCell(all) {
      var pressed = all.filter(function (cell) {
        return cell.getAttribute("aria-pressed") === "true";
      });
      return pressed[0] || all[0];
    }

    function syncTabindex() {
      var all = cells();
      if (all.length === 0) return;
      if (all.indexOf(current) < 0) current = initialCell(all);
      all.forEach(function (cell) {
        cell.setAttribute("tabindex", cell === current ? "0" : "-1");
      });
    }

    function cellFor(target) {
      return cells().filter(function (cell) {
        return cell === target || cell.contains(target);
      })[0];
    }

    function moveTo(all, index) {
      var bounded = Math.max(0, Math.min(all.length - 1, index));
      current = all[bounded];
      syncTabindex();
      current.focus();
    }

    function targetIndex(key, index, count) {
      var width = columns();
      var rowStart = index - (index % width);
      var offsets = {
        ArrowLeft: index - 1,
        ArrowRight: index + 1,
        ArrowUp: index - width,
        ArrowDown: index + width,
        Home: rowStart,
        End: Math.min(count - 1, rowStart + width - 1),
      };
      return offsets[key];
    }

    function onKeydown(event) {
      var all = cells();
      var cell = cellFor(event.target);
      if (!cell) return;
      if (event.key === "PageUp" || event.key === "PageDown") {
        event.preventDefault();
        emit(grid, "ds:page", { direction: event.key === "PageUp" ? "previous" : "next" });
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        cell.click();
      } else if (targetIndex(event.key, all.indexOf(cell), all.length) !== undefined) {
        event.preventDefault();
        moveTo(all, targetIndex(event.key, all.indexOf(cell), all.length));
      }
    }

    function onKeyup(event) {
      if (event.key === " " && cellFor(event.target)) event.preventDefault();
    }

    function onFocusin(event) {
      var cell = cellFor(event.target);
      if (!cell) return;
      current = cell;
      syncTabindex();
    }

    cleanups.push(listen(grid, "keydown", onKeydown));
    cleanups.push(listen(grid, "keyup", onKeyup));
    cleanups.push(listen(grid, "focusin", onFocusin));

    if (typeof MutationObserver === "function") {
      var observer = new MutationObserver(syncTabindex);
      observer.observe(grid, { childList: true, subtree: true });
      cleanups.push(function () {
        observer.disconnect();
      });
    }

    syncTabindex();

    return function () {
      cleanups.forEach(function (cleanup) {
        cleanup();
      });
      cells().forEach(function (cell) {
        cell.removeAttribute("tabindex");
      });
    };
  }

  var behaviours = [
    { attribute: "data-ds-popover", bind: bindPopover },
    { attribute: "data-ds-grid", bind: bindGrid },
  ];

  function attach(root) {
    var bound = tracked.get(root) || new Map();
    var present = new Set();
    behaviours.forEach(function (behaviour) {
      elementsWith(root, behaviour.attribute).forEach(function (element) {
        present.add(element);
        if (!bound.has(element)) bound.set(element, behaviour.bind(element));
      });
    });
    bound.forEach(function (cleanup, element) {
      if (present.has(element)) return;
      cleanup();
      bound.delete(element);
    });
    tracked.set(root, bound);
  }

  function detach(root) {
    var bound = tracked.get(root);
    if (!bound) return;
    bound.forEach(function (cleanup) {
      cleanup();
    });
    tracked.delete(root);
  }

  window.Ledger = { attach: attach, detach: detach };
})();
