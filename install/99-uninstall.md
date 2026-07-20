# Brick 99 — Uninstall or suspend

## Purpose

Stop dispatch safely, with explicit retention choices. Follow the host repository's normal review and delivery policy.

## Discover first

Read `.github/workflows/rondo.yml` before changing it and record:

- ticket directory;
- backend and secret name;
- registry label/Issue;
- installed skills and prompt override;
- open Rondo branches/PRs and possibly running provider agents.

A removed workflow cannot cancel an already dispatched remote agent.

## Levels

### Suspend — recommended reversible default

Disable or remove the schedule while retaining manual dry-run, tickets, validation, registry, prompt, and skills. Deliver through a normal PR.

### Remove runner

Remove `.github/workflows/rondo.yml`. Decide separately whether ticket validation should remain. Preserve tickets and registry history.

### Remove repository artifacts

After explicit confirmation, also remove:

- the validation workflow;
- active tickets and `.gitkeep`, or move tickets to an agreed archive;
- `rondo.prompt.md` when it is Rondo-specific;
- installed `rondo-*` skills.

Show the ticket count and open PRs before this destructive step. Never delete user-authored tickets merely because the workflow is being removed.

### Remove external state

After a second explicit confirmation:

1. close the authoritative registry Issue with a clear comment;
2. delete the `rondo-registry` label only if nothing else uses it;
3. ask the human whether to remove the backend secret and uninstall provider Apps;
4. inspect and cancel remote agents through the provider UI/API when supported.

Print secret commands; do not run them or request the value:

```bash
gh secret remove CURSOR_API_KEY
# or
gh secret remove RONDO_HTTP_SECRET
```

## Self-check

- The chosen level and destructive effects were confirmed.
- No unrelated workflow, ticket, label, or secret was touched.
- Already-running remote work was considered.
- Repository changes were reviewed and delivered before declaring uninstall complete.
- Retained registry/ticket history and remaining human actions are reported.
