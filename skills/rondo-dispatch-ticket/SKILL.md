---
name: rondo-dispatch-ticket
description: Audit how ready tickets are automatically selected and dispatched to coding agents—covering triggers, deterministic eligibility, concurrency caps, idempotency, branch checkpointing, runtime isolation, and secret-free dry-runs—and recommend a safe dispatch loop.
---

# Automated Ticket Dispatch Audit

**Stage 3 of 7 — Build Your Software Factory**

Manual prompting caps a team's throughput at human attention. Once repository checks are reliable (Stage 1) and tickets follow a machine-readable contract (Stage 2), Stage 3 introduces a deterministic dispatch loop: ready work starts automatically inside an isolated runtime, while ineligible, paused, or already-active work stays untouched with a clear reason.

Use this skill to audit existing dispatch mechanics—or design the first automated loop—without risking duplicate pull requests, race conditions, or runaway spend.

## Guardrails

- **Audit read-only first.** Inspect workflows, runner scripts, adapters, state registries, and existing pull requests without triggering live agent runs, mutating issues, or setting secrets.
- **Never claim exactly-once dispatch.** Remote agent APIs, webhooks, and CI jobs fail ambiguously across network boundaries. Treat dispatch as **at least once** and evaluate how duplicates are prevented and reconciled.
- **Never read, print, or request secret values.** When secrets are required later, output the exact `gh secret set ...` or secret-manager command for a human operator.
- **Pin third-party and runner code to immutable commit SHAs.** Never recommend floating `@main` references in workflows that hold repository or agent-provider credentials.
- **Require a secret-free dry-run before any live dispatch.** And never trigger a newly authored remote workflow until its file has landed on the target branch required by the host platform.

## What to inspect

Examine six operational surfaces:

1. **Triggers and scheduler serialization**
   - Workflow triggers (`schedule`, `workflow_dispatch`, `pull_request` close/merge, issue/label webhooks, or local launchd/systemd timers).
   - Concurrency groups (`concurrency:` in GitHub Actions or lockfiles/leases elsewhere) ensuring two scheduler cycles cannot scan and dispatch the same queue simultaneously.

2. **Deterministic eligibility rules**
   - How a cycle decides which tickets are runnable right now: schema validity, explicit `paused` state (boolean or future `YYYY-MM-DD`), upstream dependency completion, allowed model list, and deterministic ordering (for example, numeric `priority` then `slug`).
   - Open-PR suppression: whether the dispatcher checks same-repository open pull requests on the ticket's tracked branch before launching another run—and avoids confusing fork branches (`fork:rondo/foo`) with repository heads.

3. **State registry, idempotency, and retry safety**
   - Where `ticket → branch` and attempt state persist across cycles (for example, a labelled `rondo-registry` GitHub Issue, a transactional database, or a local state file) and whether branch mappings are checkpointed immediately as each dispatch succeeds.
   - Deterministic idempotency keys passed to the agent backend, and agent-side prompt instructions requiring retry runs to reuse an existing open PR rather than opening duplicates.
   - Ambiguous-timeout handling: what happens when the HTTP call times out at 120 seconds while the remote agent is still booting and opens a PR five minutes later.

4. **Runtime isolation and credential boundaries**
   - Where agents actually execute: hosted background-agent APIs (Cursor, Codex/Claude cloud receivers), ephemeral containers/microVMs, or local Git worktrees on a dedicated host.
   - Isolation guarantees: separate working tree per run, clean base-branch checkout, bounded wall-clock timeout, HTTPS-only outbound dispatch by default, and scoped repository/provider tokens injected via infrastructure rather than prompt text.

5. **Capacity bounds and cost controls**
   - Hard per-cycle dispatch cap (for example, `max-dispatches-per-cycle`, counting failed attempts against the cap so broken backends do not spin through an entire backlog).
   - Availability of a zero-side-effect `dry-run` mode that computes and logs eligibility without requiring provider API keys.

6. **Operator visibility**
   - Run summaries and structured logs showing every scanned ticket, why skipped tickets were skipped (`paused`, `blocked by dependency`, `open PR #42`, `cap reached`), which branch was assigned, and any adapter error—without leaking prompts containing sensitive payloads or tokens.

## Reference architecture vs host ports

When evaluating or recommending Rondo alongside custom automation, keep protocol invariants separate from replaceable ports:

| Concern | Rondo reference profile | Alternative / custom port |
|---|---|---|
| **Queue & eligibility** | Scans `tickets/<slug>.md`, enforces `paused`, `depends`, model allowlist, and deterministic `priority` → `slug` order. | Query Linear/GitHub Issues for a strict `ready` state with equivalent deterministic filtering. |
| **Branch tracking** | One `rondo-registry` Issue stores `slug → actual branch`, checkpointed per dispatch; checks open PRs before re-dispatching. | Store `ticket_id → branch / active_pr` in a database or tracker custom field with compare-and-set updates. |
| **Scheduler** | Serialized GitHub Actions cron + `workflow_dispatch` with `dry_run`. | Event-driven worker queue or dedicated server timer with single-leader locking. |
| **Agent adapter** | Built-in `cursor-api` or signed/HTTPS `http` adapter to your own agent runner. | Custom container/VM job runner, Codex/Claude CLI bridge, or internal orchestrator implementing the same idempotent request contract. |

## Diagnostic rubric

Score each dimension as `Ready`, `Partial`, `Missing`, or `Unverified`:

| Dimension | Healthy signal (`Ready`) | Fragile signal (`Partial` / `Missing`) | Failure mode if left unfixed |
|---|---|---|---|
| **1. Serialized trigger** | One scheduler path with explicit concurrency locking and manual `dry-run` trigger. | Overlapping webhook/cron runs or manual scripts with no lock. | Two agents launch simultaneously on the same ticket. |
| **2. Eligibility precision** | Deterministic ordering; honors pauses, dependencies, and existing same-repo open PRs. | Loose label triggers (`ai-todo`) with no PR check or dependency check. | Agents re-run tickets that already have open PRs awaiting review. |
| **3. At-least-once safety** | Checkpointed `ticket → branch` registry, idempotency keys, and single-PR reuse instructions. | Blind retries on timeout; no durable record of assigned branches. | Duplicate PRs, wasted tokens, and conflicting branches after transient network errors. |
| **4. Isolated, bounded runtime** | Clean checkout/sandbox per run, hard runtime/request timeouts, scoped secrets, HTTPS transport. | Shared dirty working directory or broad personal credentials inside prompts. | Cross-ticket file contamination or credential exposure. |
| **5. Cap & progressive rollout** | Hard per-cycle cap (tested at `1` first), failed attempts counted, secret-free dry-run verified. | Unbounded fan-out across every matching issue on first enablement. | Instant API bill spike and twenty simultaneous broken PRs. |

## How to formulate recommendations

- **Design for rollout in three gated steps:** (1) merge the workflow/runner with scheduled triggers disabled or capped, (2) run `dry-run` with zero provider secrets and verify eligibility output on real tickets, (3) run one live cycle capped at `1` ticket and inspect the checkpointed branch, provider session, cost, and resulting PR before enabling a schedule.
- **Match the runtime to team constraints.** If the team already uses GitHub Actions and Cursor or an HTTPS agent receiver, recommend Rondo's reference profile pinned to a reviewed 40-character commit SHA (`<RONDO_REF>`). If they run agents on a dedicated VM or container cluster, keep the exact same eligibility, concurrency cap, and branch-registry invariants over an HTTPS or queue adapter—and note clearly that a laptop cron job stops whenever the lid closes.
- **Protect against duplicate work at two layers.** Enforce open-PR suppression in the dispatcher *and* instruct the agent prompt to inspect existing open PRs on its assigned branch before creating a new one.

## Audit report format

Return the audit in this structure:

```markdown
## Stage 3 Audit — Automated Ticket Dispatch

**Verdict:** <Ready for Stage 4 | Partially ready | Not ready>
<2–3 sentences summarizing how agent runs are triggered today, what isolation/state guarantees exist, and the highest-risk gap in duplicate or spend control.>

### Scorecard

| Dimension | Status | Repository / workflow evidence | Failure mode / risk |
|---|---|---|---|
| Serialized trigger | ... | `<exact workflows/timers/locks>` | ... |
| Eligibility precision | ... | `<exact rules/scripts>` | ... |
| At-least-once safety | ... | `<registry, idempotency, PR check>` | ... |
| Isolated, bounded runtime | ... | `<runner/worktree/sandbox details>` | ... |
| Cap & progressive rollout | ... | `<caps, timeouts, dry-run support>` | ... |

### Recommended dispatch architecture
<Compact flow (8–15 lines) naming the trigger, eligibility filter, state registry, runtime adapter, concurrency cap, and timeout budget suited to this repository.>

### What to do next

#### P0 — Fix now (Stage 3 blockers)
1. **<Short imperative title>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact workflow, runner script, or adapter path>`
   - **Action:** <Concrete change, using pinned SHAs and explicit caps.>
   - **Verify:** `<exact dry-run or cap-1 verification step>`

#### P1 — High-impact hardening
1. **<Short imperative title>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact path>`
   - **Action:** <Concrete improvement.>
   - **Verify:** `<exact check>`

#### Not yet — Skip for now
- <1–2 premature additions to defer—such as high-concurrency fan-out or complex webhook meshes before a cap-1 scheduled loop is proven.>

### Stage 3 exit gate
<3–4 concrete proofs—starting with a clean secret-free dry-run and a single cap-1 dispatch that suppresses re-dispatch while its PR stays open—required before Stage 4 (`rondo-feedback-loop`).>
```

End by offering to draft the `P0` dispatch workflow or dry-run harness on a branch, leaving live secret configuration and the first remote trigger to the human operator.
