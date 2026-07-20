// Cursor Background Agents adapter.
//
// Conforms to the contract in ./CONTRACT.md. Payload shape mirrors what is
// sent by Cursor's dashboard "Copy API payload" as of v0 (verified against a
// production caller). If Cursor changes the shape, regenerate from the
// dashboard and diff against this file.
//
// Cursor's API does not carry arbitrary "context" fields, so we prepend a
// small "Runtime inputs" block to the prompt text — that is how the dispatched
// agent sees TICKET_FILE / BRANCH_NAME / BASE_BRANCH / IDEMPOTENCY_KEY.

const CURSOR_API = "https://api.cursor.com/v0";

import { fetchWithTimeout, readErrorBody, readJson } from "../lib/network.mjs";
import {
  assertNonEmptyString,
  assertPositiveInteger,
  assertValidAgentId,
  assertValidBranchName,
  assertValidIdempotencyKey,
  assertValidModel,
  assertValidRepoFullName,
} from "../lib/validation.mjs";

export function createCursorAdapter({
  apiKey,
  requestTimeoutMs = 120_000,
  fetchImpl = globalThis.fetch,
}) {
  assertNonEmptyString(apiKey, "CURSOR_API_KEY");
  assertPositiveInteger(requestTimeoutMs, "requestTimeoutMs");

  return {
    backend: "cursor-api",

    async dispatch({
      repoFullName,
      ticketFile,
      suggestedBranch,
      baseBranch,
      model,
      prompt,
      idempotencyKey,
    }) {
      assertValidRepoFullName(repoFullName);
      assertNonEmptyString(ticketFile, "ticketFile");
      assertValidBranchName(suggestedBranch, "suggestedBranch");
      assertValidBranchName(baseBranch, "baseBranch");
      assertValidModel(model, "model");
      assertNonEmptyString(prompt, "prompt");
      const validatedIdempotencyKey = assertValidIdempotencyKey(idempotencyKey);
      if (!validatedIdempotencyKey) {
        throw new Error("Cursor dispatch requires idempotencyKey.");
      }

      const inputsHeader = [
        "## Runtime inputs",
        "",
        `- TICKET_FILE: ${ticketFile}`,
        `- BRANCH_NAME: ${suggestedBranch}`,
        `- BASE_BRANCH: ${baseBranch}`,
        `- IDEMPOTENCY_KEY: ${validatedIdempotencyKey}`,
        "",
        "---",
        "",
      ].join("\n");

      const payload = {
        prompt: { text: inputsHeader + prompt },
        source: {
          repository: `https://github.com/${repoFullName}`,
          ref: baseBranch,
        },
        target: {
          autoCreatePr: true,
          openAsCursorGithubApp: true,
          branchName: suggestedBranch,
        },
      };
      if (model && model !== "default") payload.model = model;

      // Do not retry this POST: a response can be lost after Cursor has
      // already created the agent.
      const res = await fetchWithTimeout(
        fetchImpl,
        `${CURSOR_API}/agents`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          redirect: "error",
        },
        { timeoutMs: requestTimeoutMs, label: "Cursor dispatch" },
      );

      if (!res.ok) {
        const text = await readErrorBody(res);
        throw new Error(`Cursor dispatch failed (${res.status}): ${text}`);
      }
      const data = await readJson(res, "Cursor dispatch");
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Cursor dispatch returned a JSON value that is not an object.");
      }

      const branchName = data.target?.branchName ?? suggestedBranch;
      const agentId = data.id;
      assertValidAgentId(agentId, "Cursor dispatch response agentId");
      assertValidBranchName(branchName, "Cursor dispatch response branchName");
      return { agentId, branchName };
    },
  };
}
