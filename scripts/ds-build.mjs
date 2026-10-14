import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const system = join(root, "designs/ds/ledger");
const appStylesheet = join(root, "apps/invoicing/assets/css/ds.css");

const tokens = JSON.parse(readFileSync(join(system, "tokens.json"), "utf8"));
const themeIds = tokens.color.themes.map((theme) => theme.id);
const [firstTheme, ...laterThemes] = themeIds;
const plainFamilies = Object.keys(tokens).filter(
  (key) => !["name", "version", "color", "type", "shadow", "spacing", "radius"].includes(key),
);

function themeValue(token, theme) {
  if (typeof token.value === "string") return theme === firstTheme ? token.value : undefined;
  return token.value[theme];
}

function cssValue(value) {
  const alias = /^\{(.+)\}$/.exec(value);
  return alias ? `var(--${alias[1]})` : value;
}

function declaration(token, value, indent = "  ") {
  return `${indent}--${token.name}: ${cssValue(value)};`;
}

function themedTokens() {
  return [...tokens.color.tokens, ...(tokens.shadow?.tokens ?? [])];
}

function firstThemeBlock() {
  const lines = themedTokens().map((token) =>
    declaration(token, themeValue(token, firstTheme) ?? Object.values(token.value)[0]),
  );
  return [`:root, [data-theme="${firstTheme}"] {`, ...lines, "}"].join("\n");
}

function isOverride(token, theme) {
  const value = themeValue(token, theme);
  if (value === undefined) return false;
  return value !== themeValue(token, firstTheme) || /^\{.+\}$/.test(value);
}

function laterThemeBlock(theme) {
  const lines = themedTokens()
    .filter((token) => isOverride(token, theme))
    .map((token) => declaration(token, themeValue(token, theme)));
  return [`[data-theme="${theme}"] {`, ...lines, "}"].join("\n");
}

function plainBlock() {
  const lines = [
    ...tokens.spacing.tokens,
    ...tokens.radius.tokens,
    ...plainFamilies.flatMap((family) => tokens[family].tokens),
  ].map((token) => declaration(token, token.value));
  const fonts = Object.entries(tokens.type.families).map(
    ([key, stack]) => `  --font-${key}: ${stack};`,
  );
  return [":root {", ...lines, ...fonts, "}"].join("\n");
}

function styleClasses() {
  return tokens.type.groups.flatMap((group) =>
    group.styles.map((style) =>
      [
        `.${style.name} {`,
        `  font-family: var(--font-${group.family});`,
        `  font-size: ${style.fontSize};`,
        `  line-height: ${style.lineHeight};`,
        `  font-weight: ${style.fontWeight};`,
        "}",
      ].join("\n"),
    ),
  );
}

const generatedTokens =
  [
    `/* ${tokens.name} — generated from tokens.json */`,
    firstThemeBlock(),
    ...laterThemes.map(laterThemeBlock),
    plainBlock(),
    ...styleClasses(),
  ].join("\n") + "\n";

writeFileSync(join(system, "tokens.css"), generatedTokens);
writeFileSync(
  appStylesheet,
  generatedTokens + "\n" + readFileSync(join(system, "components/bundle.css"), "utf8"),
);
