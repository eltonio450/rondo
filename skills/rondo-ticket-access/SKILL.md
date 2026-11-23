---
name: rondo-ticket-access
description: Audit and design Stage 2 of a software factory—connecting your ticketing system (Linear, Notion, GitHub Issues, Jira, or Git tickets) directly to coding agents so they read tasks, acceptance criteria, and update progress without manual copy-paste.
---

# Ticketing System Access Setup & Audit

**Stage 2 of 7 — Build Your Software Factory**

Once a local agent can complete a pasted task from branch to PR merge (Stage 1), copy-pasting tickets by hand becomes the bottleneck. Stage 2 connects your actual ticketing system—**Linear, Notion, GitHub Issues, Jira, or Git-native `tickets/*.md`**—directly to the agent so it can read a ticket by ID, see its full context and acceptance criteria, post progress updates, and link its PR back to the ticket.

Use this skill to audit how tasks are stored today and design the cleanest, non-interactive connection between your ticketing tool and your agents.

## Guardrails

- **Audit read-only first.** Inspect repo templates, scripts, CLI/MCP configs, and safe auth status without creating test issues or mutating live tickets.
- **Work with the team's real tracker.** Never force a migration from Linear/Notion/Jira to GitHub Issues (or vice versa) unless the team wants one. Wire the tracker they already use—or pair it with Git-native Rondo `tickets/<slug>.md` for multi-step execution memory.
- **Never read, print, or request secret values.** Check auth availability via safe status commands only.

## What to inspect

Examine five concrete surfaces:

1. **Where tickets actually live today**
   - Identify the team's real task tracker: Linear, Notion, GitHub Issues, Jira, Shortcut, or in-repo `tickets/*.md` / `epics/`.
   - Check existing issue/PR templates (`.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md`) and linking conventions (`Fixes #123`, `ENG-42`).

2. **Direct, non-interactive agent access**
   - Check how an agent in a terminal can read and update a ticket **without browser scraping or human copy-paste**:
     - GitHub Issues → `gh issue view/comment/edit`
     - Linear → Linear CLI, GraphQL script, or scoped MCP
     - Notion → official Notion CLI (`ntn`), API script, or scoped MCP
     - Jira → `acli` / `jira` CLI or REST script
     - Git-native → `tickets/<slug>.md` checked directly into the repo (Rondo format)
   - Check auth scope (read + comment/status update only; avoid broad workspace admin tokens) and whether the same access pattern will survive moving to a cloud runtime in Stage 3.

3. **Minimum ticket quality for autonomous work**
   - Check whether ready tickets consistently give an agent what it needs without asking 5 questions on Slack:
     1. Clear goal (what changes and why);
     2. Acceptance criteria (how to prove it works);
     3. Out-of-scope / non-goals (what not to touch);
     4. Named owner (who decides if something is ambiguous);
     5. Right size (1 step = 1 reviewable PR, or broken into steps).

4. **Two-way status & PR linking**
   - Can the agent read the ticket, link its opened PR back to the ticket, post a short summary when blocked or ready, and leave a durable trail another session can pick up?

5. **Agent skill / instructions for using the tracker**
   - Is there a short skill or section in `AGENTS.md` telling the agent the exact commands to read a ticket, update status, and handle missing info?

## Diagnostic rubric

Score each surface as `Ready`, `Partial`, `Missing`, or `Unverified`:

| Surface | Healthy (`Ready`) | Fragile (`Partial` / `Missing`) | What breaks without it |
|---|---|---|---|
| **1. Tracker identified** | One clear source of truth for ready engineering tasks. | Tasks split across Slack DMs, docs, and multiple trackers. | Agents never know which spec is current. |
| **2. Direct CLI/API access** | Non-interactive read + comment/link works from terminal with least-privilege auth. | Humans still copy-paste ticket text into agent chats. | Cannot automate launch in Stages 3–4. |
| **3. Executable ticket shape** | Ready tickets state goal, proof of done, non-goals, owner, and 1-PR size. | One-line titles like "Fix export" or "Improve onboarding". | Agent guesses silently and ships the wrong change. |
| **4. Two-way writeback** | Agent links PRs and posts clear status/blockers back to the ticket. | Status updates stay buried in local chat logs. | Team loses visibility; next session restarts from scratch. |
| **5. Reusable tracker skill** | Exact read/update commands documented in `AGENTS.md` or a small skill. | Every engineer prompts tracker usage differently. | Inconsistent updates and brittle scripts. |

## Audit report format

Return the audit in this structure:

```markdown
## Stage 2 Audit — Ticketing System Access

**Verdict:** <Ready for Stage 3 | Partially ready | Not ready>
<2–3 concrete sentences: can an agent pull a ticket by ID from Linear/Notion/GitHub/Jira/Git today and report back without copy-paste?>

### Scorecard
| Surface | Status | Exact evidence | What breaks |
|---|---|---|---|
| Tracker identified | ... | `<tracker / templates>` | ... |
| Direct CLI/API access | ... | `<CLI / MCP / auth status>` | ... |
| Executable ticket shape | ... | `<template / sample fields>` | ... |
| Two-way writeback | ... | `<PR linking / comments>` | ... |
| Reusable tracker skill | ... | `<AGENTS.md / skills>` | ... |

### Recommended integration path
<Pick the cleanest setup for this team (e.g. Linear CLI/MCP, Notion API/CLI, `gh issue`, Jira CLI, or Rondo `tickets/*.md` bridge) and explain why it will also work unattended in Stage 3 cloud runtimes.>

### What to build next

#### P0 — Connect ticketing now
1. **<Concrete step>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact script, skill, template, or CLI setup>`
   - **Action:** <Exact change.>
   - **Verify:** `<exact read-only ticket fetch command by ID>`

#### P1 — Hardening
1. **<Concrete step>** (`Agent PR` | `Human`)
   - **Target:** `<exact path>`
   - **Action:** <Exact improvement.>
   - **Verify:** `<exact check>`

#### Not yet — Skip for now
- <Do not build auto-dispatch webhooks before a local agent can cleanly fetch a ticket by ID and update it.>

### Stage 2 exit test
Give your local agent ONLY a ticket ID (e.g. "Implement ENG-142"). Verify it fetches the spec directly from your tracker, implements and tests the change (Stage 1), opens the PR linked to the ticket, and updates the ticket with its status—with zero copy-pasting. Only then move to Stage 3 (`rondo-cloud-runtime`).
```

End by offering to draft the tracker skill, ticket template, or read/write wrapper script on a branch.
