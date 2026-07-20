# `action/` — reference Rondo runner

This directory is the GitHub/Node 24 reference profile for the portable protocol in [`SPEC.md`](../SPEC.md). It is small enough to read and fork. It is not a hosted service and it is not the only valid Rondo architecture.

## Responsibilities

The reference runner:

- scans a flat ticket directory;
- derives eligibility from ticket files and open PRs;
- orders tickets and applies a per-cycle attempt cap;
- loads the bundled prompt plus an optional host prepend/override;
- dispatches through one selected adapter with a timeout and idempotency key;
- checkpoints actual branch mappings in one GitHub Issue;
- emits a cycle summary and fails visibly on critical persistence errors.

It does **not** run an agent locally, inspect provider state after dispatch, or verify that the resulting PR follows the prompt. Delivery is at least once.

## Architecture

```text
action/src/index.mjs
  ├─ config and Action environment
  ├─ vcs/gh-client.mjs ───── GitHub VCS port
  ├─ adapters/*.mjs ─────── remote-agent port
  └─ core/runner.mjs
       ├─ eligibility.mjs
       ├─ registry.mjs
       ├─ lib/frontmatter.mjs
       └─ lib/prompt-loader.mjs
```

| Area | Role | Port boundary |
|---|---|---|
| `core/runner.mjs` | cycle orchestration and dispatch capacity | consumes VCS and adapter interfaces |
| `core/eligibility.mjs` | pure eligibility predicate | portable protocol logic |
| `core/registry.mjs` | registry JSON and human snapshot | storage-neutral body format, reference GitHub use |
| `lib/frontmatter.mjs` | line-based ticket parsing | portable protocol logic |
| `lib/prompt-loader.mjs` | bundled/host prompt composition | host convention |
| `adapters/cursor-api.mjs` | Cursor Background Agents | provider-specific and expected to drift |
| `adapters/http.mjs` | generic HTTPS dispatch | portable reference adapter |
| `vcs/gh-client.mjs` | GitHub REST operations | VCS-specific |
| `cli/validate-tickets.mjs` | strict author-time validation | CI/authoring tool |

Read [`../ADAPT.md`](../ADAPT.md), [`src/adapters/CONTRACT.md`](src/adapters/CONTRACT.md), and [`src/vcs/CONTRACT.md`](src/vcs/CONTRACT.md) before replacing a boundary.

## Shipped backends

- `cursor-api`: direct Cursor API call.
- `http`: HTTPS POST to a receiver owned by the installing team.

No dedicated Claude Code or Codex Cloud adapter is present. Adding a string to `agent-backend` is not enough; implement and test a port.

## Safety controls

- `max-dispatches-per-cycle`: `1..1000`, default `10`; failures consume a slot.
- `request-timeout-seconds`: `1..3600`, default `120`.
- `http-allow-insecure`: default `false`; cleartext HTTP requires explicit opt-in.
- `Idempotency-Key`: deterministic SHA-256 correlation for the same repository, ticket path, and ticket content.
- HTTP HMAC: when a secret is configured, timestamped HMAC-SHA256 headers allow receiver authentication and replay-window checks.
- Registry checkpoint: a successful adapter result is persisted before another dispatch begins.
- Dry-run: evaluates order and capacity without creating an adapter or requiring provider credentials.

These controls reduce cost and duplicates; they do not provide exactly-once execution. A timed-out remote request may still complete.

## Inputs

[`action.yml`](action.yml) is the public Action-input contract. Keep it aligned with `readConfig()` in `src/index.mjs`, installation examples, and `SPEC.md §10`.

Input environment names from GitHub Actions have historically appeared in hyphenated and underscore-normalized forms. Configuration parsing must remain covered by tests rather than assuming one spelling.

## Development

Requires Node 24.

```bash
cd action
npm test
```

Tests are stored under [`../internal/tests/`](../internal/tests/). Pure logic and mocked network boundaries should be tested locally; a real-provider dispatch belongs in a controlled smoke environment, not the default unit suite.

Before changing a public boundary:

1. update the relevant contract/spec first or in the same change;
2. add success, invalid-input, timeout, and failure-path tests;
3. keep network effects injected or mocked;
4. run the full Node 24 suite;
5. update security and release notes when data or trust boundaries change.

## Packaging and releases

The host workflow should reference `eltonio450/rondo/action@<RONDO_REF>`, where `<RONDO_REF>` is a reviewed immutable commit SHA. Do not document an unreleased tag as if it exists, and do not recommend `main` for production.

The Action has no runtime dependencies. Release checks must still verify that the checked-in source, `action.yml` runtime, package metadata, spec version, tests, and documentation agree.
