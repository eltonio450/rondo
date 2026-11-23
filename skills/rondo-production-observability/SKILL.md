---
name: rondo-production-observability
description: Audit post-deploy verification and production feedback loops—covering commit-to-release telemetry lineage, post-deploy health windows, SLO/error comparison, fast rollback, and deduplicated regression-to-ticket creation—and recommend how to close the software factory loop.
---

# Post-Deploy Observability & Closed-Loop Audit

**Stage 7 of 7 — Build Your Software Factory**

A merged pull request and a finished deploy job do not prove the change works in production. Stage 7 closes the software factory loop: every release carries commit and PR lineage into telemetry, an automated post-deploy window compares live error rates, latency, and business signals against baseline and SLOs, acute regressions trigger containment or rollback first, and verified anomalies open deduplicated, Stage 2-compliant tickets with production evidence attached.

Use this skill to audit what happens after merge today and recommend the shortest path to a closed production loop—the prerequisite before running metric-driven agent swarms.

## Guardrails

- **Audit read-only first.** Inspect deployment workflows, telemetry instrumentation, alert/SLO configs-as-code, runbooks, and read-only observability CLI status without triggering deploys, mutating alerts, or creating noisy tickets.
- **Mitigate user impact before dispatching a coding agent.** When production degrades after a deploy, containment (rollback, canary halt, or feature-flag kill) comes before opening an autonomous fix loop.
- **Never read, print, or request secret values,** and never paste raw customer PII from production logs or traces into repository tickets.
- **Deduplicate aggressively.** An alert storm must enrich one existing incident/ticket via a stable fingerprint, never flood the dispatch queue with fifty identical agent runs.

## What to inspect

Examine six surfaces across deployment, instrumentation, and operations:

1. **Commit-to-production lineage**
   - Release and deploy workflows (`.github/workflows/*deploy*`, ArgoCD/Flux, Terraform, Fly/Cloudflare/Vercel/Kubernetes configs, Dockerfile build args).
   - Whether runtime telemetry stamps `version` / `git.commit.sha`, `service`, and `env` onto logs, distributed traces, error events, and source maps—so any spike maps back to the exact deploy and pull request in one query.

2. **Observability coverage and agent-readable access**
   - Instrumentation in code: OpenTelemetry/Datadog/Sentry/Prometheus SDKs, structured logging, error boundaries, health endpoints, and key business counters (for example, checkout completions, webhook deliveries, job throughput—not just HTTP 200s).
   - Read-only diagnostic reachability: whether engineers and diagnostic agents have a documented, least-privilege CLI/API or skill (such as Datadog, Sentry, Grafana, or Cloudflare telemetry) to query traces, error groups, and deploy markers without sharing admin browser sessions.

3. **Post-deploy verification window**
   - What happens immediately after deploy: does the pipeline mark release success the instant processes boot, or does it run smoke tests plus a bounded observation window (for example, 10–30 minutes comparing error rate, p95/p99 latency, crash loops, and critical business heartbeats against pre-deploy baseline and SLO budgets)?

4. **Progressive delivery and rollback speed**
   - Canary/staged rollouts, feature flags, backward-compatible expand/contract migration practices, and how many minutes and human steps a clean rollback actually takes.

5. **Regression-to-ticket feedback loop**
   - How post-deploy anomalies or escaped bugs turn back into actionable engineering work:
     - **Deduplication key:** error fingerprint + service + release range;
     - **Evidence envelope:** suspect release SHA and PR(s), baseline vs observed metric delta, trace/log query link, affected endpoints/cohort, and whether rollback already ran;
     - **Ticket routing:** creates or updates one Stage 2 ticket (`paused: true` or `needs-triage` when human severity review is required; directly eligible only for pre-approved, bounded classes of follow-up).

6. **Readiness for Beyond-Stage-7 Swarms**
   - Once Stages 1–7 hold, assess whether the repo has the four prerequisites required before ever running parallel optimization swarms (for latency, bundle size, test coverage, or cost): a trustworthy automated metric/oracle, a pinned baseline, a hard compute/PR budget, and deterministic rollback on regression.

## Diagnostic rubric

Score each dimension as `Ready`, `Partial`, `Missing`, or `Unverified`:

| Dimension | Healthy signal (`Ready`) | Fragile signal (`Partial` / `Missing`) | Failure mode if left unfixed |
|---|---|---|---|
| **1. Release/SHA lineage** | Every log, trace, error, and deploy event carries `service`, `env`, and `git.commit.sha`. | Unversioned logs/errors; correlating a spike to a PR requires guesswork and timestamps. | Agents and responders chase the wrong commit during regressions. |
| **2. Read-only telemetry access** | Structured logs, traces, errors, and SLOs exist and are queryable via a scoped CLI/API skill. | Unstructured `console.log` text or dashboard-only tools invisible to diagnostic workflows. | Post-deploy verification stays 100% manual. |
| **3. Post-deploy health gate** | Automated smoke checks + bounded baseline/SLO comparison window before marking a release healthy. | "Deploy succeeded" means `docker push` or pod startup returned exit code `0`. | Silent behavioral regressions linger until customers complain. |
| **4. Fast containment/rollback** | Feature flags, canary halt, or one-command rollback restores baseline in minutes. | Rollback requires writing a new PR and waiting twenty minutes for CI, or irreversible migrations ship routinely. | Agent-authored fixes race while live users stay broken. |
| **5. Deduplicated ticket loop** | Confirmed regressions create or enrich one fingerprinted, PII-scrubbed ticket with SHA/PR/trace evidence. | Alerts go to noisy Slack channels with no link back to the ticket queue—or spawn duplicate tickets per alert. | Either regressions drop on the floor or alert storms stampede the agent queue. |

## How to formulate recommendations

- **Wire commit SHA lineage first.** Passing `GIT_COMMIT_SHA` at build/deploy time into telemetry tags (`DD_VERSION`, `SENTRY_RELEASE`, `OTEL_RESOURCE_ATTRIBUTES`) is usually a 20-line change with immediate payoff for humans and agents alike.
- **Document one canonical read-only observability skill.** Just as Stage 2 gives agents one clean tracker CLI, give diagnostic runs one read-only telemetry playbook (naming the authoritative trace/error source, required filters, and PII rules) so agents never scrape dashboards or query the wrong logging store.
- **Start the closed loop in "draft / paused ticket" mode.** Have post-deploy verification attach the full correlation dossier (suspect SHA/PR, metric delta, trace query, rollback status) to a single fingerprinted issue or `paused: true` Rondo ticket assigned to the PR `owner`. Promote specific well-understood regression classes to auto-dispatch only after false-alarm rates are proven low.

## Audit report format

Return the audit in this structure:

```markdown
## Stage 7 Audit — Post-Deploy Observability & Closed Loop

**Verdict:** <Full loop operational | Partially ready | Not ready>
<2–3 sentences summarizing deploy-to-telemetry correlation, post-deploy verification today, and what is missing to safely close the production → ticket loop.>

### Scorecard

| Dimension | Status | Repository / deploy / telemetry evidence | Failure mode / risk |
|---|---|---|---|
| Release/SHA lineage | ... | `<deploy workflows, build args, SDK tags>` | ... |
| Read-only telemetry access | ... | `<SDKs, CLIs, observability skills>` | ... |
| Post-deploy health gate | ... | `<smoke checks, canary, SLO windows>` | ... |
| Fast containment/rollback | ... | `<rollback commands, flags, migration rules>` | ... |
| Deduplicated ticket loop | ... | `<alert routing, fingerprinting, ticket intake>` | ... |

### Recommended closed-loop flow
<Compact flow (10–15 lines) from deploy marker → observation window → containment rule → fingerprinted evidence ticket.>

### What to do next

#### P0 — Fix now (Stage 7 blockers)
1. **<Short imperative title>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact deploy workflow, telemetry init file, verify script, or observability skill>`
   - **Action:** <Concrete change.>
   - **Verify:** `<exact staging/deploy check confirming SHA tag + health check output>`

#### P1 — High-impact hardening
1. **<Short imperative title>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact path>`
   - **Action:** <Concrete improvement.>
   - **Verify:** `<exact check>`

#### Not yet — Skip for now
- <1–2 premature jumps to avoid—such as letting alerts auto-dispatch code fixes before SHA lineage, deduplication, and fast rollback work reliably, or launching multi-agent swarms without a trustworthy production/eval metric.>

### Stage 7 exit gate (and Swarm readiness check)
<3–4 concrete proofs confirming code → deploy → verified health → deduplicated regression ticket works end to end, plus a one-line assessment of whether the codebase now satisfies the baseline/oracle/budget/rollback bar for metric-driven swarms.>
```

End by asking whether the human wants you to prepare the `P0` commit-lineage wiring, post-deploy verification check, or read-only observability skill on a branch.
