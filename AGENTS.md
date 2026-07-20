# AGENTS.md

This repository defines the Rondo protocol and its GitHub/Node reference runner. Preserve the distinction between portable core semantics and replaceable ports.

## Repository map

- `SPEC.md`, `PROMPT.md` — protocol and remote-agent contract.
- `action/src/core`, `action/src/lib` — portable runner logic.
- `action/src/adapters` — remote-agent ports; read `CONTRACT.md`.
- `action/src/vcs` — VCS port; read `CONTRACT.md`.
- `action/src/cli` and `schemas` — strict ticket validation.
- `install`, `INSTALL.md`, `skills` — host onboarding surfaces.
- `internal/tests` — Node 24 tests.
- `ADAPT.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md` — architecture and governance.

## Validate

```bash
cd action && npm test
```

For validator changes, test valid, invalid, empty-present, and missing ticket directories. For documentation changes, check relative links, `<RONDO_REF>` usage, versions, and workflow input names.

## Invariants

- Dispatch is at least once; never claim exactly once.
- The runner requests exactly one relevant PR touching the ticket, reused on retry, but does not verify it.
- Priority then slug ordering is deterministic.
- Dispatch attempts are capped `1..1000`, default `10`; failures consume slots.
- `paused: false` means unpaused.
- Successful actual branches are checkpointed before later dispatches.
- Dry-run has no provider mutation and needs no provider secret.
- Network requests are bounded; HTTP is HTTPS by default.
- No secret belongs in tickets, prompts, logs, examples, or fixtures.

## Adaptation boundaries

Replace agent backends through `action/src/adapters/CONTRACT.md`; replace GitHub through `action/src/vcs/CONTRACT.md`. A different registry/state transport or scheduler must preserve `SPEC.md` semantics and document consistency, retries, capacity, and security. Avoid provider conditionals in core logic.

## Last-ticket CI rule

Deleting the final ticket is valid and can remove the directory from Git. Preserve this terminal case: the runtime and validator must treat an absent ticket directory as an empty queue. `.gitkeep` may aid discovery but must never be required for CI success.

## Before modifying

1. Inspect guidance and working-tree changes; preserve unrelated work.
2. Identify the protocol or port boundary affected.
3. Read its contract and security implications.
4. Update code, tests, docs, and `CHANGELOG.md` together when behavior changes.
5. Use immutable refs in workflow/skill examples.
6. Run relevant Node 24 tests and report exact outcomes.
7. Do not commit, push, mutate external state, or use live credentials unless the user explicitly asks.
