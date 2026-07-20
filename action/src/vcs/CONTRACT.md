# VCS port contract — v0.4

The VCS port supplies repository/change-request reads and registry-record writes to the core runner. The reference port is GitHub REST; another provider can implement the same behavioral interface without changing ticket or adapter semantics.

## Reference interface

```js
const vcs = {
  async listIssuesByLabel(label, options) {},
  async listAllOpenPRs() {},
  async createIssue({ title, body, labels, assignees }) {},
  async updateIssueBody(issueNumber, body) {},
};
```

A non-GitHub port MAY rename “Issue” and “PR” internally, but the object passed to the runner must expose equivalent operations or be wrapped to this shape.

## Operation semantics

### `listIssuesByLabel(label, { state = "open", perPage = 100 } = {})`

- Return open registry candidates carrying the stable marker/label.
- Exclude change requests returned by mixed Issue APIs.
- Paginate or explicitly enforce/document a complete bounded result.
- Preserve at least `number` (or stable record ID), `title`, and `body`.
- Multiple candidates are not silently merged; the runner warns and selects deterministically or fails according to policy.

### `listAllOpenPRs()`

- Return every open change request needed for eligibility, across all result pages.
- Each item must expose a stable identifier and head branch.
- When the provider exposes head-repository identity, include it so a same-named branch from a fork does not block a host-repository ticket.
- Absence of optional repository identity must be documented; do not fabricate it.

Reference normalized shape:

```js
{
  number: 42,
  head: {
    ref: "rondo/example",
    repo: { full_name: "owner/repo" },
  },
}
```

### `createIssue({ title, body, labels, assignees })`

- Create one registry record and return its stable ID, title, and body.
- This operation is not blindly retried after an ambiguous failure. Re-list/reconcile before another create to avoid duplicate registries.

### `updateIssueBody(issueNumber, body)`

- Replace the complete registry body, not append a status event.
- The requested body is an absolute snapshot, so a safe retry may repeat the same body.
- A failed checkpoint is critical after dispatch and must surface to the runner.

## Network policy

- Every request has the configured finite timeout.
- Authenticate with the minimum required scope.
- Retry only operations safe for the exact request, and only for transient network failures, `429`, provider `5xx`, or an explicit provider rate-limit response such as GitHub `403` with `Retry-After`.
- Respect `Retry-After` when present and bound total attempts/delay.
- Do not retry authentication, authorization, validation, or general `4xx` failures.
- Never include tokens, full registry bodies, prompts, or provider response secrets in errors.

## Registry consistency

The runner depends on the registry branch mapping to avoid using an incorrect conventional branch.

- Reads must distinguish “no registry exists” from “registry exists but is corrupt.”
- Corrupt existing machine state should fail closed rather than silently reset to `{}`.
- Successful dispatch mappings should be checkpointed before another dispatch begins.
- The store should provide read-after-write consistency suitable for the next serialized cycle.
- A port with weaker consistency must document the duplicate-dispatch risk and mitigation.

The human-readable table is informational. Eligibility must use normalized VCS data and the machine mapping, not scrape that table.

## GitHub reference permissions

The shipped port needs:

```yaml
permissions:
  contents: read
  issues: write
  pull-requests: read
```

The remote coding-agent provider uses its own authorization to clone, push, and open PRs; those privileges are not granted to the Rondo workflow token by this contract.

## Required tests for a new VCS port

- pagination and empty results;
- exclusion of PRs from mixed Issue APIs;
- fork/same-branch disambiguation;
- timeout and redacted errors;
- bounded transient retry and `Retry-After`;
- no blind registry creation retry;
- idempotent body update retry;
- multiple registry records;
- corrupt registry propagation;
- checkpoint failure after a successful dispatch.
