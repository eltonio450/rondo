import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFrontmatter, serializeFrontmatter } from "../../action/src/lib/frontmatter.mjs";

test("parses the canonical example from SPEC §3", () => {
  const content = [
    "owner: alice",
    "priority: 2",
    "model: default",
    "",
    "# EPIC: Example",
    "Body here.",
  ].join("\n");

  const { frontmatter, body } = parseFrontmatter(content);
  assert.deepEqual(frontmatter, { owner: "alice", priority: 2, model: "default" });
  assert.equal(body, "# EPIC: Example\nBody here.");
});

test("coerces paused: true to boolean", () => {
  const content = "owner: a\npriority: 0\nmodel: default\npaused: true\n\n# t";
  const { frontmatter } = parseFrontmatter(content);
  assert.equal(frontmatter.paused, true);
});

test("keeps paused: 2026-05-01 as string", () => {
  const content = "owner: a\npriority: 0\nmodel: default\npaused: 2026-05-01\n\n# t";
  const { frontmatter } = parseFrontmatter(content);
  assert.equal(frontmatter.paused, "2026-05-01");
});

test("parses depends as a raw string (parsing into list is caller's job)", () => {
  const content = "owner: a\npriority: 0\nmodel: default\ndepends: t-one, t-two\n\n# t";
  const { frontmatter } = parseFrontmatter(content);
  assert.equal(frontmatter.depends, "t-one, t-two");
});

test("stops at first blank line", () => {
  const content = "owner: a\npriority: 1\nmodel: default\n\nowner: mallory\n\n# t";
  const { frontmatter, body } = parseFrontmatter(content);
  assert.equal(frontmatter.owner, "a");
  assert.equal(body, "owner: mallory\n\n# t");
});

test("stops at first non-key line without requiring blank separator", () => {
  const content = "owner: a\npriority: 1\nmodel: default\n# Heading\nBody";
  const { frontmatter, body } = parseFrontmatter(content);
  assert.equal(frontmatter.owner, "a");
  assert.equal(body, "# Heading\nBody");
});

test("preserves unknown keys (forward-compat per SPEC §3.2)", () => {
  const content = "owner: a\npriority: 0\nmodel: default\nspec: 0.1\nx_custom: hello\n\n# t";
  const { frontmatter } = parseFrontmatter(content);
  assert.equal(frontmatter.spec, "0.1");
  assert.equal(frontmatter.x_custom, "hello");
});

test("handles CRLF line endings", () => {
  const content = "owner: a\r\npriority: 2\r\nmodel: default\r\n\r\n# t";
  const { frontmatter } = parseFrontmatter(content);
  assert.deepEqual(frontmatter, { owner: "a", priority: 2, model: "default" });
});

test("roundtrips via serialize (key order preserved)", () => {
  const content = "owner: a\npriority: 0\nmodel: default\ndepends: x\n\n# t\nbody";
  const parsed = parseFrontmatter(content);
  const out = serializeFrontmatter(parsed);
  assert.equal(out, content);
});

test("serialize appends new keys after preserved order", () => {
  const parsed = parseFrontmatter("owner: a\npriority: 0\nmodel: default\n\n# t");
  parsed.frontmatter.paused = "2026-05-01";
  const out = serializeFrontmatter(parsed);
  assert.match(out, /owner: a\npriority: 0\nmodel: default\npaused: 2026-05-01/);
});
