export type FetchFunction = typeof globalThis.fetch;

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  url: string;
}

export interface AttachmentInput {
  url: string;
  title: string;
  subtitle?: string;
}

export interface FileUploadTarget {
  uploadUrl: string;
  assetUrl: string;
  headers: Record<string, string>;
}

export interface LinearClient {
  issue(identifier: string): Promise<LinearIssue>;
  updateDescription(issueId: string, markdown: string): Promise<void>;
  createComment(issueId: string, body: string): Promise<void>;
  attachmentCreate(issueId: string, attachment: AttachmentInput): Promise<void>;
  fileUpload(filename: string, contentType: string, size: number): Promise<FileUploadTarget>;
  putFile(uploadUrl: string, headers: Record<string, string>, bytes: Uint8Array): Promise<void>;
}

export interface LinearClientOptions {
  apiKey: string;
  fetch: FetchFunction;
}

export const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

interface GraphqlResponse<Data> {
  data?: Data;
  errors?: { message: string }[];
}

interface MutationOutcome {
  success: boolean;
}

const ISSUE_QUERY = `query Issue($id: String!) {
  issue(id: $id) { id identifier title description url }
}`;

const UPDATE_DESCRIPTION_MUTATION = `mutation UpdateDescription($id: String!, $description: String!) {
  issueUpdate(id: $id, input: { description: $description }) { success }
}`;

const CREATE_COMMENT_MUTATION = `mutation CreateComment($issueId: String!, $body: String!) {
  commentCreate(input: { issueId: $issueId, body: $body }) { success }
}`;

const CREATE_ATTACHMENT_MUTATION = `mutation CreateAttachment($input: AttachmentCreateInput!) {
  attachmentCreate(input: $input) { success }
}`;

const FILE_UPLOAD_MUTATION = `mutation FileUpload($filename: String!, $contentType: String!, $size: Int!) {
  fileUpload(filename: $filename, contentType: $contentType, size: $size) {
    success
    uploadFile { uploadUrl assetUrl headers { key value } }
  }
}`;

/** Creates a Linear GraphQL client that sends every request through the given fetch. */
export function createLinearClient(options: LinearClientOptions): LinearClient {
  async function request<Data>(query: string, variables: Record<string, unknown>): Promise<Data> {
    const response = await options.fetch(LINEAR_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: options.apiKey },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) {
      throw new Error(`Linear request failed: ${response.status} ${response.statusText}`);
    }
    const payload = (await response.json()) as GraphqlResponse<Data>;
    if (payload.errors !== undefined && payload.errors.length > 0) {
      throw new Error(`Linear request failed: ${payload.errors.map((e) => e.message).join("; ")}`);
    }
    if (payload.data === undefined) {
      throw new Error("Linear request failed: response has no data");
    }
    return payload.data;
  }

  async function mutate(
    field: string,
    query: string,
    variables: Record<string, unknown>,
  ): Promise<void> {
    const data = await request<Record<string, MutationOutcome>>(query, variables);
    if (data[field]?.success !== true) {
      throw new Error(`Linear ${field} was not successful`);
    }
  }

  return {
    async issue(identifier) {
      const data = await request<{ issue: LinearIssue | null }>(ISSUE_QUERY, { id: identifier });
      if (data.issue === null) {
        throw new Error(`Linear issue ${identifier} not found`);
      }
      return data.issue;
    },

    updateDescription(issueId, markdown) {
      return mutate("issueUpdate", UPDATE_DESCRIPTION_MUTATION, {
        id: issueId,
        description: markdown,
      });
    },

    createComment(issueId, body) {
      return mutate("commentCreate", CREATE_COMMENT_MUTATION, { issueId, body });
    },

    attachmentCreate(issueId, attachment) {
      return mutate("attachmentCreate", CREATE_ATTACHMENT_MUTATION, {
        input: { issueId, ...attachment },
      });
    },

    async fileUpload(filename, contentType, size) {
      const data = await request<{
        fileUpload: {
          success: boolean;
          uploadFile: {
            uploadUrl: string;
            assetUrl: string;
            headers: { key: string; value: string }[];
          } | null;
        };
      }>(FILE_UPLOAD_MUTATION, { filename, contentType, size });
      const { uploadFile } = data.fileUpload;
      if (!data.fileUpload.success || uploadFile === null) {
        throw new Error(`Linear fileUpload was not successful for ${filename}`);
      }
      return {
        uploadUrl: uploadFile.uploadUrl,
        assetUrl: uploadFile.assetUrl,
        headers: Object.fromEntries(uploadFile.headers.map(({ key, value }) => [key, value])),
      };
    },

    async putFile(uploadUrl, headers, bytes) {
      const response = await options.fetch(uploadUrl, {
        method: "PUT",
        headers,
        body: new Uint8Array(bytes),
      });
      if (!response.ok) {
        throw new Error(`File upload failed: ${response.status} ${response.statusText}`);
      }
    },
  };
}
