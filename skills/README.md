# Rondo Skills

Standalone agent skills in this repository fall into two groups:

1. **Build Your Software Factory (7 stages)** — read-only audit & action-plan skills that help any team move step by step from ad-hoc coding chats to an observable, autonomous delivery loop.
2. **Core Rondo operator skills** — install Rondo, author valid tickets, and resume stalled work.

## Build Your Software Factory — 7 Audit & Recommendation Skills

Each skill is **self-contained, read-only by default, and structured as an Audit + Action Plan**: point your coding agent at one skill for your current stage, get an evidence-backed scorecard of your repository, and receive a prioritized list of concrete changes (`P0` blockers, `P1` hardening, and what *not* to build yet).

| Stage | Skill | What it audits and recommends |
|---|---|---|
| **1** | [`rondo-agent-ready`](rondo-agent-ready/SKILL.md) | Clean-checkout bootstrap, concise `AGENTS.md` / modular `skills/`, sub-2-minute local precheck, local-to-CI parity, and sensitive-path boundaries. |
| **2** | [`rondo-ticket-contract`](rondo-ticket-contract/SKILL.md) | Direct runtime access to tasks (Git-native Rondo `tickets/<slug>.md`, external tracker CLI/API, or hybrid), executable ticket contract, 1-PR step sizing, and schema validation. |
| **3** | [`rondo-dispatch-ticket`](rondo-dispatch-ticket/SKILL.md) | Serialized triggers, deterministic eligibility, concurrency caps, `ticket → branch` checkpointing, at-least-once duplicate protection, isolated sandboxes, and secret-free dry-runs. |
| **4** | [`rondo-feedback-loop`](rondo-feedback-loop/SKILL.md) | Explicit run outcomes (`Progress`, `Pause`, `Needs feedback`, `Done`), structured human decision briefs on PRs, bounded CI/review repair, SHA-bound answers, and single-writer resume. |
| **5** | [`rondo-review-gate`](rondo-review-gate/SKILL.md) | Author–reviewer context separation, domain-specialist routing, `file:line` evidence discipline, SHA-pinned `MERGE_ADVICE` vs `HUMAN_REVIEW` verdicts, and historical PR calibration. |
| **6** | [`rondo-auto-merge`](rondo-auto-merge/SKILL.md) | Deterministic policy-as-code over `head_sha`, hard blast-radius exclusions (migrations, auth, secrets, CI/policy self-edits), Rondo inter-step pause invariants, rollback, and kill switch. |
| **7** | [`rondo-production-observability`](rondo-production-observability/SKILL.md) | Commit-to-release telemetry lineage, post-deploy baseline/SLO verification windows, fast containment/rollback, deduplicated regression-to-ticket creation, and swarm readiness. |

### How to run any stage

1. **Direct prompt with URL or file path** (in Claude Code, Codex, Cursor, OpenCode, or Pi):
   ```text
   Read <URL-or-path-to-SKILL.md> and run this audit on our repository.
   Stay read-only, cite exact files and workflows, and give me the prioritized action plan.
   ```
2. **Installed repository skill:** copy `<skill-name>/SKILL.md` into `skills/<skill-name>/SKILL.md` (or `.claude/skills/` / `.cursor/skills/`) so anyone on the team can invoke it as `/<skill-name>`.

### Why swarms come after Stage 7

Parallel agent swarms only compound value once a single-agent loop can verify changes locally (1), read bounded tasks (2), dispatch safely (3), pause on ambiguity (4), review independently (5), enforce deterministic merge boundaries (6), and observe production outcomes (7). With those seven loops in place, a swarm becomes an extension: multiple agents optimizing a measurable target against a pinned baseline, a hard budget, and automatic rollback.

## Core Rondo Operator Skills

| Skill | Purpose |
|---|---|
| [`rondo-install`](rondo-install/SKILL.md) | Install or update the Rondo GitHub reference profile safely using an immutable reviewed source ref. |
| [`rondo-author-ticket`](rondo-author-ticket/SKILL.md) | Turn an informal request into a valid, reviewable Rondo ticket while preserving queue safety and dependency semantics. |
| [`rondo-resume-ticket`](rondo-resume-ticket/SKILL.md) | Resume or retire a stalled Rondo ticket safely, accounting for pauses, existing PRs, retries, and current repository reality. |
