# Brick 3 — Registry Issue

## What it does

Maintains **one GitHub Issue** in the host repo whose body carries a `slug → branchName` mapping for every ticket currently on the queue. That's the only durable state Rondo keeps outside the repo.

The runner rewrites the Issue body from scratch at the end of every cycle — the body is always a snapshot of current reality. Eligibility is then derived from the filesystem (ticket files) and the list of open PRs (branches), not from any persisted status.

## Default we ship

**One long-lived GitHub Issue**, identified by the label `rondo-registry`. The runner finds it (or creates it) at the start of every cycle.

Body shape ([`SPEC.md §6`](../SPEC.md)):

```
<!-- rondo-registry
{
  "<slug>": "<branchName>",
  ...
}
-->

# Rondo — ticket registry

Updated <ISO-8601>. ...

| Ticket | Branch | State |
|---|---|---|
| `<slug>` | `<branchName>` | <state> |
```

Why this default:
- The UI is free — every developer already watches the Issues tab.
- No DB to provision, no dashboard to host, no schema to evolve.
- No per-ticket Issues to clean up — one Issue, for the life of the repo.
- If Rondo disappears tomorrow, your state is still yours, in your repo.

## Questions to ask the human

1. *"Create (or adopt) the single registry Issue? (strongly recommended default: yes)"*
2. If yes: no further questions — the runner creates it on its first cycle. You just need the label.
3. If no: Rondo doesn't run without a registry. Stop this brick and discuss alternatives (there are no shipped ones).

## Steps (for the default)

Create the single label. Idempotent — if it already exists, `gh` returns a harmless "already exists" message.

```bash
gh label create rondo-registry --color "0E8A16" --description "Rondo — single registry Issue (slug → branchName)" || true
```

That's it. The runner will create the Issue itself on its first cycle if it doesn't find one with that label.

If you're migrating from a legacy install (pre-registry-Issue design): the old per-ticket Issues and `rondo:status:*` labels are obsolete. See [`install/99-uninstall.md`](./99-uninstall.md) for a safe cleanup path, or leave them alone — the new runner ignores them.

## Alternatives

None shipped. The registry Issue is the only persistence mechanism Rondo v0.2 uses — a single small piece of state. If you want to move it elsewhere (Supabase, a KV store, a flat file in the repo), you'd need to rewrite [`action/src/core/registry.mjs`](../action/src/core/registry.mjs) and [`action/src/vcs/gh-client.mjs`](../action/src/vcs/gh-client.mjs) to talk to your backend. Before doing that, consider: the body is ~N lines for N live tickets. You probably don't have a performance problem.

## Self-check

- [ ] Label `rondo-registry` exists in the host repo (`gh label list | grep rondo-registry`).
- [ ] No stray `rondo:status:*` labels remain from a legacy install (optional — they're harmless, just noise).
- [ ] The human understands the runner will create the registry Issue itself on its first cycle.
