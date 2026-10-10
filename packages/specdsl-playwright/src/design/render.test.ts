import { expect, test } from "@playwright/test";
import { propDefaults, renderArtboard, renderTemplate } from "./render.js";

const artboard = (body: string, props = "{}") =>
  `<html><head><title>T</title><script src="./support.js"></script></head><body><x-dc><helmet><style>a{}</style></helmet>${body}</x-dc><script type="text/x-dc" data-dc-script data-props='${props}'></script></body></html>`;

test("fills holes from dotted lookups and leaves missing values empty", () => {
  expect(
    renderTemplate("<h1>{{ deal.name }}</h1><p>{{ deal.missing }}|{{ nothing.here }}</p>", {
      deal: { name: "Big" },
    }),
  ).toBe("<h1>Big</h1><p>|</p>");
});

test("escapes markup in hole values", () => {
  expect(renderTemplate("{{ text }}", { text: "<b>&" })).toBe("&lt;b&gt;&amp;");
});

test("keeps an sc-if body when its value is truthy and drops it otherwise", () => {
  const template = `<sc-if value="{{ flag }}" hint-placeholder-val="{{ true }}">yes</sc-if>`;
  expect(renderTemplate(template, { flag: true })).toBe("yes");
  expect(renderTemplate(template, { flag: false })).toBe("");
  expect(renderTemplate(template, {})).toBe("");
});

test("repeats an sc-for body per item with its index", () => {
  const template = `<sc-for list="{{ rows }}" as="row" hint-placeholder-count="3">[{{ $index }}:{{ row.name }}]</sc-for>`;
  expect(renderTemplate(template, { rows: [{ name: "a" }, { name: "b" }] })).toBe("[0:a][1:b]");
  expect(renderTemplate(template, { rows: [] })).toBe("");
});

test("nests sc-if inside sc-for and sc-for inside sc-for", () => {
  const nested = `<sc-for list="{{ rows }}" as="row"><sc-if value="{{ row.overdue }}">{{ row.name }};</sc-if></sc-for>`;
  expect(
    renderTemplate(nested, {
      rows: [
        { name: "a", overdue: true },
        { name: "b", overdue: false },
        { name: "c", overdue: true },
      ],
    }),
  ).toBe("a;c;");
  const doubled = `<sc-for list="{{ groups }}" as="group">{{ group.name }}:<sc-for list="{{ group.items }}" as="item">{{ item }},</sc-for>/</sc-for>`;
  expect(
    renderTemplate(doubled, {
      groups: [
        { name: "x", items: [1, 2] },
        { name: "y", items: [3] },
      ],
    }),
  ).toBe("x:1,2,/y:3,/");
});

test("reads prop defaults from data-props and skips preview settings", () => {
  const html = artboard(
    "",
    JSON.stringify({ stage: { editor: "enum", default: "lead" }, $preview: { width: 1 } }),
  );
  expect(propDefaults(html)).toEqual({ stage: "lead" });
});

test("renders defaults and lets given props override them", () => {
  const html = artboard(
    '<h1>{{ deal.name }}</h1><sc-if value="{{ overdue }}">late</sc-if>',
    JSON.stringify({
      deal: { editor: null, default: { name: "Sample" } },
      overdue: { editor: "boolean", default: true },
    }),
  );
  expect(renderArtboard(html)).toContain("<h1>Sample</h1>late");
  const overridden = renderArtboard(html, { deal: { name: "Real" }, overdue: false });
  expect(overridden).toContain("<h1>Real</h1>");
  expect(overridden).not.toContain("late");
});

test("serves the helmet style and drops canvas scripts", () => {
  const rendered = renderArtboard(artboard("<p>x</p>"));
  expect(rendered).toContain("<style>a{}</style>");
  expect(rendered).not.toContain("support.js");
  expect(rendered).not.toContain("sc-");
});
