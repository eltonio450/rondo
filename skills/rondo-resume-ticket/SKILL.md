---
name: rondo-resume-ticket
description: Resume or retire a stalled Rondo ticket safely, accounting for pauses, existing PRs, retries, and current repository reality.
---

# Resume a Rondo ticket

Rondo dispatch is at least once. Before doing work, determine whether another dispatch or PR already exists. Never assume a timeout means the remote agent stopped.

## Reconstruct state

1. Read repository guidance and the complete target ticket: frontmatter, mission, steps, decisions, and progress.
2. Inspect current base-branch code and recent relevant changes; ticket plans can become stale.
3. Resolve the branch from the machine JSON block in the open Issue labelled `rondo-registry`. If no mapping exists, use the configured branch prefix (default `rondo/<slug>`).
4. Search open PRs on that exact branch in the host repository. A same-named fork branch is not the same head.
5. Inspect provider state when the last dispatch timed out or failed ambiguously.

If an open, relevant PR already exists, do not start another step. Continue/review that work or report the inconsistency.

## Pause semantics

- `paused: true`: stop unless a human explicitly authorizes unpause.
- future `paused: YYYY-MM-DD`: stop until that date.
- date today or earlier: remove the key and matching `[resume: DATE]` suffix before progressing.
- `paused: false`: unpaused; remove it for clarity when editing.

## Choose one outcome

1. **Progress:** implement one reviewable next step; insert progress/decisions at the top; create or update the single matching PR touching the ticket.
2. **Pause:** set a valid pause, record reason/trigger/owner, and create or update the single ticket-only PR.
3. **Done:** promote durable knowledge, then remove or explicitly archive the ticket in the single matching PR.
4. **No-op:** record blocker, need, and owner in the single ticket-only PR; do not repeat the same no-op indefinitely.

Use the registry branch as head and configured base branch as target. Work on only this ticket. Ensure exactly one relevant PR exists—reuse it on retry—and remember that the runner does not verify this; your compliance preserves the protocol.

## Re-scope or retire

Treat progress history and current code as evidence. If a step is obsolete, rewrite it and add a dated decision. Do not silently rewrite the mission. Retire the ticket when the mission is complete, no longer relevant, or fully superseded.

Before handoff, report existing PR/provider checks, chosen outcome, changed scope, validation run, and remaining risk. Do not commit, push, close PRs, or mutate the registry unless explicitly authorized by the current task.
