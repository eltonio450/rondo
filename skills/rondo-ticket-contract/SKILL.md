---
name: rondo-ticket-contract
description: Audit how work items reach the development environment—covering tracker reachability, Git-native Rondo tickets vs external issue trackers, schema completeness, 1-PR step sizing, and durable state updates—and recommend how to make tickets directly executable by agents.
---

# Machine-Readable Ticket Contract Audit

**Stage 2 of 7 — Build Your Software Factory**

Agents fail on vague intent long before they fail on code. Once a repository can verify changes locally and in CI (Stage 1), the development environment needs direct, non-interactive access to a single source of truth for tasks—where every ready ticket carries enough scope, acceptance criteria, ownership, and history for an agent to execute one reviewable pull request without private chat context.

Use this skill to audit how work enters the repository today and recommend the cleanest ticket contract and integration path.

## Guardrails

- **Audit read-only first.** Inspect repository files, templates, validators, and read-only tracker metadata (only if an authenticated CLI is already configured) without creating test issues, editing live tickets, or mutating branches.
- **Cite concrete artifacts.** Reference exact templates, workflow files, CLI tools, or sample ticket structures—never assume a tracker integration works just because a CLI binary is installed.
- **Never read, print, or request secret values.** Check whether non-interactive authentication is available via safe status commands, never by inspecting tokens or `.env` files.
- **Do not force a migration the team does not need.** Both an external tracker port (Linear, GitHub Issues, Jira) and a Git-native queue (such as Rondo `tickets/<slug>.md`) can satisfy Stage 2. Recommend the path that fits how the team already plans work.

## What to inspect

Examine five surfaces across the repository and local environment:

1. **Current source of truth for work**
   - In-repo queues or specs: `tickets/`, `epics/`, `rfcs/`, `docs/`, `rondo*.yml`, or ticket validators/schemas.
   - Issue and PR templates: `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md`, branch-naming conventions, or commit/PR link rules (`Fixes #123`, Linear IDs).
   - Agent instructions (`AGENTS.md`, `CLAUDE.md`, existing `skills/`) mentioning how tasks are picked up, scoped, and updated.

2. **Programmatic reachability from the runtime**
   - Whether an agent running in a terminal or background sandbox can read a ticket and record progress through one deterministic, scriptable interface (Git files in the checkout, `gh issue`, a Linear/Jira CLI, or a scoped MCP/HTTP tool)—without browser scraping, screenshots, or copy-pasted Slack threads.
   - Authentication ergonomics and blast radius: read/write scopes, service accounts vs personal admin tokens, and rate-limit or offline behavior.

3. **Minimum executable ticket contract**
   Check whether ready work items consistently capture nine fields:
   - **Identity:** stable ticket ID or slug;
   - **Mission:** what needs to change, why it matters, and the observable end state;
   - **Acceptance criteria & verification:** concrete behavior and tests that prove completion;
   - **Scope & non-goals:** relevant modules/files and explicit boundaries not to cross;
   - **Owner:** accountable human handle responsible for decisions and review;
   - **Priority:** deterministic ordering signal;
   - **Dependencies:** upstream blockers that must finish first;
   - **State / pause:** whether the task is eligible now, waiting on a human, or deferred until a date;
   - **Evidence & history:** linked branch, open/merged PRs, architectural decisions, and prior attempt notes so a fresh agent can resume cleanly.

4. **Step granularity and durable memory**
   - Whether multi-PR initiatives are decomposed into independently reviewable steps (`1 step = 1 PR`) rather than monolithic "rewrite module X" tickets.
   - Where decisions and progress live between runs: inside a versioned ticket file, a structured issue block, or scattered across ephemeral chat transcripts and closed PR comments.

5. **Validation and data hygiene**
   - Author-time or CI checks that reject malformed frontmatter, missing owners, invalid priorities, or dependency cycles before an agent is dispatched.
   - Guardrails preventing secrets, customer PII, or raw credentials from being pasted into ticket descriptions sent to model providers.

## Two valid architectural patterns

Evaluate the repository against both patterns (or a deliberate hybrid):

| Pattern | How it works | Best fit | Key trade-off to manage |
|---|---|---|---|
| **A. Git-native queue (Rondo `tickets/<slug>.md`)** | Work lives as Markdown files in `tickets/` with line-based frontmatter (`owner`, `priority`, `model`, optional `depends`, `paused`), `Steps (1 PR each)`, `Decisions (newest first)`, and `Progress history (newest first)`. Code and ticket memory ship together in each PR. | Engineering-led epics, refactors, migrations, and repos wanting zero external tracker state or API drift. | Product intake still needs a lightweight triage step before a reviewed `.md` ticket lands on the base branch. |
| **B. Canonical tracker port (Linear / GitHub Issues / Jira)** | Work stays in the issue tracker; a dedicated skill + CLI/API adapter reads a strict "ready" schema and writes structured status/PR updates back. | Teams whose product, support, and roadmap workflows already run tightly in Linear, GitHub Issues, or Jira. | Requires non-interactive auth in remote sandboxes, strict field discipline, and explicit handling of concurrent edits. |
| **C. Hybrid (Tracker intake → Git-native execution)** | Issues/Linear track triage and roadmap; once approved for autonomous execution, an authoring skill materializes a bounded `tickets/<slug>.md` file linked to the upstream issue. | Organizations wanting product visibility in their tracker and deterministic, Git-versioned memory for multi-step agent execution. | Keep responsibilities crisp: upstream issue owns business goal; repo ticket owns step-by-step execution state. |

## Diagnostic rubric

Score each dimension as `Ready`, `Partial`, `Missing`, or `Unverified`:

| Dimension | Healthy signal (`Ready`) | Fragile signal (`Partial` / `Missing`) | Agent failure mode if left unfixed |
|---|---|---|---|
| **1. Authoritative source** | Every executable task lives in one canonical place with a stable ID/slug. | Requirements are split across Slack threads, Notion pages, and verbal context. | Agents build against stale or partial requirements. |
| **2. Runtime reachability** | Agents read and update tickets via Git or one documented CLI/API without browser login. | Manual copy-paste by a human is the only way context reaches the agent. | Background dispatch (Stage 3) is impossible. |
| **3. Contract completeness** | Mission, acceptance criteria, non-goals, accountable `owner`, priority, dependencies, and pause state are explicit. | One-line titles ("Fix webhook bug") with no reproduction, scope, or reviewer. | Agents guess product behavior or touch unrelated modules. |
| **4. 1-PR step sizing & memory** | Large work is broken into 1-PR steps; decisions and progress persist across sessions. | Huge multi-week tickets; context dies whenever an agent session ends. | Unreviewable 3,000-line PRs and repeated dead-end retries. |
| **5. Schema & hygiene validation** | CI or intake checks enforce required fields, dependency integrity, and secret-free text. | Freeform prose with unvalidated metadata or pasted customer payloads. | Broken automation parsers or sensitive data leaked to LLM APIs. |

## How to formulate recommendations

- **Pick one clean contract, not two competing queues.** Recommend Pattern A, B, or C explicitly based on existing repo evidence, and define exact authority boundaries so humans and agents never wonder which system wins.
- **Specify a concrete authoring and reading skill.** Recommend adding (or tightening) a repo skill—such as `rondo-author-ticket` for Git-native `tickets/<slug>.md` or a scoped tracker skill for `gh`/Linear—that enforces the nine-field contract and refuses vague one-liners by asking concise clarifying questions up front.
- **Validate structure deterministically.** For Git-native tickets, recommend a fast CI validator covering required keys (`owner`, `priority`, `model`), dependency cycles, valid `paused` values (`true`, `false`, or `YYYY-MM-DD`), and the empty-queue terminal case when the last ticket is deleted. For external trackers, recommend a deterministic readiness check (`ready` state/label + required sections present) before an agent starts work.
- **Verify without spam.** When recommending a live connectivity test, use read-only queries against existing issues or local validation on synthetic fixtures—never create throwaway issues in a team's production tracker.

## Audit report format

Return the audit in this structure:

```markdown
## Stage 2 Audit — Machine-Readable Ticket Contract

**Verdict:** <Ready for Stage 3 | Partially ready | Not ready>
**Recommended architecture:** <Pattern A: Git-native Rondo queue | Pattern B: Canonical tracker port | Pattern C: Hybrid>
<2–3 sentences explaining how tasks reach developers today, why the recommended pattern fits this repo, and the main gap blocking unattended execution.>

### Scorecard

| Dimension | Status | Repository / toolchain evidence | Impact on agents |
|---|---|---|---|
| Authoritative source | ... | `<exact files/templates/tools>` | ... |
| Runtime reachability | ... | `<exact CLI/Git surface>` | ... |
| Contract completeness | ... | `<fields present vs missing>` | ... |
| 1-PR step sizing & memory | ... | `<how multi-step work is tracked>` | ... |
| Schema & hygiene validation | ... | `<validators/workflows/rules>` | ... |

### Proposed ticket contract for this repo
<Compact concrete template or field spec tailored to the chosen pattern (10–20 lines max).>

### What to do next

#### P0 — Fix now (Stage 2 blockers)
1. **<Short imperative title>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact skill, template, validator, or config path>`
   - **Action:** <Concrete change to establish the contract and runtime access.>
   - **Verify:** `<exact read-only command or local validator check>`

#### P1 — High-impact hardening
1. **<Short imperative title>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact path>`
   - **Action:** <Concrete improvement.>
   - **Verify:** `<exact check>`

#### Not yet — Skip for now
- <1–2 over-engineering traps to avoid at Stage 2, such as bidirectional sync daemons between two trackers.>

### Stage 2 exit gate
<3–4 concrete proofs confirming an agent can read a ticket, verify its readiness, and record durable progress from a clean session before advancing to Stage 3 (`rondo-dispatch-ticket`).>
```

End by asking whether the human wants you to scaffold the `P0` ticket contract artifacts (authoring skill, template, or validator) on a branch without creating noisy test tickets.
