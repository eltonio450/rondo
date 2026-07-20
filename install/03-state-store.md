# Brick 3 — Registry port

## Purpose

Persist the last known `slug → branchName` mapping needed to match tickets with open PRs.

## Reference profile

The GitHub VCS port uses one open Issue labelled `rondo-registry`. The runner creates the Issue when needed and replaces its body each cycle. The JSON comment is machine-readable; the table is an informational dashboard.

The registry is not a dispatch lock and does not make execution exactly once.

## Discovery

Before mutation:

```bash
gh issue list --label rondo-registry --state open
gh label list --search rondo-registry
```

If more than one open Issue carries the label, stop and ask which record is authoritative. If a registry exists, adopt it rather than recreating it.

## Setup

After the installation workflow has been reviewed and delivered, ask permission to create the label:

```bash
gh label create rondo-registry --color 0E8A16 --description "Rondo branch registry"
```

If the label already exists, inspect it and continue. Do not hide unrelated API or permission errors with `|| true`.

The workflow token needs `issues: write` and `pull-requests: read`. The runner creates the Issue on its first non-dry cycle; dry-run makes no registry mutation.

## Alternative VCS/state ports

A non-GitHub implementation may store the same mapping elsewhere, but it must preserve the semantics in `SPEC.md` and implement `action/src/vcs/CONTRACT.md`. Document consistency, identity, failure, and retention behavior.

## Self-check

- Exactly one authoritative registry is selected.
- The label exists or an authorized human owns that pending step.
- Workflow permissions are least-privilege.
- The human understands that mapping loss can cause repeat dispatch and must be treated as an operational failure.
