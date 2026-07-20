# Brick 1 — Ticket directory

## Purpose

Create the flat, versioned directory scanned by the reference runner.

## Decisions

Ask for the path relative to the repository root; default `tickets`. The v0.4 reference scanner reads direct `.md` children only. Nested team directories require a runner port and must not be implied by this brick.

If the directory already contains files, inventory them and preserve them. Never seed or overwrite an example without approval.

## Steps

1. Create `<ticketsDir>` if absent.
2. Optionally add `<ticketsDir>/.gitkeep` when the team wants the empty queue visible in Git. The runtime and validator treat an absent directory as an empty queue, so this sentinel is not required.
3. If the directory has no `.md` ticket and the human wants an example, resolve an owner with `gh api user --jq .login` or ask. Do not invent an angle-bracket placeholder.
4. Create `<ticketsDir>/example.md` in a paused state so the first real cycle cannot dispatch placeholder work:

   ```markdown
   owner: rondo-user
   priority: 2
   model: default
   paused: true

   # Example ticket — replace or remove me

   ## Mission
   Describe the desired end state, constraints, and reason for the work.

   ## Steps (1 PR each)

   ### Step 1 — Define one concrete, reviewable change

   ## Decisions (newest first)

   ## Progress history (newest first)
   ```

   Replace `rondo-user` with the resolved reviewer. Keep `paused: true` until the example is real.

5. Removing the final ticket is valid completion behavior. Do not make CI depend on a directory that Git will no longer materialize; absence must remain equivalent to an empty queue.

## Self-check

- `<ticketsDir>` is relative to the repository root; empty/absent behavior is understood.
- Existing files are unchanged unless explicitly approved.
- Every `.md` filename matches the slug rule.
- Any example has a valid owner and is paused.
- The workflow and validator will use the exact same path.
