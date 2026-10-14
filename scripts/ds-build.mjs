import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const system = join(root, "designs/ds/ledger");
const appStylesheet = join(root, "apps/invoicing/assets/css/ds.css");

const tokens = JSON.parse(readFileSync(join(system, "tokens.json"), "utf8"));

function declarations(values, indent) {
  return Object.entries(values)
    .map(([name, value]) => `${indent}${name}: ${value};`)
    .join("\n");
}

function tokensCss({ light, dark }) {
  return [
    "/* Generated from tokens.json by scripts/ds-build.mjs */",
    ":root {",
    "  color-scheme: light;",
    declarations(light, "  "),
    "}",
    "",
    "@media (prefers-color-scheme: dark) {",
    '  :root:not([data-theme="light"]) {',
    "    color-scheme: dark;",
    declarations(dark, "    "),
    "  }",
    "}",
    "",
    ':root[data-theme="dark"] {',
    "  color-scheme: dark;",
    declarations(dark, "  "),
    "}",
    "",
  ].join("\n");
}

const generatedTokens = tokensCss(tokens);
writeFileSync(join(system, "tokens.css"), generatedTokens);
writeFileSync(appStylesheet, generatedTokens + "\n" + readFileSync(join(system, "ds.css"), "utf8"));
