import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  main,
  validateTicketFile,
  validateTicketSet,
} from "../../action/src/cli/validate-tickets.mjs";

function fm(extra = "") {
  return `owner: alice\npriority: 2\nmodel: default\n${extra}\n# X\n`;
}

test("minimal valid ticket has no errors", () => {
  assert.deepEqual(validateTicketFile("ok.md", fm()), []);
});

test("missing required key is flagged", () => {
  const content = "owner: alice\npriority: 2\n\n# X";
  const errors = validateTicketFile("ok.md", content);
  assert.ok(errors.some((e) => e.includes("model")));
});

test("filename not matching slug regex is flagged", () => {
  const errors = validateTicketFile("BAD_NAME.md", fm());
  assert.ok(errors.some((e) => e.includes("filename")));
});

test("filename with leading dash is flagged", () => {
  const errors = validateTicketFile("-leading.md", fm());
  assert.ok(errors.some((e) => e.includes("filename")));
});

test("priority > 99 is flagged", () => {
  const content = "owner: alice\npriority: 100\nmodel: default\n\n# X";
  const errors = validateTicketFile("ok.md", content);
  assert.ok(errors.some((e) => e.includes("priority") && e.includes("99")));
});

test("priority < 0 is flagged", () => {
  const content = "owner: alice\npriority: -1\nmodel: default\n\n# X";
  const errors = validateTicketFile("ok.md", content);
  assert.ok(errors.some((e) => e.includes("priority")));
});

test("non-integer priority is flagged", () => {
  const content = "owner: alice\npriority: default\nmodel: default\n\n# X";
  const errors = validateTicketFile("ok.md", content);
  assert.ok(errors.some((e) => e.includes("priority")));
});

test("owner violating handle pattern is flagged", () => {
  const content = "owner: not a handle\npriority: 2\nmodel: default\n\n# X";
  const errors = validateTicketFile("ok.md", content);
  assert.ok(errors.some((e) => e.includes("owner")));
});

test("model containing only whitespace is flagged", () => {
  const content = "owner: alice\npriority: 2\nmodel:    \n\n# X";
  const errors = validateTicketFile("ok.md", content);
  assert.ok(errors.some((e) => e.includes("model")));
});

test("paused: true is valid", () => {
  assert.deepEqual(validateTicketFile("ok.md", fm("paused: true")), []);
});

test("paused: false is valid and means not paused", () => {
  assert.deepEqual(validateTicketFile("ok.md", fm("paused: false")), []);
});

test("paused ISO date is valid", () => {
  assert.deepEqual(
    validateTicketFile("ok.md", fm("paused: 2026-05-01")),
    [],
  );
});

test("paused malformed date is flagged", () => {
  const errors = validateTicketFile("ok.md", fm("paused: May 1 2026"));
  assert.ok(errors.some((e) => e.includes("paused")));
});

test("paused impossible calendar date is flagged", () => {
  const errors = validateTicketFile("ok.md", fm("paused: 2026-02-30"));
  assert.ok(errors.some((e) => e.includes("paused")));
});

test("depends with valid comma-separated slugs is valid", () => {
  assert.deepEqual(
    validateTicketFile("ok.md", fm("depends: epic-a, epic-b")),
    [],
  );
});

test("depends with invalid slug (uppercase) is flagged", () => {
  const errors = validateTicketFile("ok.md", fm("depends: EPIC_A"));
  assert.ok(errors.some((e) => e.includes("depends")));
});

test("depends with .md suffix is accepted", () => {
  assert.deepEqual(
    validateTicketFile("ok.md", fm("depends: epic-a.md, epic-b.md")),
    [],
  );
});

test("self-dependency is flagged", () => {
  const errors = validateTicketFile("epic-a.md", fm("depends: epic-a.md"));
  assert.ok(errors.some((e) => e.includes("cannot depend on itself")));
});

test("dependency cycles are flagged on every member", () => {
  const results = validateTicketSet([
    { filename: "epic-a.md", content: fm("depends: epic-b") },
    { filename: "epic-b.md", content: fm("depends: epic-c") },
    { filename: "epic-c.md", content: fm("depends: epic-a") },
  ]);
  assert.equal(results.length, 3);
  for (const result of results) {
    assert.ok(result.errors.some((e) => e.includes("dependency cycle detected")));
  }
});

test("an acyclic dependency graph is valid", () => {
  const results = validateTicketSet([
    { filename: "epic-a.md", content: fm() },
    { filename: "epic-b.md", content: fm("depends: epic-a") },
    { filename: "constructor.md", content: fm("depends: epic-b") },
  ]);
  assert.deepEqual(results.map((result) => result.errors), [[], [], []]);
});

test("spec: 0.1 is valid", () => {
  assert.deepEqual(validateTicketFile("ok.md", fm("spec: 0.1")), []);
});

test("spec: v1 is flagged", () => {
  const errors = validateTicketFile("ok.md", fm("spec: v1"));
  assert.ok(errors.some((e) => e.includes("spec")));
});

test("unknown keys are accepted (additionalProperties: true)", () => {
  assert.deepEqual(
    validateTicketFile("ok.md", fm("x_custom: anything-goes")),
    [],
  );
});

test("empty frontmatter fails all required keys", () => {
  const errors = validateTicketFile("ok.md", "\n# No frontmatter\n");
  assert.ok(errors.some((e) => e.includes("owner")));
  assert.ok(errors.some((e) => e.includes("priority")));
  assert.ok(errors.some((e) => e.includes("model")));
});

test("a missing tickets directory is an empty queue, not a setup error", (t) => {
  const root = mkdtempSync(join(tmpdir(), "rondo-validator-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const originalLog = console.log;
  console.log = () => {};
  try {
    assert.equal(main(["node", "validate-tickets.mjs", join(root, "tickets")]), 0);
  } finally {
    console.log = originalLog;
  }
});
