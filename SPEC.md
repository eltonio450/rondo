# Rondo Specification v0.3

> Normative. Last updated: 2026-04-21.

This document specifies the Rondo ticket format, lifecycle, and state storage. Any runner that implements this spec can be called "Rondo-conformant". The reference implementation lives in [`action/`](./action/).

Keywords **MUST**, **MUST NOT**, **SHOULD**, **MAY** follow [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

## 1. Overview

A **ticket** is a Markdown file in the host repository. A **runner** scans the ticket directory on a schedule and dispatches an **agent** to make one reviewable Pull Request per eligible ticket per cycle. The only durable state the runner keeps outside the repo is a single **registry Issue** whose body holds a `slug → branchName` mapping — nothing more.

The method is:

1. Dev creates `<ticketsDir>/<slug>.md` on the default branch.
2. Runner fires on schedule, reads every `.md` file, evaluates eligibility.
3. For each eligible ticket, runner dispatches an agent and records the branch it ended up on in the registry Issue.
4. Agent opens exactly one PR that modifies code **and** updates the ticket file.
5. Reviewer merges; next cycle picks up where the ticket file says to.

## 2. Terms

| Term | Definition |
|---|---|
| **Ticket file** | A `.md` file in `<ticketsDir>` whose frontmatter conforms to §3.2. |
| **Slug** | The filename without `.md`, lowercase, kebab-case, stable across a ticket's lifetime. |
| **Registry Issue** | The single GitHub Issue in the host repo whose body carries the `slug → branchName` mapping for every ticket currently on the queue (§6). |
| **Dispatch** | One launch of an agent against a ticket. Zero or more per ticket's lifetime. |
| **Runner** | The scheduled process that scans files, evaluates eligibility, and launches dispatches. |
| **Agent** | The external background coding agent (Cursor API, Claude Code, Codex, custom HTTP endpoint). |
| **Host repo** | The repository in which Rondo is installed. |

## 3. Ticket file format

### 3.1 Location and naming

- Ticket files **MUST** live in `<ticketsDir>`, a directory relative to the repo root, defaulting to `tickets/`.
- Filenames **MUST** match `^[a-z0-9][a-z0-9-]{0,62}\.md$`. The part before `.md` is the **slug**.
- The slug **MUST** be unique within the repo.

### 3.2 Frontmatter

Ticket files **MUST** begin with a **key:value** frontmatter block in the first lines of the file (no YAML fences, no `---` delimiter — keys are parsed line by line until the first blank line or the first line that does not match `^[a-z_]+:\s*.+$`).

| Key | Required? | Type | Semantics |
|---|---|---|---|
| `owner` | **MUST** | string | GitHub username of the human reviewer. |
| `priority` | **MUST** | integer 0–99 | Lower number dispatches first. Tie-break by filename lexical order. |
| `model` | **MUST** | string | Agent model identifier. Runners **MUST** accept `default` and **MAY** accept backend-specific aliases. Unknown values skip the ticket and log a warning. |
| `depends` | MAY | comma-separated list of slugs or filenames | The ticket is ineligible while any listed dependency still exists as a file in `<ticketsDir>`. |
| `paused` | MAY | `true` \| ISO date (`YYYY-MM-DD`) | If `true`, ticket is never eligible. If a date in the future, ineligible until that date (inclusive-start). If a date today or past, treated as absent. |

Any other `key: value` line in the frontmatter is **reserved for future use** and **MUST** be preserved by agents when rewriting the file.

### 3.3 Body

After frontmatter, the body is free-form Markdown. Agents **SHOULD** maintain the following sections (idiomatic, not required by the spec):

- `## Mission` — scope and constraints
- `## Steps` — one H3 per step; one PR per step
- `## Decisions (newest first)` — newest-first dated log
- `## Progress history (newest first)` — newest-first dated log, one line per merged PR

The body **MAY** include `[resume: YYYY-MM-DD]` as a suffix in the first H1 title when an agent has paused the ticket with a future date (§5.2). Agents **MUST** strip this suffix when the ticket resumes.

## 4. Eligibility

A ticket file **IS eligible** for dispatch in cycle *c* if **all** of the following hold:

1. Its frontmatter has the three required keys `owner`, `priority`, `model` with the primitive types declared in §3.2 (string / integer / string). **Full** schema validation (owner pattern, priority range 0–99, `depends`/`paused`/`spec` formats) is enforced at author/CI time by the validator shipped in [`action/src/cli/validate-tickets.mjs`](./action/src/cli/validate-tickets.mjs) against [`schemas/ticket.schema.json`](./schemas/ticket.schema.json). At runtime the runner is deliberately lenient: malformed tickets are skipped with reason `invalid_frontmatter`, logged, and **MUST NOT** crash the cycle.
2. Its `model` is `default` or in the runner's accepted-models allowlist (empty allowlist = accept any).
3. Its `paused` value is absent, `false`, or a date ≤ today.
4. Every slug in `depends` does **not** correspond to an existing file in `<ticketsDir>`. (Missing files are treated as "dependency completed".)
5. No open PR in the host repo has a head branch equal to this ticket's branch — read from the registry if known, otherwise the default `<branchPrefix><slug>`.

Ineligible tickets **MUST** be skipped without side effects, with a single log line explaining why.

Runners rely on their cron cadence (hourly by default) to avoid dispatching the same ticket twice while a previous dispatch is still in flight. A ticket that was dispatched in cycle *c* but has not opened a PR by cycle *c+1* will be re-dispatched — this is considered acceptable: at most one PR will survive, and the duplicate agent run is a rare corner case, not a correctness issue.

## 5. Lifecycle

A ticket's state is **derived from reality**, not tracked in a state machine. At any moment, a ticket is in exactly one of:

- **Eligible** — file exists, not paused, no open PR on its branch, dependencies resolved.
- **In flight** — a PR is open on the ticket's branch.
- **Paused** — the frontmatter carries `paused: true` or `paused: <future-date>`.
- **Blocked** — the frontmatter's `depends` key lists at least one slug whose file still exists.
- **Gone** — the `.md` file no longer exists (the last cycle's agent chose output **(c) Done**). The registry drops the entry on the next cycle.

There is no persistent status to transition between. Every cycle, the runner recomputes the state of every ticket from the filesystem + the list of open PRs.

### 5.1 Agent outputs per cycle

A dispatched agent **MUST** produce exactly one of four outputs in a single PR. The PR **MUST** always include a diff touching the ticket `.md` file — even when there is no code change.

| Output | Ticket file change | Code change |
|---|---|---|
| **(a) Progress** — ship the next step | Append to `Progress history` and (as needed) `Decisions`; may re-scope `Steps`. | Yes. |
| **(b) Pause** — defer this ticket | Set frontmatter `paused: YYYY-MM-DD` (future) or `paused: true` (indefinite). Log the reason in `Decisions`. | No. |
| **(c) Done** — retire the ticket | Delete the `.md` file. Durable knowledge **MUST** be promoted into canonical docs in the same PR. | Doc changes only; no functional code. |
| **(d) No-op** — document a blocker | Append to `Decisions` explaining why no progress was made and what is needed. | No. |

Agents **MUST NOT** produce a PR with zero file changes. Agents **MUST NOT** produce more than one PR per dispatch.

### 5.2 Resume from pause

When an agent pauses a ticket (output **(b)**) with a future date:
1. It **MUST** add `paused: YYYY-MM-DD` to the frontmatter.
2. It **SHOULD** add `[resume: YYYY-MM-DD]` as a suffix to the first H1 title for visibility.
3. On the first eligible cycle after the resume date (§4), the next agent **MUST** strip the title suffix and remove the `paused:` key before starting work.

### 5.3 Completion

When choosing output **(c) Done**, the active agent **MUST**:
1. Delete the ticket file in the same PR as the final code/doc changes.
2. Before deletion, promote any durable knowledge out of the ticket into canonical long-lived docs. The runner's prompt **SHOULD** remind the agent of this.

On the first cycle after such a PR merges, the runner **MUST** drop the ticket's entry from the registry (§6) — the `.md` no longer exists, so the entry is stale.

## 6. State storage — the registry Issue

### 6.1 One Issue total

The runner **MUST** maintain a single long-lived GitHub Issue per host repo, identified by the label `rondo-registry`. If no such Issue exists at the start of a cycle, the runner **MUST** create one.

There **MUST NOT** be a separate Issue per ticket. The registry is the only durable piece of state Rondo persists outside the repo.

### 6.2 Registry Issue body

The Issue body carries a single machine-readable block and a human-readable table. The runner **MUST** overwrite the body at the end of every cycle — the body is always a snapshot of current reality.

```
<!-- rondo-registry
{
  "<slug>": "<branchName>",
  ...
}
-->

# Rondo — ticket registry

Updated <ISO-8601 timestamp>. ...

| Ticket | Branch | State |
|---|---|---|
| `<slug>` | `<branchName>` | <state> |
```

The machine-readable block is delimited by:

- Opening marker: `<!-- rondo-registry` at the start of a line.
- Closing marker: the first `-->` after the opening marker.

The payload between the markers is a JSON object where keys are ticket slugs and values are the branch names the runner last knew each ticket to be using. Runners **MUST** treat a missing marker, an empty payload, or malformed JSON as `{}` — the next cycle will re-populate it.

### 6.3 Mapping semantics

Entries in the mapping reflect the **last branch a dispatched agent was launched on** for each ticket. Specifically:

- When a cycle dispatches an agent for a ticket, the adapter returns the real branch name (which may differ from the suggested `<branchPrefix><slug>`, e.g. Cursor auto-generates branches). The runner records that branch in the mapping.
- When a cycle observes that a ticket's `.md` file no longer exists, the runner **MUST** drop that slug from the mapping.
- Tickets that have never been dispatched have no entry. The runner uses `<branchPrefix><slug>` as the default branch for those.

### 6.4 No labels, no per-ticket Issues

Rondo v0.3 does **not** maintain any `rondo:status:*`, `rondo:paused`, or `rondo` labels on per-ticket Issues. The only label involved is `rondo-registry` on the single registry Issue. Ticket state is derived every cycle from the filesystem and the repo's open PRs.

## 7. PR conventions

- A dispatched agent **MUST** open exactly one PR per dispatch.
- The PR **MUST** include a diff to the ticket `.md` file or its deletion — even on output **(d) No-op** (§5.1).
- The PR head branch **MUST** match the branch the adapter returned to the runner (and which the runner wrote to the registry). The runner suggests `<branchPrefix><slug>` where `<branchPrefix>` defaults to `rondo/`; adapters that can honor the suggestion **SHOULD** do so.
- The PR base branch **MUST** equal `<baseBranch>` as declared by the runner.

## 8. Dispatch contract

A runner dispatches an agent by passing it:

1. The path of the ticket file, relative to the host repo root
2. The target branch name (the "suggested branch")
3. The base branch name
4. The prompt text (see [PROMPT.md](./PROMPT.md); a host repo **MAY** override it by convention by placing `rondo.prompt.md` at its root — if present, the runner uses it instead of or on top of the bundled prompt, no config key needed)

The adapter returns `{ agentId, branchName }`. The runner persists `branchName` in the registry so that subsequent cycles can match the ticket to any open PR on that branch.

How the agent authenticates, creates a worktree, or opens the PR is out of scope for this spec. Runner-level settings (tickets directory, branch prefix, base branch, agent backend) are configured by the installer — in the reference implementation via `with:` inputs in the host's workflow file, but any runner-level mechanism is conformant. Agent adapters are also a runner-level concern.

## 9. Conformance

A runner is **Rondo-conformant** if it:

- Accepts ticket files per §3 and rejects malformed ones with a warning (not a crash)
- Evaluates eligibility per §4
- Persists the registry per §6
- Enforces PR conventions per §7

Runners **MAY** add features (priorities beyond 0–99, additional frontmatter keys under a `x-` prefix, custom agent backends) as long as they do not break the above.

## 10. Versioning

This document is versioned as `SPEC.md v<major>.<minor>`. Breaking changes bump the major. Additive changes bump the minor. The current reference implementation **MUST** declare which spec version it targets.

Ticket files **MAY** include an optional `spec: 0.2` frontmatter key to pin to a specific spec version. If absent, the latest version the runner implements is assumed.
