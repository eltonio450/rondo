// HTTP adapter — the generic reference implementation.
//
// Conforms to the contract in ./CONTRACT.md. POSTs a JSON dispatch payload to
// a URL the installing team controls, and expects `{ agentId, branchName }`
// back. Nothing Cursor-, Claude-, or Codex-specific — any backend a team can
// reach over HTTP works. From the receiver's perspective this looks like a
// webhook (Rondo calls you when a ticket is eligible); from Rondo's side it's
// just an HTTP POST, hence the name.
//
// Shared-secret auth is optional. When configured, the adapter signs
// `<unix-timestamp>.<raw-json-body>` with HMAC-SHA256.

import { createHmac } from "node:crypto";

import { fetchWithTimeout, readErrorBody, readJson } from "../lib/network.mjs";
import {
  assertNonEmptyString,
  assertPositiveInteger,
  assertValidAgentId,
  assertValidBranchName,
  assertValidIdempotencyKey,
  assertValidModel,
  assertValidRepoFullName,
  validateHttpEndpoint,
} from "../lib/validation.mjs";

export function createHttpAdapter({
  url,
  secret,
  allowInsecure = false,
  requestTimeoutMs = 120_000,
  fetchImpl = globalThis.fetch,
  nowImpl = Date.now,
}) {
  const endpoint = validateHttpEndpoint(url, { allowInsecure });
  let signingSecret;
  if (secret !== undefined && secret !== "") {
    signingSecret = assertNonEmptyString(secret, "RONDO_HTTP_SECRET");
  }
  assertPositiveInteger(requestTimeoutMs, "requestTimeoutMs");
  if (typeof nowImpl !== "function") throw new Error("nowImpl must be a function.");

  return {
    backend: "http",

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
        throw new Error("HTTP dispatch requires idempotencyKey.");
      }

      const headers = { "Content-Type": "application/json" };

      const payload = {
        repo: repoFullName,
        ticket_file: ticketFile,
        suggested_branch: suggestedBranch,
        base_branch: baseBranch,
        model,
        prompt,
      };
      payload.idempotency_key = validatedIdempotencyKey;
      headers["Idempotency-Key"] = validatedIdempotencyKey;
      const body = JSON.stringify(payload);

      if (signingSecret) {
        const now = Number(nowImpl());
        if (!Number.isFinite(now) || now < 0) {
          throw new Error("nowImpl must return a valid epoch timestamp.");
        }
        const timestamp = String(Math.floor(now / 1000));
        const digest = createHmac("sha256", signingSecret)
          .update(`${timestamp}.${body}`)
          .digest("hex");
        headers["X-Rondo-Timestamp"] = timestamp;
        headers["X-Rondo-Signature"] = `sha256=${digest}`;
      }

      // A dispatch is not safe to replay blindly: the receiver may have
      // launched an agent even when its response was lost. The idempotency key
      // lets the receiver deduplicate, but this adapter still performs one POST.
      const res = await fetchWithTimeout(
        fetchImpl,
        endpoint,
        {
          method: "POST",
          headers,
          body,
          redirect: "error",
        },
        { timeoutMs: requestTimeoutMs, label: "HTTP dispatch" },
      );

      if (!res.ok) {
        const text = await readErrorBody(res);
        throw new Error(`HTTP dispatch failed (${res.status}): ${text}`);
      }
      const data = await readJson(res, "HTTP dispatch");
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("HTTP dispatch returned a JSON value that is not an object.");
      }
      const agentId = data.agent_id ?? data.agentId ?? data.id;
      const branchName = data.branch_name ?? data.branchName ?? data.branch;
      assertValidAgentId(agentId, "HTTP dispatch response agentId");
      assertValidBranchName(branchName, "HTTP dispatch response branchName");
      return { agentId, branchName };
    },
  };
}
