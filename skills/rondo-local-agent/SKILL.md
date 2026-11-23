---
name: rondo-local-agent
description: Audit and set up Stage 1 of a software factory—a local coding agent that can take a pasted task, build and verify changes locally, open a PR, watch CI and review feedback, and follow the PR through to merge.
---

# Local Agent End-to-End Setup & Audit

**Stage 1 of 7 — Build Your Software Factory**

Before cloud servers, orchestrators, or swarms, prove one concrete thing on your own machine: you copy-paste a task or PR spec to a local coding agent, and it can implement the change, verify it locally, open a clean PR, watch CI and review comments, and take it all the way to merge—without you hand-holding every command.

Use this skill to audit what currently blocks a local agent from completing a task end-to-end in this repository, and produce the shortest concrete plan to make Stage 1 work.

## Guardrails

- **Audit read-only first.** Inspect repository files, scripts, CI workflows, and local CLI status (`git`, `gh`, test runners) without modifying code, pushing branches, or merging PRs.
- **Cite evidence, not guesses.** Reference exact files, commands, and workflow jobs. Never report an unrun command as passing.
- **Never read, print, or request secret values.** Inspect `.env.example` and auth status commands (`gh auth status`), never `.env` files or raw tokens.
- **Keep it practical.** Propose the smallest changes that let a real local agent run `branch → code → test → PR → CI → merge` cleanly.

## What to inspect

Examine five concrete surfaces in this repo and local setup:

1. **Repo bootstrap & local setup**
   - Pinned runtime/tool versions (`.nvmrc`, `.node-version`, `.python-version`, `pyproject.toml`, `go.mod`, `mise.toml`, `Dockerfile`, `Makefile`, `justfile`) and lockfiles.
   - Local config template (`.env.example`) and whether running unit/type/lint checks works without live production credentials.

2. **Agent instructions & repo boundaries**
   - `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*`, `skills/`: do they state exact install, build, lint, and test commands, key architectural rules, and sensitive folders that always require human review?

3. **Fast local verification matching CI**
   - Compare local test/lint/typecheck scripts against `.github/workflows/*` (or other CI config).
   - Check whether an agent can run a fast precheck (< 2 minutes) locally that catches the same failures CI will reject—instead of pushing blind and waiting 20 minutes.

4. **End-to-end PR & CI loop from the CLI**
   - Verify whether the local agent has non-interactive Git and VCS CLI access (`git`, `gh auth status` or `glab`) to create a branch, push, open a PR with a clear template (`.github/PULL_REQUEST_TEMPLATE.md`), read CI check status/logs (`gh pr checks`, `gh run view`), read review comments, push fixes on the same branch, and follow the PR until merged.

5. **Safe stop boundaries**
   - Clear rule on whether the agent stops at "PR green & ready for human merge" or can merge after approval, and explicit instruction to pause and ask instead of guessing when requirements are ambiguous.

## Diagnostic rubric

Score each surface as `Ready`, `Partial`, `Missing`, or `Unverified`:

| Surface | Healthy (`Ready`) | Fragile (`Partial` / `Missing`) | What breaks without it |
|---|---|---|---|
| **1. Local setup** | Clean clone boots with pinned versions and `.env.example`. | Setup steps live in Slack or fail without undocumented env vars. | Agent burns turns fighting the environment before writing code. |
| **2. Repo rules** | Concise `AGENTS.md` / `CLAUDE.md` with exact commands and sensitive paths. | Missing, stale, or bloated prose nobody updates. | Agent guesses conventions or edits critical code without warning. |
| **3. Fast check = CI** | Single local precheck (< 2 min) mirrors required CI checks. | Local tests differ from CI, or only a slow full suite exists. | Endless push → wait → red CI loops. |
| **4. PR & CI CLI loop** | Agent can push, open a PR, read CI logs/review comments, and update the PR to merge. | No `gh` auth, manual PR creation, or agent can't inspect failing CI. | Human still manually shepherds every PR after the agent edits files. |
| **5. Stop rules** | Clear handoff when ready to merge or blocked on a product question. | Agent guesses silently or merges without authorization. | Unwanted changes or silent stalls. |

## Audit report format

Return the audit in this structure:

```markdown
## Stage 1 Audit — Local Agent End-to-End

**Verdict:** <Ready for Stage 2 | Partially ready | Not ready>
<2–3 concrete sentences: can a local agent take a pasted task from branch to merged PR today, and what is the #1 blocker?>

### Scorecard
| Surface | Status | Exact evidence | What breaks |
|---|---|---|---|
| Local setup | ... | `<files/commands>` | ... |
| Repo rules | ... | `<AGENTS.md/skills>` | ... |
| Fast check = CI | ... | `<scripts vs workflows>` | ... |
| PR & CI CLI loop | ... | `<git/gh/PR template>` | ... |
| Stop rules | ... | `<merge/pause rules>` | ... |

### What to build next

#### P0 — Make Stage 1 work now
1. **<Concrete step>** (`Agent PR` | `Human`)
   - **Target:** `<exact file or local setup step>`
   - **Action:** <Exact change.>
   - **Verify:** `<exact command or end-to-end test task>`

#### P1 — Hardening
1. **<Concrete step>** (`Agent PR` | `Human`)
   - **Target:** `<exact path>`
   - **Action:** <Exact improvement.>
   - **Verify:** `<exact check>`

#### Not yet — Skip for now
- <Do not build cloud runners, orchestrators, or swarms before 1 local task runs end-to-end.>

### Stage 1 exit test
Pick one small real task, paste it into your local agent, and verify it creates a branch, passes local checks, opens a PR, responds to CI/review feedback, and reaches merge with zero manual terminal babysitting. Only then move to Stage 2 (`rondo-ticket-access`).
```

End by offering to implement the `P0` repo files (`AGENTS.md`, precheck script, or PR template) on a clean branch.
