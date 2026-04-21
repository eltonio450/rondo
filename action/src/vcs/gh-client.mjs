// Thin GitHub REST wrapper. Uses Node 20 built-in fetch — no deps.
// Skeletal: the installing agent is expected to verify request shapes against
// GitHub's REST docs and adjust as needed. Each function carries its
// canonical endpoint and any pitfalls Rondo has hit in production.

const API = "https://api.github.com";

export function createGhClient({ token, owner, repo, fetchImpl = globalThis.fetch }) {
  if (!token) throw new Error("GH client requires a token (process.env.GH_TOKEN).");

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "rondo-action",
  };

  async function req(method, path, body) {
    const res = await fetchImpl(`${API}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`GH ${method} ${path} → ${res.status}: ${text}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  return {
    /** List open Issues carrying a given label. Direct REST (not Search) so
     *  results are strongly consistent — the runner relies on this to find
     *  the registry Issue (label: rondo-registry) right after creating it.
     *  Endpoint: GET /repos/{owner}/{repo}/issues?labels=<label>&state=open */
    async listIssuesByLabel(label, { state = "open", perPage = 100 } = {}) {
      const url = `/repos/${owner}/${repo}/issues?labels=${encodeURIComponent(label)}&state=${state}&per_page=${perPage}`;
      const data = await req("GET", url);
      // The Issues endpoint returns PRs too — filter them out.
      return (data || []).filter((it) => !it.pull_request);
    },

    /** All open PRs on the repo, paginated.
     *  Endpoint: GET /repos/{owner}/{repo}/pulls?state=open */
    async listAllOpenPRs() {
      const out = [];
      let page = 1;
      for (;;) {
        const url = `/repos/${owner}/${repo}/pulls?state=open&per_page=100&page=${page}`;
        const batch = await req("GET", url);
        if (!Array.isArray(batch) || batch.length === 0) break;
        out.push(...batch);
        if (batch.length < 100) break;
        page += 1;
      }
      return out;
    },

    async createIssue({ title, body, labels, assignees = [] }) {
      return req("POST", `/repos/${owner}/${repo}/issues`, { title, body, labels, assignees });
    },

    async updateIssueBody(issueNumber, body) {
      return req("PATCH", `/repos/${owner}/${repo}/issues/${issueNumber}`, { body });
    },
  };
}
