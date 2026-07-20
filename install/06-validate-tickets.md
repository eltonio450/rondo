# Brick 6 — Ticket validation CI

## Purpose

Add strict author-time validation before malformed tickets reach the lenient runtime scanner.

The check only blocks merge when the host repository marks it required. It validates syntax and dependency cycles among present files; it cannot always distinguish a missing dependency from a completed one.

## Checkout path discovery

Before writing the workflow, check whether `.rondo-validator/` or any proposed nested checkout path already exists in the host repository. Never let `actions/checkout` replace a user directory. Choose a repository-relative temporary path and record it as `<rondoCheckoutPath>`; default `.rondo-validator` only when absent and unused.

Add the chosen path to the host `.gitignore` only with approval. The Actions runner is ephemeral, so ignoring it is optional for CI; it matters mainly when humans reproduce the workflow locally.

## Workflow

Create `.github/workflows/rondo-validate-tickets.yml`. Use reviewed immutable SHAs for Rondo and third-party Actions.

```yaml
name: Rondo — validate tickets

on:
  pull_request:
    paths:
      - '<ticketsDir>/**'
      - '.github/workflows/rondo-validate-tickets.yml'
  workflow_dispatch:

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-latest
    timeout-minutes: 3
    steps:
      - name: Checkout host repository
        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
      - name: Checkout reviewed Rondo source
        uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
        with:
          repository: eltonio450/rondo
          ref: "<RONDO_REF>"
          path: "<rondoCheckoutPath>"
      - name: Set up Node 24
        uses: actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0
        with:
          node-version: '24'
      - name: Validate tickets
        env:
          RONDO_SOURCE: "<rondoCheckoutPath>"
          RONDO_TICKETS_DIR: "<ticketsDir>"
        run: node "$RONDO_SOURCE/action/src/cli/validate-tickets.mjs" "$RONDO_TICKETS_DIR"
```

Replace every remaining placeholder. `<RONDO_REF>` is the same reviewed commit SHA used by the runner. The checkout/setup-node SHAs above match Rondo's reviewed CI at the time of writing; a host may substitute other reviewed immutable SHAs required by its policy.

## Directory lifecycle

The validator treats an absent `<ticketsDir>` as an empty queue and exits `0`. This is intentional: a Done PR may delete the final ticket, and Git does not preserve an empty directory. `.gitkeep` is optional for human discoverability, not a CI requirement. Other read/setup failures still exit `2`.

## Enforcement

After the workflow has been delivered and observed once, an authorized human should select the exact check name GitHub reports in the repository's ruleset. It commonly includes both workflow and job, for example `Rondo — validate tickets / validate`; do not promise or configure a name before observing it. Until required, a red run is advisory and does not itself block merge.

## Self-check

- All Action refs are immutable and reviewed.
- The nested checkout path does not collide with a host file or directory.
- Node 24 and the exact ticket directory are configured.
- Empty and absent ticket directories both pass as an empty queue; other I/O failures exit `2`.
- A valid ticket passes and an invalid priority fails.
- A small dependency cycle fails.
- The observed workflow/job check, not an assumed display name, is required or its advisory status is reported honestly.
