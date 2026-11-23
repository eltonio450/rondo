---
name: rondo-feedback-loop
description: Audit how coding agents handle ambiguity, failing CI, review comments, and external blockers—covering structured PR decision briefs, pause/resume semantics, SHA-bound answers, and single-writer branch safety—and recommend a reliable feedback loop.
---

# Structured Feedback & Resume Loop Audit

**Stage 4 of 7 — Build Your Software Factory**

Unattended runs break down when an agent hits an ambiguous requirement or a red CI job and either guesses silently, loops until its budget burns out, or dies in an unread log. Stage 4 turns blockers, CI failures, and review comments into structured, SHA-bound handoffs on the pull request and ticket—releasing compute while waiting for a human and resuming cleanly on the same branch once answered.

Use this skill to audit how blockers and human feedback flow today and recommend a clean pause-and-resume protocol.

## Guardrails

- **Audit read-only first.** Inspect prompts, skills, workflows, PR templates, and recent PR/ticket patterns without posting comments, editing open pull requests, or mutating issue state.
- **Keep feedback separate from review and merge authority.** Answering an agent's product question unblocks implementation; it never counts as technical code review (Stage 5) or merge approval (Stage 6).
- **Never read, print, or request secret values.**
- **Assume concurrent writers are unsafe.** Never recommend a resume trigger that launches a second agent onto a branch while an earlier run may still be pushing commits.

## What to inspect

Examine five surfaces across prompts, repository docs, and CI workflows:

1. **Explicit agent outcome contract**
   - Agent prompts and skills (`PROMPT.md`, `rondo.prompt.md`, `AGENTS.md`, `skills/`): check whether every run must end in one explicit, observable outcome—such as `Progress`, `Pause`, `Needs feedback` (`No-op`), or `Done`—materialized in a single pull request rather than buried in provider logs.
   - Anti-guessing rules: whether instructions explicitly forbid inventing product behavior, permissions, or schema choices when acceptance criteria conflict with code reality.

2. **Human decision-brief quality**
   - How blocked agents communicate with humans on PRs or tickets. Check whether handoffs include seven essentials: (1) exact decision or action needed, (2) concise context and blocker cause, (3) concrete evidence (reproduction, failing check, SHA, diff), (4) 2–3 options with trade-offs and a clear recommendation, (5) named accountable `owner`, (6) what the answer authorizes next, and (7) the exact resume point.

3. **CI failure and review-comment ingestion**
   - What happens after an agent opens a PR and CI fails or a human requests changes: does a bounded repair workflow feed failing check logs and review threads back to an agent on the *same* branch, or does the PR stall until a developer checks out the branch manually?
   - Loop bounds: maximum automated repair attempts per PR/step before escalating to a human so flaky or architectural failures do not cycle endlessly.

4. **Pause, wake, and stale-state protection**
   - Durable pause markers (such as `paused: true`, `paused: YYYY-MM-DD`, or an explicit tracker status) that stop the Stage 3 scheduler from re-dispatching while waiting on human input, freeing compute immediately.
   - Version/SHA binding: whether human answers and status transitions check that the underlying ticket revision or branch SHA has not drifted, and prevent duplicate webhook deliveries from launching double runs.

5. **Single-PR and single-writer discipline**
   - Resume skills (such as `rondo-resume-ticket`) and branch rules ensuring retries, follow-up fixes, and human handoffs reuse the existing open PR on the tracked branch, and confirm any previous writer has stopped before taking over.

## Diagnostic rubric

Score each dimension as `Ready`, `Partial`, `Missing`, or `Unverified`:

| Dimension | Healthy signal (`Ready`) | Fragile signal (`Partial` / `Missing`) | Failure mode if left unfixed |
|---|---|---|---|
| **1. Explicit run outcomes** | Agents must choose `Progress`, `Pause`, `Needs feedback`, or `Done` and record it in the ticket/PR. | Prompts only say "implement the ticket"; failure paths are undefined. | Agents hallucinate requirements or fail silently in background logs. |
| **2. Actionable decision briefs** | Blocked runs post options, evidence, a recommendation, a named `owner`, and a resume point. | Vague comments ("I got stuck") or raw 300-line stack traces. | Humans spend longer decoding the agent than doing the task themselves. |
| **3. Bounded CI/PR repair** | Failing checks and review comments route back onto the existing PR branch with a strict retry cap (e.g., 1–2 attempts). | Red PRs sit abandoned, or retry bots push infinite broken commits. | Review queues clog with half-finished PRs or noisy commit storms. |
| **4. Durable pause & SHA binding** | Waiting work enters an explicit paused state, releases compute, and binds decisions to current state/SHA. | Active polling loops, implicit timeouts treated as approval, or stale comments re-triggering old plans. | Wasted compute and outdated answers overwriting newer code. |
| **5. Single-branch resume** | Resume flows reconstruct state from repo + open PR + registry before editing, enforcing one writer per branch. | Retries open fresh branches/PRs or race against an still-running session. | Duplicate PRs, force-push conflicts, and lost review comments. |

## How to formulate recommendations

- **Standardize a short decision-brief template first.** Adding a 15-line blocker/handoff contract to the agent prompt and resume skill costs zero infrastructure and immediately stops silent guessing.
- **Pause in durable state, never in a sleeping process.** Recommend recording `paused:` (or tracker `waiting_for_human`) and exiting the run cleanly so the next scheduled or event-driven cycle resumes from committed state once a human responds.
- **Add automated PR repair cautiously.** Before wiring webhook bots onto every PR comment, start with an explicit resume skill (`rondo-resume-ticket`) plus a bounded CI-repair trigger capped at one or two attempts per human push/review, triggered only by authorized repository contributors.
- **Never treat silence as consent.** Escalation timers may remind an `owner` or route to a backup reviewer, never auto-approve an open product or risk question.

## Audit report format

Return the audit in this structure:

```markdown
## Stage 4 Audit — Structured Feedback & Resume Loop

**Verdict:** <Ready for Stage 5 | Partially ready | Not ready>
<2–3 sentences describing what happens today when an agent blocks or fails CI, what state survives across attempts, and the sharpest handoff gap.>

### Scorecard

| Dimension | Status | Repository / workflow evidence | Failure mode / risk |
|---|---|---|---|
| Explicit run outcomes | ... | `<prompts/skills inspected>` | ... |
| Actionable decision briefs | ... | `<templates/PR conventions>` | ... |
| Bounded CI/PR repair | ... | `<workflows/triggers/caps>` | ... |
| Durable pause & SHA binding | ... | `<pause fields/state transitions>` | ... |
| Single-branch resume | ... | `<resume skill/branch locking>` | ... |

### Recommended handoff & resume protocol
<Compact specification (10–15 lines) showing the outcome states, decision-brief template, pause marker, and bounded repair rule for this repository.>

### What to do next

#### P0 — Fix now (Stage 4 blockers)
1. **<Short imperative title>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact prompt, skill, template, or workflow path>`
   - **Action:** <Concrete change.>
   - **Verify:** `<exact scenario check—e.g., ambiguous ticket or failing check dry-run>`

#### P1 — High-impact hardening
1. **<Short imperative title>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact path>`
   - **Action:** <Concrete improvement.>
   - **Verify:** `<exact check>`

#### Not yet — Skip for now
- <1–2 traps to defer, such as unauthenticated PR-comment webhooks that let external commenters steer repository agents.>

### Stage 4 exit gate
<3–4 concrete proofs confirming blocked and red-CI runs leave an owner-assigned, SHA-pinned, single-PR state that resumes cleanly without losing prior context, before advancing to Stage 5 (`rondo-review-gate`).>
```

End by asking whether the human wants you to draft the `P0` feedback/resume instructions or PR handoff template on a branch.
