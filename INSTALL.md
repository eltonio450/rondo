# INSTALL — modular menu for an AI agent

> **v0.2 — adapter status.**
> The runner's environment-independent pieces are complete: orchestrator, eligibility, frontmatter, registry Issue, GitHub REST client, validator CLI. The only place installation choice matters is the **adapter** — the file that dispatches a background agent. Two adapters ship:
> - **`cursor-api`** — targets Cursor's Background Agents API (`POST /v0/agents`). Payload mirrors the dashboard "Copy API payload" shape. This is the default.
> - **`http`** — generic: POSTs a JSON dispatch payload to a URL you control and expects `{ agentId, branchName }` back. Use this when your backend doesn't have a dedicated adapter yet — run a small receiver that forwards to Claude Code remote, Codex Cloud, Twill, a self-hosted model, etc.
>
> Adapters for `claude-code-remote` and `codex-cloud` are **not shipped** as dedicated files — use the `http` backend and forward from your own infra, or write one against the contract in [`action/src/adapters/CONTRACT.md`](action/src/adapters/CONTRACT.md).

> **You are an AI coding agent (Cursor, Claude Code, Codex, etc.) installing Rondo into the repository you have access to.**
> Read this page first. It lists the **bricks** Rondo is made of. For each brick, there is a dedicated file in [`install/`](install/) with the detailed steps, the questions to ask the human, and the alternatives the human may prefer over the default.
>
> **Working rules:**
> - Run the pre-flight (below) first. Always.
> - Ask the human which bricks to install before touching anything. Default recommendation for a first install: bricks 1–6 (5 core + ticket validator).
> - Each brick file is **self-contained** and **idempotent** — re-running must not duplicate state.
> - Do **not** set GitHub secrets yourself. Print the `gh secret set` commands; the human runs them.
> - Do **not** open a PR for the install itself — commit on the current branch only.

---

## What is Rondo made of?

Rondo is the composition of **six core bricks** plus one optional one (plus uninstall). There is **no separate config file** — every runtime knob is passed to the runner as an input in the `.github/workflows/rondo.yml` file the scheduler brick creates. The only optional companion file is `rondo.prompt.md` at the repo root, picked up automatically by convention if present.

| # | Brick | What it does | Default implementation | Alternatives (see brick file) |
|---|---|---|---|---|
| 1 | **Tickets directory** | Where `.md` tickets live in the repo | `tickets/` at repo root | Any directory; one per team; nested |
| 2 | **Prompt** | The instructions passed to the dispatched agent | [`PROMPT.md`](PROMPT.md) bundled with the action | Per-repo override: drop `rondo.prompt.md` at the repo root (automatic, convention-based) |
| 3 | **Registry Issue** | Where the `slug → branchName` lookup lives | **One long-lived GitHub Issue** labelled `rondo-registry`, body rewritten each cycle | — (labels and body are owned by the runner) |
| 4 | **Scheduler** | When agents fire — and where every runtime knob is configured (via `with:`) | **GitHub Action on hourly cron** | Different cron, webhook-triggered, manual `workflow_dispatch`, external cron |
| 5 | **Agent runner** | Which background coding agent actually does the work | **Cursor Background Agents API** (one shared `CURSOR_API_KEY` secret) | Claude Code remote, Codex Cloud, Claude.ai web, Twill, per-user Cursor tokens, custom HTTP endpoint |
| 6 | **Ticket validation (CI)** | Blocks merge of PRs with malformed ticket files | GitHub Actions workflow invoking `action/src/cli/validate-tickets.mjs` | Standalone script copied in-repo; pre-commit hook |
| 7 | *Skills (optional)* | Helpers for humans authoring tickets from their IDE | Cursor + Claude Code skill files | Skip if team uses neither |
| — | *Uninstall* | Removes Rondo from the repo | Delete workflows; optionally delete tickets + close the registry Issue | — |

The 6 core bricks are what you need. The optional brick is quality-of-life.

---

## Pre-flight (always run, first)

1. Confirm you are at the repository root. If not, `cd` there.
2. Confirm `gh` CLI is authenticated: `gh auth status`. If not, **stop** and ask the human to run `gh auth login`.
3. Detect the default branch name: `gh repo view --json defaultBranchRef --jq .defaultBranchRef.name`. Remember it — several bricks need it.
4. Detect the existing Rondo footprint:
   - Does `tickets/` (or a custom tickets directory — ask if unsure) exist?
   - Does `.github/workflows/rondo.yml` exist?
   - Does `rondo.prompt.md` exist at the repo root?
   - Does an Issue with label `rondo-registry` exist?
5. If any of the above exist, **ask the human whether to continue or abort** before touching anything. "Continue" means:
   - **Existing `tickets/` dir** — leave user files alone; only seed `example.md` if the directory is empty (Brick 1 handles this).
   - **Existing `.github/workflows/rondo.yml`** — show the human the current content side-by-side with Brick 4's target, ask which `with:` keys to update. Never overwrite wholesale.
   - **Existing `rondo.prompt.md`** — do not touch unless the human explicitly opts in via Brick 2.
   - **Existing `rondo-registry` Issue** — keep it; the runner will rewrite the body on its next cycle.
   - **Legacy `rondo:status:*` labels from pre-v0.1 installs** — leave them, they're harmless noise; point the human at `install/99-uninstall.md` if they want a cleanup.

---

## Ask the human which bricks to install

Present this menu verbatim. Wait for the human's answer before running anything. The human may pick any subset — and can re-run any brick later.

```
[ ] 1. Tickets directory      — install/01-tickets-dir.md
[ ] 2. Prompt                 — install/02-prompt.md
[ ] 3. Registry Issue         — install/03-state-store.md
[ ] 4. Scheduler              — install/04-scheduler.md
[ ] 5. Agent runner           — install/05-agent-runner.md
[ ] 6. Ticket validation (CI) — install/06-validate-tickets.md
[ ] 7. Skills (optional)      — install/07-skills.md
[ ] —  Uninstall              — install/99-uninstall.md

Recommended first install: 1 + 2 + 3 + 4 + 5 + 6.
```

---

## Run each chosen brick in order

For each brick the human picked, open the corresponding file under [`install/`](install/), read it in full, and execute it. Each brick file follows the same shape:

1. **What it does** — one line.
2. **Default we ship** — the reference choice and why.
3. **Questions to ask the human** — present verbatim, record answers.
4. **Steps** — the idempotent commands to run or files to write.
5. **Alternatives** — the other implementations you can wire instead. Only documented; not shipped as code today.
6. **Self-check** — confirm the brick is installed before moving on.

**Order matters** only in that Brick 1 (tickets dir) should precede Bricks 2–5 (they reference the directory name), and Brick 4 (Scheduler) should run before Brick 5 (Agent runner) adds backend-specific env vars to the workflow file created by Brick 4. Brick 6 (validation) can run anytime after Brick 1. Optional brick 7 can run anytime after the core set.

---

## When all chosen bricks are installed

1. Stage only the files you created or modified.
2. Commit with:

   ```
   chore(rondo): install bricks <list>

   Installed via INSTALL.md.
   ```

3. **Smoke-test the install before declaring success.** After the human has set the secret(s) from Brick 5, run the workflow in dry-run mode to catch any wiring mistake without dispatching real agents:

   ```bash
   gh workflow run rondo.yml -f dry_run=true
   # wait for the run to complete, then check the log:
   gh run list --workflow=rondo.yml --limit 1 --json databaseId --jq '.[0].databaseId' \
     | xargs -I{} gh run view {} --log
   ```

   Look for a line containing `cycle done — dispatched 0, skipped <N>, failed 0`. If you see `failed > 0` or the run errors out, inspect the log — common causes: missing `CURSOR_API_KEY` secret, Cursor GitHub App not installed on the repo (Brick 5 prereq), malformed `<ticketsDir>` path, or `GH_TOKEN` missing `issues: write` permission.

   If the human prefers, they can run this themselves instead — print the commands.

4. Print this message verbatim to the human:

   > ✅ Rondo bricks installed: `<list>`. Smoke-test passed (`cycle done` with 0 failures).
   >
   > Next:
   > 1. Edit a ticket file in `<ticketsDir>/` and describe a real piece of work.
   > 2. Push this commit. The scheduler fires on its configured cadence; trigger it early via **Actions → Rondo Runner → Run workflow** (uncheck dry-run this time).
   > 3. Watch the Issues tab — a single Issue with label `rondo-registry` will appear, and its body will list every ticket currently on the queue.
   >
   > Docs: <repo URL>/blob/<base-branch>/README.md

---

## What you must NOT do

- Do **not** set GitHub secrets yourself (the human must).
- Do **not** open any PR as part of the install — only commit on the current branch.
- Do **not** modify any pre-existing workflow file other than the new `rondo*.yml` files.
- Do **not** silently overwrite `tickets/` or `rondo.prompt.md` — always ask first.
- Do **not** add host-repo npm dependencies. The runner lives in a reusable GitHub Action; nothing is installed on the host machine.
- Do **not** invent bricks that are not in this list. If the human asks for something exotic (a new state store, a new runner), point them at the alternatives section of the relevant brick file and offer to stub a PR against the Rondo repo instead.
