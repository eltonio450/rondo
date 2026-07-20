// Thin, tested GitHub REST port. Uses Node's built-in fetch and keeps remote
// API assumptions isolated here; see ./CONTRACT.md for the runner-facing
// behavior and failure semantics.

const API = "https://api.github.com";

import { fetchWithTimeout, readErrorBody, readJson } from "../lib/network.mjs";
import {
  assertNonEmptyString,
  assertPositiveInteger,
  assertValidRepoFullName,
} from "../lib/validation.mjs";

const DEFAULT_RETRY_BASE_MS = 250;

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createGhClient({
  token,
  owner,
  repo,
  requestTimeoutMs = 120_000,
  maxRetries = 2,
  retryBaseMs = DEFAULT_RETRY_BASE_MS,
  fetchImpl = globalThis.fetch,
  sleepImpl = defaultSleep,
}) {
  assertNonEmptyString(token, "GH_TOKEN");
  assertValidRepoFullName(`${owner}/${repo}`, "GitHub repository");
  assertPositiveInteger(requestTimeoutMs, "requestTimeoutMs");
  assertPositiveInteger(maxRetries, "maxRetries", { min: 0, max: 5 });
  assertPositiveInteger(retryBaseMs, "retryBaseMs", { min: 0, max: 30_000 });
  if (typeof sleepImpl !== "function") throw new Error("sleepImpl must be a function.");

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "rondo-action",
  };

  async function req(method, path, body, { retryable = method === "GET" || method === "PATCH" } = {}) {
    const hasBody = body !== undefined;
    const requestHeaders = hasBody ? { ...headers, "Content-Type": "application/json" } : headers;

    for (let attempt = 0; ; attempt++) {
      let res;
      try {
        res = await fetchWithTimeout(
          fetchImpl,
          `${API}${path}`,
          {
            method,
            headers: requestHeaders,
            body: hasBody ? JSON.stringify(body) : undefined,
            redirect: "error",
          },
          { timeoutMs: requestTimeoutMs, label: `GitHub ${method} ${path}` },
        );
      } catch (error) {
        if (retryable && attempt < maxRetries) {
          await sleepImpl(Math.min(retryBaseMs * 2 ** attempt, 5_000));
          continue;
        }
        throw new Error(`GH ${method} ${path} failed: ${error.message}`, { cause: error });
      }

      const retryAfter = res.headers?.get?.("retry-after");
      const transient =
        res.status === 429 ||
        res.status >= 500 ||
        (res.status === 403 && retryAfter !== undefined && retryAfter !== null);
      if (!res.ok && retryable && transient && attempt < maxRetries) {
        await res.text().catch(() => "");
        const retryAfterSeconds = retryAfter === null || retryAfter === undefined || retryAfter.trim() === ""
          ? Number.NaN
          : Number(retryAfter);
        const delay = Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
          ? Math.min(retryAfterSeconds * 1_000, 30_000)
          : Math.min(retryBaseMs * 2 ** attempt, 5_000);
        await sleepImpl(delay);
        continue;
      }

      if (!res.ok) {
        const text = await readErrorBody(res);
        throw new Error(`GH ${method} ${path} → ${res.status}: ${text}`);
      }
      if (res.status === 204) return null;
      return readJson(res, `GitHub ${method} ${path}`);
    }
  }

  return {
    /** List open Issues carrying a given label. Direct REST (not Search) so
     *  results are strongly consistent — the runner relies on this to find
     *  the registry Issue (label: rondo-registry) right after creating it.
     *  Endpoint: GET /repos/{owner}/{repo}/issues?labels=<label>&state=open */
    async listIssuesByLabel(label, { state = "open", perPage = 100 } = {}) {
      assertNonEmptyString(label, "label");
      if (!["open", "closed", "all"].includes(state)) {
        throw new Error('state must be one of "open", "closed", or "all".');
      }
      assertPositiveInteger(perPage, "perPage", { min: 1, max: 100 });
      const url = `/repos/${owner}/${repo}/issues?labels=${encodeURIComponent(label)}&state=${encodeURIComponent(state)}&per_page=${perPage}`;
      const data = await req("GET", url);
      if (!Array.isArray(data)) throw new Error("GitHub issues response must be an array.");
      // The Issues endpoint returns PRs too — filter them out.
      return data.filter((it) => !it.pull_request);
    },

    /** All open PRs on the repo, paginated.
     *  Endpoint: GET /repos/{owner}/{repo}/pulls?state=open */
    async listAllOpenPRs() {
      const out = [];
      let page = 1;
      for (;;) {
        const url = `/repos/${owner}/${repo}/pulls?state=open&per_page=100&page=${page}`;
        const batch = await req("GET", url);
        if (!Array.isArray(batch)) throw new Error("GitHub pulls response must be an array.");
        if (batch.length === 0) break;
        out.push(...batch);
        if (batch.length < 100) break;
        page += 1;
      }
      return out;
    },

    async createIssue({ title, body, labels, assignees = [] }) {
      return req(
        "POST",
        `/repos/${owner}/${repo}/issues`,
        { title, body, labels, assignees },
        { retryable: false },
      );
    },

    async updateIssueBody(issueNumber, body) {
      assertPositiveInteger(issueNumber, "issueNumber");
      return req("PATCH", `/repos/${owner}/${repo}/issues/${issueNumber}`, { body });
    },
  };
}
