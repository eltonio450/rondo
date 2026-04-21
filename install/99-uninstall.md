# Brick 99 — Uninstall

## What it does

Removes Rondo from the host repo. Scoped so the human can pick between *"just stop dispatching for now"* and *"nuke everything"*.

## Default we ship

A staged uninstall with three levels:

- **Workflow-only** — disables dispatch; keeps tickets, the registry Issue, and labels intact. Reversible in one `git revert`.
- **Everything** — also deletes `tickets/` and the host-repo prompt override. The registry Issue and its label are preserved so the historical snapshot stays in the Issues tab.
- **Scorched earth** — also closes the registry Issue and deletes the `rondo-registry` label. Rare; destructive. Confirm twice.

## Questions to ask the human

1. *"Uninstall level? `workflow-only` (default — reversible) · `everything` · `scorched-earth`."*
2. If `everything` or `scorched-earth`: *"Are you sure? This repo currently has M ticket files on the queue."* (run `ls <ticketsDir>/*.md` to populate M before asking).
3. *"Also remove the agent-runner secret (`CURSOR_API_KEY` etc.)? I'll print the command; you run it."*

## Steps

### Level: workflow-only

1. Delete `.github/workflows/rondo.yml` if present.
2. Delete `.github/workflows/rondo-validate-tickets.yml` if present.
3. **Done.** The registry Issue stays, labels stay, `tickets/` stays.

### Level: everything (does level `workflow-only` first, then)

1. Delete `<ticketsDir>/` (read the `tickets-dir` input from `.github/workflows/rondo.yml` before deleting the workflow; else assume `tickets/`).
2. Delete the host-repo prompt override (`rondo.prompt.md`) if it exists.
3. Delete `.cursor/skills/rondo-*`, `.claude/skills/rondo-*`, `skills/rondo-*` if the human opted to install them in Brick 7.
4. The registry Issue and `rondo-registry` label are **preserved** — the last snapshot is still useful history.

### Level: scorched-earth (does level `everything` first, then)

1. Ask the human **one more time** before proceeding.
2. Close the registry Issue:

   ```bash
   gh issue list --label rondo-registry --state open --json number --jq '.[].number' \
     | xargs -I{} gh issue close {} --comment "Closed by Rondo uninstall (scorched-earth)."
   ```

3. Delete the label:

   ```bash
   gh label delete rondo-registry --yes || true
   ```

4. If any legacy labels still linger from an old install, clean them up too:

   ```bash
   for L in rondo rondo:status:dispatched rondo:status:active rondo:status:stale rondo:status:failed rondo:paused; do
     gh label delete "$L" --yes || true
   done
   ```

### In all cases: the secret

Print (do **not** run):

```bash
gh secret remove CURSOR_API_KEY           # or CLAUDE_CODE_OAUTH_TOKEN / CODEX_CLOUD_ENV_ID / RONDO_HTTP_SECRET
```

Tell the human to remove whichever secret(s) they set during Brick 5.

## Alternatives (documented, not implemented by default)

- **Archive instead of delete** — move `tickets/` to `tickets-archive/` instead of deleting. Preserves the historical record of everything that was on the queue. Easy to add; not the default because most teams clearing Rondo want a clean repo.
- **Transfer to another repo** — move the tickets to a different host repo via `gh transfer`. Not automated; the human can do it by hand if needed.

## Self-check

- [ ] The chosen level's files are gone.
- [ ] The human has been told which `gh secret remove` command to run.
- [ ] If `scorched-earth`: the registry Issue is closed, `rondo-registry` label is deleted.
- [ ] If not `scorched-earth`: the registry Issue is still visible under the `rondo-registry` label.
