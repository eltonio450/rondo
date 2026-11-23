---
name: rondo-local-agent
description: Audit and set up Stage 1 of a software factory—a local coding agent that can build a real feature autonomously, run and test its changes in a working local environment, open a PR, watch CI and review feedback, and follow it through to merge.
---

# Local Agent End-to-End Setup & Audit

**Stage 1 of 7 — Build Your Software Factory**

Before cloud servers, orchestrators, or swarms, prove one concrete thing on your own machine: you paste a feature or task to a local coding agent, and it can implement the feature autonomously, test its own changes in a real working environment (app, local DB/services, tests, checks), open a clean PR, watch CI and review comments, and follow it all the way to merge—without you hand-holding every step.

Use this skill to check whether your repo is already there. If yes, you're ready for Stage 2. If not, use the build plan below to get there.

## Guardrails

- **Audit read-only first.** Inspect repository files, scripts, local env setup, CI workflows, and CLI status (`git`, `gh`, test runners) without modifying code, pushing branches, or merging PRs.
- **Cite evidence, not guesses.** Reference exact files, commands, and workflow jobs. Never report an unrun command as passing.
- **Never read, print, or request secret values.** Inspect `.env.example` and safe auth status (`gh auth status`), never `.env` files or raw tokens.
- **Keep it practical.** Propose the smallest changes that let a real local agent build a feature, test it in a real local environment, open a PR, and reach merge cleanly.

## What to inspect

Examine five concrete surfaces in this repo and local setup:

1. **Working local test environment**
   - Can an agent actually boot the app/services locally (pinned runtime versions, lockfiles, `.env.example`, Docker Compose / local DB / seed fixtures / dev server) and test a real feature change end-to-end—without undocumented manual clicks or live production credentials?

2. **Agent instructions & repo boundaries**
   - `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*`, `skills/`: do they state exact commands to boot the local env, run tests/checks, verify UI or API behavior, and flag sensitive folders that always require human review?

3. **Fast local verification matching CI**
   - Compare local test/lint/typecheck/e2e scripts against `.github/workflows/*` (or other CI config).
   - Check whether an agent can verify its feature locally in under 2 minutes with the same checks CI enforces—instead of pushing blind and waiting 20 minutes.

4. **End-to-end PR & CI loop from the CLI**
   - Verify whether the local agent has non-interactive Git and VCS CLI access (`git`, `gh auth status` or `glab`) to create a branch, push, open a PR with a clear template (`.github/PULL_REQUEST_TEMPLATE.md`), read CI check status/logs (`gh pr checks`, `gh run view`), read review comments, push fixes on the same branch, and follow the PR until merged.

5. **Safe stop boundaries**
   - Clear rule on whether the agent stops at "PR green & ready for human merge" or can merge after approval, and explicit instruction to pause and ask instead of guessing when requirements are ambiguous.

## Diagnostic rubric

Score each surface as `Ready`, `Partial`, `Missing`, or `Unverified`:

| Surface | Healthy (`Ready`) | Fragile (`Partial` / `Missing`) | What breaks without it |
|---|---|---|---|
| **1. Local test env** | Agent can boot the app/services/DB locally and test a real feature end-to-end. | Setup steps live in Slack or require undocumented manual tweaks. | Agent edits code blind and can't verify its feature actually works. |
| **2. Repo rules** | Concise `AGENTS.md` / `CLAUDE.md` with exact commands and sensitive paths. | Missing, stale, or bloated prose nobody updates. | Agent guesses conventions or edits critical code without warning. |
| **3. Fast check = CI** | Local precheck (< 2 min) mirrors required CI checks. | Local tests differ from CI, or only a slow full suite exists. | Endless push → wait → red CI loops. |
| **4. PR & CI CLI loop** | Agent can push, open a PR, read CI logs/review comments, and update the PR to merge. | No `gh` auth, manual PR creation, or agent can't inspect failing CI. | Human still manually shepherds every PR after the agent edits files. |
| **5. Stop rules** | Clear handoff when ready to merge or blocked on a product question. | Agent guesses silently or merges without authorization. | Unwanted changes or silent stalls. |

## Audit report format

Return the audit in this structure:

```markdown
## Stage 1 Audit — Local Agent End-to-End

**Verdict:** <Ready — move to Stage 2 | Not there yet — build plan below>
<2–3 concrete sentences: can a local agent build a real feature, test it in a working local environment, open a PR, and follow it to merge today? What is the #1 blocker?>

### Scorecard
| Surface | Status | Exact evidence | What breaks |
|---|---|---|---|
| Local test env | ... | `<compose/scripts/.env.example>` | ... |
| Repo rules | ... | `<AGENTS.md/skills>` | ... |
| Fast check = CI | ... | `<scripts vs workflows>` | ... |
| PR & CI CLI loop | ... | `<git/gh/PR template>` | ... |
| Stop rules | ... | `<merge/pause rules>` | ... |

### What to build to get there

#### P0 — Fix now (Stage 1 blockers)
1. **<Concrete step>** (`Agent PR` | `Human`)
   - **Target:** `<exact file or local env step>`
   - **Action:** <Exact change.>
   - **Verify:** `<exact command or end-to-end feature check>`

#### P1 — Hardening
1. **<Concrete step>** (`Agent PR` | `Human`)
   - **Target:** `<exact path>`
   - **Action:** <Exact improvement.>
   - **Verify:** `<exact check>`

#### Not yet — Skip for now
- <Do not build cloud runners, orchestrators, or swarms before 1 local feature runs end-to-end.>

### Stage 1 exit test
Pick one small real feature, paste it into your local agent, and verify it implements the change, tests it in a working local environment, passes local checks, opens a PR, responds to CI/review feedback, and reaches merge without hand-holding. If yes, you're ready for Stage 2 (`rondo-ticket-access`).
```

End by offering to implement the `P0` setup (`AGENTS.md`, local env/precheck script, or PR template) on a clean branch.
