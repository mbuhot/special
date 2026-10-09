import { describe, expect, it } from "vitest";
import { createLinearClient } from "../src/linear.js";
import { fakeLinear, issueResponse } from "./fake-linear.js";

describe("linear client", () => {
  it("sends the API key as the Authorization header and returns the issue", async () => {
    const linear = fakeLinear({ Issue: issueResponse("# Spec") });
    const client = createLinearClient({ apiKey: "lin_api_test", fetch: linear.fetch });

    const issue = await client.issue("INV-12");

    expect(issue).toEqual({
      id: "issue-uuid-1",
      identifier: "INV-12",
      title: "Invoice line totals",
      description: "# Spec",
      url: "https://linear.app/acme/issue/INV-12",
    });
    expect(linear.requests[0]?.headers["Authorization"]).toBe("lin_api_test");
    expect(linear.graphqlRequests()).toEqual([{ operation: "Issue", variables: { id: "INV-12" } }]);
  });

  it("updates an issue description", async () => {
    const linear = fakeLinear({ UpdateDescription: () => ({ issueUpdate: { success: true } }) });
    const client = createLinearClient({ apiKey: "lin_api_test", fetch: linear.fetch });

    await client.updateDescription("issue-uuid-1", "# New spec");

    expect(linear.graphqlRequests()).toEqual([
      {
        operation: "UpdateDescription",
        variables: { id: "issue-uuid-1", description: "# New spec" },
      },
    ]);
  });

  it("rejects when the API returns GraphQL errors", async () => {
    const fetch = async () => Response.json({ errors: [{ message: "Entity not found" }] });
    const client = createLinearClient({ apiKey: "lin_api_test", fetch });

    await expect(client.issue("INV-99")).rejects.toThrow("Linear request failed: Entity not found");
  });
});
