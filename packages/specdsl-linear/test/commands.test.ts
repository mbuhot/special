import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { attach, buildLintComment, lint, pull, type CommandContext } from "../src/commands.js";
import { createLinearClient } from "../src/linear.js";
import { fakeLinear, issueResponse, type FakeLinear } from "./fake-linear.js";

const DIALECT_PATH = resolve(import.meta.dirname, "../../../dialects/invoicing.ts");

const VALID_SPEC = readFileSync(
  resolve(import.meta.dirname, "../../../specs/invoicing.md"),
  "utf8",
);

const SPEC_WITH_UNKNOWN_CONTROL = VALID_SPEC.replace(
  'Accounts clicks "Send"',
  'Accounts clicks "Teleport"',
);

const SPEC_WARNINGS_COMMENT = [
  "Spec check: 0 errors, 5 warnings",
  "",
  "- INV-12:6: warning: Transition Invoice.status:sent->paid is not covered by any TransitionUse",
  "- INV-12:6: warning: Transition Invoice.status:draft->void is not covered by any TransitionUse",
  "- INV-12:10: warning: Control Invoice list/Invoices is not referenced by any step",
  "- INV-12:10: warning: Control Invoice list/New invoice is not referenced by any step",
  "- INV-12:11: warning: Control Invoice editor/Unit price is not referenced by any step",
].join("\n");

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

describe("pull", () => {
  it("writes the spec file and reports a bind error with the issue identifier and line for an unknown control", async () => {
    const outDir = scratchDirectory();
    const { context, errors } = session(
      fakeLinear({
        Issue: issueResponse(`Context\n\n\`\`\`spec\n${SPEC_WITH_UNKNOWN_CONTROL}\n\`\`\`\n`),
      }),
    );

    const exitCode = await pull("INV-12", { dialectPath: DIALECT_PATH, outDir }, context);

    expect(readFileSync(join(outDir, "INV-12.md"), "utf8")).toBe(`${SPEC_WITH_UNKNOWN_CONTROL}\n`);
    expect(exitCode).toBe(1);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(new RegExp(`^INV-12:${unknownControlLine()}: error: .*Teleport`));
  });

  it("exits zero when the spec binds", async () => {
    const { context } = session(fakeLinear({ Issue: issueResponse(VALID_SPEC) }));

    const exitCode = await pull(
      "INV-12",
      { dialectPath: DIALECT_PATH, outDir: scratchDirectory() },
      context,
    );

    expect(exitCode).toBe(0);
  });
});

describe("lint", () => {
  it("posts one comment listing the spec warnings", async () => {
    const linear = fakeLinear({
      Issue: issueResponse(VALID_SPEC),
      CreateComment: () => ({ commentCreate: { success: true } }),
    });
    const { context } = session(linear);

    const exitCode = await lint("INV-12", { dialectPath: DIALECT_PATH, comment: true }, context);

    expect(exitCode).toBe(0);
    expect(
      linear.graphqlRequests().filter(({ operation }) => operation === "CreateComment"),
    ).toEqual([
      {
        operation: "CreateComment",
        variables: { issueId: "issue-uuid-1", body: SPEC_WARNINGS_COMMENT },
      },
    ]);
  });

  it("posts nothing when comment is off", async () => {
    const linear = fakeLinear({ Issue: issueResponse(VALID_SPEC) });
    const { context } = session(linear);

    await lint("INV-12", { dialectPath: DIALECT_PATH, comment: false }, context);

    expect(linear.graphqlRequests().map(({ operation }) => operation)).toEqual(["Issue"]);
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
