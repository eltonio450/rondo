// Cursor Background Agents adapter.
//
// Conforms to the contract in ./CONTRACT.md. Payload shape mirrors what is
// sent by Cursor's dashboard "Copy API payload" as of v0 (verified against a
// production caller). If Cursor changes the shape, regenerate from the
// dashboard and diff against this file.
//
// Cursor's API does not carry arbitrary "context" fields, so we prepend a
// small "Runtime inputs" block to the prompt text — that is how the dispatched
// agent sees TICKET_FILE / BRANCH_NAME / BASE_BRANCH.

const CURSOR_API = "https://api.cursor.com/v0";

export function createCursorAdapter({ apiKey, fetchImpl = globalThis.fetch }) {
  if (!apiKey) throw new Error("Cursor adapter requires CURSOR_API_KEY.");

  return {
    backend: "cursor-api",

    async dispatch({ repoFullName, ticketFile, suggestedBranch, baseBranch, model, prompt }) {
      const inputsHeader = [
        "## Runtime inputs",
        "",
        `- TICKET_FILE: ${ticketFile}`,
        `- BRANCH_NAME: ${suggestedBranch}`,
        `- BASE_BRANCH: ${baseBranch}`,
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

      const res = await fetchImpl(`${CURSOR_API}/agents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Cursor dispatch failed (${res.status}): ${text}`);
      }
      const data = await res.json();

      const branchName = data.target?.branchName ?? suggestedBranch;
      const agentId = data.id;
      if (!agentId) {
        throw new Error(`Cursor dispatch succeeded but returned no agent id: ${JSON.stringify(data)}`);
      }
      return { agentId: String(agentId), branchName: String(branchName) };
    },
  };
}
