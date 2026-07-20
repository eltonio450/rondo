# Brick 4 — Scheduler and reference configuration

## Purpose

Add the serialized GitHub Actions workflow that scans tickets and owns the reference runner inputs.

## Decisions

Confirm schedule, ticket directory, detected base branch, immutable `<RONDO_REF>`, capacity, request timeout, and whether manual dispatch is enabled. Start manual-only during a pilot.

## Workflow

Create `.github/workflows/rondo.yml` without overwriting an existing file. Pin both Rondo and third-party Actions to reviewed immutable commits.

```yaml
name: Rondo Runner

on:
  workflow_dispatch:
    inputs:
      dry_run:
        description: Discover and plan without dispatching
        type: boolean
        default: true
      max_dispatches:
        description: Dispatch-attempt cap for this manual run
        type: number
        default: 1
  # Enable only after the controlled pilot:
  # schedule:
  #   - cron: "0 * * * *"

concurrency:
  group: rondo-runner
  cancel-in-progress: false

permissions:
  contents: read
  issues: write
  pull-requests: read

jobs:
  dispatch:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
      - uses: eltonio450/rondo/action@<RONDO_REF>
        with:
          dry-run: ${{ inputs.dry_run }}
          tickets-dir: "<ticketsDir>"
          base-branch: "<baseBranch>"
          agent-backend: cursor-api
          max-dispatches-per-cycle: ${{ inputs.max_dispatches }}
          request-timeout-seconds: "120"
          http-allow-insecure: "false"
        env:
          GH_TOKEN: ${{ github.token }}
          CURSOR_API_KEY: ${{ secrets.CURSOR_API_KEY }}
```

`<RONDO_REF>` must be a full reviewed commit SHA. The `actions/checkout` SHA above is the one reviewed by Rondo's own CI at the time of writing; replace it only with another reviewed immutable SHA required by host policy. Replace all angle-bracket values before delivery.

For HTTP, Brick 5 changes the backend, URL, and secret. Do not retain unused backend secrets.

## Inputs

| Input | Reference default | Notes |
|---|---|---|
| `dry-run` | `false` | No adapter construction or dispatch secret required. |
| `tickets-dir` | `tickets` | Flat direct-child scanner. |
| `branch-prefix` | `rondo/` | Suggested branch prefix. |
| `base-branch` | `main` | Installer must replace with detected default. |
| `agent-backend` | `cursor-api` | Shipped: `cursor-api`, `http`. |
| `accepted-models` | empty | Empty accepts any; `default` is always accepted. |
| `max-dispatches-per-cycle` | `10` | `1..1000`; there is no unlimited mode. Failed attempts consume capacity. |
| `request-timeout-seconds` | `120` | Integer `1..3600`; per-request network timeout. |
| `http-url` | empty | Required for HTTP. HTTPS by default. |
| `http-allow-insecure` | `false` | Explicit cleartext HTTP opt-in. |

The Action runs on Node 24; the host repo installs no Node dependency.

## Delivery and smoke test

Review, commit, push, and merge this workflow according to host policy **before** calling `gh workflow run`. The manual input defaults to a cap of `1`; scheduled events provide an empty input and the Action applies its safe default `10`. Passing `0` remains invalid and fails configuration instead of silently changing the cap.

Run a controlled real cycle explicitly with:

```bash
gh workflow run rondo.yml -f dry_run=false -f max_dispatches=1
```

## Self-check

- No Rondo or third-party Action reference uses mutable `main` or an assumed release tag.
- The workflow is serialized and least-privilege.
- All placeholders are replaced.
- The ticket directory/base branch match Brick 1 and discovery.
- Manual runs expose a cap defaulting to `1`; scheduled runs retain the configured fallback.
- The pilot is manual or conservatively scheduled.
