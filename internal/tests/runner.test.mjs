import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { runCycle } from "../../action/src/core/runner.mjs";
import { parseRegistry, renderRegistry } from "../../action/src/core/registry.mjs";

const baseConfig = {
  ticketsDir: "tickets",
  branchPrefix: "rondo/",
  baseBranch: "main",
  acceptedModels: undefined,
  maxDispatchesPerCycle: 10,
};

function ticketContent({ priority = 2, extra = "", body = "# Ticket\n" } = {}) {
  return `owner: alice\npriority: ${priority}\nmodel: default\n${extra}\n${body}`;
}

function createRepo(t, tickets) {
  const repoRoot = mkdtempSync(join(tmpdir(), "rondo-runner-"));
  const ticketsDir = join(repoRoot, "tickets");
  mkdirSync(ticketsDir);
  for (const [slug, content] of Object.entries(tickets)) {
    writeFileSync(join(ticketsDir, `${slug}.md`), content);
  }
  t.after(() => rmSync(repoRoot, { recursive: true, force: true }));
  return repoRoot;
}

function createGh({
  mapping = {},
  body,
  openPRs = [],
  updateImpl,
  issueNumber = 7,
  issues,
} = {}) {
  let registryBody = body ?? renderRegistry({ mapping, tickets: [], openPRs: [] });
  const updates = [];
  return {
    updates,
    async listAllOpenPRs() {
      return openPRs;
    },
    async listIssuesByLabel() {
      return issues ?? [{ number: issueNumber, body: registryBody }];
    },
    async updateIssueBody(number, newBody) {
      assert.equal(number, issueNumber);
      updates.push(newBody);
      if (updateImpl) await updateImpl(number, newBody);
      registryBody = newBody;
    },
    async createIssue() {
      throw new Error("registry already exists in these tests");
    },
  };
}

function cycleArgs({ repoRoot, gh, adapter, config = baseConfig, dryRun = false }) {
  return {
    config,
    gh,
    adapter,
    repoRoot,
    repoFullName: "acme/widgets",
    dryRun,
    today: "2026-07-20",
    log: () => {},
  };
}

test("runCycle checkpoints the registry after every successful dispatch", async (t) => {
  const repoRoot = createRepo(t, {
    alpha: ticketContent({ priority: 1 }),
    beta: ticketContent({ priority: 2 }),
  });
  const gh = createGh();
  const dispatchInputs = [];
  const adapter = {
    async dispatch(input) {
      dispatchInputs.push(input);
      const slug = input.ticketFile.split("/").at(-1).replace(/\.md$/, "");
      return { agentId: `agent-${slug}`, branchName: `cursor/${slug}` };
    },
  };

  const result = await runCycle(cycleArgs({ repoRoot, gh, adapter }));

  assert.equal(result.dispatched.length, 2);
  assert.equal(gh.updates.length, 2);
  const first = parseRegistry(gh.updates[0], { strict: true });
  const second = parseRegistry(gh.updates[1], { strict: true });
  assert.deepEqual(Object.keys(first), ["alpha"]);
  assert.deepEqual(Object.keys(second), ["alpha", "beta"]);
  assert.match(gh.updates[0], /dispatched \(awaiting PR\)/);
  assert.equal(dispatchInputs.length, 2);
  for (const input of dispatchInputs) assert.match(input.idempotencyKey, /^[a-f0-9]{64}$/);
});

test("idempotency key is stable for unchanged ticket content and changes with the ticket", async (t) => {
  const originalContent = ticketContent();
  const repoRoot = createRepo(t, { stable: originalContent });
  const gh = createGh();
  const keys = [];
  const adapter = {
    async dispatch(input) {
      keys.push(input.idempotencyKey);
      return { agentId: `agent-${keys.length}`, branchName: "rondo/stable" };
    },
  };

  await runCycle(cycleArgs({ repoRoot, gh, adapter }));
  await runCycle(cycleArgs({ repoRoot, gh, adapter }));
  const expected = createHash("sha256")
    .update("acme/widgets\0tickets/stable.md\0")
    .update(originalContent)
    .digest("hex");
  assert.equal(keys[0], expected);
  assert.equal(keys[0], keys[1]);

  writeFileSync(
    join(repoRoot, "tickets", "stable.md"),
    ticketContent({ body: "# Ticket\n\nProgress changed.\n" }),
  );
  await runCycle(cycleArgs({ repoRoot, gh, adapter }));
  assert.notEqual(keys[1], keys[2]);
});

test("dispatch limit counts attempts, records excess tickets as skipped, and defaults defensively", async (t) => {
  const tickets = {};
  for (let i = 1; i <= 12; i += 1) {
    tickets[`ticket-${String(i).padStart(2, "0")}`] = ticketContent({ priority: i });
  }
  const repoRoot = createRepo(t, tickets);
  const gh = createGh();
  let attempts = 0;
  const adapter = {
    async dispatch(input) {
      attempts += 1;
      if (attempts === 1) throw new Error("ambiguous backend failure");
      return { agentId: `agent-${attempts}`, branchName: input.suggestedBranch };
    },
  };

  // Omitted maxDispatchesPerCycle uses the core default of ten. The first
  // failed POST still consumes a slot because it may have launched remotely.
  const config = { ...baseConfig, maxDispatchesPerCycle: undefined };
  const result = await runCycle(cycleArgs({ repoRoot, gh, adapter, config }));
  assert.equal(attempts, 10);
  assert.equal(result.failed.length, 1);
  assert.equal(result.dispatched.length, 9);
  assert.deepEqual(
    result.skipped.map((entry) => entry.reason),
    ["max_dispatches_per_cycle_reached", "max_dispatches_per_cycle_reached"],
  );
});

test("dry-run applies capacity without adapter or registry mutations", async (t) => {
  const repoRoot = createRepo(t, {
    alpha: ticketContent({ priority: 1 }),
    beta: ticketContent({ priority: 2 }),
  });
  const gh = createGh();
  const logs = [];
  const adapter = {
    async dispatch() {
      throw new Error("dry-run must not call the adapter");
    },
  };

  const result = await runCycle({
    ...cycleArgs({
      repoRoot,
      gh,
      adapter,
      dryRun: true,
      config: { ...baseConfig, maxDispatchesPerCycle: 1 },
    }),
    log: (message) => logs.push(message),
  });

  assert.deepEqual(result.dispatched, []);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(result.skipped, [
    { slug: "beta", reason: "max_dispatches_per_cycle_reached" },
  ]);
  assert.equal(gh.updates.length, 0);
  assert.ok(logs.some((message) => message.includes("would dispatch alpha")));
});

test("invalid dispatch limits are rejected by the core", async (t) => {
  const repoRoot = createRepo(t, { one: ticketContent() });
  const gh = createGh();
  const adapter = { dispatch: async () => ({ agentId: "a", branchName: "rondo/one" }) };
  await assert.rejects(
    runCycle(
      cycleArgs({
        repoRoot,
        gh,
        adapter,
        config: { ...baseConfig, maxDispatchesPerCycle: 0 },
      }),
    ),
    /maxDispatchesPerCycle must be an integer from 1 to 1000/,
  );
});

test("registry checkpoint failure is fatal and prevents further dispatches", async (t) => {
  const repoRoot = createRepo(t, {
    alpha: ticketContent({ priority: 1 }),
    beta: ticketContent({ priority: 2 }),
  });
  const gh = createGh({
    updateImpl: async () => {
      throw new Error("GitHub unavailable");
    },
  });
  let adapterCalls = 0;
  const adapter = {
    async dispatch(input) {
      adapterCalls += 1;
      return { agentId: "agent-1", branchName: input.suggestedBranch };
    },
  };

  await assert.rejects(
    runCycle(cycleArgs({ repoRoot, gh, adapter })),
    /could not persist registry Issue #7 — GitHub unavailable/,
  );
  assert.equal(adapterCalls, 1);
  assert.equal(gh.updates.length, 1);
});

test("an existing malformed registry fails closed before dispatch", async (t) => {
  const repoRoot = createRepo(t, { one: ticketContent() });
  const gh = createGh({ body: "# marker was deleted" });
  let adapterCalls = 0;
  const adapter = {
    async dispatch() {
      adapterCalls += 1;
      return { agentId: "agent", branchName: "cursor/generated" };
    },
  };

  await assert.rejects(
    runCycle(cycleArgs({ repoRoot, gh, adapter })),
    /Invalid Rondo registry: machine-readable marker is missing/,
  );
  assert.equal(adapterCalls, 0);
  assert.equal(gh.updates.length, 0);
});

test("multiple registries select the oldest Issue deterministically and warn", async (t) => {
  const repoRoot = createRepo(t, {});
  const body = renderRegistry({ mapping: {}, tickets: [], openPRs: [] });
  const gh = createGh({
    issueNumber: 3,
    issues: [
      { number: 9, body },
      { number: 3, body },
    ],
  });
  const logs = [];

  await runCycle({
    ...cycleArgs({ repoRoot, gh, adapter: null }),
    log: (message) => logs.push(message),
  });

  assert.equal(gh.updates.length, 1);
  assert.ok(logs.some((message) => message.includes("using oldest #3")));
});

test("invalid registry identity fails before dispatch", async (t) => {
  const repoRoot = createRepo(t, { one: ticketContent() });
  const body = renderRegistry({ mapping: {}, tickets: [], openPRs: [] });
  const gh = createGh({ issues: [{ body }] });
  let adapterCalls = 0;
  const adapter = {
    async dispatch() {
      adapterCalls += 1;
      return { agentId: "agent", branchName: "rondo/one" };
    },
  };

  await assert.rejects(
    runCycle(cycleArgs({ repoRoot, gh, adapter })),
    /Issue without a positive integer number/,
  );
  assert.equal(adapterCalls, 0);
  assert.equal(gh.updates.length, 0);
});

test("invalid newly-created registry identity fails before dispatch", async (t) => {
  const repoRoot = createRepo(t, { one: ticketContent() });
  const createdBody = renderRegistry({ mapping: {}, tickets: [], openPRs: [] });
  let adapterCalls = 0;
  const gh = {
    async listAllOpenPRs() {
      return [];
    },
    async listIssuesByLabel() {
      return [];
    },
    async createIssue() {
      return { body: createdBody };
    },
  };
  const adapter = {
    async dispatch() {
      adapterCalls += 1;
      return { agentId: "agent", branchName: "rondo/one" };
    },
  };

  await assert.rejects(
    runCycle(cycleArgs({ repoRoot, gh, adapter })),
    /registry creation returned an Issue without a positive integer number/,
  );
  assert.equal(adapterCalls, 0);
});

test("fork PR branch names do not block local tickets, local and legacy shapes do", async (t) => {
  const repoRoot = createRepo(t, {
    forked: ticketContent({ priority: 1 }),
    local: ticketContent({ priority: 2 }),
    legacy: ticketContent({ priority: 3 }),
  });
  const gh = createGh({
    openPRs: [
      {
        number: 10,
        head: { ref: "rondo/forked", repo: { full_name: "contributor/widgets" } },
      },
      {
        number: 11,
        head: { ref: "rondo/local", repo: { full_name: "acme/widgets" } },
      },
      { number: 12, head: { ref: "rondo/legacy" } },
    ],
  });
  const calls = [];
  const adapter = {
    async dispatch(input) {
      calls.push(input.ticketFile);
      return { agentId: "agent-forked", branchName: input.suggestedBranch };
    },
  };

  const result = await runCycle(cycleArgs({ repoRoot, gh, adapter }));
  assert.deepEqual(calls, ["tickets/forked.md"]);
  assert.deepEqual(
    result.skipped.map(({ slug, reason }) => ({ slug, reason })),
    [
      { slug: "local", reason: "open_pr_exists" },
      { slug: "legacy", reason: "open_pr_exists" },
    ],
  );
});

test("valid slug 'constructor' never resolves through Object.prototype", async (t) => {
  const repoRoot = createRepo(t, { constructor: ticketContent() });
  const gh = createGh();
  let suggestedBranch;
  const adapter = {
    async dispatch(input) {
      suggestedBranch = input.suggestedBranch;
      return { agentId: "agent-constructor", branchName: input.suggestedBranch };
    },
  };

  await runCycle(cycleArgs({ repoRoot, gh, adapter }));
  assert.equal(suggestedBranch, "rondo/constructor");
  const persisted = parseRegistry(gh.updates.at(-1), { strict: true });
  assert.equal(persisted.constructor, "rondo/constructor");
  assert.equal(Object.getPrototypeOf(persisted), null);
});

test("invalid adapter results fail the ticket and never enter the mapping", async (t) => {
  const repoRoot = createRepo(t, {
    "bad-agent": ticketContent({ priority: 1 }),
    "bad-branch": ticketContent({ priority: 2 }),
    "bad-ref": ticketContent({ priority: 3 }),
  });
  const gh = createGh();
  const adapter = {
    async dispatch(input) {
      if (input.ticketFile.endsWith("bad-agent.md")) {
        return { agentId: "   ", branchName: "rondo/bad-agent" };
      }
      return {
        agentId: "agent",
        branchName: input.ticketFile.endsWith("bad-ref.md") ? "bad..branch" : "bad\nbranch",
      };
    },
  };

  const result = await runCycle(cycleArgs({ repoRoot, gh, adapter }));
  assert.equal(result.failed.length, 3);
  for (const failure of result.failed) assert.match(failure.error, /invalid dispatch result/);
  assert.equal(result.dispatched.length, 0);
  const persisted = parseRegistry(gh.updates.at(-1), { strict: true });
  assert.equal(Object.hasOwn(persisted, "bad-agent"), false);
  assert.equal(Object.hasOwn(persisted, "bad-branch"), false);
  assert.equal(Object.hasOwn(persisted, "bad-ref"), false);
});
