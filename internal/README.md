# `internal/` — tests and development notes

Anything the Rondo maintainers need that isn't shipped to end users goes here. Host repos never `checkout` this directory; it lives in the Rondo repo only.

## Structure

```
internal/
  README.md                     (this file)
  tests/
    frontmatter.test.mjs        Ticket frontmatter parser/serializer.
    eligibility.test.mjs        Pure eligibility predicate per SPEC §4.
    registry.test.mjs           Registry Issue body parser/renderer per SPEC §6.
```

## Running the tests

From the repo root:

```bash
node --test 'internal/tests/*.test.mjs'
```

Or, from `action/`:

```bash
npm test
```

Requires **Node 20+**. Zero dependencies — the tests use `node:test` and `node:assert`, both built-in.

## What is tested vs. what is not

**Tested (pure logic):**
- `action/src/lib/frontmatter.mjs` — parse/serialize, roundtrip, CRLF, unknown keys.
- `action/src/core/eligibility.mjs` — every branch of SPEC §4 (invalid frontmatter, paused, depends, open PR, model allowlist).
- `action/src/core/registry.mjs` — parse/render the `<!-- rondo-registry -->` block, malformed-body tolerance, roundtrip.

**Not tested (skeletal I/O that the installing agent wires):**
- `action/src/vcs/gh-client.mjs` — thin wrapper over `fetch` against GitHub's REST API.
- `action/src/adapters/cursor-api.mjs` — depends on Cursor's current API surface.
- `action/src/core/runner.mjs` — the orchestrator; stable parts are covered by the pure unit tests above.

If you implement a new adapter (`adapters/claude-code.mjs`), please add tests here with mocked HTTP (inject a `fetchImpl` into the factory — the existing skeletal code already accepts one).

## When to add a test

- Any change to `core/eligibility.mjs` — SPEC §4 must stay covered.
- Any change to the registry Issue body format — update `registry.test.mjs` so SPEC §6 stays enforced.
- Any change to the frontmatter parsing rules — update `frontmatter.test.mjs` so SPEC §3.2 stays enforced.
