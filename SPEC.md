# Rondo Protocol Specification v0.4

> Normative draft. Status: **Unreleased**.

This document defines the portable Rondo protocol and the behavior of the reference runner in [`action/`](action/). Keywords **MUST**, **MUST NOT**, **SHOULD**, and **MAY** follow RFC 2119.

Rondo distinguishes three kinds of requirement:

- **core protocol** — semantics a compatible implementation preserves;
- **reference profile** — the GitHub Action, Issue registry, and shipped ports in this repository;
- **agent contract** — behavior requested from a remote coding agent but not verified by the reference runner.

## 1. Model and delivery guarantee

A **ticket** is a Markdown file committed to a repository. A **cycle** scans ticket files on a base revision, derives eligibility, and dispatches a bounded set through an **agent adapter**. A **VCS port** supplies repository and change-request operations. A **registry** stores the last known branch for each live ticket when that branch cannot be derived reliably.

Rondo dispatch is **at least once**:

- the runner MUST NOT claim exactly-once execution;
- if a dispatch has not produced a visible open change request before a later cycle, the ticket MAY be dispatched again;
- the runner SHOULD attach a deterministic idempotency key to each dispatch;
- an adapter or remote receiver SHOULD collapse repeated requests carrying the same key;
- an idempotency key reduces duplicates but does not prove that one agent or one PR exists.

The reference runner requests the agent behavior in §7. It does not poll the remote agent and does not verify PR count, branch, base, or diff after dispatch.

## 2. Portable architecture

The following semantics are core:

1. Tickets and their durable work history live in version control.
2. Eligibility is derived each cycle rather than transitioned through a persisted status machine.
3. Dependencies resolve when the corresponding ticket file is absent.
4. Open change requests are matched by head branch.
5. Dispatch order is deterministic and dispatch attempts are bounded when a capacity is configured.
6. A successful dispatch returns the real branch used by the backend and that mapping is persisted.

The following mechanisms are ports and MAY be replaced:

- scheduler and execution environment;
- VCS provider and change-request API;
- registry transport;
- remote-agent provider;
- prompt additions;
- authoring and validation UX.

A port MUST document deviations from the core semantics. [ADAPT.md](ADAPT.md) describes the boundaries.

## 3. Ticket file

### 3.1 Location and name

- Ticket files MUST be direct `.md` children of `<ticketsDir>` unless a port explicitly declares recursive discovery.
- The reference default is `tickets/`.
- A filename MUST match `^[a-z0-9][a-z0-9-]{0,62}\.md$`.
- The filename without `.md` is the stable, repository-unique **slug**.

### 3.2 Frontmatter grammar

A ticket MUST start with line-based frontmatter. There are no YAML fences.

- Each line matches `^[a-z_]+:\s*.+$`.
- The first blank or non-matching line ends the block.
- Unknown matching keys are preserved for forward compatibility.

| Key | Requirement | Parsed type | Meaning |
|---|---|---|---|
| `owner` | MUST | string matching `^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$` | Human reviewer context. The reference runner does not assign or notify this user. |
| `priority` | MUST | integer 0–99 | Lower values are considered first; slug is the lexical tie-break. |
| `model` | MUST | non-empty, non-whitespace string | `default` or a backend-specific identifier. |
| `depends` | MAY | comma-separated slugs or filenames | Ineligible while any named ticket file exists. |
| `paused` | MAY | `true`, `false`, or a real `YYYY-MM-DD` calendar date | `true` pauses indefinitely; `false` is equivalent to absence; a future date pauses until that date. |
| `spec` | MAY | version string | Informational protocol pin; the reference runner validates its shape but does not negotiate older behavior. |

Unknown keys MUST NOT be interpreted as capabilities unless the active runner or adapter documents them.

### 3.3 Body

The body is free-form Markdown. For interoperability, agents SHOULD maintain:

- `## Mission`;
- `## Steps (1 PR each)`;
- `## Decisions (newest first)`;
- `## Progress history (newest first)`.

Newest-first means new entries are inserted at the top of the relevant section.

## 4. Discovery and validation

The runtime scanner MUST tolerate individual malformed tickets: it skips them with `invalid_frontmatter` and continues the cycle.

The reference CI validator performs stricter author-time checks against [`schemas/ticket.schema.json`](schemas/ticket.schema.json). Its CLI contract is:

- exit `0`: all discovered tickets are valid; an empty or absent ticket directory is an empty queue;
- exit `1`: one or more ticket files are invalid;
- exit `2`: another setup/I/O error occurs, such as an unreadable existing directory or ticket.

Treating an absent directory as empty preserves the terminal lifecycle: deleting the final ticket MUST NOT make validation fail merely because Git no longer materializes the directory. A tracked `.gitkeep` MAY be used for discoverability but is not required by the protocol or validator.

Validators SHOULD detect dependency cycles among files present in the validated directory. A reference to an absent dependency cannot reliably be called a typo because absence means completion under §5.

## 5. Eligibility

A parsed ticket is eligible at the beginning of a cycle when all conditions hold:

1. `owner`, `priority`, and `model` conform to the constraints in §3.2.
2. `model` is `default`, is in the configured allowlist, or no allowlist is configured.
3. `paused` is absent, `false`, or a date less than or equal to the cycle's `today` value.
4. No normalized slug in `depends` exists among the current ticket files.
5. No open change request has a head branch equal to the registry branch for the ticket, or to `<branchPrefix><slug>` when no mapping exists.

An ineligible ticket MUST be skipped without dispatch and SHOULD emit one stable reason.

Eligibility is not a reservation. A ticket can be eligible again if the remote dispatch remains invisible to the VCS at the next cycle.

## 6. Ordering and capacity

Eligible tickets are considered by ascending `priority`, then lexical slug.

A runner MAY configure a maximum number of dispatch **attempts** per cycle. The reference input is `max-dispatches-per-cycle`:

- default in the shipped Action: `10`;
- integer in `1..1000`;
- absent configuration uses the safe reference default `10`; there is no unlimited mode;
- a failed adapter call consumes one slot;
- eligible tickets beyond the limit are skipped with `max_dispatches_per_cycle_reached`;
- dry-run MUST simulate the same ordering and limit without creating remote state.

Capacity is a safety bound, not a monetary budget. Operators MUST account for provider pricing separately.

## 7. Agent contract

For each dispatch, the runner supplies:

- repository identity;
- ticket path relative to the repository root;
- suggested head branch;
- base branch;
- requested model;
- prompt;
- deterministic idempotency key.

The prompt MUST request that the agent read the ticket and choose exactly one outcome:

| Outcome | Requested ticket change | Requested code change |
|---|---|---|
| Progress | Record progress and relevant decisions | One reviewable step |
| Pause | Set `paused:` and record why | None |
| Done | Promote durable knowledge, then remove or archive the ticket | Documentation or cleanup as needed |
| No-op | Record blocker, need, and owner | None |

The prompt MUST request that exactly one relevant change request exist for the dispatch: create it when absent, but reuse/update a matching open change request on retry and never open a second one. It must touch or remove the ticket, use the requested/suggested head branch when the backend can honor it, and target the requested base branch. The registry checkpoints the actual branch returned by the adapter after launch. These are **agent conformance requirements**; the reference runner does not attest that they happened.

An agent SHOULD remove an expired `paused:` key and any matching `[resume: DATE]` title suffix before progressing.

## 8. Adapter contract

An adapter dispatches one remote agent and returns non-empty `{ agentId, branchName }`. It MUST:

- accept all fields from §7;
- apply the configured request timeout;
- throw on invalid responses or unrecoverable failures;
- avoid blind retries of non-idempotent POSTs unless the backend documents idempotency;
- return the actual backend branch, not merely the suggestion, when known.

The reference Action ships only `cursor-api` and `http`. Full details are normative in [action/src/adapters/CONTRACT.md](action/src/adapters/CONTRACT.md).

## 9. VCS and registry contract

A VCS port provides the operations required to:

1. list open change requests with head branch and identifier;
2. find registry records by stable marker;
3. create a registry record;
4. replace its body.

The reference GitHub port uses one open Issue labelled `rondo-registry`. Its body contains:

```text
<!-- rondo-registry
{
  "<slug>": "<branchName>"
}
-->
```

The remaining body is a human-readable snapshot. The machine block is authoritative for branch mapping; status text is informational.

Rules:

- tolerant parsing tools MAY map absent/malformed data to an empty null-prototype mapping;
- the reference runner MUST fail closed when an existing registry is malformed, because falling back to a conventional branch can duplicate work on a provider-generated branch;
- a successful dispatch updates `slug → actual branch`;
- entries whose ticket file is absent are removed;
- the human snapshot SHOULD show `dispatched (awaiting PR)` after a successful checkpoint until an open PR is visible;
- a registry write failure MUST be observable and MUST NOT be reported as a fully successful cycle;
- a port SHOULD persist successful mappings before they can be lost to a later timeout;
- multiple matching registries SHOULD produce a warning and deterministic selection.

The portable VCS interface is defined in [action/src/vcs/CONTRACT.md](action/src/vcs/CONTRACT.md).

## 10. Reference Action inputs

| Input | Default | Semantics |
|---|---|---|
| `dry-run` | `false` | Discover, order, and simulate capacity without constructing a dispatch adapter or requiring its secret. |
| `tickets-dir` | `tickets` | Non-escaping directory relative to repository root; direct ticket children only. |
| `branch-prefix` | `rondo/` | Valid suggested branch prefix ending in `/`. |
| `base-branch` | `main` | Valid change-request base branch. Installers SHOULD set the detected default branch. |
| `agent-backend` | `cursor-api` | Shipped: `cursor-api`, `http`. |
| `accepted-models` | empty | Comma-separated allowlist; empty accepts any, and `default` is always accepted. |
| `max-dispatches-per-cycle` | `10` | Dispatch-attempt cap defined in §6. |
| `request-timeout-seconds` | `120` | Integer `1..3600`; timeout for each provider/VCS network request. |
| `http-url` | empty | Required for `http`; absolute URL without embedded credentials. HTTPS required by default. |
| `http-allow-insecure` | `false` | Explicit opt-in to cleartext HTTP for controlled local/private environments. |

The reference Action targets Node 24.

## 11. Security and transport

- Secrets MUST be supplied through the execution environment, never ticket frontmatter or prompts.
- The generic HTTP adapter MUST reject non-HTTPS URLs unless `http-allow-insecure` is true.
- When a shared secret is configured, the HTTP adapter MUST send `X-Rondo-Timestamp` and `X-Rondo-Signature: sha256=<hex>`, where the signature is HMAC-SHA256 over `<timestamp>.<exact-body>`.
- Receivers MUST verify the HMAC with a timing-safe comparison and reject timestamps outside their configured replay window.
- The reference HTTP adapter MUST send the dispatch idempotency key in both `Idempotency-Key` and the JSON `idempotency_key` field.
- Operators MUST review what prompt and repository metadata leave their environment.
- Workflow dependencies and Rondo itself SHOULD be pinned to reviewed immutable commit SHAs.

See [SECURITY.md](SECURITY.md).

## 12. Conformance

A **core-compatible runner** implements §§3–7 and declares its delivery semantics and capacity behavior.

A **reference-profile-compatible runner** additionally implements §§8–10 or behaviorally equivalent ports.

An **agent-conformant dispatch** satisfies the requested PR behavior in §7. Runner conformance alone does not prove agent conformance.

Extensions MUST preserve unknown frontmatter keys and MUST document new keys, state, or side effects. Implementations SHOULD expose their supported protocol version.

## 13. Versioning

Breaking protocol changes increment the major version. Additive, backward-compatible protocol changes increment the minor version. Implementation-only fixes increment the implementation release without changing the protocol version.

Version `0.4` is unreleased until a reviewed immutable commit and release notes are published. Installation docs use `<RONDO_REF>` rather than assuming a tag exists.
