import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "components/bundle.js"),
  "utf8",
);

class FakeElement extends EventTarget {
  constructor(document, attributes = {}, children = []) {
    super();
    this.ownerDocument = document;
    this.attributes = new Map(Object.entries(attributes));
    this.children = children;
    this.parent = null;
    children.forEach((child) => (child.parent = this));
    this.clicks = 0;
  }
  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  hasAttribute(name) {
    return this.attributes.has(name);
  }
  descendants() {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
  querySelectorAll(selector) {
    const name = /^\[([\w-]+)\]$/.exec(selector)[1];
    return this.descendants().filter((element) => element.hasAttribute(name));
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  contains(other) {
    return other === this || this.descendants().includes(other);
  }
  focus() {
    this.ownerDocument.activeElement = this;
    this.parent?.bubble(new Event("focusin", { bubbles: true }), this);
  }
  bubble(event, origin) {
    Object.defineProperty(event, "target", { value: origin });
    this.dispatchEvent(event);
    this.parent?.bubble(new Event(event.type, { bubbles: true }), origin);
  }
  click() {
    this.clicks += 1;
  }
}

class FakeDocument extends EventTarget {
  constructor() {
    super();
    this.body = new FakeElement(this);
    this.activeElement = this.body;
  }
}

function keydown(target, key) {
  const event = Object.assign(new Event("keydown", { bubbles: true, cancelable: true }), { key });
  Object.defineProperty(event, "target", { value: target });
  target.parent.dispatchEvent(event);
}

function pointerdown(document, target) {
  const event = new Event("pointerdown");
  Object.defineProperty(event, "target", { value: target });
  document.dispatchEvent(event);
}

function loadLedger() {
  const window = {};
  new Function("window", source)(window);
  return window.Ledger;
}

function pickerFixture() {
  const document = new FakeDocument();
  const days = Array.from(
    { length: 14 },
    (_, index) =>
      new FakeElement(document, {
        "data-ds-grid-cell": "",
        "aria-pressed": index === 9 ? "true" : "false",
      }),
  );
  const grid = new FakeElement(document, { "data-ds-grid": "", "data-ds-grid-columns": "7" }, days);
  const trigger = new FakeElement(document, { "data-ds-popover-trigger": "" });
  const panel = new FakeElement(document, { "data-ds-popover-panel": "" }, [grid]);
  const container = new FakeElement(document, { "data-ds-popover": "" }, [trigger, panel]);
  const root = new FakeElement(document, {}, [container]);
  return { document, days, grid, trigger, panel, container, root };
}

test("global Ledger is the only property the script defines", () => {
  const ledger = loadLedger();
  assert.deepEqual(Object.keys(ledger).sort(), ["attach", "detach"]);
});

test("grid keeps one day in the tab order, starting at the chosen day", () => {
  const { days, root } = pickerFixture();
  loadLedger().attach(root);
  assert.deepEqual(
    days.map((day) => day.getAttribute("tabindex")),
    days.map((_, index) => (index === 9 ? "0" : "-1")),
  );
});

test("arrow keys move focus by a day or a week", () => {
  const { days, root } = pickerFixture();
  loadLedger().attach(root);
  days[9].focus();
  keydown(days[9], "ArrowRight");
  assert.equal(days[0].ownerDocument.activeElement, days[10]);
  keydown(days[10], "ArrowDown");
  assert.equal(days[0].ownerDocument.activeElement, days[13]);
  keydown(days[13], "ArrowUp");
  assert.equal(days[0].ownerDocument.activeElement, days[6]);
  keydown(days[6], "ArrowLeft");
  assert.equal(days[0].ownerDocument.activeElement, days[5]);
  assert.equal(days[5].getAttribute("tabindex"), "0");
  assert.equal(days[6].getAttribute("tabindex"), "-1");
});

test("Home and End move focus to the ends of the week", () => {
  const { days, root } = pickerFixture();
  loadLedger().attach(root);
  days[9].focus();
  keydown(days[9], "End");
  assert.equal(days[0].ownerDocument.activeElement, days[13]);
  keydown(days[13], "Home");
  assert.equal(days[0].ownerDocument.activeElement, days[7]);
});

test("PageUp and PageDown announce the paging direction", () => {
  const { days, grid, root } = pickerFixture();
  loadLedger().attach(root);
  const directions = [];
  grid.addEventListener("ds:page", (event) => directions.push(event.detail.direction));
  days[9].focus();
  keydown(days[9], "PageUp");
  keydown(days[9], "PageDown");
  assert.deepEqual(directions, ["previous", "next"]);
});

test("Enter and Space click the focused day", () => {
  const { days, root } = pickerFixture();
  loadLedger().attach(root);
  days[9].focus();
  keydown(days[9], "Enter");
  keydown(days[9], " ");
  assert.equal(days[9].clicks, 2);
});

test("Escape asks the popover owner to dismiss", () => {
  const { container, document, root } = pickerFixture();
  loadLedger().attach(root);
  let dismissals = 0;
  container.addEventListener("ds:dismiss", () => (dismissals += 1));
  document.dispatchEvent(Object.assign(new Event("keydown"), { key: "Escape" }));
  assert.equal(dismissals, 1);
});

test("pointer down outside the popover asks the owner to dismiss; inside does not", () => {
  const { container, days, document, root } = pickerFixture();
  loadLedger().attach(root);
  let dismissals = 0;
  container.addEventListener("ds:dismiss", () => (dismissals += 1));
  pointerdown(document, days[0]);
  assert.equal(dismissals, 0);
  pointerdown(document, document.body);
  assert.equal(dismissals, 1);
});

test("attaching twice reacts once per event", () => {
  const { container, document, root } = pickerFixture();
  const ledger = loadLedger();
  ledger.attach(root);
  ledger.attach(root);
  let dismissals = 0;
  container.addEventListener("ds:dismiss", () => (dismissals += 1));
  document.dispatchEvent(Object.assign(new Event("keydown"), { key: "Escape" }));
  assert.equal(dismissals, 1);
});

test("detaching removes every behaviour", () => {
  const { container, days, document, root } = pickerFixture();
  const ledger = loadLedger();
  ledger.attach(root);
  ledger.detach(root);
  let dismissals = 0;
  container.addEventListener("ds:dismiss", () => (dismissals += 1));
  document.dispatchEvent(Object.assign(new Event("keydown"), { key: "Escape" }));
  assert.equal(dismissals, 0);
  assert.equal(days[0].getAttribute("tabindex"), null);
});

test("focus returns to the toggle when the popover is removed", () => {
  const observers = [];
  globalThis.MutationObserver = class {
    constructor(callback) {
      this.callback = callback;
      observers.push(this);
    }
    observe() {}
    disconnect() {}
  };
  try {
    const { days, trigger, container, document, root } = pickerFixture();
    loadLedger().attach(root);
    days[9].focus();
    container.children = [trigger];
    document.activeElement = document.body;
    observers.forEach((observer) => observer.callback());
    assert.equal(document.activeElement, trigger);
  } finally {
    delete globalThis.MutationObserver;
  }
});
