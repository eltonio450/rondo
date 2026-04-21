---
name: rondo-author-ticket
description: Turn an informal ask into a well-formed Rondo ticket (.md file with frontmatter, Mission, Steps). Invoke when the user says "write a ticket", "draft a rondo ticket", or describes work they want an agent to pick up.
---

# rondo-author-ticket

You are going to help the user draft a new ticket for Rondo. A ticket is a Markdown file in `<ticketsDir>/` (usually `tickets/`). The runner scans it every cycle and dispatches an agent.

## Before you write anything

Ask the user (in one message, not one-by-one):

1. **Mission** — what's the full scope in 2–4 sentences? If the user waves vaguely, push back: agents work better with a crisp mission.
2. **Owner** — which GitHub handle should be the human reviewer? Default: the user themselves.
3. **Priority** — 0 (fire), 2 (normal), 9 (nice-to-have). Default: 2.
4. **Model** — leave as `default` unless the user has a reason.
5. **Dependencies** — are there other tickets currently on the queue this one must wait for?
6. **Pause** — should this ticket wait until a future date?
7. **Rough steps** — what's the first step? What comes after? Three concrete steps are better than ten vague ones.

## The file to write

File path: `<ticketsDir>/<slug>.md` where `<slug>` matches `^[a-z0-9][a-z0-9-]{0,62}$` — kebab-case, short, stable. Propose a slug to the user and confirm before writing.

Template:

```markdown
owner: <handle>
priority: <N>
model: default

# EPIC: <Title — short and descriptive; shown in the registry Issue's table>

## Mission
<2–4 sentences. What are we doing, why, and what's the end state?>

## Steps (1 PR each)

### Step 1 — <concrete, ships-in-one-PR>
<What the agent should do on the first cycle. Be specific. Reference files if you can.>

### Step 2 — <next>

### Step 3 — <after that>

## Decisions (newest first)
- <YYYY-MM-DD> — *(agent fills this in as it makes calls)*

## Progress history (newest first)
- <YYYY-MM-DD> — *(agent appends one line per merged PR)*
```

## Frontmatter rules (non-negotiable per SPEC §3.2)

- **No YAML `---` fences.** Key: value per line at the very top of the file.
- Blank line ends the frontmatter.
- Required: `owner`, `priority`, `model`.
- Optional: `depends: ticket-a, ticket-b`, `paused: 2026-05-01` or `paused: true`, `spec: 0.2`.

## Self-check before handing over

- [ ] Frontmatter validates against [`schemas/ticket.schema.json`](../../schemas/ticket.schema.json).
- [ ] The slug is kebab-case, unique in `<ticketsDir>/`, and short enough to read.
- [ ] Mission answers *what* and *why* in 2–4 sentences.
- [ ] Steps are concrete enough that a background agent knows what to code on the first cycle.
- [ ] Decisions and Progress sections are present but empty (newest-first convention).
