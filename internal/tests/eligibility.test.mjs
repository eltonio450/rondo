import { test } from "node:test";
import assert from "node:assert/strict";
import { isEligible } from "../../action/src/core/eligibility.mjs";

const baseTicket = {
  slug: "t-one",
  frontmatter: { owner: "alice", priority: 2, model: "default" },
};

const baseInputs = {
  ticket: baseTicket,
  existingTicketSlugs: ["t-one"],
  openPRs: [],
  today: "2026-04-20",
  branchName: "rondo/t-one",
  acceptedModels: ["default"],
};

test("happy path — eligible", () => {
  assert.deepEqual(isEligible(baseInputs), { eligible: true, reason: "ok" });
});

test("invalid frontmatter — missing priority", () => {
  const bad = { ...baseInputs, ticket: { ...baseTicket, frontmatter: { owner: "a", model: "default" } } };
  assert.equal(isEligible(bad).reason, "invalid_frontmatter");
});

test("invalid frontmatter — missing owner", () => {
  const bad = { ...baseInputs, ticket: { ...baseTicket, frontmatter: { priority: 2, model: "default" } } };
  assert.equal(isEligible(bad).reason, "invalid_frontmatter");
});

test("invalid frontmatter — missing model", () => {
  const bad = { ...baseInputs, ticket: { ...baseTicket, frontmatter: { owner: "a", priority: 2 } } };
  assert.equal(isEligible(bad).reason, "invalid_frontmatter");
});

test("invalid frontmatter — priority is a string", () => {
  const bad = {
    ...baseInputs,
    ticket: { ...baseTicket, frontmatter: { owner: "a", priority: "2", model: "default" } },
  };
  assert.equal(isEligible(bad).reason, "invalid_frontmatter");
});

test("unknown model (not in allowlist)", () => {
  const bad = {
    ...baseInputs,
    ticket: { ...baseTicket, frontmatter: { ...baseTicket.frontmatter, model: "gpt-99" } },
  };
  assert.equal(isEligible(bad).reason, "unknown_model:gpt-99");
});

test("'default' is always accepted, even with a restrictive allowlist", () => {
  const input = {
    ...baseInputs,
    acceptedModels: ["claude-sonnet-4-6"],
    ticket: { ...baseTicket, frontmatter: { ...baseTicket.frontmatter, model: "default" } },
  };
  assert.equal(isEligible(input).eligible, true);
});

test("empty acceptedModels → any model accepted", () => {
  const input = {
    ...baseInputs,
    acceptedModels: [],
    ticket: { ...baseTicket, frontmatter: { ...baseTicket.frontmatter, model: "some-exotic-model" } },
  };
  assert.equal(isEligible(input).eligible, true);
});

test("undefined acceptedModels → any model accepted", () => {
  const input = {
    ...baseInputs,
    acceptedModels: undefined,
    ticket: { ...baseTicket, frontmatter: { ...baseTicket.frontmatter, model: "some-exotic-model" } },
  };
  assert.equal(isEligible(input).eligible, true);
});

test("model in allowlist → accepted", () => {
  const input = {
    ...baseInputs,
    acceptedModels: ["claude-sonnet-4-6", "cursor-fast"],
    ticket: { ...baseTicket, frontmatter: { ...baseTicket.frontmatter, model: "cursor-fast" } },
  };
  assert.equal(isEligible(input).eligible, true);
});

test("paused: true → ineligible indefinitely", () => {
  const bad = {
    ...baseInputs,
    ticket: { ...baseTicket, frontmatter: { ...baseTicket.frontmatter, paused: true } },
  };
  assert.equal(isEligible(bad).reason, "paused_indefinitely");
});

test("paused: future date → ineligible until that date", () => {
  const bad = {
    ...baseInputs,
    ticket: { ...baseTicket, frontmatter: { ...baseTicket.frontmatter, paused: "2026-12-25" } },
  };
  assert.equal(isEligible(bad).reason, "paused_until:2026-12-25");
});

test("paused: past date → treated as absent", () => {
  const input = {
    ...baseInputs,
    ticket: { ...baseTicket, frontmatter: { ...baseTicket.frontmatter, paused: "2026-01-01" } },
  };
  assert.equal(isEligible(input).eligible, true);
});

test("paused: today → treated as absent (inclusive-start resume)", () => {
  const input = {
    ...baseInputs,
    ticket: { ...baseTicket, frontmatter: { ...baseTicket.frontmatter, paused: "2026-04-20" } },
  };
  assert.equal(isEligible(input).eligible, true);
});

test("paused: false → invalid_frontmatter (aligns runtime with CI schema)", () => {
  const bad = {
    ...baseInputs,
    ticket: { ...baseTicket, frontmatter: { ...baseTicket.frontmatter, paused: false } },
  };
  assert.equal(isEligible(bad).reason, "invalid_frontmatter");
});

test("paused: non-date string → invalid_frontmatter", () => {
  const bad = {
    ...baseInputs,
    ticket: { ...baseTicket, frontmatter: { ...baseTicket.frontmatter, paused: "May 1 2026" } },
  };
  assert.equal(isEligible(bad).reason, "invalid_frontmatter");
});

test("depends on an existing ticket → ineligible", () => {
  const bad = {
    ...baseInputs,
    ticket: { ...baseTicket, frontmatter: { ...baseTicket.frontmatter, depends: "t-two" } },
    existingTicketSlugs: ["t-one", "t-two"],
  };
  assert.equal(isEligible(bad).reason, "depends_on:t-two");
});

test("depends resolved (blocker ticket file deleted) → eligible", () => {
  const input = {
    ...baseInputs,
    ticket: { ...baseTicket, frontmatter: { ...baseTicket.frontmatter, depends: "t-two" } },
    existingTicketSlugs: ["t-one"],
  };
  assert.equal(isEligible(input).eligible, true);
});

test("depends with .md suffix is normalized", () => {
  const input = {
    ...baseInputs,
    ticket: { ...baseTicket, frontmatter: { ...baseTicket.frontmatter, depends: "t-two.md" } },
    existingTicketSlugs: ["t-one", "t-two"],
  };
  assert.equal(isEligible(input).reason, "depends_on:t-two");
});

test("depends with multiple entries — lists all unresolved", () => {
  const input = {
    ...baseInputs,
    ticket: { ...baseTicket, frontmatter: { ...baseTicket.frontmatter, depends: "t-two, t-three" } },
    existingTicketSlugs: ["t-one", "t-two", "t-three"],
  };
  assert.equal(isEligible(input).reason, "depends_on:t-two,t-three");
});

test("open PR on the same branch → ineligible", () => {
  const bad = {
    ...baseInputs,
    openPRs: [{ branchName: "rondo/t-one" }],
  };
  assert.equal(isEligible(bad).reason, "open_pr_exists");
});

test("open PR on a different branch → doesn't block", () => {
  const input = {
    ...baseInputs,
    openPRs: [{ branchName: "rondo/t-other" }, { branchName: "feat/user-thing" }],
  };
  assert.equal(isEligible(input).eligible, true);
});

test("open PR on a backend-generated branch recorded in the registry → ineligible", () => {
  // Simulates Cursor: registry maps slug → "cursor/auto-t-one-abc", we pass that
  // as `branchName`, and the open PR happens to be on that branch.
  const bad = {
    ...baseInputs,
    branchName: "cursor/auto-t-one-abc",
    openPRs: [{ branchName: "cursor/auto-t-one-abc" }],
  };
  assert.equal(isEligible(bad).reason, "open_pr_exists");
});
