import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { baseSourcesFromSpecsDir } from "../src/base-sources.js";
import { attach, buildLintComment, lint, pull, type CommandContext } from "../src/commands.js";
import { createLinearClient } from "../src/linear.js";
import { fakeLinear, issueResponse, type FakeLinear } from "./fake-linear.js";

const DIALECT_PATH = resolve(import.meta.dirname, "../../../dialects/invoicing.ts");

const BASE_FILES: Record<string, string> = {
  "model.md": [
    "# Invoicing",
    "",
    "## Model",
    "",
    "- Customer: name, email. Has many Invoice.",
    "- Invoice: number, status, total. Belongs to Customer. Has many LineItem.",
    "- Invoice.status: draft -> sent -> paid, draft -> void",
    "- LineItem: description, quantity, unit price. Belongs to Invoice.",
    "",
  ].join("\n"),
  "surfaces.md": [
    "# Invoicing",
    "",
    "## Surfaces",
    "",
    '- Invoice list: table "Invoices", button "New invoice"',
    '- Invoice editor: field "Quantity", field "Unit price", region "Totals", region "Status", button "Send", button "Mark paid", button "Void"',
    "",
    "## Actors",
    "",
    "- Accounts: role accountant",
    "- Manager: role admin",
    "",
  ].join("\n"),
  "policies.md": [
    "# Invoicing",
    "",
    "## Policies",
    "",
    "- Invoice: accountant may read, create, update, send",
    "- Invoice: admin may read, create, update, send, mark paid, void",
    "",
  ].join("\n"),
  "unrelated-feature.md": [
    "# Invoicing",
    "",
    "## Scenario: Line total updates as quantity changes",
    "",
    'Given a Customer "Other"',
    "",
  ].join("\n"),
};

const VALID_SPEC = [
  "# Invoicing",
  "",
  "## Scenario: Line total updates as quantity changes",
  "",
  'Given a Customer "Acme"',
  'Given an Invoice "INV-001" with status draft, customer Acme',
  'Given a LineItem "Consulting" with invoice INV-001, quantity 1, unit price 100',
  "When Accounts opens Invoice editor for INV-001",
  'Then Accounts sees "100.00" in "Totals"',
  'When Accounts enters 3 into "Quantity"',
  'Then Accounts sees "300.00" in "Totals"',
  "Narrate: The line total updates as the quantity changes.",
].join("\n");

const SPEC_WITH_UNKNOWN_CONTROL = VALID_SPEC.replace(
  'Accounts enters 3 into "Quantity"',
  'Accounts enters 3 into "Teleport"',
);

const SPEC_REDECLARING_BASE_ENTITY = [
  "# Invoicing",
  "",
  "## Model",
  "",
  "- Customer: name.",
  "",
  VALID_SPEC.split("\n").slice(2).join("\n"),
].join("\n");

const SPEC_WARNINGS_COMMENT = (specsDir: string): string =>
  [
    "Spec check: 0 errors, 10 warnings",
    "",
    ...[
      "model.md:7: warning: Transition Invoice.status:draft->sent is not covered by any TransitionUse",
      "model.md:7: warning: Transition Invoice.status:sent->paid is not covered by any TransitionUse",
      "model.md:7: warning: Transition Invoice.status:draft->void is not covered by any TransitionUse",
      "surfaces.md:5: warning: Control Invoice list/Invoices is not referenced by any step",
      "surfaces.md:5: warning: Control Invoice list/New invoice is not referenced by any step",
      "surfaces.md:6: warning: Control Invoice editor/Unit price is not referenced by any step",
      "surfaces.md:6: warning: Control Invoice editor/Status is not referenced by any step",
      "surfaces.md:6: warning: Control Invoice editor/Send is not referenced by any step",
      "surfaces.md:6: warning: Control Invoice editor/Mark paid is not referenced by any step",
      "surfaces.md:6: warning: Control Invoice editor/Void is not referenced by any step",
    ].map((warning) => `- ${specsDir}/${warning}`),
  ].join("\n");

const EXPECTED_REDECLARATION_ERROR = (specsDir: string): string =>
  `INV-12:5: error: Customer is already declared in ${specsDir}/model.md:5`;

function unknownControlLine(): number {
  return SPEC_WITH_UNKNOWN_CONTROL.split("\n").findIndex((line) => line.includes("Teleport")) + 1;
}

interface Session {
  context: CommandContext;
  linear: FakeLinear;
  printed: string[];
  errors: string[];
}

function session(linear: FakeLinear): Session {
  const printed: string[] = [];
  const errors: string[] = [];
  const context: CommandContext = {
    client: createLinearClient({ apiKey: "lin_api_test", fetch: linear.fetch }),
    print: (line) => printed.push(line),
    printError: (line) => errors.push(line),
  };
  return { context, linear, printed, errors };
}

function scratchDirectory(): string {
  return mkdtempSync(join(tmpdir(), "specdsl-linear-"));
}

function specsDirectory(): string {
  const directory = scratchDirectory();
  Object.entries(BASE_FILES).forEach(([name, markdown]) =>
    writeFileSync(join(directory, name), markdown),
  );
  return directory;
}

function issueWithSpec(spec: string) {
  return fakeLinear({ Issue: issueResponse(`Context\n\n\`\`\`spec\n${spec}\n\`\`\`\n`) });
}

describe("pull", () => {
  it("writes the spec file and reports a bind error with the issue identifier and line for an unknown control", async () => {
    const outDir = scratchDirectory();
    const { context, errors } = session(issueWithSpec(SPEC_WITH_UNKNOWN_CONTROL));

    const exitCode = await pull(
      "INV-12",
      {
        dialectPath: DIALECT_PATH,
        bases: baseSourcesFromSpecsDir(specsDirectory()),
        destination: { kind: "out-dir", outDir },
      },
      context,
    );

    expect(readFileSync(join(outDir, "INV-12.md"), "utf8")).toBe(`${SPEC_WITH_UNKNOWN_CONTROL}\n`);
    expect(exitCode).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(new RegExp(`^INV-12:${unknownControlLine()}: error: .*Teleport`));
  });

  it("binds the issue spec against base files and exits zero", async () => {
    const { context, errors } = session(issueWithSpec(VALID_SPEC));

    const exitCode = await pull(
      "INV-12",
      {
        dialectPath: DIALECT_PATH,
        bases: baseSourcesFromSpecsDir(specsDirectory()),
        destination: { kind: "out-dir", outDir: scratchDirectory() },
      },
      context,
    );

    expect(exitCode).toBe(0);
    expect(errors.filter((line) => line.includes(": error: "))).toEqual([]);
  });

  it("writes the feature file named after the issue title", async () => {
    const specsDir = specsDirectory();
    const { context, printed } = session(issueWithSpec(VALID_SPEC));

    await pull(
      "INV-12",
      {
        dialectPath: DIALECT_PATH,
        bases: baseSourcesFromSpecsDir(specsDir),
        destination: { kind: "specs-dir", specsDir },
      },
      context,
    );

    expect(readFileSync(join(specsDir, "invoice-line-totals.md"), "utf8")).toBe(`${VALID_SPEC}\n`);
    expect(printed).toEqual([`Wrote ${join(specsDir, "invoice-line-totals.md")}`]);
  });

  it("reports a scenario that redeclares a base entity with the base file and line", async () => {
    const specsDir = specsDirectory();
    const { context, errors } = session(issueWithSpec(SPEC_REDECLARING_BASE_ENTITY));

    const exitCode = await pull(
      "INV-12",
      {
        dialectPath: DIALECT_PATH,
        bases: baseSourcesFromSpecsDir(specsDir),
        destination: { kind: "specs-dir", specsDir },
      },
      context,
    );

    expect(exitCode).toBe(1);
    expect(errors).toEqual([EXPECTED_REDECLARATION_ERROR(specsDir)]);
  });
});

describe("lint", () => {
  it("posts one comment listing the spec warnings", async () => {
    const specsDir = specsDirectory();
    const linear = fakeLinear({
      Issue: issueResponse(`\`\`\`spec\n${VALID_SPEC}\n\`\`\``),
      CreateComment: () => ({ commentCreate: { success: true } }),
    });
    const { context } = session(linear);

    const exitCode = await lint(
      "INV-12",
      { dialectPath: DIALECT_PATH, bases: baseSourcesFromSpecsDir(specsDir), comment: true },
      context,
    );

    expect(exitCode).toBe(0);
    expect(
      linear.graphqlRequests().filter(({ operation }) => operation === "CreateComment"),
    ).toEqual([
      {
        operation: "CreateComment",
        variables: { issueId: "issue-uuid-1", body: SPEC_WARNINGS_COMMENT(specsDir) },
      },
    ]);
  });

  it("posts nothing when comment is off", async () => {
    const linear = issueWithSpec(VALID_SPEC);
    const { context } = session(linear);

    await lint(
      "INV-12",
      {
        dialectPath: DIALECT_PATH,
        bases: baseSourcesFromSpecsDir(specsDirectory()),
        comment: false,
      },
      context,
    );

    expect(linear.graphqlRequests().map(({ operation }) => operation)).toEqual(["Issue"]);
  });

  it("notes that warnings are project-wide checks", async () => {
    const { context, errors } = session(issueWithSpec(VALID_SPEC));

    await lint(
      "INV-12",
      {
        dialectPath: DIALECT_PATH,
        bases: baseSourcesFromSpecsDir(specsDirectory()),
        comment: false,
      },
      context,
    );

    expect(errors[0]).toBe(
      "note: warnings are project-wide coverage checks over the base files plus this feature",
    );
  });
});

describe("lint comment body", () => {
  it("lists each warning on its own line", () => {
    const body = buildLintComment({
      errors: [],
      warnings: [
        { file: "INV-12", line: 4, message: "Customer is not covered by any scenario" },
        { file: "INV-12", line: 9, message: "Invoice.status void is never observed" },
      ],
      scenarioCount: 2,
    });

    expect(body).toBe(
      [
        "Spec check: 0 errors, 2 warnings",
        "",
        "- INV-12:4: warning: Customer is not covered by any scenario",
        "- INV-12:9: warning: Invoice.status void is never observed",
      ].join("\n"),
    );
  });

  it("lists errors before warnings", () => {
    const body = buildLintComment({
      errors: [{ file: "INV-12", line: 30, message: "unknown control Teleport" }],
      warnings: [{ file: "INV-12", line: 4, message: "Customer is not covered" }],
      scenarioCount: 0,
    });

    expect(body).toBe(
      [
        "Spec check: 1 error, 1 warning",
        "",
        "- INV-12:30: error: unknown control Teleport",
        "- INV-12:4: warning: Customer is not covered",
      ].join("\n"),
    );
  });

  it("states the scenario count when there is nothing to report", () => {
    expect(buildLintComment({ errors: [], warnings: [], scenarioCount: 3 })).toBe(
      "Spec binds cleanly: 3 scenarios",
    );
  });
});

describe("attach", () => {
  it("uploads the file bytes to the pre-signed URL and creates an attachment titled from timeline.json", async () => {
    const demoDirectory = scratchDirectory();
    const videoBytes = Buffer.from([0, 1, 2, 3, 250]);
    writeFileSync(join(demoDirectory, "demo.mp4"), videoBytes);
    writeFileSync(
      join(demoDirectory, "timeline.json"),
      JSON.stringify({ scenario: "Line total updates as quantity changes", steps: [] }),
    );
    const linear = fakeLinear({
      Issue: issueResponse(VALID_SPEC),
      FileUpload: () => ({
        fileUpload: {
          success: true,
          uploadFile: {
            uploadUrl: "https://storage.example.com/presigned?sig=abc",
            assetUrl: "https://uploads.linear.app/asset/demo.mp4",
            headers: [{ key: "x-goog-meta-owner", value: "linear" }],
          },
        },
      }),
      CreateAttachment: () => ({ attachmentCreate: { success: true } }),
    });
    const { context } = session(linear);

    const exitCode = await attach("INV-12", { files: [join(demoDirectory, "demo.mp4")] }, context);

    expect(exitCode).toBe(0);
    const upload = linear.requests.find((request) => request.method === "PUT");
    expect(upload).toEqual({
      url: "https://storage.example.com/presigned?sig=abc",
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=31536000",
        "x-goog-meta-owner": "linear",
      },
      body: new Uint8Array(videoBytes),
    });
    expect(linear.graphqlRequests().map(({ operation }) => operation)).toEqual([
      "Issue",
      "FileUpload",
      "CreateAttachment",
    ]);
    expect(linear.graphqlRequests()[1]?.variables).toEqual({
      filename: "demo.mp4",
      contentType: "video/mp4",
      size: 5,
    });
    expect(linear.graphqlRequests()[2]?.variables).toEqual({
      input: {
        issueId: "issue-uuid-1",
        url: "https://uploads.linear.app/asset/demo.mp4",
        title: "Demo: Line total updates as quantity changes",
        subtitle: "demo.mp4",
      },
    });
  });

  it("titles an mp4 attachment with its filename when no timeline.json sits beside it", async () => {
    const demoDirectory = scratchDirectory();
    writeFileSync(join(demoDirectory, "clip.mp4"), Buffer.from([9]));
    const linear = fakeLinear({
      Issue: issueResponse(VALID_SPEC),
      FileUpload: () => ({
        fileUpload: {
          success: true,
          uploadFile: {
            uploadUrl: "https://storage.example.com/presigned",
            assetUrl: "https://uploads.linear.app/asset/clip.mp4",
            headers: [],
          },
        },
      }),
      CreateAttachment: () => ({ attachmentCreate: { success: true } }),
    });
    const { context } = session(linear);

    await attach("INV-12", { files: [join(demoDirectory, "clip.mp4")] }, context);

    expect(linear.graphqlRequests()[2]?.variables).toEqual({
      input: {
        issueId: "issue-uuid-1",
        url: "https://uploads.linear.app/asset/clip.mp4",
        title: "clip.mp4",
        subtitle: "clip.mp4",
      },
    });
  });
});
