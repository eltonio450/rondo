// HTTP adapter — the generic reference implementation.
//
// Conforms to the contract in ./CONTRACT.md. POSTs a JSON dispatch payload to
// a URL the installing team controls, and expects `{ agentId, branchName }`
// back. Nothing Cursor-, Claude-, or Codex-specific — any backend a team can
// reach over HTTP works. From the receiver's perspective this looks like a
// webhook (Rondo calls you when a ticket is eligible); from Rondo's side it's
// just an HTTP POST, hence the name.
//
// Shared-secret auth is optional (sent as `X-Rondo-Signature: <secret>`).
// Teams that need HMAC signing can extend this — keep the return shape.

export function createHttpAdapter({ url, secret, fetchImpl = globalThis.fetch }) {
  if (!url) throw new Error("HTTP adapter requires a URL (workflow input `with: http-url`).");

  return {
    backend: "http",

    async dispatch({ repoFullName, ticketFile, suggestedBranch, baseBranch, model, prompt }) {
      const headers = { "Content-Type": "application/json" };
      if (secret) headers["X-Rondo-Signature"] = secret;

      const payload = {
        repo: repoFullName,
        ticket_file: ticketFile,
        suggested_branch: suggestedBranch,
        base_branch: baseBranch,
        model,
        prompt,
      };

      const res = await fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP dispatch failed (${res.status}): ${text}`);
      }
      const data = await res.json();
      const agentId = data.agent_id ?? data.agentId ?? data.id;
      const branchName = data.branch_name ?? data.branchName ?? data.branch ?? suggestedBranch;
      if (!agentId) {
        throw new Error(
          `HTTP dispatch succeeded but the response is missing agent_id. Got: ${JSON.stringify(data)}`,
        );
      }
      return { agentId: String(agentId), branchName: String(branchName) };
    },
  };
}
