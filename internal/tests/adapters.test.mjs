import { createHmac } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";

import { createCursorAdapter } from "../../action/src/adapters/cursor-api.mjs";
import { createHttpAdapter } from "../../action/src/adapters/http.mjs";

const IDEMPOTENCY_KEY = "a".repeat(64);
const DISPATCH_INPUT = {
  repoFullName: "owner/repo",
  ticketFile: "tickets/example.md",
  suggestedBranch: "rondo/example",
  baseBranch: "main",
  model: "default",
  prompt: "Do the next safe step.",
  idempotencyKey: IDEMPOTENCY_KEY,
};

function response(status, data, { headers = {}, rawText } = {}) {
  const body = rawText ?? JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[name.toLowerCase()] ?? null },
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

test("HTTP adapter sends exact payload, idempotency key, and deterministic HMAC", async () => {
  const calls = [];
  const adapter = createHttpAdapter({
    url: "https://receiver.example.test/dispatch",
    secret: "shared-secret",
    nowImpl: () => 1_700_000_000_000,
    fetchImpl: async (...args) => {
      calls.push(args);
      return response(202, { agent_id: "agent-1", branch_name: "agents/example" });
    },
  });

  assert.deepEqual(await adapter.dispatch(DISPATCH_INPUT), {
    agentId: "agent-1",
    branchName: "agents/example",
  });
  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.equal(url, "https://receiver.example.test/dispatch");
  assert.equal(options.method, "POST");
  assert.equal(options.redirect, "error");
  assert.ok(options.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(options.body), {
    repo: "owner/repo",
    ticket_file: "tickets/example.md",
    suggested_branch: "rondo/example",
    base_branch: "main",
    model: "default",
    prompt: "Do the next safe step.",
    idempotency_key: IDEMPOTENCY_KEY,
  });
  assert.equal(options.headers["Idempotency-Key"], IDEMPOTENCY_KEY);
  assert.equal(options.headers["X-Rondo-Timestamp"], "1700000000");
  const expected = createHmac("sha256", "shared-secret")
    .update(`1700000000.${options.body}`)
    .digest("hex");
  assert.equal(options.headers["X-Rondo-Signature"], `sha256=${expected}`);
});

test("HTTP adapter requires HTTPS unless explicitly opted into plain HTTP", () => {
  assert.throws(
    () => createHttpAdapter({ url: "http://receiver.test", fetchImpl: async () => {} }),
    /must use HTTPS/,
  );
  assert.equal(
    createHttpAdapter({
      url: "http://receiver.test",
      allowInsecure: true,
      fetchImpl: async () => {},
    }).backend,
    "http",
  );
  assert.throws(
    () => createHttpAdapter({ url: "https://user:pass@receiver.test" }),
    /embedded credentials/,
  );
  assert.throws(
    () => createHttpAdapter({ url: "http://receiver.test", allowInsecure: "true" }),
    /must be a boolean/,
  );
});

test("HTTP adapter treats an empty optional secret as absent", async () => {
  let headers;
  const adapter = createHttpAdapter({
    url: "https://receiver.test",
    secret: "",
    fetchImpl: async (_url, options) => {
      headers = options.headers;
      return response(200, { agent_id: "agent", branch_name: "rondo/example" });
    },
  });
  await adapter.dispatch(DISPATCH_INPUT);
  assert.equal(headers["X-Rondo-Timestamp"], undefined);
  assert.equal(headers["X-Rondo-Signature"], undefined);
});

test("HTTP adapter requires a valid idempotency key before sending", async () => {
  let calls = 0;
  const adapter = createHttpAdapter({
    url: "https://receiver.test",
    fetchImpl: async () => {
      calls++;
      return response(200, {});
    },
  });
  await assert.rejects(() => adapter.dispatch({ ...DISPATCH_INPUT, idempotencyKey: undefined }), /requires idempotencyKey/);
  await assert.rejects(() => adapter.dispatch({ ...DISPATCH_INPUT, idempotencyKey: "ABC" }), /SHA-256/);
  assert.equal(calls, 0);
});

test("HTTP adapter rejects missing, empty, or non-string result fields", async (t) => {
  const cases = [
    [{ branch_name: "rondo/example" }, /agentId/],
    [{ agent_id: "", branch_name: "rondo/example" }, /agentId/],
    [{ agent_id: " agent ", branch_name: "rondo/example" }, /agentId/],
    [{ agent_id: "agent\nforged", branch_name: "rondo/example" }, /agentId/],
    [{ agent_id: 42, branch_name: "rondo/example" }, /agentId/],
    [{ agent_id: "agent" }, /branchName/],
    [{ agent_id: "agent", branch_name: "" }, /branchName/],
    [{ agent_id: "agent", branch_name: { name: "rondo/example" } }, /branchName/],
  ];
  for (const [data, expected] of cases) {
    await t.test(JSON.stringify(data), async () => {
      const adapter = createHttpAdapter({
        url: "https://receiver.test",
        fetchImpl: async () => response(200, data),
      });
      await assert.rejects(() => adapter.dispatch(DISPATCH_INPUT), expected);
    });
  }
});

test("HTTP adapter does not retry a failed dispatch POST", async () => {
  let calls = 0;
  const adapter = createHttpAdapter({
    url: "https://receiver.test",
    fetchImpl: async () => {
      calls++;
      return response(503, { error: "temporarily unavailable" });
    },
  });
  await assert.rejects(() => adapter.dispatch(DISPATCH_INPUT), /503/);
  assert.equal(calls, 1);
});

test("HTTP adapter keeps untrusted error bodies on one log line", async () => {
  const adapter = createHttpAdapter({
    url: "https://receiver.test",
    fetchImpl: async () => response(400, null, {
      rawText: "bad request\n::add-mask::attacker-controlled",
    }),
  });
  await assert.rejects(
    () => adapter.dispatch(DISPATCH_INPUT),
    (error) =>
      !error.message.includes("\n") &&
      error.message.includes("bad request\\n::add-mask::attacker-controlled"),
  );
});

test("HTTP adapter aborts a hanging request", async () => {
  const adapter = createHttpAdapter({
    url: "https://receiver.test",
    requestTimeoutMs: 10,
    fetchImpl: async (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }),
  });
  await assert.rejects(() => adapter.dispatch(DISPATCH_INPUT), /timed out after 10ms/);
});

test("HTTP adapter reports invalid JSON without echoing request secrets", async () => {
  const adapter = createHttpAdapter({
    url: "https://receiver.test",
    secret: "do-not-log-me",
    fetchImpl: async () => response(200, null, { rawText: "not-json" }),
  });
  await assert.rejects(
    () => adapter.dispatch(DISPATCH_INPUT),
    (error) => error.message.includes("invalid JSON") && !error.message.includes("do-not-log-me"),
  );
});

test("Cursor adapter sends the documented v0 payload and normalizes the result", async () => {
  const calls = [];
  const adapter = createCursorAdapter({
    apiKey: "cursor-key",
    fetchImpl: async (...args) => {
      calls.push(args);
      return response(201, { id: "cursor-agent", target: { branchName: "cursor/generated" } });
    },
  });
  assert.deepEqual(await adapter.dispatch(DISPATCH_INPUT), {
    agentId: "cursor-agent",
    branchName: "cursor/generated",
  });
  assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.equal(url, "https://api.cursor.com/v0/agents");
  assert.equal(options.headers.Authorization, "Bearer cursor-key");
  assert.equal(options.redirect, "error");
  const payload = JSON.parse(options.body);
  assert.equal(payload.source.repository, "https://github.com/owner/repo");
  assert.equal(payload.source.ref, "main");
  assert.equal(payload.target.branchName, "rondo/example");
  assert.equal(payload.target.autoCreatePr, true);
  assert.equal(payload.model, undefined);
  assert.match(payload.prompt.text, /TICKET_FILE: tickets\/example\.md/);
  assert.match(payload.prompt.text, new RegExp(`IDEMPOTENCY_KEY: ${IDEMPOTENCY_KEY}`));
});

test("Cursor adapter forwards a non-default model", async () => {
  let payload;
  const adapter = createCursorAdapter({
    apiKey: "cursor-key",
    fetchImpl: async (_url, options) => {
      payload = JSON.parse(options.body);
      return response(201, { id: "agent", target: { branchName: "rondo/example" } });
    },
  });
  await adapter.dispatch({ ...DISPATCH_INPUT, model: "provider/model@v2" });
  assert.equal(payload.model, "provider/model@v2");
});

test("Cursor adapter validates an idempotency key before dispatch", async () => {
  let calls = 0;
  const adapter = createCursorAdapter({
    apiKey: "cursor-key",
    fetchImpl: async () => {
      calls++;
      return response(201, { id: "agent", target: { branchName: "rondo/example" } });
    },
  });
  await assert.rejects(
    () => adapter.dispatch({ ...DISPATCH_INPUT, idempotencyKey: undefined }),
    /requires idempotencyKey/,
  );
  await assert.rejects(
    () => adapter.dispatch({ ...DISPATCH_INPUT, idempotencyKey: "not-a-sha256" }),
    /SHA-256/,
  );
  assert.equal(calls, 0);
});

test("Cursor adapter rejects wrong-type response fields and present empty branches", async (t) => {
  const cases = [
    [{ target: { branchName: "rondo/example" } }, /agentId/],
    [{ id: 42, target: { branchName: "rondo/example" } }, /agentId/],
    [{ id: " agent ", target: { branchName: "rondo/example" } }, /agentId/],
    [{ id: "agent", target: { branchName: "" } }, /branchName/],
    [{ id: "agent", target: { branchName: {} } }, /branchName/],
  ];
  for (const [data, expected] of cases) {
    await t.test(JSON.stringify(data), async () => {
      const adapter = createCursorAdapter({
        apiKey: "cursor-key",
        fetchImpl: async () => response(200, data),
      });
      await assert.rejects(() => adapter.dispatch(DISPATCH_INPUT), expected);
    });
  }
});

test("Cursor adapter does not retry and aborts a hanging POST", async () => {
  let calls = 0;
  const failing = createCursorAdapter({
    apiKey: "cursor-key",
    fetchImpl: async () => {
      calls++;
      return response(503, { error: "busy" });
    },
  });
  await assert.rejects(() => failing.dispatch(DISPATCH_INPUT), /503/);
  assert.equal(calls, 1);

  const hanging = createCursorAdapter({
    apiKey: "cursor-key",
    requestTimeoutMs: 10,
    fetchImpl: async (_url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }),
  });
  await assert.rejects(() => hanging.dispatch(DISPATCH_INPUT), /timed out after 10ms/);
});
