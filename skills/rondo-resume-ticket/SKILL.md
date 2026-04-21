---
name: rondo-resume-ticket
description: Pick up a stalled Rondo ticket cleanly. Re-reads the ticket's decisions log and progress history, identifies the next concrete step, and produces a clean PR. Invoke when a ticket has been paused, failed, or left mid-progress for more than one cycle.
---

# rondo-resume-ticket

You are going to resume a Rondo ticket that has stalled. The usual reasons: a pause has expired, a dispatch went stale without merging, or a previous agent left the ticket mid-step.

## Inputs

- `TICKET_FILE` — path to the ticket `.md` under `<ticketsDir>/`.

## Steps

1. **Read the ticket in full.** Pay special attention to:
   - `## Decisions (newest first)` — the most recent entries tell you *why* things are where they are.
   - `## Progress history (newest first)` — the most recent merged PRs tell you *what* is already shipped.
   - `## Steps` — compare against Progress history. Which steps are already in prod? Which is next?
2. **Check the frontmatter.**
   - If `paused: <date>` is present and the date is **past or today** → remove the key (the pause has expired). Also strip any `[resume: <date>]` suffix from the first H1.
   - If `paused: true` → **stop.** This ticket is paused indefinitely; a human must remove the key.
3. **Resolve conflict with open PRs.** Look up this ticket's recorded branch in the registry Issue (label `rondo-registry`) — its JSON block maps `slug → branchName`. If no mapping exists yet, fall back to the convention `rondo/<slug>`. Then search for an open PR on that exact branch. If one exists and is mergeable, **do not start a new step** — the runner should have skipped this ticket. Flag to the user. (Note: some backends like Cursor auto-generate branch names such as `cursor/auto-<slug>-abc` — that's why the registry is the source of truth, not the `rondo/` prefix.)
4. **Identify the next step.** Use the Progress history as ground truth: the next step is the first one in `## Steps` that hasn't been logged as merged.
5. **Re-check the step is still relevant.** A lot may have changed since the ticket was written. If the step is obsolete, rewrite it and log the rewrite in Decisions.
6. **Proceed as a normal Rondo cycle.** Follow [`PROMPT.md`](../../PROMPT.md) — choose one of the four outputs (Progress / Pause / Done / No-op), and always open exactly one PR.

## Signals that the ticket should be retired, not resumed

- The Mission is no longer relevant (the product pivoted, the bug is already fixed elsewhere).
- Every step in `## Steps` is either already in Progress history or has been superseded.
- The Decisions log contains a `YYYY-MM-DD — abandoning this ticket because X` entry that wasn't acted on.

In those cases, choose output (c) Done: promote any durable knowledge into canonical docs, then delete the `.md` file.

## What you must NOT do

- Do not rewrite the Mission silently. If you must re-scope, log it in Decisions with a dated entry.
- Do not drop the Decisions or Progress history sections, even if they're long. They are the ticket's memory.
- Do not open more than one PR.
