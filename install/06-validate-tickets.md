# Brick 6 — Ticket validation (CI)

## What it does

Adds a GitHub Actions workflow that **blocks merge of any PR** whose `tickets/**` files fail to parse against [SPEC.md §3](../SPEC.md) and [`schemas/ticket.schema.json`](../schemas/ticket.schema.json). Catches malformed frontmatter, invalid priority ranges, non-slug filenames, and typos in `depends:` before the runner ever picks up the ticket.

## Default we ship

- A workflow file at `.github/workflows/rondo-validate-tickets.yml` that triggers on PRs touching `<ticketsDir>/**`.
- The workflow checks out the Rondo repo at a pinned ref and invokes the bundled CLI: `node .rondo/action/src/cli/validate-tickets.mjs <ticketsDir>/`.
- Node 20 runtime. Zero dependencies to install on the host.

Why this default: the validator reuses the runner's own `frontmatter.mjs` + `schemas/ticket.schema.json` via a thin CLI. One source of truth — if the SPEC evolves, the CI evolves with it automatically.

## Questions to ask the human

1. *"Pin the validator to which `eltonio450/rondo` ref? (default: `v0.2` — the tag shipped with this brick; `main` for bleeding-edge)"*
2. *"Trigger on every PR, or only on PRs touching `<ticketsDir>/**`? (default: only those paths — cheaper CI)"*

## Steps

1. Create `.github/workflows/rondo-validate-tickets.yml`:

   ```yaml
   name: Rondo — validate tickets

   on:
     pull_request:
       paths:
         - '<ticketsDir>/**'
     workflow_dispatch:

   permissions:
     contents: read

   jobs:
     validate:
       runs-on: ubuntu-latest
       timeout-minutes: 3
       steps:
         - name: Checkout host repo
           uses: actions/checkout@v4
         - name: Checkout Rondo
           uses: actions/checkout@v4
           with:
             repository: eltonio450/rondo
             ref: v0.2
             path: .rondo
         - uses: actions/setup-node@v4
           with:
             node-version: '20'
         - name: Validate tickets
           run: node .rondo/action/src/cli/validate-tickets.mjs <ticketsDir>/
   ```

2. Substitute `<ticketsDir>` with the value chosen in Brick 1 (default `tickets`).

3. Tell the human to make this check required under **Settings → Branches → branch protection → required status checks**. Without that, a malformed ticket can still merge — the check runs but doesn't gate.

## Alternatives (documented, not implemented)

- **Standalone script copied into the host repo.** `scripts/validate-tickets.mjs` duplicates `frontmatter.mjs` + schema enforcement locally. Trade-off: autonomous, no external checkout at CI time, but drifts from the Rondo spec as it evolves.
- **Pre-commit hook (husky / lefthook).** Runs on `git commit` before CI. Faster feedback loop. Downside: easy to bypass with `--no-verify`; should combine with the CI, not replace it.
- **Validate on `push` to the default branch.** Only catches mistakes post-merge — too late for merge-blocking. Not recommended.
- **Validate the host repo's workflow file against the Rondo action inputs.** Not shipped in v0.2 — `action.yml` is the contract and GitHub Actions already fails fast on unknown `with:` keys.

## Self-check

- [ ] `.github/workflows/rondo-validate-tickets.yml` exists and references the correct `<ticketsDir>`.
- [ ] Opening a PR that adds a deliberately malformed ticket (e.g., `priority: 200`) makes the workflow fail with a clear error line.
- [ ] Opening a PR that adds a valid ticket makes the workflow pass.
- [ ] The human has been told to mark `Rondo — validate tickets` as a **required** status check under branch protection.
