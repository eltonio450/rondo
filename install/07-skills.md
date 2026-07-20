# Brick 7 — Standalone skills (optional)

## Purpose

Install small, self-contained instructions for humans and agents that author, install, or resume Rondo work.

## Rules

- Copy skills from the same immutable `<RONDO_REF>` as the Action, never from `main`.
- Preserve each `SKILL.md` verbatim unless the host requires metadata changes.
- Skills must remain usable after copying: they cannot depend on relative links back to the Rondo source checkout.
- Do not install into a tool-specific directory until the human confirms that tool.

## Locations

| Tool | Conventional destination |
|---|---|
| Cursor | `.cursor/skills/<name>/SKILL.md` |
| Claude Code | `.claude/skills/<name>/SKILL.md` |
| Repository-neutral | `skills/<name>/SKILL.md` |

If several tools need the skills, prefer duplication during installation unless the host explicitly accepts repository symlinks across platforms.

## Canonical sources

Resolve each source against the immutable commit, for example:

```text
https://raw.githubusercontent.com/eltonio450/rondo/<RONDO_REF>/skills/rondo-install/SKILL.md
https://raw.githubusercontent.com/eltonio450/rondo/<RONDO_REF>/skills/rondo-author-ticket/SKILL.md
https://raw.githubusercontent.com/eltonio450/rondo/<RONDO_REF>/skills/rondo-resume-ticket/SKILL.md
```

Do not leave `<RONDO_REF>` unresolved. If network fetch is not approved, copy from an already reviewed local checkout at that ref.

## Self-check

- Every installed skill came from the selected immutable ref.
- No installed instruction depends on `../../PROMPT.md`, `../../schemas`, or another source-only relative path.
- Existing skills were not overwritten without approval.
- The human knows the invocation syntax for their tool.
