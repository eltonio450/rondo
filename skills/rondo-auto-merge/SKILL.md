---
name: rondo-auto-merge
description: Audit merge governance and publication safety—covering deterministic policy-as-code, SHA-pinned CI and review checks, hard path exclusions, Rondo step-pause invariants, rollback readiness, and kill switches—and recommend a safe auto-merge gate.
---

# Policy-Driven Auto-Merge Audit

**Stage 6 of 7 — Build Your Software Factory**

Auto-merge is safe only when a **deterministic policy** evaluates verifiable facts on the exact `head_sha`—never when a language model decides on its own to merge a pull request. Once repository checks match CI (Stage 1) and an independent review gate emits structured, SHA-bound verdicts (Stage 5), Stage 6 carves out a narrow, auditable envelope of low-risk changes that can merge unattended while routing everything else cleanly to `HUMAN_REVIEW`.

Use this skill to audit current merge protections and design a strict, reversible auto-merge policy.

## Guardrails

- **Audit read-only first.** Inspect workflows, `CODEOWNERS`, merge scripts, and read-only repository rulesets/branch-protection metadata (when `gh` permissions allow; otherwise mark as `Unverified from checkout`) without merging PRs, editing branch protections, or mutating repository settings.
- **Model prose is evidence, never merge authority.** Require a deterministic script, check run, or ruleset evaluator to decide `AUTO_MERGE` vs `HUMAN_REVIEW` from structured inputs tied to the current `head_sha`.
- **Default to `HUMAN_REVIEW` on any missing, skipped, stale, or ambiguous signal.** Timeouts, neutral/skipped required checks, or API errors must fail closed.
- **Never read, print, or request secret values.**
- **Require an instant kill switch.** An operator must be able to disable auto-merge across the repository in seconds without reverting code.

## What to inspect

Examine six governance and pipeline surfaces:

1. **Repository merge protections and strategy**
   - Branch protection rules or GitHub Rulesets on the base branch: required status checks, strict up-to-date / merge-queue enforcement, stale-approval dismissal on new pushes, conversation-resolution requirements, and `CODEOWNERS` enforcement.
   - Existing auto-merge workflows (Dependabot/Renovate rules, `gh pr merge --auto`, custom merge bots) and what credentials they hold.

2. **Deterministic eligibility envelope and hard exclusions**
   - Whether changed file paths and diff shape are classified deterministically. Check that high-blast-radius changes are **hard-excluded** from initial auto-merge:
     - database schemas, migrations, and backfills;
     - authentication, authorization, permissions, and cryptography;
     - secrets, environment config, infrastructure-as-code, and `.github/workflows/` or merge-policy files themselves (preventing an agent from editing the rule that gates its own PR);
     - billing, payments, and external legal/public API contracts;
     - major dependency upgrades, large diffs exceeding a line/file budget, or behavioral code changes lacking corresponding tests.

3. **Exact `head_sha` conjunction**
   - Whether every required condition is verified against the **identical current `head_sha`**:
     1. Required CI checks succeeded (not skipped or cancelled);
     2. Stage 5 review gate check/artifact matches `head_sha`, reports `MERGE_ADVICE`, has zero critical/high/blocking findings, and stays within the risk threshold;
     3. Zero unresolved human or bot review threads;
     4. Author/trigger identity belongs to an explicitly trusted origin (never arbitrary external forks);
     5. No merge conflicts or base-branch drift bypassing required checks.

4. **Multi-step orchestration safety (the Rondo pause invariant)**
   - In multi-step ticket queues like Rondo, merging Step 1 makes Step 2 immediately eligible on the next scheduler cycle unless the ticket carries `paused: true`. Inspect whether workflows that require human sign-off between stages verify that `paused: true` is present in the ticket diff *before* allowing merge.

5. **Deployment blast radius and rollback path**
   - What happens the moment a PR merges into the base branch: does merge deploy straight to 100% of production, land in staging/merge-queue first, or roll out behind canary/feature flags with a tested one-command rollback? Auto-merge without fast rollback turns minor mistakes into prolonged incidents.

6. **Audit trail and emergency kill switch**
   - Decision logging: whether every evaluation records policy version, PR number, `head_sha`, evaluated rule vector, and final verdict (`AUTO_MERGE` vs `HUMAN_REVIEW` + exact failed rule).
   - Kill switch: a single repository variable (for example `AUTO_MERGE_ENABLED=false`) or ruleset toggle checked right before merge execution.

## Diagnostic rubric

Score each dimension as `Ready`, `Partial`, `Missing`, or `Unverified`:

| Dimension | Healthy signal (`Ready`) | Fragile signal (`Partial` / `Missing`) | Failure mode if left unfixed |
|---|---|---|---|
| **1. Enforced branch rules** | Required checks, stale-review dismissal, thread resolution, and merge queue / up-to-date rules enforced by VCS. | Direct pushes allowed, checks optional, or stale approvals survive new commits. | Unverified commits slip into the base branch after review. |
| **2. Hard path exclusions** | Policy-as-code blocks migrations, auth, secrets, infra, billing, CI/policy self-edits, and oversized diffs. | Broad auto-merge based only on a label or green unit tests. | High-blast-radius changes ship unattended. |
| **3. Strict `head_sha` match** | CI, security checks, and Stage 5 `MERGE_ADVICE` all bind to the exact current `head_sha`; fails closed on missing data. | Bot reads the latest PR comment without checking which commit SHA it reviewed. | Agent pushes a broken follow-up commit that merges under an earlier commit's `MERGE_ADVICE`. |
| **4. Step-gate & thread safety** | Blocks on unresolved threads, active pause flags, or missing inter-step `paused: true` markers. | Merges while humans have open questions or triggers uncontrolled next-step cascades. | Multi-step epics race ahead without intended product checkpoints. |
| **5. Audit log & kill switch** | Versioned policy logs every rule verdict per SHA; repo variable disables auto-merge instantly; rollback is proven. | Opaque merge script with no dry-run mode, no audit log, and slow manual rollback. | Operators cannot halt bad merges quickly or reconstruct why a PR merged. |

## How to formulate recommendations

- **Write merge policy as pure, testable code—never as an LLM prompt.** Recommend a tiny, dependency-free policy evaluator (with unit tests covering stale SHAs, skipped checks, self-modified workflow files, unresolved threads, and excluded paths) that outputs `{ verdict: "AUTO_MERGE" | "HUMAN_REVIEW", headSha, policyVersion, failedRules }`.
- **Always prevent policy self-modification.** Explicitly require `HUMAN_REVIEW` whenever a PR touches `.github/workflows/`, `CODEOWNERS`, agent prompts, or the policy file itself.
- **Roll out in dry-run shadow mode first.** Run the evaluator on every PR for two weeks logging *"Would have returned AUTO_MERGE / HUMAN_REVIEW because…"* without calling merge, verify zero unsafe false positives, then enable live auto-merge for one narrow slice (such as docs, isolated tests, or internal leaf packages behind feature flags).

## Audit report format

Return the audit in this structure:

```markdown
## Stage 6 Audit — Policy-Driven Auto-Merge

**Verdict:** <Ready for Stage 7 | Partially ready | Not ready>
<2–3 sentences assessing current branch governance, deployment/rollback safety after merge, and whether prerequisites from Stages 1 and 5 are strong enough for unattended merges.>

### Scorecard

| Dimension | Status | Repository / ruleset evidence | Failure mode / risk |
|---|---|---|---|
| Enforced branch rules | ... | `<rulesets/branch protection/merge queue>` | ... |
| Hard path exclusions | ... | `<sensitive paths & size bounds>` | ... |
| Strict `head_sha` match | ... | `<CI + Stage 5 SHA verification>` | ... |
| Step-gate & thread safety | ... | `<threads/pause invariants>` | ... |
| Audit log & kill switch | ... | `<policy logging, toggle, rollback>` | ... |

### Proposed merge policy (`v1`) for this repo
<Concise rule table or pseudocode listing the initial eligible slice, hard-excluded paths, required `head_sha` checks, and kill-switch variable.>

### What to do next

#### P0 — Fix now (Stage 6 blockers)
1. **<Short imperative title>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact policy module, test file, workflow, or ruleset>`
   - **Action:** <Concrete change.>
   - **Verify:** `<exact unit test + shadow dry-run against recent merged/rejected PRs>`

#### P1 — High-impact hardening
1. **<Short imperative title>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact path>`
   - **Action:** <Concrete improvement.>
   - **Verify:** `<exact check>`

#### Not yet — Skip for now
- <1–2 temptations to refuse—such as enabling auto-merge before Stage 5 is calibrated or allowing auto-merge on database migrations.>

### Stage 6 exit gate
<3–4 concrete proofs—unit-tested policy evaluator, shadow dry-run with zero unsafe approvals, verified kill switch, and proven post-merge rollback—required before live enablement and Stage 7 (`rondo-production-observability`).>
```

End by asking whether the human wants you to draft the `P0` deterministic policy evaluator and unit tests in dry-run mode (with live merging disabled by default).
