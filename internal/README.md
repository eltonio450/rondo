# `internal/` — maintainer tests and fixtures

This directory contains development-only tests for the reference implementation. It is not a host-repository configuration surface.

## Test areas

Tests should cover:

- frontmatter parse/serialize and v0.4 values such as `paused: false`;
- eligibility and dependency semantics;
- registry parse/render, strict corruption handling, and derived display state;
- runner ordering, capacity, dry-run, idempotency keys, and registry checkpoint failures;
- validator syntax, cycles, and missing-directory exit behavior;
- Action input normalization and bounds;
- Cursor/HTTP/VCS request shape, timeout, authentication, pagination, retries, and response validation;
- prompt loading and host override modes.

Some areas may still be missing coverage. This list is the target, not a claim that every bullet is complete; inspect the actual test files and coverage before relying on it.

## Run

Use Node 24 from the repository root:

```bash
node --test 'internal/tests/*.test.mjs'
```

Or:

```bash
cd action
npm test
npm run test:coverage
```

The coverage command applies the same minimums as CI: 90% lines, 80% branches, and 90% functions.

No live Cursor or GitHub credentials belong in the unit suite. Inject `fetchImpl`, use deterministic clocks, and assert both requests and failure behavior.

## Test principles

- Protocol rules in `SPEC.md` need a focused regression test.
- Every network port needs timeout and malformed-response tests.
- Non-idempotent dispatch POSTs must not gain blind retries.
- A registry persistence failure after dispatch is a critical test case.
- Dry-run must remain side-effect free and provider-secret free.
- Missing and empty ticket directories must both remain valid empty queues; unrelated I/O failures must remain distinguishable.
- Tests must not mutate real GitHub, provider, or user state.

When adding a fixture, keep ticket content synthetic and free of credentials or real customer data.
