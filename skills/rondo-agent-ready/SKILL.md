---
name: rondo-agent-ready
description: Audit whether a repository is ready for autonomous coding agents—covering bootstrap determinism, agent instructions, domain skills, fast local prechecks, CI parity, and sensitive-path boundaries—and recommend a prioritized action plan.
---

# Agent-Ready Repository Audit

**Stage 1 of 7 — Build Your Software Factory**

Autonomous agents are only as reliable as the feedback loop inside a fresh checkout. Before adding ticket queues, background runners, or automated review, a clean clone must tell an unfamiliar agent how the repository works, let it verify a change locally in minutes, and enforce the same deterministic checks in CI.

Use this skill to audit a repository's Stage 1 readiness and produce a concrete, repo-specific plan of what to fix next.

## Guardrails

- **Audit read-only first.** Inspect files, Git metadata, scripts, and CI workflows without editing code, installing global packages, pushing branches, or mutating external services.
- **Cite evidence, not impressions.** Back every finding with exact file paths, script names, workflow jobs, or missing surfaces.
- **Separate static presence from runtime proof.** An existing test script or `AGENTS.md` file is not proof that tests pass quickly or instructions match current code. Never report an unrun command as passing.
- **Never read, print, or request secret values.** Inspect `.env.example` and secret references in workflow YAML, never `.env` files or live credentials.
- **Right-size every recommendation.** Propose the smallest change that eliminates a real agent failure mode for this repository's stack and team size. Avoid sprawling documentation that rots within weeks.

## What to inspect

Examine these six surfaces in the target repository:

1. **Clean-checkout bootstrap**
   - Pinned toolchain and runtime files (`.nvmrc`, `.node-version`, `packageManager`, `.python-version`, `pyproject.toml`, `go.mod`, `rust-toolchain.toml`, `mise.toml`, `devcontainer.json`, `Dockerfile`, `Makefile`, `justfile`).
   - Lockfiles and workspace layout (single package vs monorepo packages/apps).
   - Environment template (`.env.example` or documented local defaults) and whether unit/static checks require live cloud credentials or external databases just to boot.

2. **Agent instructions and domain skills**
   - Root guidance files: `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/*`, `.github/copilot-instructions.md`, `CONTRIBUTING.md`, `README.md`.
   - Scoped guidance in subdirectories or monorepo packages, plus reusable task playbooks under `skills/`, `.claude/skills/`, `.cursor/skills/`, or `.agents/skills/`.
   - Signal quality: check whether guidance states exact build/lint/test commands, architectural boundaries, and non-obvious invariants—or whether files contradict each other, duplicate README prose, or omit where agents routinely break things.

3. **Fast local verification ("precheck")**
   - Available verification commands in `package.json`, `Makefile`, `justfile`, `scripts/`, or language build tools: format, lint, typecheck, unit tests, and build.
   - Changed-file or package-scoped runners (for example, a dedicated `check` or `agent-precheck` script that validates touched files in under two minutes instead of running a twenty-minute end-to-end suite).
   - Generated-artifact checks: schema/OpenAPI/GraphQL codegen, ORM clients, snapshots, lockfile sync, or translations that agents frequently forget to regenerate.

4. **CI pipeline and local-to-CI parity**
   - Workflow definitions (`.github/workflows/*`, `.gitlab-ci.yml`, CircleCI, Buildkite): triggers on `pull_request`, concurrency cancellation, timeouts, and deterministic dependency installation (`npm ci`, `--frozen-lockfile`, pinned actions).
   - Gaps where CI enforces checks that have no obvious local equivalent—or where local scripts exist but CI never runs them on pull requests.
   - Checks that break on agent branches because they assume production secrets, manual labels, or long-lived staging environments.

5. **Ownership, blast radius, and delivery rules**
   - `CODEOWNERS`, `.github/PULL_REQUEST_TEMPLATE.md`, commit/PR conventions, and branch protection or rulesets (inspect via read-only `gh` commands only when authenticated and permitted; otherwise mark as `Unverified from checkout`).
   - High-risk paths that require heightened scrutiny or explicit human approval: database migrations, authentication/authorization, billing, secrets/config, infrastructure-as-code, and `.github/workflows/`.

6. **Behavioral verification beyond syntax**
   - Fixture suites, integration smoke tests, contract tests, preview environments, or evaluation harnesses for domains where green typechecks and unit mocks still allow broken runtime behavior.

If the user permits safe local commands and dependencies are already installed, you may time a dry static check (such as a linter or `--help` invocation) to verify wiring. Do not install dependencies or run heavy test suites during the audit unless asked.

## Diagnostic rubric

Score each dimension as `Ready`, `Partial`, `Missing`, or `Unverified`:

| Dimension | Healthy signal (`Ready`) | Fragile signal (`Partial` / `Missing`) | Agent failure mode if left unfixed |
|---|---|---|---|
| **1. Deterministic bootstrap** | Runtime versions and lockfiles are pinned; static checks and unit tests run without undocumented local setup or live secrets. | Unpinned runtimes, missing `.env.example`, or tests that crash without prod/staging credentials. | Fresh background sandboxes fail before writing a single line of code. |
| **2. Canonical agent guidance** | A concise root `AGENTS.md` (mirrored to `CLAUDE.md` if needed) states repo map, exact commands, invariants, and points to focused `skills/` for complex workflows. | No agent docs, conflicting tool-specific files, or a 1,000-line prose dump nobody maintains. | Agents guess conventions, invent patterns, or ignore outdated instructions. |
| **3. Fast scoped precheck** | One documented command runs lint, types, codegen drift, and targeted tests on changed code in ~1–2 minutes. | Only full-repo test suites exist, or lint/type/test flags are scattered across five undocumented scripts. | Agents skip verification entirely or burn time and tokens waiting on slow suites. |
| **4. Local-to-CI parity** | Every required PR check maps to a local command; CI runs deterministically on every PR with explicit timeouts. | No PR workflow, flaky/secret-gated PR jobs, or CI-only checks that surprise local runs. | Endless push-wait-fail loops on trivial lint, lockfile, or codegen errors. |
| **5. Blast-radius boundaries** | Sensitive paths (migrations, auth, infra, CI, billing), `CODEOWNERS`, and PR expectations are explicit in repo docs and config. | Sensitive directories look identical to routine UI/library code; no ownership or escalation rules. | Agents casually refactor migrations, permissions, or deployment workflows. |

## How to formulate recommendations

Translate gaps into concrete engineering work tailored to the repository in front of you:

- **Prefer one short root map plus modular skills.** Recommend a compact root `AGENTS.md` (aim for 60–150 lines: architecture map, exact commands, hard invariants, sensitive paths, PR expectations) and move specialized recurring workflows—migrations, release steps, domain debugging, UI conventions—into standalone `skills/<name>/SKILL.md` files. If the team uses both Claude Code and Codex/Cursor, keep `AGENTS.md` and `CLAUDE.md` identical and enforce parity with a trivial CI check (`cmp -s AGENTS.md CLAUDE.md`).
- **Design a single fast precheck entrypoint.** If checks are fragmented or slow, recommend one canonical command (for example `npm run check`, `make check`, or `scripts/agent-precheck.sh`) that runs formatting/lint, typechecking, codegen drift checks, and changed-target unit tests first, while leaving slow end-to-end suites to CI or explicit flags.
- **Close CI parity gaps before adding more tools.** Fixing a missing PR workflow, unpinned runtime, or secret-dependent test job delivers far higher leverage than writing elaborate prompt rules telling agents "please be careful."
- **Name the owner of each action.** Distinguish changes an agent can ship in a clean pull request today (`Agent PR`) from repository settings only a maintainer can toggle (`Human / Admin`, such as required branch protection checks or `CODEOWNERS` teams).
- **Explicitly call out what to skip for now.** Do not recommend multi-agent orchestration, custom eval platforms, or heavy containerization in Stage 1 if a pinned runtime, a 90-line `AGENTS.md`, and a two-minute precheck script solve the bottleneck.

## Audit report format

Return the audit in this structure:

```markdown
## Stage 1 Audit — Agent-Ready Repository

**Verdict:** <Ready for Stage 2 | Partially ready | Not ready>
<2–3 sentences summarizing the repository's stack, its strongest existing foundation, and the primary bottleneck holding back reliable autonomous runs.>

### Scorecard

| Dimension | Status | Repository evidence | Impact on agents |
|---|---|---|---|
| Deterministic bootstrap | ... | `<exact files/scripts>` | ... |
| Canonical agent guidance | ... | `<exact files/dirs>` | ... |
| Fast scoped precheck | ... | `<exact commands/timings>` | ... |
| Local-to-CI parity | ... | `<exact workflow files/jobs>` | ... |
| Blast-radius boundaries | ... | `<exact paths/configs>` | ... |

### What to do next

#### P0 — Fix now (Stage 1 blockers)
1. **<Short imperative title>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact file or script path>`
   - **Action:** <Concrete change to make, grounded in this repo's tooling.>
   - **Verify:** `<exact command or check that proves it works>`

#### P1 — High-impact hardening
1. **<Short imperative title>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact file or script path>`
   - **Action:** <Concrete change.>
   - **Verify:** `<exact verification command>`

#### Not yet — Skip for now
- <1–2 temptations this specific repo does NOT need yet, and why.>

### Stage 1 exit gate
<Checklist of 3–4 concrete facts that must be true before moving to Stage 2 (`rondo-ticket-contract`), without modifying product behavior.>
```

End with one concise offer: ask whether the human wants you to prepare the `P0` repository-readiness changes on a branch without touching product code. Do not edit files until they confirm.
