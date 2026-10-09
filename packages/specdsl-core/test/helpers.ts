import { bind, parseMarkdown, type BindResult, type BindSuccess } from "../src/index.js";
import invoicing from "../../../dialects/invoicing.ts";

export function bindSource(source: string): BindResult {
  return bind(parseMarkdown(source), invoicing, { file: "spec.md" });
}

export function bindSuccess(source: string): BindSuccess {
  const result = bindSource(source);
  if (!result.ok) {
    throw new Error(result.errors.map((error) => `${error.line}: ${error.message}`).join("\n"));
  }
  return result;
}

export function lineOf(source: string, text: string): number {
  return source.split("\n").findIndex((line) => line.includes(text)) + 1;
}

export const PREAMBLE = [
  "# Test",
  "",
  "## Model",
  "- Customer: name, email",
  "- Invoice: number, status, total. Belongs to Customer.",
  "- Invoice.status: draft -> sent -> paid, draft -> void",
  "",
  "## Actors",
  "- Accounts: role accountant",
  "",
];

export function specWith(...lines: string[]): string {
  return [...PREAMBLE, ...lines, ""].join("\n");
}

export const DRAFT_INVOICE = [
  'Given a Customer "Acme"',
  'Given an Invoice "INV-001" with status draft, customer Acme',
  "When Accounts opens Invoice editor for INV-001",
];
