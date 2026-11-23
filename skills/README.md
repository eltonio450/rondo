# Rondo Skills

Standalone agent skills in this repository fall into two groups:

1. **Build Your Software Factory (7 stages)** — concrete, read-only audit & build-plan skills taking an engineering team step by step from a local coding agent to an autonomous software factory.
2. **Core Rondo operator skills** — install Rondo, author valid tickets, and resume stalled work.

## Build Your Software Factory — 7 Skills

Build these 7 capabilities in your environment, in order, and you have a real software factory. Each skill is **self-contained, read-only by default, and outputs a concrete Scorecard + Build Plan** (`P0` build now, `P1` hardening, and what *not* to build yet).

| Stage | Skill | What you build in your environment |
|---|---|---|
| **1** | [`rondo-local-agent`](rondo-local-agent/SKILL.md) | **Local agent end-to-end:** paste a task to a local agent, and it builds, verifies locally (<2 min), opens a PR, watches CI/review feedback, and follows it through to merge. |
| **2** | [`rondo-ticket-access`](rondo-ticket-access/SKILL.md) | **Ticketing system access:** connect Linear, Notion, GitHub Issues, Jira, or Git tickets directly to your agent so it reads specs and updates status without manual copy-paste. |
| **3** | [`rondo-cloud-runtime`](rondo-cloud-runtime/SKILL.md) | **Cloud runtime:** run the exact same working loop in an isolated cloud VM/container/sandbox—with Git, CI, ticketing, dependencies, secrets, timeouts, and logs working when your laptop is closed. |
| **4** | [`rondo-orchestrator`](rondo-orchestrator/SKILL.md) | **Orchestrator:** automatically launch ready tasks into your cloud runtime without pressing Enter (e.g. Rondo), tracking `ticket → branch`, capping concurrency, and pausing/resuming cleanly. |
| **5** | [`rondo-review-gate`](rondo-review-gate/SKILL.md) | **Automated PR review:** an independent AI reviewer adapted to each PR's scope, risk paths, and owner—flagging real issues with `file:line` evidence and advising without merging. |
| **6** | [`rondo-merge-gate`](rondo-merge-gate/SKILL.md) | **Explicit merge gate:** testable, rule-based merge criteria on the current commit—safe changes auto-merge; critical paths (DB, auth, billing, secrets, CI rules) stay human; instant kill switch. |
| **7** | [`rondo-external-swarms`](rondo-external-swarms/SKILL.md) | **External triggers & swarms:** connect prod bugs, degrading metrics, or alerts to split work into sub-problems and launch parallel agent swarms under baselines, budgets, and rollback-first safety. |

### How to run any stage

1. **Direct prompt with URL or file path** (Claude Code, Codex, Cursor, OpenCode, or Pi):
   ```text
   Read <URL-or-path-to-SKILL.md> and run this audit on our repository.
   Stay read-only, cite exact files and workflows, and give me the prioritized build plan.
   ```
2. **Installed repository skill:** copy `<skill-name>/SKILL.md` into `skills/<skill-name>/SKILL.md` (or `.claude/skills/` / `.cursor/skills/`) so anyone on the team can invoke it as `/<skill-name>`.

## Core Rondo Operator Skills

| Skill | Purpose |
|---|---|
| [`rondo-install`](rondo-install/SKILL.md) | Install or update the Rondo GitHub reference profile safely using an immutable reviewed source ref. |
| [`rondo-author-ticket`](rondo-author-ticket/SKILL.md) | Turn an informal request into a valid, reviewable Rondo ticket while preserving queue safety and dependency semantics. |
| [`rondo-resume-ticket`](rondo-resume-ticket/SKILL.md) | Resume or retire a stalled Rondo ticket safely, accounting for pauses, existing PRs, retries, and current repository reality. |
