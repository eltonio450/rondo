---
name: rondo-review-gate
description: Audit automated pull-request review quality—covering author-reviewer independence, domain-specialist routing, evidence-backed findings, SHA-bound merge advice, noise control, and historical PR calibration—and recommend a high-signal AI review gate.
---

# Automated Review Gate & Merge Advice Audit

**Stage 5 of 7 — Build Your Software Factory**

Once tickets dispatch automatically (Stage 3) and agents recover from routine blockers (Stage 4), human code review becomes the bottleneck. Stage 5 introduces an **independent** AI review gate: a separate reviewer context evaluates the exact pull-request `head_sha` against repository invariants and domain risk rules, filters out linter trivia, and publishes an evidence-backed advisory verdict (`MERGE_ADVICE`, `CHANGES_REQUESTED`, or `HUMAN_REVIEW`)—without holding permission to merge.

Use this skill to audit existing PR review automation (or design a clean review gate from scratch) and recommend high-signal improvements.

## Guardrails

- **Audit read-only first.** Inspect review workflows, prompts, scripts, `CODEOWNERS`, and sample PR structures without posting review comments, approving pull requests, or mutating repository settings.
- **A reviewer advises; it never merges.** Keep merge credentials and policy enforcement strictly out of the AI review runtime.
- **Require author–reviewer independence.** Self-review by the same agent session that wrote the diff shares its blind spots; Stage 5 requires a fresh context, reviewer-specific instructions, and separate budget/telemetry accounting.
- **Never read, print, or request secret values.**
- **Do not ship an uncalibrated reviewer as a hard blocker.** Recommend shadow/observation mode and evaluation on historical PRs before turning review findings into required status checks.

## What to inspect

Examine six surfaces in the repository and CI setup:

1. **Reviewer architecture and independence**
   - Existing review workflows (`.github/workflows/*review*`, PR bots, third-party review apps, or custom scripts).
   - Context separation: whether the reviewer reads the diff, base code, tests, and repository rules from a clean session—without inheriting the authoring agent's chain-of-thought rationalization—and runs under least-privilege read/comment permissions.

2. **Diff-aware and specialist routing**
   - Path and risk classification: whether sensitive diffs—authentication/permissions, database migrations, security/cryptography, billing, public API contracts, CI workflows—trigger specialist review prompts or domain checklists aligned with `CODEOWNERS` and the ticket's `owner`.

3. **Finding rigor and noise discipline**
   - Output contract: whether every finding must cite exact `file:line`, concrete failure scenario, severity (`critical`, `high`, `medium`, `low`), and confidence—banning formatting/style nitpicks already covered by Stage 1 linters.
   - Comment hygiene: whether re-runs on new commits update or supersede one structured summary comment instead of burying humans under twenty outdated inline threads.

4. **SHA-pinned advisory verdict**
   - Whether each review explicitly records the reviewed `head_sha`, a structured risk assessment, and one clear advisory outcome:
     - `MERGE_ADVICE` — low-risk diff, verified by tests, zero high/medium findings, candidate for fast human sign-off or Stage 6 policy evaluation;
     - `CHANGES_REQUESTED` — concrete defect, missing test, or invariant violation with actionable evidence;
     - `HUMAN_REVIEW` — architectural trade-off, sensitive domain touched, or insufficient test oracle for high-confidence automated sign-off.
   - Invalidation: whether pushing a new commit immediately marks prior `MERGE_ADVICE` verdicts stale.

5. **Prompt-injection and untrusted-diff resilience**
   - Protections ensuring untrusted PR descriptions, external fork PRs, or adversarial strings inside diffs cannot hijack privileged tokens or exfiltrate secrets (`pull_request` vs `pull_request_target` safety).

6. **Calibration, latency, and cost tracking**
   - Benchmark corpus or evaluation scripts testing the reviewer against real historical PRs (known escaped regressions vs known clean PRs) to measure defect recall, false-block rate, review latency, and API cost per PR.

## Diagnostic rubric

Score each dimension as `Ready`, `Partial`, `Missing`, or `Unverified`:

| Dimension | Healthy signal (`Ready`) | Fragile signal (`Partial` / `Missing`) | Failure mode if left unfixed |
|---|---|---|---|
| **1. Independent reviewer** | Fresh context, read-only repo + PR-comment scope, separate from authoring session. | No automated review, or authoring agent merely summarizes its own diff. | Bugs caused by misunderstood specs sail through unchallenged. |
| **2. Domain/owner routing** | Diffs touching auth, data/migrations, security, or APIs invoke targeted specialist checks and surface owner expectations. | One generic prompt treats CSS tweaks and RBAC rewrites identically. | Subtle permission, migration, or data-loss bugs escape review. |
| **3. High-signal evidence** | Every finding names `file:line`, failure mechanism, severity, and confidence; single updated summary per PR. | Speculative "consider refactoring" spam and duplicate comments per push. | Alert fatigue—engineers mute or ignore the reviewer within a week. |
| **4. SHA-bound merge advice** | Structured `MERGE_ADVICE` / `CHANGES_REQUESTED` / `HUMAN_REVIEW` verdict pinned to exact `head_sha`, never holding merge rights. | Prose-only comments with no machine-readable verdict or SHA pin. | Humans still re-read everything from scratch; Stage 6 has no clean input. |
| **5. Historical calibration** | Tested on a small corpus of real past regressions + clean PRs before gating; cost and latency tracked. | Deployed blind onto live PRs with zero false-positive measurement. | Expensive, slow reviews that block clean PRs while missing real defects. |

## How to formulate recommendations

- **Start with one generalist reviewer plus 1–3 high-risk specialists only where justified.** Only add a specialist lens (such as permissions/RBAC, migrations, or security) when historical regressions show a domain gap—and verify on held-out historical PRs that the specialist catches real bugs the generalist missed without inflating false blocks.
- **Make the output contract dual-purpose: fast for humans, parseable for policy.** Recommend a compact human dossier at the top (verdict, `head_sha`, blast radius, test proof, findings by severity) plus a machine-readable JSON/check-run summary that Stage 6 (`rondo-auto-merge`) can verify deterministically without parsing freeform prose.
- **Roll out in observation mode first.** Run silently or as a non-blocking comment on 10–20 real PRs, measure engineer agreement, latency, and cost per accepted PR, tighten noisy rules, and only then promote high-confidence checks.
- **Account for Rondo's explicit boundary.** Rondo's `owner` frontmatter provides context, not GitHub reviewer assignment or AI review. Recommend wiring reviewer assignment (`CODEOWNERS` or owner mapping) alongside the Stage 5 workflow where human sign-off remains required.

## Audit report format

Return the audit in this structure:

```markdown
## Stage 5 Audit — Automated Review Gate & Merge Advice

**Verdict:** <Ready for Stage 6 | Partially ready | Not ready>
<2–3 sentences summarizing current PR review automation, signal-to-noise risks, and what stands between today's setup and trustworthy SHA-bound merge advice.>

### Scorecard

| Dimension | Status | Repository / CI evidence | Failure mode / risk |
|---|---|---|---|
| Independent reviewer | ... | `<workflows/bots/permissions>` | ... |
| Domain/owner routing | ... | `<CODEOWNERS/path rules/prompts>` | ... |
| High-signal evidence | ... | `<output format/comment behavior>` | ... |
| SHA-bound merge advice | ... | `<verdict schema/SHA pinning>` | ... |
| Historical calibration | ... | `<evals/benchmarks/cost tracking>` | ... |

### Recommended review-gate design
<Compact design (10–15 lines) covering trigger safety, generalist + any justified domain checklist, single-comment UX, and the exact SHA-bound verdict schema.>

### What to do next

#### P0 — Fix now (Stage 5 blockers)
1. **<Short imperative title>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact workflow, prompt, or benchmark script path>`
   - **Action:** <Concrete change.>
   - **Verify:** `<exact replay check on 4–8 historical PRs or non-blocking shadow run>`

#### P1 — High-impact hardening
1. **<Short imperative title>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact path>`
   - **Action:** <Concrete improvement.>
   - **Verify:** `<exact check>`

#### Not yet — Skip for now
- <1–2 traps to avoid—such as adding five unbenchmarked specialist agents or running `pull_request_target` on untrusted code.>

### Stage 5 exit gate
<3–4 concrete proofs confirming every PR gets an independent, low-noise, SHA-pinned review dossier calibrated against real diffs before considering Stage 6 (`rondo-auto-merge`).>
```

End by offering to scaffold the `P0` review prompt, structured verdict schema, or historical-PR replay harness on a branch in non-blocking mode.
