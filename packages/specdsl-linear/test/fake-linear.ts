import type { FetchFunction } from "../src/linear.js";

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

export type GraphqlResponder = (variables: Record<string, unknown>) => unknown;

export interface FakeLinear {
  fetch: FetchFunction;
  requests: RecordedRequest[];
  graphqlRequests(): { operation: string; variables: Record<string, unknown> }[];
}

export function fakeLinear(responders: Record<string, GraphqlResponder>): FakeLinear {
  const requests: RecordedRequest[] = [];
  const fetch: FetchFunction = async (input, init) => {
    const url = String(input);
    const rawBody = init?.body;
    const isJson = typeof rawBody === "string";
    requests.push({
      url,
      method: init?.method ?? "GET",
      headers: { ...(init?.headers as Record<string, string>) },
      body: isJson ? JSON.parse(rawBody) : rawBody,
    });
    if (!isJson) {
      return new Response(null, { status: 200 });
    }
    const { query, variables } = JSON.parse(rawBody) as {
      query: string;
      variables: Record<string, unknown>;
    };
    const operation = /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] as string;
    const respond = responders[operation];
    if (respond === undefined) {
      throw new Error(`No canned response for ${operation}`);
    }
    return Response.json({ data: respond(variables) });
  };
  return {
    fetch,
    requests,
    graphqlRequests: () =>
      requests
        .filter((request) => request.url === "https://api.linear.app/graphql")
        .map((request) => {
          const { query, variables } = request.body as {
            query: string;
            variables: Record<string, unknown>;
          };
          return { operation: /(?:query|mutation)\s+(\w+)/.exec(query)?.[1] as string, variables };
        }),
  };
}

export function issueResponse(description: string | null) {
  return () => ({
    issue: {
      id: "issue-uuid-1",
      identifier: "INV-12",
      title: "Invoice line totals",
      description,
      url: "https://linear.app/acme/issue/INV-12",
    },
  });
}
