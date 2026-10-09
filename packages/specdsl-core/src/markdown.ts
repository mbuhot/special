import type {
  Heading,
  List,
  ListItem,
  Paragraph,
  Root,
  RootContent,
  Table as TableNode,
} from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

export interface Line {
  text: string;
  line: number;
}

export interface Item {
  text: string;
  line: number;
  children: Item[];
}

export interface TableRow {
  cells: string[];
  line: number;
}

export interface Table {
  line: number;
  header: string[];
  rows: TableRow[];
}

export interface Section {
  heading: string;
  line: number;
  items: Item[];
  tables: Table[];
  body: Line[];
}

export interface MarkdownTree {
  title: string;
  titleLine: number;
  sections: Section[];
}

/** Parses Markdown source into a title and level-2 sections, preserving line numbers. */
export function parseMarkdown(source: string): MarkdownTree {
  const root = unified().use(remarkParse).use(remarkGfm).parse(source) as Root;
  const tree: MarkdownTree = { title: "", titleLine: 0, sections: [] };
  for (const node of root.children) {
    collectNode(node, source, tree);
  }
  return tree;
}

function collectNode(node: RootContent, source: string, tree: MarkdownTree): void {
  const section = tree.sections[tree.sections.length - 1];
  if (node.type === "heading") {
    collectHeading(node, source, tree);
  } else if (section === undefined) {
    return;
  } else if (node.type === "list") {
    section.items.push(...itemsOf(node, source));
  } else if (node.type === "table") {
    section.tables.push(tableOf(node, source));
  } else if (node.type === "paragraph") {
    section.body.push(...linesOf(node, source));
  }
}

function collectHeading(node: Heading, source: string, tree: MarkdownTree): void {
  const text = headingText(node, source);
  const line = node.position?.start.line ?? 0;
  if (node.depth === 1 && tree.title === "") {
    tree.title = text;
    tree.titleLine = line;
  } else if (node.depth === 2) {
    tree.sections.push({ heading: text, line, items: [], tables: [], body: [] });
  }
}

function rawText(
  node: { position?: { start: { offset?: number }; end: { offset?: number } } },
  source: string,
): string {
  const start = node.position?.start.offset ?? 0;
  const end = node.position?.end.offset ?? 0;
  return source.slice(start, end);
}

function headingText(node: Heading, source: string): string {
  const first = node.children[0];
  const last = node.children[node.children.length - 1];
  if (first === undefined || last === undefined) {
    return "";
  }
  const start = first.position?.start.offset ?? 0;
  const end = last.position?.end.offset ?? 0;
  return source.slice(start, end).trim();
}

function linesOf(paragraph: Paragraph, source: string): Line[] {
  const firstLine = paragraph.position?.start.line ?? 0;
  return rawText(paragraph, source)
    .split("\n")
    .map((text, offset) => ({ text: text.trim(), line: firstLine + offset }))
    .filter((entry) => entry.text !== "");
}

function itemsOf(list: List, source: string): Item[] {
  return list.children.map((listItem) => itemOf(listItem, source));
}

function itemOf(listItem: ListItem, source: string): Item {
  const paragraph = listItem.children.find(
    (child): child is Paragraph => child.type === "paragraph",
  );
  const nested = listItem.children.filter((child): child is List => child.type === "list");
  return {
    text:
      paragraph === undefined
        ? ""
        : rawText(paragraph, source)
            .replace(/\s*\n\s*/g, " ")
            .trim(),
    line: paragraph?.position?.start.line ?? listItem.position?.start.line ?? 0,
    children: nested.flatMap((list) => itemsOf(list, source)),
  };
}

function tableOf(table: TableNode, source: string): Table {
  const [headerRow, ...bodyRows] = table.children;
  const rowOf = (row: TableNode["children"][number]): TableRow => ({
    cells: row.children.map((cell) => rawText(cell, source).trim()),
    line: row.position?.start.line ?? 0,
  });
  return {
    line: table.position?.start.line ?? 0,
    header: headerRow === undefined ? [] : rowOf(headerRow).cells,
    rows: bodyRows.map(rowOf),
  };
}
