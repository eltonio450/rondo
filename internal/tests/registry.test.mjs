import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRegistry, renderRegistry, REGISTRY_LABEL, REGISTRY_TITLE } from "../../action/src/core/registry.mjs";

function nullMapping(entries = {}) {
  return Object.assign(Object.create(null), entries);
}

test("constants are exported with the canonical values", () => {
  assert.equal(REGISTRY_LABEL, "rondo-registry");
  assert.equal(REGISTRY_TITLE, "[Rondo] Ticket registry");
});

test("parseRegistry — empty body → {}", () => {
  assert.deepEqual(parseRegistry(""), nullMapping());
  assert.deepEqual(parseRegistry(undefined), nullMapping());
  assert.deepEqual(parseRegistry(null), nullMapping());
});

test("parseRegistry — no marker → {}", () => {
  assert.deepEqual(parseRegistry("# Random markdown without a marker"), nullMapping());
});

test("parseRegistry — malformed JSON → {} (not a throw)", () => {
  const body = `<!-- rondo-registry\n{ not json }\n-->\n# body`;
  assert.deepEqual(parseRegistry(body), nullMapping());
});

test("parseRegistry — empty payload → {}", () => {
  const body = `<!-- rondo-registry\n\n-->\n# body`;
  assert.deepEqual(parseRegistry(body), nullMapping());
});

test("parseRegistry — strict mode fails closed on missing or malformed markers", () => {
  assert.throws(
    () => parseRegistry("# no marker", { strict: true }),
    /Invalid Rondo registry: machine-readable marker is missing/,
  );
  assert.throws(
    () => parseRegistry("<!-- rondo-registry\n{ nope }\n-->", { strict: true }),
    /Invalid Rondo registry: malformed JSON/,
  );
  assert.throws(
    () => parseRegistry('<!-- rondo-registry\n{"ticket":"   "}\n-->', { strict: true }),
    /branch for "ticket" must be a trimmed non-empty string/,
  );
  assert.throws(
    () => parseRegistry('<!-- rondo-registry\n{"ticket":" rondo/ticket"}\n-->', { strict: true }),
    /branch for "ticket" must be a trimmed non-empty string/,
  );
  assert.throws(
    () => parseRegistry('<!-- rondo-registry\n{"ticket":"bad..branch"}\n-->', { strict: true }),
    /invalid Git branch for "ticket"/,
  );
});

test("parseRegistry — valid payload returns the mapping", () => {
  const body = [
    "<!-- rondo-registry",
    JSON.stringify({ "slug-a": "rondo/slug-a", "slug-b": "cursor/auto-gen-xyz" }, null, 2),
    "-->",
    "",
    "# Rondo — ticket registry",
  ].join("\n");
  assert.deepEqual(parseRegistry(body), nullMapping({
    "slug-a": "rondo/slug-a",
    "slug-b": "cursor/auto-gen-xyz",
  }));
});

test("parseRegistry — drops entries whose branch value is not a non-empty string", () => {
  const body = [
    "<!-- rondo-registry",
    JSON.stringify({ "slug-a": "rondo/slug-a", "slug-b": "", "slug-c": 42, "slug-d": null }, null, 2),
    "-->",
  ].join("\n");
  assert.deepEqual(parseRegistry(body), nullMapping({ "slug-a": "rondo/slug-a" }));
});

test("parseRegistry — tolerant mode drops padded or control-character branches", () => {
  const body = [
    "<!-- rondo-registry",
    JSON.stringify({ good: "rondo/good", padded: " rondo/padded", control: "rondo/control\n" }),
    "-->",
  ].join("\n");
  assert.deepEqual(parseRegistry(body), nullMapping({ good: "rondo/good" }));
});

test("parseRegistry — arrays and non-objects are rejected", () => {
  const arrBody = `<!-- rondo-registry\n[1,2,3]\n-->`;
  const numBody = `<!-- rondo-registry\n42\n-->`;
  assert.deepEqual(parseRegistry(arrBody), nullMapping());
  assert.deepEqual(parseRegistry(numBody), nullMapping());
});

test("parseRegistry — valid slug 'constructor' is an own property on a null-prototype mapping", () => {
  const body = `<!-- rondo-registry\n{"constructor":"rondo/constructor"}\n-->`;
  const mapping = parseRegistry(body, { strict: true });
  assert.equal(Object.getPrototypeOf(mapping), null);
  assert.equal(Object.hasOwn(mapping, "constructor"), true);
  assert.equal(mapping.constructor, "rondo/constructor");
});

test("renderRegistry — empty queue returns a body with the marker and 'no tickets' note", () => {
  const body = renderRegistry({ mapping: {}, tickets: [], openPRs: [], now: new Date("2026-04-21T10:00:00Z") });
  assert.match(body, /<!-- rondo-registry/);
  assert.match(body, /-->/);
  assert.match(body, /No tickets on the queue/i);
  assert.deepEqual(parseRegistry(body), nullMapping());
});

test("renderRegistry — roundtrips a non-trivial mapping", () => {
  const mapping = { "slug-a": "rondo/slug-a", "slug-b": "cursor/auto-xyz" };
  const tickets = [
    { slug: "slug-a", frontmatter: { owner: "alice", priority: 2, model: "default" } },
    { slug: "slug-b", frontmatter: { owner: "bob", priority: 1, model: "default" } },
  ];
  const body = renderRegistry({ mapping, tickets, openPRs: [], now: new Date("2026-04-21T10:00:00Z") });
  assert.deepEqual(parseRegistry(body), nullMapping(mapping));
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
  const body = renderRegistry({
    mapping,
    tickets,
    openPRs,
    today: "2026-04-21",
    existingTicketSlugs: [...tickets.map((ticket) => ticket.slug), "other"],
  });
  assert.match(body, /pr-open \(#42\)/);
  assert.match(body, /paused \(indefinitely\)/);
  assert.match(body, /paused \(until 2027-01-01\)/);
  assert.match(body, /blocked-by: other/);
  assert.match(body, /eligible/);
});

test("renderRegistry — expired/false pauses and resolved dependencies are eligible", () => {
  const tickets = [
    { slug: "past", frontmatter: { owner: "a", priority: 1, model: "default", paused: "2026-01-01" } },
    { slug: "false", frontmatter: { owner: "a", priority: 1, model: "default", paused: false } },
    { slug: "resolved", frontmatter: { owner: "a", priority: 1, model: "default", depends: "gone" } },
  ];
  const body = renderRegistry({
    mapping: {},
    tickets,
    openPRs: [],
    today: "2026-04-21",
    existingTicketSlugs: tickets.map((ticket) => ticket.slug),
  });
  assert.doesNotMatch(body, /paused \(/);
  assert.doesNotMatch(body, /blocked-by/);
  assert.equal((body.match(/\| eligible \|/g) || []).length, 3);
});

test("renderRegistry — a launch checkpoint is visible while awaiting its PR", () => {
  const tickets = [{ slug: "fresh", frontmatter: { owner: "a", priority: 1, model: "default" } }];
  const body = renderRegistry({
    mapping: { fresh: "rondo/fresh" },
    tickets,
    openPRs: [],
    dispatchedSlugs: new Set(["fresh"]),
  });
  assert.match(body, /dispatched \(awaiting PR\)/);
  assert.doesNotMatch(body, /\| eligible \|/);
});

test("renderRegistry — tickets without a mapping entry render with em-dash branch", () => {
  const tickets = [{ slug: "fresh", frontmatter: { owner: "a", priority: 1, model: "default" } }];
  const body = renderRegistry({ mapping: {}, tickets, openPRs: [] });
  // A ticket without a mapping shows "—" as its branch.
  assert.match(body, /<code>fresh<\/code> \| <code>—<\/code>/);
});

test("renderRegistry — escapes valid branch punctuation in the Markdown table", () => {
  const tickets = [{ slug: "fresh", frontmatter: { owner: "a", priority: 1, model: "default" } }];
  const body = renderRegistry({
    mapping: { fresh: "feature/`tick|pipe" },
    tickets,
    openPRs: [],
  });
  assert.match(body, /<code>feature\/`tick&#124;pipe<\/code>/);
});

test("renderRegistry — 'now' is included as an ISO timestamp in the header", () => {
  const body = renderRegistry({ mapping: {}, tickets: [], openPRs: [], now: new Date("2026-04-21T10:00:00Z") });
  assert.match(body, /Updated 2026-04-21T10:00:00\.000Z/);
});
