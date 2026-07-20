import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createAdapter,
  input,
  isDirectExecution,
  main,
  readConfig,
} from "../../action/src/index.mjs";

test("input preserves GitHub Action dashes and supports an underscore alias", () => {
  assert.equal(input("dry-run", "false", { "INPUT_DRY-RUN": "true" }), "true");
  assert.equal(input("dry-run", "false", { INPUT_DRY_RUN: "true" }), "true");
  assert.equal(
    input("dry-run", "false", { "INPUT_DRY-RUN": "false", INPUT_DRY_RUN: "true" }),
    "false",
  );
});

test("readConfig returns validated safe defaults", () => {
  assert.deepEqual(readConfig({ env: {} }), {
    dryRun: false,
    ticketsDir: "tickets",
    branchPrefix: "rondo/",
    baseBranch: "main",
    agentBackend: "cursor-api",
    acceptedModels: undefined,
    httpUrl: undefined,
    httpAllowInsecure: false,
    maxDispatchesPerCycle: 10,
    requestTimeoutMs: 120_000,
  });
});

test("readConfig reads every dashed GitHub input", () => {
  const config = readConfig({
    env: {
      "INPUT_DRY-RUN": "true",
      "INPUT_TICKETS-DIR": "planning/tickets",
      "INPUT_BRANCH-PREFIX": "agents/",
      "INPUT_BASE-BRANCH": "develop",
      "INPUT_AGENT-BACKEND": "http",
      "INPUT_ACCEPTED-MODELS": "provider/model@v2, default",
      "INPUT_HTTP-URL": "https://receiver.example.test/dispatch",
      "INPUT_HTTP-ALLOW-INSECURE": "false",
      "INPUT_MAX-DISPATCHES-PER-CYCLE": "25",
      "INPUT_REQUEST-TIMEOUT-SECONDS": "45",
    },
  });

  assert.deepEqual(config, {
    dryRun: true,
    ticketsDir: "planning/tickets",
    branchPrefix: "agents/",
    baseBranch: "develop",
    agentBackend: "http",
    acceptedModels: ["provider/model@v2", "default"],
    httpUrl: "https://receiver.example.test/dispatch",
    httpAllowInsecure: false,
    maxDispatchesPerCycle: 25,
    requestTimeoutMs: 45_000,
  });
});

test("readConfig rejects unsafe or malformed configuration", () => {
  const cases = [
    [{ "INPUT_DRY-RUN": "yes" }, /dry-run/],
    [{ "INPUT_TICKETS-DIR": "../outside" }, /must not escape/],
    [{ "INPUT_TICKETS-DIR": "tickets\ninjected" }, /relative to the repository root/],
    [{ "INPUT_BRANCH-PREFIX": "rondo" }, /must end/],
    [{ "INPUT_BASE-BRANCH": "bad..branch" }, /valid Git branch/],
    [{ "INPUT_AGENT-BACKEND": "unknown" }, /Unknown agent-backend/],
    [{ "INPUT_MAX-DISPATCHES-PER-CYCLE": "0" }, /between 1 and 1000/],
    [{ "INPUT_REQUEST-TIMEOUT-SECONDS": "0" }, /between 1 and 3600/],
    [{ "INPUT_AGENT-BACKEND": "http" }, /http-url is empty/],
    [
      { "INPUT_AGENT-BACKEND": "http", "INPUT_HTTP-URL": "http://receiver.test" },
      /must use HTTPS/,
    ],
  ];

  for (const [env, expected] of cases) {
    assert.throws(() => readConfig({ env }), expected);
  }
});

test("readConfig allows plain HTTP only with the explicit opt-in", () => {
  const config = readConfig({
    env: {
      "INPUT_AGENT-BACKEND": "http",
      "INPUT_HTTP-URL": "http://receiver.test/hook",
      "INPUT_HTTP-ALLOW-INSECURE": "true",
    },
  });
  assert.equal(config.httpUrl, "http://receiver.test/hook");
  assert.equal(config.httpAllowInsecure, true);
});

test("createAdapter forwards timeout and requires the selected backend credential", () => {
  const config = readConfig({ env: {} });
  assert.throws(() => createAdapter(config, { env: {} }), /CURSOR_API_KEY/);
  const adapter = createAdapter(config, {
    env: { CURSOR_API_KEY: "cursor-secret" },
    fetchImpl: async () => {},
  });
  assert.equal(adapter.backend, "cursor-api");
});

test("main dry-run never instantiates an adapter or requires a backend secret", async () => {
  const calls = [];
  const logs = [];
  const exitCode = await main({
    env: {
      GH_TOKEN: "github-token",
      GITHUB_REPOSITORY: "owner/repo",
      GITHUB_WORKSPACE: "/workspace",
      "INPUT_DRY-RUN": "true",
    },
    nowImpl: () => new Date("2026-07-20T12:00:00Z"),
    log: (line) => logs.push(line),
    ghFactory: (options) => ({ kind: "gh", options }),
    adapterFactory: () => {
      throw new Error("adapter must not be created in dry-run");
    },
    runCycleImpl: async (options) => {
      calls.push(options);
      return { dispatched: [], skipped: [{ slug: "a", reason: "dry" }], failed: [] };
    },
  });

  assert.equal(exitCode, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].adapter, null);
  assert.equal(calls[0].dryRun, true);
  assert.equal(calls[0].today, "2026-07-20");
  assert.equal(calls[0].repoFullName, "owner/repo");
  assert.match(logs.at(-1), /dispatched 0, skipped 1, failed 0/);
});

test("main builds an adapter for a live run and reports dispatch failures", async () => {
  const adapter = { backend: "stub", dispatch: async () => ({}) };
  let adapterCalls = 0;
  const exitCode = await main({
    env: { GH_TOKEN: "github-token", GITHUB_REPOSITORY: "owner/repo" },
    log: () => {},
    ghFactory: () => ({ kind: "gh" }),
    adapterFactory: () => {
      adapterCalls++;
      return adapter;
    },
    runCycleImpl: async (options) => {
      assert.equal(options.adapter, adapter);
      return { dispatched: [], skipped: [], failed: [{ slug: "a", error: "boom" }] };
    },
  });
  assert.equal(adapterCalls, 1);
  assert.equal(exitCode, 2);
});

test("importing index is side-effect free", () => {
  assert.equal(isDirectExecution("file:///tmp/index.mjs", "/tmp/other.mjs"), false);
});
