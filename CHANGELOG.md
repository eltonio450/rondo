# Changelog

Notable user-visible changes are recorded here. Rondo installation should pin an immutable commit; version headings are discovery aids, not a substitute for reviewing that pin.

## [0.4.0] — Unreleased

### Added

- Explicit separation between portable protocol, GitHub reference profile, agent adapter, and VCS port.
- Agent and VCS contracts for implementing new providers safely.
- Per-cycle dispatch-attempt cap, default `10`, bounded to `1..1000`.
- Per-request timeout input, default `120` seconds.
- HTTPS enforcement for the generic HTTP adapter with explicit insecure opt-in.
- Deterministic dispatch idempotency keys and timestamped HTTP HMAC authentication.
- Strict adapter response validation and safer VCS retry guidance.
- Security, adaptation, contribution, and agent-maintainer guides.
- Comprehensive mocked runtime/port tests and CI coverage thresholds.

### Changed

- Reference Action runtime moves to Node 24.
- Delivery semantics are documented honestly as at least once.
- “Exactly one relevant PR, reused on retry” remains an agent requirement but is no longer described as runner verification.
- Installation uses a reviewed immutable `<RONDO_REF>` and follows host branch/PR policy before remote smoke testing.
- Only Cursor and generic HTTP are described as shipped adapters.
- Skills are standalone and sourced from the same immutable ref as the Action.
- `paused: false` is accepted as equivalent to no pause.
- Registry state rendering and checkpoint behavior are aligned with runtime eligibility and duplicate-safety needs.
- The strict validator treats a missing ticket directory as an empty queue and checks dependency cycles among present tickets.

### Security

- Provider/VCS requests are bounded by timeouts.
- Cleartext HTTP is rejected unless explicitly allowed.
- Optional HTTP shared secrets use HMAC-SHA256 over timestamp plus exact body; receivers must enforce a replay window.
- Installation and CI guidance pin external code by immutable SHA.

### Migration notes

- Replace tag or `main` workflow refs with a reviewed commit SHA.
- Update workflow inputs for capacity, timeout, and HTTP transport policy.
- Review optional `.gitkeep` usage; the validator no longer requires the empty ticket directory to remain tracked.
- Validate or repair the existing registry machine block before upgrading; the v0.4 runner fails closed on corrupt existing registry state.
- Re-copy installed skills from the selected v0.4 commit.
- Review custom HTTP receivers for `Idempotency-Key`, timestamped HMAC, strict response values, and timeout ambiguity.
- Run dry-run, then one real dispatch with capacity `1` before restoring a schedule.

## [0.3.0] — 2026-05-11

- Bumped public installation pins and documentation to v0.3.
- Retained the install skill as the host-repository maintenance entry point.

## [0.2.0] — 2026-04-21

- Added installability polish, modular bricks, validator, and reference Action documentation.

## [0.1.0] — 2026-04-21

- Initial public reference release.
