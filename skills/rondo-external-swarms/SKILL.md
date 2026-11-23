---
name: rondo-external-swarms
description: Audit and design Stage 7 of a software factory—connecting external triggers (production bugs, degrading metrics, alerts, SLO drops) to decompose work into sub-problems and run parallel agent swarms against baselines, budgets, and automatic rollback.
---

# External Triggers & Agent Swarms Setup & Audit

**Stage 7 of 7 — Build Your Software Factory**

With Stages 1–6 in place, you have a safe, repeatable delivery machine: local/cloud runtime, ticketing access, orchestrator, automated PR review, and an explicit merge gate. Stage 7 turns it into a true autonomous software factory by connecting **external triggers**—a production bug, a degrading latency/error metric, a failing SLO, or a recurring operational issue—so the system can decompose a problem into sub-problems and launch **multiple agents in parallel (a swarm)** to investigate, test candidate fixes or optimizations against a baseline, and ship verified improvements under hard budgets and rollback safety.

Use this skill to audit your external signals, telemetry lineage, rollback safety, and swarm readiness, and design your first bounded, metric-driven swarm.

## Guardrails

- **Audit read-only first.** Inspect observability configs, alert webhooks, deploy pipelines, benchmark/eval suites, and orchestrator limits without triggering alerts, spawning parallel agents, or mutating production.
- **Protect users before dispatching a swarm.** When a production deploy degrades live traffic, containment (rollback, canary halt, or feature-flag kill) always runs *before* dispatching agents to diagnose or fix the root cause.
- **Deduplicate aggressively.** An alert storm must enrich one incident/root ticket via a stable fingerprint—never launch 50 duplicate swarms.
- **Never run an unmeasured swarm.** Every parallel swarm must define a pinned baseline, a measurable success oracle, a max-variants/budget cap, and a clear stop condition.
- **Never read, print, or request secret values,** and never copy raw customer PII from production logs into repository tickets.

## What to inspect

Examine six concrete surfaces:

1. **External triggers & deduplication**
   - What real-world signals exist today: error tracking (Sentry/Datadog), latency/SLO alerts, CI/perf regressions, scheduled optimization jobs, or structured bug reports.
   - How incoming signals are filtered, sanitized (no PII/prompt injection), and deduplicated by fingerprint before creating work.

2. **Commit-to-production lineage & containment**
   - Do deploys stamp commit/PR metadata into logs, traces, and error events so an agent can immediately correlate a spike to the exact change?
   - Is post-deploy verification + fast rollback / feature-flag kill wired so user impact stops first?

3. **Agent-readable diagnostic & benchmark surfaces**
   - Can diagnostic/optimization agents query read-only production telemetry (Datadog/Sentry/Grafana CLI or API) and run reproducible local/cloud benchmarks or eval harnesses to score candidate solutions?

4. **Problem decomposition & fan-out topology**
   - How a triggered problem splits cleanly into independent sub-problems or parallel hypotheses:
     - **Triage / Planner:** reads the trigger + evidence, isolates the scope, creates bounded sub-tasks (each 1-PR sized) or independent candidate variants;
     - **Parallel workers:** N isolated cloud runtimes (Stage 3) working concurrently on non-overlapping files/variants;
     - **Verifier / Aggregator:** benchmarks or tests every variant against the pinned baseline, discards regressions, and opens clean PRs into Stages 5–6.

5. **Hard swarm budgets & stop conditions**
   - Max parallel agents per trigger, max total tokens/spend per swarm, wall-clock timeout, and automatic abort if invariants break or no variant beats baseline.

6. **Closed feedback loop into ticketing & Stages 5–6**
   - Swarm outputs still pass through the exact same ticket tracking (Stage 2), independent review (Stage 5), and explicit merge gate (Stage 6)—swarms never bypass safety gates.

## Diagnostic rubric

Score each surface as `Ready`, `Partial`, `Missing`, or `Unverified`:

| Surface | Healthy (`Ready`) | Fragile (`Partial` / `Missing`) | What breaks without it |
|---|---|---|---|
| **1. External triggers & dedup** | Scoped, deduplicated signals (bug/metric/alert) feed structured work items. | Raw alert webhooks fire ungrouped or everything starts manually. | Alert storms flood the queue with duplicate agent runs. |
| **2. Lineage & rollback first** | Releases tagged in telemetry; post-deploy check + fast rollback trigger before fix runs. | No commit lineage or agents try to "fix forward" during live outages. | Users suffer prolonged downtime while agents debug. |
| **3. Measurable oracle / baseline** | Automated benchmark, repro test, or metric query scores every candidate objectively. | "Make it faster" with no reproducible benchmark or reproducer. | Parallel agents produce noisy diffs with unprovable gains. |
| **4. Clean fan-out topology** | Planner splits independent sub-problems or variants; aggregator keeps only winners. | Multiple agents edit overlapping files simultaneously without coordination. | Merge conflicts, duplicated work, and wasted compute. |
| **5. Hard swarm budgets** | Cap on parallel workers, spend, time, and stop conditions enforced outside prompts. | Unbounded fan-out per trigger. | One noisy alert burns an entire month's API budget. |

## Audit report format

Return the audit in this structure:

```markdown
## Stage 7 Audit — External Triggers & Agent Swarms

**Verdict:** <Ready for first bounded swarm | Partially ready | Not ready>
<2–3 concrete sentences: are Stages 1–6, telemetry lineage, rollback, and measurable baselines ready to drive parallel agents from external triggers?>

### Scorecard
| Surface | Status | Exact evidence | What breaks |
|---|---|---|---|
| External triggers & dedup | ... | `<alerts/webhooks/fingerprinting>` | ... |
| Lineage & rollback first | ... | `<deploy tags/rollback runbook>` | ... |
| Measurable oracle / baseline | ... | `<repro tests/benchmarks/evals>` | ... |
| Clean fan-out topology | ... | `<planner/worker/aggregator setup>` | ... |
| Hard swarm budgets | ... | `<worker cap/budget/stop rules>` | ... |

### Recommended first bounded swarm
<Pick ONE narrow, high-value external trigger for this repo—either (a) deduplicated prod error → repro + fix PR, or (b) degrading perf/SLO metric → N parallel candidate variants scored on a pinned benchmark—with exact worker cap, budget, and stop condition.>

### What to build next

#### P0 — Build the first triggered loop safely
1. **<Concrete step>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact deploy workflow, alert-to-ticket handler, benchmark, or swarm runner>`
   - **Action:** <Exact change.>
   - **Verify:** `<exact replay with a synthetic alert or historical regression>`

#### P1 — Hardening
1. **<Concrete step>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact path>`
   - **Action:** <Exact improvement.>
   - **Verify:** `<exact check>`

#### Not yet — Skip for now
- <Do not wire uncapped swarms to raw production alert streams or let swarm PRs bypass Stages 5–6.>

### Stage 7 exit test
Replay one real historical bug or degrading metric through the trigger: verify rollback/containment fires first if live, deduplication collapses repeat alerts into one root task, parallel workers stay within budget, only a verified improvement opens a PR into Stages 5–6, and zero PII leaks into Git.
```

End by offering to scaffold the `P0` deduplicated trigger handler, benchmark oracle, or bounded swarm config in dry-run mode on a branch.
