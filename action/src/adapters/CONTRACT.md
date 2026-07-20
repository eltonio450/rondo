# Agent adapter contract — v0.4

An adapter is the dispatch port between the Rondo runner and one remote coding-agent service. It launches or requests one agent and returns the branch that service will actually use.

It does not scan tickets, decide eligibility, write the registry, clone the repository locally, or verify the later PR.

## Interface

```js
async function dispatch({
  repoFullName,
  ticketFile,
  suggestedBranch,
  baseBranch,
  model,
  prompt,
  idempotencyKey,
}) {
  return { agentId, branchName };
}
```

### Inputs

| Field | Requirement | Meaning |
|---|---|---|
| `repoFullName` | non-empty string | Provider/VCS repository identity such as `owner/repo`. |
| `ticketFile` | non-empty relative path | Ticket the agent must read. |
| `suggestedBranch` | non-empty string | Preferred head branch; it may come from an earlier registry mapping. |
| `baseBranch` | non-empty string | PR target branch. |
| `model` | non-empty string | `default` or backend-specific model identifier. |
| `prompt` | string | Fully composed agent instructions. Treat as potentially sensitive data. |
| `idempotencyKey` | lowercase SHA-256 hex | Stable for repository identity, ticket path, and exact ticket content. |

An adapter MUST forward all semantics its provider can express. When the provider has no separate runtime-input fields, the adapter MAY prepend them to the prompt.

### Result

- `agentId` MUST be a non-empty string suitable for correlation in logs.
- `branchName` MUST be a non-empty string and SHOULD be the actual provider branch.
- An adapter MUST NOT silently replace a present but invalid provider value with the suggestion. A fallback is acceptable only when the provider contract explicitly guarantees it honored `suggestedBranch`.

The runner checkpoints `branchName`; returning the wrong value can cause repeat dispatch.

## At-least-once and idempotency

Calling `dispatch` means “request one remote execution,” not “prove one execution exists.” Network ambiguity, workflow cancellation, or a slow provider can produce a successful remote agent after the local call failed.

- The runner supplies the same `idempotencyKey` for the same ticket content.
- Adapters SHOULD use the provider's native idempotency mechanism.
- HTTP receivers SHOULD persist and deduplicate this key for an operationally appropriate window.
- Adapters MUST NOT blindly retry a dispatch POST unless the remote endpoint documents idempotent handling for that key.
- Operators must inspect remote provider state and open PRs before manual retry after a timeout.

## Timeouts and errors

Factories receive a request timeout derived from `request-timeout-seconds` (reference default `120`). Every network request MUST have a finite timeout.

Throw an `Error` for:

- missing credentials/configuration;
- timeout or network failure;
- non-success HTTP response;
- invalid JSON;
- missing or invalid result fields.

Errors SHOULD identify backend, operation, and status without including credentials, HMAC material, full prompts, or ticket content. The runner records a failed attempt, and that attempt consumes cycle capacity.

## Generic HTTP wire contract

The shipped HTTP adapter POSTs JSON to the configured receiver:

```json
{
  "repo": "owner/repo",
  "ticket_file": "tickets/example.md",
  "suggested_branch": "rondo/example",
  "base_branch": "main",
  "model": "default",
  "prompt": "...",
  "idempotency_key": "<sha256-hex>"
}
```

Required headers:

```text
Content-Type: application/json
Idempotency-Key: <sha256-hex>
```

When `RONDO_HTTP_SECRET` is configured, the adapter also sends:

```text
X-Rondo-Timestamp: <unix-seconds>
X-Rondo-Signature: sha256=<hmac-hex>
```

The signature is HMAC-SHA256 over the UTF-8 bytes of:

```text
<timestamp>.<exact-request-body>
```

The receiver MUST recompute the HMAC over the exact bytes received, compare in constant time, and reject timestamps outside a short configured replay window. HMAC authenticates the sender and body; it does not encrypt them. HTTPS remains mandatory unless an operator explicitly sets `http-allow-insecure: true` for a controlled environment.

Accepted response field spellings are implementation-defined but the normalized result is always:

```json
{
  "agentId": "remote-id",
  "branchName": "actual/head-branch"
}
```

Document any aliases a receiver relies on and reject empty, non-string normalized values.

## Cursor reference adapter

The Cursor adapter sends the repository URL, base branch, requested model when non-default, and a prompt containing runtime inputs. It asks Cursor to create the PR through the Cursor GitHub App.

Cursor is an external evolving API. Payload compatibility must be covered by mocked contract tests and verified in a controlled smoke repository before release. Do not describe it as provider-independent or permanently stable.

## Required tests for a new adapter

At minimum:

- valid request and exact normalized result;
- missing configuration/credential;
- timeout/abort;
- non-2xx and invalid JSON;
- missing, empty, and wrong-type result fields;
- idempotency propagation;
- no blind POST retry;
- secret/header redaction in errors;
- provider-generated branch handling;
- HTTP-only: HTTPS rejection/opt-in and deterministic HMAC verification.

Wire a new adapter into configuration only after its name, secret/data requirements, installation steps, security notes, and tests exist.
