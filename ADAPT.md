# Adapting Rondo

Rondo is a small protocol with a GitHub reference profile. Adapt it by replacing ports around the core, not by copying implicit assumptions into a new monolith.

## Mental model

```text
                         host repository
                  ticket files + prompt override
                              │
                         scheduler port
                              │
                    scan / order / capacity
                              │
               ┌──────────────┴──────────────┐
               │                             │
           VCS port                    agent adapter
    open PRs + registry mapping       remote dispatch
               │                             │
          GitHub reference             Cursor / HTTP
```

The core knows tickets, eligibility, ordering, capacity, and branch mappings. It should not know provider authentication, VCS endpoint shapes, or scheduler syntax.

## Preserve these invariants

A compatible adaptation preserves:

- ticket identity is a stable slug and durable ticket history is versioned;
- the runtime scanner skips malformed tickets without crashing the whole cycle;
- `paused: false` is unpaused; future dates and `true` block dispatch;
- dependencies remain blocked while their ticket files exist;
- open changes are matched using the actual mapped head branch;
- ordering is priority then slug;
- dispatch attempts are bounded (`1..1000`, reference default `10`);
- adapter failures consume capacity;
- dispatch is described as at least once;
- successful dispatch returns and checkpoints the actual branch;
- the prompt requests one relevant PR touching the ticket and tells retries to reuse it, while runner docs admit this is not verified;
- secrets never enter ticket frontmatter, prompts, or registry bodies.

If a product needs different semantics, give it a named profile and document the divergence rather than calling it transparent compatibility.

## Ports

### Agent backend

Implement the interface in [`action/src/adapters/CONTRACT.md`](action/src/adapters/CONTRACT.md). The fastest path is usually an HTTPS receiver behind the shipped HTTP adapter. A dedicated adapter is appropriate when a provider has useful native branch, model, or idempotency controls.

Checklist:

1. map all dispatch inputs explicitly;
2. return strict non-empty agent/branch identifiers;
3. honor the request timeout;
4. propagate a native idempotency key when available;
5. do not blindly retry POST;
6. document data sent, credentials, pricing, and cancellation behavior;
7. add mocked request/response/failure tests;
8. add installer and security guidance before exposing the backend name.

### VCS provider

Implement [`action/src/vcs/CONTRACT.md`](action/src/vcs/CONTRACT.md). Normalize the provider's open-change shape before it reaches eligibility logic.

Key design decisions to document:

- how head branches and fork identities are represented;
- pagination and consistency;
- where the registry record lives;
- how a corrupt registry fails closed;
- how record creation is reconciled after an ambiguous network failure;
- which operations may safely retry;
- least-privilege scopes.

### Registry/state transport

The GitHub profile stores `slug → branchName` in one Issue. Another transport may use a repository-native record, object store, or database if it provides:

- one authoritative mapping per host repository;
- complete snapshot replacement;
- read-after-write behavior appropriate for serialized cycles;
- explicit corrupt/missing distinction;
- durable checkpoint failure reporting;
- pruning when tickets disappear.

Do not turn the registry into an unreviewed status state machine. Eligibility remains derived from ticket files and open changes.

### Scheduler/execution environment

GitHub Actions is only the shipped scheduler. A cron worker, queue consumer, GitHub App, or another CI can call the runner if it preserves:

- one serialized cycle per host repository;
- explicit repository/base revision;
- finite process and network timeouts;
- per-cycle attempt capacity;
- secret isolation;
- observable success, skip, and failure outcomes;
- at-least-once documentation.

An event-driven scheduler still needs serialization; a push and PR event can otherwise race.

### Ticket authoring and validation

Editors, IDE skills, forms, and PM integrations may generate ticket files. The committed file remains the protocol boundary. Authoring tools should invoke the strict validator and must preserve unknown frontmatter keys.

## Recommended change sequence

1. Write down the host constraint and choose the smallest port that addresses it.
2. Read `SPEC.md`, both port contracts, `SECURITY.md`, and `AGENTS.md`.
3. Add a narrow interface/adapter rather than branching core logic throughout the runner.
4. Add fixtures and mocked tests for success, invalid response, timeout, and ambiguous failure.
5. Update installation, security, data-flow, and cost documentation.
6. Run the full Node 24 test suite.
7. Exercise dry-run in a disposable host repository.
8. Perform one real dispatch with cycle capacity `1`.
9. Pin the reviewed commit SHA in consumers.

## Compatibility checklist

- Does a v0.4 ticket behave the same for pause, dependencies, priority, and completion?
- Can a generated provider branch be found on the next cycle?
- Can an ambiguous dispatch be correlated or deduplicated?
- Does a registry write failure stop further untracked dispatch?
- Are remote data recipients and costs explicit?
- Are all network requests bounded?
- Can operators suspend scheduling without deleting tickets?
- Can the port be removed without losing durable ticket history?

When the answer is “no,” document the exception prominently in the profile's README and changelog.
