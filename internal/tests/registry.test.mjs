import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRegistry, renderRegistry, REGISTRY_LABEL, REGISTRY_TITLE } from "../../action/src/core/registry.mjs";

test("constants are exported with the v0.1 canonical values", () => {
  assert.equal(REGISTRY_LABEL, "rondo-registry");
  assert.equal(REGISTRY_TITLE, "[Rondo] Ticket registry");
});

test("parseRegistry — empty body → {}", () => {
  assert.deepEqual(parseRegistry(""), {});
  assert.deepEqual(parseRegistry(undefined), {});
  assert.deepEqual(parseRegistry(null), {});
});

test("parseRegistry — no marker → {}", () => {
  assert.deepEqual(parseRegistry("# Random markdown without a marker"), {});
});

test("parseRegistry — malformed JSON → {} (not a throw)", () => {
  const body = `<!-- rondo-registry\n{ not json }\n-->\n# body`;
  assert.deepEqual(parseRegistry(body), {});
});

test("parseRegistry — empty payload → {}", () => {
  const body = `<!-- rondo-registry\n\n-->\n# body`;
  assert.deepEqual(parseRegistry(body), {});
});

test("parseRegistry — valid payload returns the mapping", () => {
  const body = [
    "<!-- rondo-registry",
    JSON.stringify({ "slug-a": "rondo/slug-a", "slug-b": "cursor/auto-gen-xyz" }, null, 2),
    "-->",
    "",
    "# Rondo — ticket registry",
  ].join("\n");
  assert.deepEqual(parseRegistry(body), {
    "slug-a": "rondo/slug-a",
    "slug-b": "cursor/auto-gen-xyz",
  });
});

test("parseRegistry — drops entries whose branch value is not a non-empty string", () => {
  const body = [
    "<!-- rondo-registry",
    JSON.stringify({ "slug-a": "rondo/slug-a", "slug-b": "", "slug-c": 42, "slug-d": null }, null, 2),
    "-->",
  ].join("\n");
  assert.deepEqual(parseRegistry(body), { "slug-a": "rondo/slug-a" });
});

test("parseRegistry — arrays and non-objects are rejected", () => {
  const arrBody = `<!-- rondo-registry\n[1,2,3]\n-->`;
  const numBody = `<!-- rondo-registry\n42\n-->`;
  assert.deepEqual(parseRegistry(arrBody), {});
  assert.deepEqual(parseRegistry(numBody), {});
});

test("renderRegistry — empty queue returns a body with the marker and 'no tickets' note", () => {
  const body = renderRegistry({ mapping: {}, tickets: [], openPRs: [], now: new Date("2026-04-21T10:00:00Z") });
  assert.match(body, /<!-- rondo-registry/);
  assert.match(body, /-->/);
  assert.match(body, /No tickets on the queue/i);
  assert.deepEqual(parseRegistry(body), {});
});

test("renderRegistry — roundtrips a non-trivial mapping", () => {
  const mapping = { "slug-a": "rondo/slug-a", "slug-b": "cursor/auto-xyz" };
  const tickets = [
    { slug: "slug-a", frontmatter: { owner: "alice", priority: 2, model: "default" } },
    { slug: "slug-b", frontmatter: { owner: "bob", priority: 1, model: "default" } },
  ];
  const body = renderRegistry({ mapping, tickets, openPRs: [], now: new Date("2026-04-21T10:00:00Z") });
  assert.deepEqual(parseRegistry(body), mapping);
});

test("renderRegistry — JSON payload is sorted alphabetically by slug", () => {
  const mapping = { zeta: "rondo/zeta", alpha: "rondo/alpha", mid: "rondo/mid" };
  const tickets = [
    { slug: "alpha", frontmatter: { owner: "a", priority: 1, model: "default" } },
    { slug: "mid", frontmatter: { owner: "b", priority: 1, model: "default" } },
    { slug: "zeta", frontmatter: { owner: "c", priority: 1, model: "default" } },
  ];
  const body = renderRegistry({ mapping, tickets, openPRs: [] });
  const alphaIdx = body.indexOf('"alpha"');
  const midIdx = body.indexOf('"mid"');
  const zetaIdx = body.indexOf('"zeta"');
  assert.ok(alphaIdx > 0 && alphaIdx < midIdx && midIdx < zetaIdx, "slugs should be ordered alphabetically in the JSON payload");
});

test("renderRegistry — human table flags pr-open, paused, blocked, eligible", () => {
  const mapping = {
    "pr-one": "rondo/pr-one",
    "paused-one": "rondo/paused-one",
    "paused-date": "rondo/paused-date",
    "blocked-one": "rondo/blocked-one",
    "eligible-one": "rondo/eligible-one",
  };
  const tickets = [
    { slug: "pr-one", frontmatter: { owner: "a", priority: 1, model: "default" } },
    { slug: "paused-one", frontmatter: { owner: "a", priority: 1, model: "default", paused: true } },
    { slug: "paused-date", frontmatter: { owner: "a", priority: 1, model: "default", paused: "2027-01-01" } },
    { slug: "blocked-one", frontmatter: { owner: "a", priority: 1, model: "default", depends: "other" } },
    { slug: "eligible-one", frontmatter: { owner: "a", priority: 1, model: "default" } },
  ];
  const openPRs = [{ branchName: "rondo/pr-one", number: 42 }];
  const body = renderRegistry({ mapping, tickets, openPRs });
  assert.match(body, /pr-open \(#42\)/);
  assert.match(body, /paused \(indefinitely\)/);
  assert.match(body, /paused \(until 2027-01-01\)/);
  assert.match(body, /blocked-by: other/);
  assert.match(body, /eligible/);
});

test("renderRegistry — tickets without a mapping entry render with em-dash branch", () => {
  const tickets = [{ slug: "fresh", frontmatter: { owner: "a", priority: 1, model: "default" } }];
  const body = renderRegistry({ mapping: {}, tickets, openPRs: [] });
  // A ticket without a mapping shows "—" as its branch.
  assert.match(body, /`fresh` \| `—`/);
});

test("renderRegistry — 'now' is included as an ISO timestamp in the header", () => {
  const body = renderRegistry({ mapping: {}, tickets: [], openPRs: [], now: new Date("2026-04-21T10:00:00Z") });
  assert.match(body, /Updated 2026-04-21T10:00:00\.000Z/);
});
