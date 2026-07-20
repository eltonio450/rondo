---
name: rondo-author-ticket
description: Turn an informal request into a valid, reviewable Rondo ticket while preserving queue safety and dependency semantics.
---

# Author a Rondo ticket

Use this skill to create a ticket file for a Rondo v0.4-compatible runner. This skill is standalone; do not assume the Rondo source tree or schema is present.

## Discover first

1. Read repository guidance and inspect the current working tree.
2. Find `tickets-dir` in `.github/workflows/rondo.yml`; default to `tickets` only when no configured path exists.
3. List current ticket filenames and read any ticket named as a dependency.
4. Note whether the team uses optional `.gitkeep`; do not make it a validation requirement.
5. Do not overwrite an existing slug.

## Clarify

Ask in one concise message only for facts not already supplied:

- mission and measurable end state;
- GitHub reviewer handle (`owner`);
- priority `0..99` (default `2`);
- model (default `default`);
- dependencies on currently live ticket slugs;
- pause date/indefinite pause, if any;
- the first concrete reviewable step and likely following steps.

Propose a short stable slug matching `^[a-z0-9][a-z0-9-]{0,62}$`. Confirm before writing when a materially different slug would affect dependencies or naming conventions.

## Ticket format

Ticket frontmatter is line-based, not YAML. It starts on line 1, has no `---` fences, and ends at the first blank line.

```markdown
owner: <github-handle>
priority: 2
model: default
depends: ticket-a, ticket-b
paused: 2026-08-15

# <Short descriptive title>

## Mission
<What, why, constraints, and observable end state in 2–4 sentences.>

## Steps (1 PR each)

### Step 1 — <Concrete change that fits one reviewable PR>
<Relevant files, behavior, tests, and non-goals.>

### Step 2 — <Next independently reviewable change>

## Decisions (newest first)

## Progress history (newest first)
```

Include `depends` and `paused` only when needed. Valid pause values are `true`, `false`, or `YYYY-MM-DD`; omission is clearer than `false`. Missing dependency files mean completed under the protocol, so warn when a named dependency is not present. Reject a dependency cycle among live tickets.

## Quality bar

- Mission explains what/why/end state, not implementation trivia alone.
- Each step is independently reviewable and names validation expectations.
- Non-goals and risky migrations are explicit.
- No secret, credential, customer data, or private incident detail is embedded.
- Newest-first sections start empty; agents insert new entries at the top.
- Owner/model/priority and filename obey the rules above.

If the repository contains the validator, run it for the configured directory. Otherwise report that schema validation was not run and hand over the file for the host CI check. Do not commit or push unless explicitly requested.
