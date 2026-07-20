# Contributing to Rondo

Rondo is a protocol plus a small reference implementation. Changes should keep that distinction visible and preserve boring, testable port boundaries.

## Before editing

1. Read [`AGENTS.md`](AGENTS.md), [`SPEC.md`](SPEC.md), and [`ADAPT.md`](ADAPT.md).
2. Read the relevant adapter or VCS contract for network-boundary changes.
3. Check the working tree and preserve unrelated changes.
4. Decide whether the change alters protocol semantics, reference behavior, a port, installation, or only prose.
5. Add an entry under `CHANGELOG.md` → `Unreleased` when behavior or public guidance changes.

## Development environment

- Node 24.
- No runtime dependencies in the reference Action.
- No live provider or GitHub credentials in unit tests.

Run:

```bash
cd action
npm test
npm run test:coverage
```

CI enforces at least 90% line coverage, 80% branch coverage, and 90% function coverage across the imported reference runtime.

For validator work, also exercise exit codes with valid, invalid, empty-present, and missing directories. Use temporary synthetic fixtures; never customer tickets.

## Change rules

### Protocol or ticket format

- Update `SPEC.md`, schema, parser/validator, prompt/skills, and tests together.
- Preserve unknown valid frontmatter keys.
- Keep runtime scanning lenient and author-time validation strict.
- Do not change dependency-absence or pause semantics accidentally.
- Consider compatibility/version impact.

### Runner

- Preserve deterministic priority/slug ordering.
- Keep the `1..1000` capacity bound and count failed attempts.
- Keep dry-run side-effect/provider-secret free.
- Preserve at-least-once language; do not claim PR verification.
- Checkpoint successful branch mappings before later dispatches.

### Adapter or VCS port

- Follow the contract in `action/src/adapters/CONTRACT.md` or `action/src/vcs/CONTRACT.md`.
- Inject network functions/clocks where needed for deterministic tests.
- Bound every request.
- Do not add blind non-idempotent retries.
- Validate remote response types strictly, bound remote error text, keep local secrets out of errors, and require receivers/providers not to echo sensitive data.
- Document credentials, data sent, pricing/cancellation, and installation.

### Installation or skills

- Examples use `<RONDO_REF>` for a reviewed immutable commit, not `main` or an assumed tag.
- The workflow must be pushed/merged before remote dispatch testing.
- Respect host branch/PR policy and never set a secret for the user.
- Installed skills must be standalone; no source-tree-relative links.
- Preserve the terminal case: deleting the last ticket makes the directory absent and validation must still pass as an empty queue.

## Tests expected

Choose tests proportional to risk, including failure paths:

- pure behavior for protocol changes;
- input bounds and aliases for Action inputs;
- mocked HTTP shape, HMAC, timeout, and malformed response;
- VCS pagination, fork branches, retries, and registry failures;
- runner capacity, dry-run, and checkpoint order;
- Markdown link/ref checks for documentation changes.

If a relevant test cannot be added, state why and describe the manual verification. “Not run” is not “passed.”

## Pull requests

Keep changes focused and reviewable. Include:

- problem and intended compatibility;
- files/protocol boundaries changed;
- security, data, and cost impact;
- exact tests and results;
- migration or rollback notes;
- changelog entry when user-visible.

Do not commit generated credentials, `.env` files, real prompts/tickets, provider responses, or private repository identifiers.

Maintainers should release only after version metadata, `action.yml` runtime, spec, changelog, pinned examples, and tests agree on the same immutable source commit.
