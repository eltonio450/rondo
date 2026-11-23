---
name: rondo-orchestrator
description: Audit and design Stage 4 of a software factory—adding an orchestrator (such as Rondo) that automatically dispatches ready tickets into your cloud runtime without manual starts, tracks ticket-to-branch state, caps concurrency, and handles clean pause/resume.
---

# Automated Orchestrator Setup & Audit

**Stage 4 of 7 — Build Your Software Factory**

Once your ticketing system is connected (Stage 2) and your cloud runtime works reliably on a single manually launched task (Stage 3), Stage 4 removes the last manual trigger: an **orchestrator** (such as Rondo, a scheduled GitHub Action, or a lightweight queue worker) watches for ready tasks and launches them into your cloud runtime automatically—without duplicate PRs, race conditions, or runaway spend.

Use this skill to audit existing dispatch/orchestration mechanics (or design your first orchestrator loop) and produce a safe, phased rollout plan.

## Guardrails

- **Audit read-only first.** Inspect workflows, orchestrator configs, adapters, state registries, and open PRs without launching live cloud runs or mutating tickets.
- **Treat dispatch as at-least-once.** Network calls, webhooks, and remote APIs can time out *after* starting an agent. Evaluate how duplicates are prevented and reconciled—never claim "exactly once."
- **Require a secret-free dry-run first.** Never recommend turning on live auto-launch before a dry-run proves which tickets would be selected and why.
- **Never read, print, or request secret values.** Pin workflow/orchestrator references to immutable commit SHAs.

## What to inspect

Examine six concrete surfaces:

1. **Triggers & scheduler serialization**
   - How cycles fire: schedule (`cron`), webhook (`ready` label/status change), `pull_request` merge/close, or manual `workflow_dispatch`.
   - Serialization (`concurrency:` group or lock/lease) so two cycles can never scan the queue and launch the same task simultaneously.

2. **Deterministic eligibility rules**
   - Mechanical selection before any agent boots:
     - valid ticket contract;
     - explicit `ready` / not `paused` state (boolean or future date);
     - upstream dependencies resolved;
     - deterministic priority ordering;
     - **open-PR check**: skip any ticket that already has an open PR on its tracked branch (never confuse external fork branches with repository branches).

3. **Durable `ticket → branch` state & idempotency**
   - Where active ticket-to-branch mappings persist across cycles (e.g. Rondo's `rondo-registry` GitHub Issue, a database table, or durable state file).
   - Checkpointing: does the orchestrator save the branch immediately after each launch, and send an idempotency key to the cloud runtime?

4. **Concurrency caps & spend safety**
   - Hard cap on concurrent cloud agents and dispatches per cycle (start at **1**, scale only after clean runs).
   - Fail-closed behavior when the registry is malformed or the budget/cap is reached.

5. **Clean pause, human handoff & single-writer resume**
   - Explicit run outcomes (`Progress`, `Pause`, `Needs feedback`, `Done`) instead of silent failure in cloud logs.
   - When an agent hits ambiguity, it pauses, posts a short structured question (context + 2 options + recommendation) on the PR/ticket, and frees the cloud runner.
   - When a human answers or CI fails, bounded retries (e.g. max 2–3 attempts) resume on the **same branch**—never launching two concurrent writers onto one branch.

6. **Adapter boundary (keeping provider choice portable)**
   - Clean separation between the orchestrator (selecting tickets and tracking branches, like Rondo) and the cloud runtime adapter (Cursor API, HTTP receiver, Claude/Codex runner) so you can swap models or hosts without rewriting your queue.

## Diagnostic rubric

Score each surface as `Ready`, `Partial`, `Missing`, or `Unverified`:

| Surface | Healthy (`Ready`) | Fragile (`Partial` / `Missing`) | What breaks without it |
|---|---|---|---|
| **1. Serialized triggers** | Event/cron triggers with strict concurrency lock. | Overlapping webhooks or cron jobs scan the queue together. | Duplicate cloud agents race on the same ticket. |
| **2. Eligibility filter** | Deterministic check of ready state, dependencies, and open PRs. | Launches every open issue blindly or relies on an LLM to pick. | Blocked, vague, or already-active tickets waste compute. |
| **3. State & idempotency** | Durable `ticket → branch` registry checkpointed per launch + idempotency key. | Stateless launcher with no memory of in-flight runs. | Network retries spawn duplicate PRs for one task. |
| **4. Concurrency & dry-run** | Hard cap (`1` initially) + secret-free dry-run printing exact selections. | Uncapped parallel fan-out with no dry-run mode. | One bad label change launches 30 agents overnight. |
| **5. Pause & resume loop** | Structured pause briefs, bounded CI retries, single-writer branch resume. | Agents guess silently, loop endlessly, or stall in unread logs. | Unattended runs burn budget or require manual branch rescue. |

## Audit report format

Return the audit in this structure:

```markdown
## Stage 4 Audit — Automated Orchestrator

**Verdict:** <Ready for Stage 5 | Partially ready | Not ready>
<2–3 concrete sentences: can ready tickets launch automatically into your cloud runtime today without duplicates or runaway spend?>

### Scorecard
| Surface | Status | Exact evidence | What breaks |
|---|---|---|---|
| Serialized triggers | ... | `<workflows/webhooks/locks>` | ... |
| Eligibility filter | ... | `<rules/open-PR check>` | ... |
| State & idempotency | ... | `<registry/branch mapping>` | ... |
| Concurrency & dry-run | ... | `<caps/dry-run mode>` | ... |
| Pause & resume loop | ... | `<outcomes/handoff/retry cap>` | ... |

### Recommended orchestrator setup
<Concrete 10-line design—for example Rondo (`SPEC.md` + `rondo-install`) or a lightweight serialized dispatcher connected to the Stage 3 cloud runtime—with explicit cap=1 rollout steps.>

### What to build next

#### P0 — Wire safe auto-launch now
1. **<Concrete step>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact workflow, orchestrator config, or adapter>`
   - **Action:** <Exact change.>
   - **Verify:** `<exact dry-run command showing eligible vs skipped tickets>`

#### P1 — Hardening
1. **<Concrete step>** (`Agent PR` | `Human`)
   - **Target:** `<exact path>`
   - **Action:** <Exact improvement.>
   - **Verify:** `<exact check>`

#### Not yet — Skip for now
- <Do not enable auto-merge (Stage 6) or multi-agent swarms (Stage 7) before single-ticket orchestration runs cleanly for a week.>

### Stage 4 exit test
1. Run dry-run and confirm it selects the exact expected ticket and skips paused/blocked/open-PR items.
2. Enable live orchestration with `cap = 1`, mark one real ticket ready, and verify it launches in the cloud, opens one PR, pauses cleanly if blocked, and never spawns a duplicate on the next cycle. Only then move to Stage 5 (`rondo-review-gate`).
```

End by offering to scaffold the `P0` orchestrator workflow, Rondo installation, or dry-run test harness on a branch.
