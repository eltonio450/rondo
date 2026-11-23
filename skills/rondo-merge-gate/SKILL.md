---
name: rondo-merge-gate
description: Audit and design Stage 6 of a software factory—an explicit, testable merge gate that evaluates verifiable facts on the exact current commit (CI, independent review, open threads, hard exclusions for critical paths, rollback readiness, and an instant kill switch).
---

# Explicit Merge Gate Setup & Audit

**Stage 6 of 7 — Build Your Software Factory**

Auto-merge is never about trusting an LLM that says "looks good to me." Stage 6 turns merge approval into an **explicit, testable merge gate**: deterministic rules evaluated on the exact `head_sha` let narrow, low-risk PRs merge cleanly once every check passes, while routing anything sensitive, stale, or uncertain straight to `HUMAN_REVIEW`.

Use this skill to audit current branch protections and merge governance, and design a strict, reversible Stage 6 merge gate.

## Guardrails

- **Audit read-only first.** Inspect workflows, `CODEOWNERS`, merge scripts, and read-only branch-protection/ruleset metadata (mark as `Unverified from checkout` if `gh` permissions do not allow reading rulesets) without merging PRs or changing repo settings.
- **Model prose is evidence, never merge authority.** Require deterministic code or rulesets to decide `AUTO_MERGE` vs `HUMAN_REVIEW` from structured checks tied to the exact current `head_sha`.
- **Fail closed on any missing, skipped, stale, or ambiguous signal.** Timeouts, skipped required checks, or API errors always route to `HUMAN_REVIEW`.
- **Never read, print, or request secret values.**
- **Require an instant kill switch.** Any operator must be able to disable auto-merge across the repo in seconds without reverting code.

## What to inspect

Examine six concrete surfaces:

1. **Repository merge protections**
   - Branch protection rules / GitHub Rulesets on the base branch: required status checks, strict up-to-date / merge queue, stale-approval dismissal on new pushes, conversation resolution, and `CODEOWNERS`.
   - Existing merge bots (Dependabot/Renovate, `gh pr merge --auto`, custom scripts) and their token scopes.

2. **Explicit eligibility rules & hard red-list exclusions**
   - Check that high-risk paths are **hard-excluded** from unattended merge:
     - database schemas, migrations, and backfills;
     - authentication, authorization, permissions, and cryptography;
     - secrets, env config, infrastructure-as-code, and `.github/workflows/` or merge-gate policy files themselves (an agent must never edit the rule gating its own PR);
     - billing, payments, and external public/legal API contracts;
     - oversized diffs or behavioral changes without tests.

3. **Exact `head_sha` conjunction**
   - Verify every required condition binds to the **same current `head_sha`**:
     1. Required CI checks passed (none skipped/cancelled);
     2. Stage 5 review gate (`rondo-review-gate`) evaluated this exact `head_sha` with `MERGE_ADVICE` and zero blocking findings;
     3. Zero unresolved human or bot review threads;
     4. Trusted PR origin (no arbitrary external forks);
     5. No merge conflicts or base-branch drift bypassing checks.

4. **Multi-step orchestrator safety (Rondo pause invariant)**
   - In multi-step ticket queues (Stage 4), merging Step 1 makes Step 2 immediately runnable unless the ticket sets `paused: true`. Check whether multi-step flows requiring human checkpoints verify `paused: true` before allowing auto-merge.

5. **Post-merge blast radius & rollback speed**
   - Does merging deploy immediately to 100% of users, or pass through staging, canary, or feature flags with a tested fast rollback?

6. **Audit log & instant kill switch**
   - Every gate evaluation logs policy version, PR number, `head_sha`, evaluated checks, and final verdict (`AUTO_MERGE` vs `HUMAN_REVIEW` + exact failed rule).
   - Single repo variable (`AUTO_MERGE_ENABLED=false`) or toggle checked right before merge.

## Diagnostic rubric

Score each surface as `Ready`, `Partial`, `Missing`, or `Unverified`:

| Surface | Healthy (`Ready`) | Fragile (`Partial` / `Missing`) | What breaks without it |
|---|---|---|---|
| **1. Enforced branch rules** | Required checks, stale-review dismissal, thread resolution, up-to-date base enforced. | Direct pushes allowed or stale approvals survive new commits. | Unchecked follow-up commits slip into main. |
| **2. Hard red-list exclusions** | Policy-as-code blocks DB, auth, billing, secrets, infra, CI/policy self-edits. | Broad auto-merge on a label or green unit tests alone. | Critical changes ship unattended. |
| **3. Exact `head_sha` match** | CI + Stage 5 `MERGE_ADVICE` strictly pinned to current `head_sha`; fails closed. | Reads latest comment without verifying commit SHA. | New broken commit merges under an old commit's verdict. |
| **4. Step-gate & thread safety** | Blocks on open threads or missing inter-step `paused: true` markers. | Merges while questions remain open or cascades next steps uncontrolled. | Multi-step epics run ahead without human checkpoints. |
| **5. Audit log & kill switch** | Versioned policy logs every verdict; instant toggle + tested rollback exist. | Opaque merge script, no dry-run history, slow rollback. | Cannot stop bad merges fast or trace why a PR merged. |

## Audit report format

Return the audit in this structure:

```markdown
## Stage 6 Audit — Explicit Merge Gate

**Verdict:** <Ready for Stage 7 | Partially ready | Not ready>
<2–3 concrete sentences: are branch protections, Stage 5 reviews, and rollback readiness strong enough for a strict, rule-based merge gate?>

### Scorecard
| Surface | Status | Exact evidence | What breaks |
|---|---|---|---|
| Enforced branch rules | ... | `<rulesets/merge queue>` | ... |
| Hard red-list exclusions | ... | `<paths & size bounds>` | ... |
| Exact `head_sha` match | ... | `<CI + Stage 5 SHA check>` | ... |
| Step-gate & thread safety | ... | `<threads/pause checks>` | ... |
| Audit log & kill switch | ... | `<logging/toggle/rollback>` | ... |

### Proposed v1 merge gate policy
<Concise rule table listing the initial eligible slice, hard red-list paths, required `head_sha` checks, and kill-switch variable.>

### What to build next

#### P0 — Build & shadow-test the merge gate
1. **<Concrete step>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact policy module, unit tests, workflow, or ruleset>`
   - **Action:** <Exact change.>
   - **Verify:** `<exact unit test + shadow dry-run on recent PRs>`

#### P1 — Hardening
1. **<Concrete step>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact path>`
   - **Action:** <Exact improvement.>
   - **Verify:** `<exact check>`

#### Not yet — Skip for now
- <Do not enable live auto-merge before shadow mode logs zero unsafe approvals across real PRs.>

### Stage 6 exit test
1. Unit tests prove stale SHAs, skipped checks, open threads, and red-list paths all return `HUMAN_REVIEW`.
2. Shadow mode runs cleanly on real PRs with zero unsafe recommendations.
3. Kill switch stops merges in seconds and post-merge rollback is verified. Only then move to Stage 7 (`rondo-external-swarms`).
```

End by offering to draft the `P0` deterministic merge-gate evaluator and unit tests in shadow mode (live merging off by default).
