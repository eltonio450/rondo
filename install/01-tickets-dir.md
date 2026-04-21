# Brick 1 — Tickets directory

## What it does

Creates the directory where ticket `.md` files live. The runner scans this directory on every cycle.

## Default we ship

`tickets/` at the repo root. One `.md` file per ticket. An example ticket is seeded if the directory is empty so the human sees the expected shape.

Why this default: agents, humans, and `ls` all understand a flat folder of markdown. No nested structure to debate, no index file to maintain.

## Questions to ask the human

1. *"Where should ticket files live? (default: `tickets/`)"* — record as `<ticketsDir>`.
2. If the directory already exists and is non-empty: *"I see existing files in `<ticketsDir>/`. Skip the example ticket? (default: yes)"*

## Steps

1. If `<ticketsDir>` does not exist, create it.
2. If `<ticketsDir>` is empty (or the human opted into the example), resolve `<owner>`:
   - Try `gh api user --jq .login` to detect the current GitHub user.
   - If that fails or returns nothing, fall back to the literal `rondo-user` — it passes [`schemas/ticket.schema.json`](../schemas/ticket.schema.json) and is an obvious placeholder to replace.
   - Do **not** write an unresolved placeholder like `<github-username>` — the `owner` regex (`^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$`) rejects angle brackets, which would make the Brick 6 validator fail on the seeded example.

3. Write `<ticketsDir>/example.md` with that resolved owner:

   ```markdown
   owner: <owner>
   priority: 2
   model: default

   # EPIC: Example ticket — replace me

   ## Mission
   Describe the full scope of work in 2–4 sentences. The agent will read this every run.

   - 1 PR = 1 step.
   - Always update this file with what was done, why, and what's next.
   - Keep the **Decisions** log newest-first.

   ## Steps (1 PR each)

   ### Step 1 — Replace this with your first concrete step
   Be specific. The agent will pick the next un-checked step on the next run.

   ### Step 2 — Your second step

   ## Decisions (newest first)
   - YYYY-MM-DD — *(agent fills this in as it makes calls)*

   ## Progress history (newest first)
   - YYYY-MM-DD — *(agent appends one line per merged PR)*
   ```

4. Tell the human: *"I seeded `<ticketsDir>/example.md` with `owner: <owner>`. Replace that with the real reviewer's handle, or delete the file once you author a real ticket."*

## Alternatives (documented, not implemented by default)

- **Multiple tickets directories** — e.g. `tickets/platform/`, `tickets/growth/`. Requires widening the runner to accept a glob. Not implemented — open a PR against the Rondo repo if you need this.
- **Tickets in a branch other than the default** — e.g. live in `rondo-queue` branch, never in `main`. Cleaner for teams who don't want tickets in their default-branch history. Not implemented; would require the scheduler to checkout a non-default branch before scanning.
- **Tickets issued as GitHub Issues only, no `.md` in the repo** — removes the "tickets live in git" story. Actively discouraged; this is not Rondo.

## Self-check

- [ ] `<ticketsDir>` exists at the repo root.
- [ ] If seeded, `<ticketsDir>/example.md` validates against [`schemas/ticket.schema.json`](../schemas/ticket.schema.json).
- [ ] The seeded `owner:` value passes the `^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$` pattern (no `<angle-brackets>`, no punctuation) — otherwise Brick 6's validator will fail.
- [ ] The human has been told to replace the seeded owner with the real reviewer's handle.
