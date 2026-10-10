/** Renders a Design-canvas artboard to static HTML: merges props over the declared defaults, fills `{{ }}` holes, expands `sc-for`, resolves `sc-if` and strips the `sc-*` wrappers. */

export type Props = Record<string, unknown>;

type Scope = Readonly<Record<string, unknown>>;

type TemplateNode =
  | { kind: "text"; text: string }
  | { kind: "if"; value: string; children: TemplateNode[] }
  | { kind: "for"; list: string; as: string; children: TemplateNode[] };

const SC_TAG = /<(\/?)sc-(if|for)\b([^>]*)>/g;
const HOLE = /\{\{\s*([^{}]*?)\s*\}\}/g;
const HINT_ATTRIBUTE = /\s+hint-[\w-]+(?:="[^"]*"|='[^']*')?/g;
const DEFAULT_ITEM_NAME = "item";

/** The `default` of every prop declared in the artboard's `data-props` attribute. */
export function propDefaults(html: string): Props {
  const declared = declaredProps(html);
  return Object.fromEntries(
    Object.entries(declared)
      .filter(([name]) => !name.startsWith("$"))
      .map(([name, definition]) => [name, (definition as { default?: unknown }).default]),
  );
}

/** The complete static document for an artboard rendered with `props` over its declared defaults. */
export function renderArtboard(html: string, props: Props = {}): string {
  const scope = { ...propDefaults(html), ...props };
  const body = /<x-dc>([\s\S]*?)<\/x-dc>/.exec(html)?.[1] ?? "";
  const helmet = /<helmet>([\s\S]*?)<\/helmet>/.exec(body)?.[1] ?? "";
  const content = renderTemplate(body.replace(/<helmet>[\s\S]*?<\/helmet>/, ""), scope);
  const title = /<title>[\s\S]*?<\/title>/.exec(html)?.[0] ?? "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />${title}${helmet}</head><body>${content}</body></html>`;
}

/** Renders a template fragment against a scope of props. */
export function renderTemplate(template: string, scope: Scope): string {
  return renderNodes(parseTemplate(template), scope).replace(HINT_ATTRIBUTE, "");
}

function declaredProps(html: string): Record<string, unknown> {
  const attribute = /data-props='([^']*)'|data-props="([^"]*)"/.exec(html);
  const raw = attribute?.[1] ?? attribute?.[2];
  if (raw === undefined) return {};
  try {
    return JSON.parse(decodeEntities(raw)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseTemplate(template: string): TemplateNode[] {
  const root: TemplateNode[] = [];
  const stack: TemplateNode[][] = [root];
  let cursor = 0;
  for (const tag of template.matchAll(SC_TAG)) {
    const current = stack[stack.length - 1] as TemplateNode[];
    const index = tag.index ?? 0;
    if (index > cursor) current.push({ kind: "text", text: template.slice(cursor, index) });
    cursor = index + tag[0].length;
    if (tag[1] === "/") {
      stack.length > 1 && stack.pop();
      continue;
    }
    const attributes = attributesOf(tag[3] ?? "");
    const children: TemplateNode[] = [];
    current.push(
      tag[2] === "if"
        ? { kind: "if", value: attributes["value"] ?? "", children }
        : {
            kind: "for",
            list: attributes["list"] ?? "",
            as: attributes["as"] ?? DEFAULT_ITEM_NAME,
            children,
          },
    );
    stack.push(children);
  }
  (stack[0] as TemplateNode[]).push({ kind: "text", text: template.slice(cursor) });
  return root;
}

function attributesOf(source: string): Record<string, string> {
  return Object.fromEntries(
    [...source.matchAll(/([\w-]+)=(?:"([^"]*)"|'([^']*)')/g)].map((match) => [
      match[1] as string,
      match[2] ?? match[3] ?? "",
    ]),
  );
}

function renderNodes(nodes: readonly TemplateNode[], scope: Scope): string {
  return nodes.map((node) => renderNode(node, scope)).join("");
}

function renderNode(node: TemplateNode, scope: Scope): string {
  switch (node.kind) {
    case "text":
      return fillHoles(node.text, scope);
    case "if":
      return truthy(resolveHole(node.value, scope)) ? renderNodes(node.children, scope) : "";
    case "for": {
      const items = resolveHole(node.list, scope);
      return Array.isArray(items)
        ? items
            .map((item, index) =>
              renderNodes(node.children, { ...scope, [node.as]: item, $index: index }),
            )
            .join("")
        : "";
    }
  }
}

function fillHoles(text: string, scope: Scope): string {
  return text.replace(HOLE, (_hole, path: string) => escapeHtml(display(lookup(path, scope))));
}

function resolveHole(attribute: string, scope: Scope): unknown {
  const hole = /^\s*\{\{\s*([^{}]*?)\s*\}\}\s*$/.exec(attribute);
  return hole === null ? attribute : lookup(hole[1] as string, scope);
}

function lookup(path: string, scope: Scope): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value !== null && typeof value === "object"
          ? (value as Record<string, unknown>)[key]
          : undefined,
      scope,
    );
}

function truthy(value: unknown): boolean {
  return value !== false && value !== "false" && value !== "" && value !== 0 && value != null;
}

function display(value: unknown): string {
  return value === null || value === undefined || typeof value === "object" ? "" : String(value);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
