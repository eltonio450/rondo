import { test } from "node:test";
import assert from "node:assert/strict";

import { createGhClient } from "../../action/src/vcs/gh-client.mjs";

function response(status, data, { headers = {}, rawText } = {}) {
  const body = rawText ?? JSON.stringify(data);
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => normalizedHeaders[name.toLowerCase()] ?? null },
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

function client(overrides = {}) {
  return createGhClient({
    token: "github-token",
    owner: "owner",
    repo: "repo",
    ...overrides,
  });
}

test("GitHub client validates credentials and repository identity", () => {
  assert.throws(() => createGhClient({ owner: "owner", repo: "repo" }), /GH_TOKEN/);
  assert.throws(
    () => createGhClient({ token: "token", owner: "bad/owner", repo: "repo" }),
    /owner\/repo/,
  );
});

test("listIssuesByLabel encodes inputs, sends required headers, and removes PRs", async () => {
  const calls = [];
  const gh = client({
    fetchImpl: async (...args) => {
      calls.push(args);
      return response(200, [
        { number: 1, title: "registry" },
        { number: 2, pull_request: { url: "pr" } },
      ]);
    },
  });
  assert.deepEqual(await gh.listIssuesByLabel("rondo registry"), [
    { number: 1, title: "registry" },
  ]);
  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.equal(
    url,
    "https://api.github.com/repos/owner/repo/issues?labels=rondo%20registry&state=open&per_page=100",
  );
  assert.equal(options.method, "GET");
  assert.equal(options.headers.Authorization, "Bearer github-token");
  assert.equal(options.headers.Accept, "application/vnd.github+json");
  assert.equal(options.redirect, "error");
  assert.ok(options.signal instanceof AbortSignal);
});

test("listAllOpenPRs paginates until a short page", async () => {
  const urls = [];
  const firstPage = Array.from({ length: 100 }, (_, index) => ({ number: index + 1 }));
  const gh = client({
    fetchImpl: async (url) => {
      urls.push(url);
      return urls.length === 1 ? response(200, firstPage) : response(200, [{ number: 101 }]);
    },
  });
  const prs = await gh.listAllOpenPRs();
  assert.equal(prs.length, 101);
  assert.match(urls[0], /page=1$/);
  assert.match(urls[1], /page=2$/);
});

test("GitHub client retries safe GET requests on transient responses", async () => {
  let calls = 0;
  const delays = [];
  const gh = client({
    retryBaseMs: 7,
    sleepImpl: async (ms) => delays.push(ms),
    fetchImpl: async () => {
      calls++;
      return calls === 1
        ? response(503, { message: "busy" })
        : response(200, []);
    },
  });
  assert.deepEqual(await gh.listIssuesByLabel("rondo-registry"), []);
  assert.equal(calls, 2);
  assert.deepEqual(delays, [7]);
});

test("GitHub client respects Retry-After on safe requests", async () => {
  let calls = 0;
  const delays = [];
  const gh = client({
    sleepImpl: async (ms) => delays.push(ms),
    fetchImpl: async () => {
      calls++;
      return calls === 1
        ? response(429, { message: "slow down" }, { headers: { "retry-after": "2" } })
        : response(200, []);
    },
  });
  await gh.listIssuesByLabel("rondo-registry");
  assert.equal(calls, 2);
  assert.deepEqual(delays, [2_000]);
});

test("updateIssueBody retries PATCH because writing the same body is idempotent", async () => {
  const calls = [];
  const gh = client({
    sleepImpl: async () => {},
    fetchImpl: async (_url, options) => {
      calls.push(options);
      return calls.length === 1
        ? response(502, { message: "gateway" })
        : response(200, { number: 7, body: "new body" });
    },
  });
  assert.deepEqual(await gh.updateIssueBody(7, "new body"), { number: 7, body: "new body" });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].headers["Content-Type"], "application/json");
  assert.equal(calls[1].body, JSON.stringify({ body: "new body" }));
});

test("createIssue never retries its non-idempotent POST", async () => {
  let calls = 0;
  const gh = client({
    sleepImpl: async () => assert.fail("POST must not sleep for a retry"),
    fetchImpl: async () => {
      calls++;
      return response(503, { message: "ambiguous failure" });
    },
  });
  await assert.rejects(
    () => gh.createIssue({ title: "registry", body: "body", labels: ["rondo-registry"] }),
    /503/,
  );
  assert.equal(calls, 1);
});

test("GitHub client aborts hanging requests after the configured timeout", async () => {
  const gh = client({
    maxRetries: 0,
    requestTimeoutMs: 10,
    fetchImpl: async (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }),
  });
  await assert.rejects(() => gh.listIssuesByLabel("rondo-registry"), /timed out after 10ms/);
});

test("GitHub client reports invalid JSON and truncates remote error bodies", async () => {
  const invalidJson = client({
    maxRetries: 0,
    fetchImpl: async () => response(200, null, { rawText: "not-json" }),
  });
  await assert.rejects(() => invalidJson.listIssuesByLabel("label"), /invalid JSON/);

  const hugeError = client({
    maxRetries: 0,
    fetchImpl: async () => response(400, null, { rawText: "x".repeat(10_000) }),
  });
  await assert.rejects(
    () => hugeError.listIssuesByLabel("label"),
    (error) => error.message.length < 5_000 && error.message.includes("truncated"),
  );
});

test("GitHub client validates list and issue parameters", async () => {
  const gh = client({ fetchImpl: async () => response(200, []) });
  await assert.rejects(() => gh.listIssuesByLabel("label", { state: "invalid" }), /state/);
  await assert.rejects(() => gh.listIssuesByLabel("label", { perPage: 101 }), /perPage/);
  await assert.rejects(() => gh.updateIssueBody(0, "body"), /issueNumber/);
});
