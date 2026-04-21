# Brick 7 — Skills (optional)

## What it does

Drops small instruction files ("skills") into the repo so Cursor / Claude Code users can invoke Rondo-specific helpers from their IDE — e.g. *"use the rondo-author-ticket skill to help me write a well-formed ticket"*. Skills complement, not replace, [`INSTALL.md`](../INSTALL.md) and [`PROMPT.md`](../PROMPT.md).

## Default we ship

Three skills, as Markdown files:

- **`rondo-install`** — wraps [`INSTALL.md`](../INSTALL.md) so a human can say *"use the rondo-install skill"* and their agent does the right thing.
- **`rondo-author-ticket`** — helps a human turn an informal ask into a well-formed ticket (frontmatter + Mission + Steps + empty Decisions / Progress sections).
- **`rondo-resume-ticket`** — helps an agent (or a human) pick up a stalled ticket cleanly — re-read the decisions log, identify the next concrete step, ignore stale scope.

Each skill is one `SKILL.md` file. Where it goes depends on what the host repo already uses:

| Tool | Skill location convention |
|---|---|
| Cursor (global) | `.cursor/skills/<name>/SKILL.md` |
| Claude Code (per-repo) | `.claude/skills/<name>/SKILL.md` |
| Neither detected | `skills/<name>/SKILL.md` (Rondo's fallback) |

## Questions to ask the human

1. *"Which coding agents will humans use to author tickets? `cursor` · `claude-code` · `both` · `none`."*
2. If `none`: skip this brick entirely.
3. *"Install all three skills (recommended), or only a subset?"*

## Steps

1. Detect existing skill directories: `.cursor/skills/`, `.claude/skills/`, `skills/`. If several exist, use the one matching the human's chosen tool.
2. For each skill the human chose, fetch its canonical content from the Rondo repo:

   ```
   https://raw.githubusercontent.com/eltonio450/rondo/main/skills/rondo-install/SKILL.md
   https://raw.githubusercontent.com/eltonio450/rondo/main/skills/rondo-author-ticket/SKILL.md
   https://raw.githubusercontent.com/eltonio450/rondo/main/skills/rondo-resume-ticket/SKILL.md
   ```

   Write each into `<skill-dir>/<name>/SKILL.md`.

3. If both Cursor and Claude Code are in use, symlink (or duplicate) the three skill directories into the second tool's expected location. Note to the human: symlinks keep them in sync; duplication avoids symlink pitfalls on Windows.

4. Tell the human how to invoke each skill from their agent — *"Type `/rondo-author-ticket` (Cursor) or ask your assistant 'use the rondo-author-ticket skill'."*

## Alternatives (documented, not implemented by default)

- **A dedicated VS Code / JetBrains extension** — packages the skills as first-class commands with keybindings. Not planned for v0.1.
- **Continue.dev / Aider / other AI-IDE integrations** — if a host uses one of these, the skills can be mirrored into its conventional prompts folder. Not automated; the human does it by hand.
- **Skill-as-service** — a shared Rondo server that serves skills to all installed repos via a URL, enabling central updates. Bad fit for an MIT OSS tool; not planned.

## Self-check

- [ ] The chosen skills exist at the right path for the tool(s) in use.
- [ ] The human has been shown how to invoke a skill from their IDE.
