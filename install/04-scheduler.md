# Brick 4 — Scheduler

## What it does

Fires the runner on a cadence **and** configures every runtime knob in the same file. The runner scans the tickets directory, evaluates eligibility, and dispatches one agent per eligible ticket. The workflow YAML created in this brick is **the only config surface** — there is no separate `rondo.config.json`.

## Default we ship

**A GitHub Action on an hourly cron.** The workflow lives at `.github/workflows/rondo.yml` in the host repo and calls the reusable action `eltonio450/rondo/action@v0.1`.

Why this default:
- You already use GitHub Actions. No new infra to host.
- One file to configure Rondo — no separate JSON config to keep in sync.
- Hourly is fast enough for human-scale teams (agents pick up the next step within an hour of the previous PR merging) and slow enough that even a 3.2M-line monorepo stays well under GitHub Actions' free tier.
- `workflow_dispatch` is included so humans can trigger off-cycle from the Actions UI when they just merged a PR and want the next step now.
- `concurrency: group: rondo-runner` guarantees no two runners race. Combined with the hourly cadence, this is also what keeps the system safe from double-dispatch without any persisted "in-flight" status.

## Questions to ask the human

1. *"Schedule: hourly (default) or something else?"* — accept any valid cron; record as `<cron>`.
2. *"Allow manual triggering from the Actions UI? (default: yes)"*
3. *"Workflow name in the Actions tab? (default: `Rondo Runner`)"*
4. *"Tickets directory (from Brick 1)? (default: `tickets`)"* — record as `<ticketsDir>`.
5. *"Base branch the runner targets? (default: the repo's default branch detected during pre-flight)"* — record as `<baseBranch>`.

## Steps

1. Create `.github/workflows/rondo.yml`:

   ```yaml
   name: Rondo Runner

   on:
     schedule:
       - cron: "0 * * * *" # every hour — replace with <cron> if different
     workflow_dispatch:
       inputs:
         dry_run:
           description: "Log eligible tickets without launching agents"
           type: boolean
           default: false

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
         - uses: actions/checkout@v4
         - uses: eltonio450/rondo/action@v0.1
           with:
             dry-run: ${{ inputs.dry_run }}
             tickets-dir: <ticketsDir>
             base-branch: <baseBranch>
             # Uncomment/edit only the keys you want to override from the defaults:
             # branch-prefix: "rondo/"
             # agent-backend: "cursor-api"
             # accepted-models: "claude-sonnet-4-6,cursor-fast"
           env:
             GH_TOKEN: ${{ github.token }}
             # Brick 5 (Agent runner) adds one backend-specific secret env var here.
             CURSOR_API_KEY: ${{ secrets.CURSOR_API_KEY }}
   ```

2. Substitute `<cron>`, `<ticketsDir>`, and `<baseBranch>` with the human's answers. Default cron if not specified: `"0 * * * *"` (hourly).
3. Adjust the `name:` per the human's answer. If manual triggering was declined, remove the `workflow_dispatch:` block (and the `${{ inputs.dry_run }}` reference — replace with `"false"`).
4. Tell the human no secrets are set yet — Brick 5 handles the secrets specific to their chosen agent runner.

**Inputs reference** (every knob Rondo accepts — all optional except when noted):

| Input | Default | Meaning |
|---|---|---|
| `dry-run` | `"false"` | Log eligible tickets without dispatching. |
| `tickets-dir` | `"tickets"` | Directory containing ticket `.md` files. |
| `branch-prefix` | `"rondo/"` | Prefix for agent branches (must end with `/`). |
| `base-branch` | `"main"` | Branch PRs target and new branches are cut from. |
| `agent-backend` | `"cursor-api"` | `cursor-api` · `claude-code-remote` · `codex-cloud` · `http`. |
| `accepted-models` | `""` | Comma-separated allowlist (empty = accept any model). `"default"` is always accepted. |
| `http-url` | `""` | **Required** when `agent-backend: "http"`. |

## Alternatives (documented, not implemented by default)

- **Different cron cadence** — every 15 min, every 4 hours, weekdays only. Already supported — just edit the `cron:` line.
- **Webhook-triggered runner** — fire on `push` to `main` so the runner scans as soon as a ticket is committed. Useful for teams that want near-real-time dispatch. Trivial to add: change the `on:` block. Caveat: still serialize via `concurrency:`.
- **Manual-only runner** — drop `schedule:`, keep `workflow_dispatch:`. For teams piloting Rondo who want to dispatch by hand at first.
- **External cron (not GitHub Actions)** — a cron job on your own infra that calls the runner script directly. Requires packaging the runner as an npm binary (not shipped as such in v0.1; the reusable Action is the contract).
- **Event-driven runner via GitHub Apps** — a dedicated Rondo GitHub App listening to `push` / `pull_request` events. Tighter coupling, no Actions minutes used. Not implemented; meaningful complexity to operate an App.
- **Long-running worker (Kubernetes, ECS, Twill)** — a permanent process watching the repo. Eliminates cron startup latency; costs more to operate. Not implemented.

## Self-check

- [ ] `.github/workflows/rondo.yml` exists and references `eltonio450/rondo/action@v0.1`.
- [ ] The cron matches the human's chosen cadence.
- [ ] The `concurrency:` block is present.
- [ ] `tickets-dir` and `base-branch` in the `with:` block match the human's answers.
- [ ] No secret is set yet (Brick 5 prints the secret command).
