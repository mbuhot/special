import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { designLint, readArtboards } from "../src/index.js";
import { bindSuccess, lineOf, specWith } from "./helpers.js";

const SURFACES = [
  "## Surfaces",
  '- Order page: design shop/order-page, button "Pay", region "Total"',
  "",
];

function artboard(surface: string, ...controls: string[]): string {
  const marks = controls.map((control) => `<div data-control="${control}">x</div>`);
  return `<x-dc><main data-surface="${surface}">${marks.join("")}</main></x-dc>`;
}

function designsWith(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "designs-"));
  for (const [path, markup] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), markup);
  }
  return root;
}

const source = specWith(...SURFACES);
const site = { file: "spec.md", line: lineOf(source, "- Order page:") };

describe("design link", () => {
  it("records the design directory on the surface", () => {
    expect(bindSuccess(source).ast.surfaces["Order page"]?.design).toBe("shop/order-page");
  });

  it("lists artboards with the default state first", () => {
    const root = designsWith({
      "shop/order-page/paid.dc.html": artboard("Order page", "Total"),
      "shop/order-page/default.dc.html": artboard("Order page", "Pay"),
    });
    expect(readArtboards(join(root, "shop/order-page")).map((board) => board.state)).toEqual([
      "default",
      "paid",
    ]);
  });
});

describe("design lint", () => {
  it("is silent when artboards carry exactly the declared controls", () => {
    const root = designsWith({
      "shop/order-page/default.dc.html": artboard("Order page", "Pay", "Total"),
    });
    expect(designLint(bindSuccess(source), root)).toEqual([]);
  });

  it("accepts a control declared in any state's artboard", () => {
    const root = designsWith({
      "shop/order-page/open.dc.html": artboard("Order page", "Pay"),
      "shop/order-page/paid.dc.html": artboard("Order page", "Total"),
    });
    expect(designLint(bindSuccess(source), root)).toEqual([]);
  });

  it("accepts controls of a shared surface inside an artboard", () => {
    const root = designsWith({
      "shop/order-page/default.dc.html": `${artboard("Order page", "Pay", "Total")}<nav data-surface="Sidebar"><a data-control="Sign out">x</a></nav>`,
    });
    expect(designLint(bindSuccess(source), root)).toEqual([]);
  });

  it("warns about a declared control missing from every artboard", () => {
    const root = designsWith({ "shop/order-page/default.dc.html": artboard("Order page", "Pay") });
    expect(designLint(bindSuccess(source), root)).toEqual([
      {
        ...site,
        message: 'Control "Total" on Order page is not in any artboard of designs/shop/order-page',
      },
    ]);
  });

  it("warns about a designed control the surface does not declare", () => {
    const root = designsWith({
      "shop/order-page/default.dc.html": artboard("Order page", "Pay", "Total", "Refund"),
    });
    expect(designLint(bindSuccess(source), root)).toEqual([
      {
        ...site,
        message:
          'Control "Refund" in designs/shop/order-page/default.dc.html is not declared on Order page',
      },
    ]);
  });

  it("warns about an artboard whose data-surface names another surface", () => {
    const root = designsWith({
      "shop/order-page/default.dc.html": artboard("Basket", "Pay", "Total"),
    });
    expect(designLint(bindSuccess(source), root)).toEqual([
      {
        ...site,
        message:
          'designs/shop/order-page/default.dc.html has data-surface "Basket", expected "Order page"',
      },
    ]);
  });

  it("warns about a missing design directory", () => {
    expect(designLint(bindSuccess(source), designsWith({}))).toEqual([
      { ...site, message: "Surface Order page has no artboard in designs/shop/order-page" },
    ]);
  });
});
