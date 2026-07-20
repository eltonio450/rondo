# Brick 2 — Agent prompt

## Purpose

Choose the instructions sent on every dispatch while preserving the portable Rondo agent contract.

## Default

Install no file. The Action loads the `PROMPT.md` bundled at the same immutable `<RONDO_REF>` as the runner.

The default requests exactly one relevant PR, reuse of a matching PR on retry, one ticket update, the agreed head/base branches, and one of four outcomes. The reference runner requests but does not verify those properties.

## Optional host additions

Ask whether the host needs repository-specific rules. Prefer a short prepend over a full replacement.

- `rondo.prompt.md` whose first non-empty line is **not** `# Rondo agent prompt` is prepended to the bundled prompt.
- A file beginning with `# Rondo agent prompt` fully replaces the bundled prompt.

For a prepend, create only the additions—do not include a trailing separator because the loader adds one:

```markdown
# Repository-specific Rondo additions

- Read AGENTS.md before editing.
- Run the checks required by CONTRIBUTING.md.
- Never change generated files by hand.
```

For a full override, copy `PROMPT.md` from the exact reviewed `<RONDO_REF>`, then edit it. Warn that removing retry awareness, branch rules, or the ticket-update requirement makes agents less interoperable; it does not change what the runner can verify.

## Security

The complete resulting prompt is sent to the configured agent provider or HTTP receiver. Do not place credentials, customer data, or private operational instructions in it unless that destination is approved to receive them.

## Self-check

- No override exists unless requested.
- A prepend does not accidentally trigger full replacement.
- A full override came from the same immutable ref as the Action.
- The final prompt contains no secret and retains the core agent contract.
