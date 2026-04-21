# Adapter contract

An **adapter** is the only piece of Rondo's runner that depends on the installing team's environment. Everything else in [`action/src/`](../) is environment-independent and fully implemented; adapters are where each team plugs in whichever background-agent service they use (Cursor, Claude Code, Codex Cloud, an in-house HTTP endpoint, a self-hosted model, …).

This file is the **normative contract** that every adapter must satisfy. The runner is coded against this shape and nothing else.

## The one thing an adapter does

> **"At this moment in the cycle, create a background coding agent that will work on a specific ticket. Tell me the agent's ID and the branch it's going to push to."**

That's it. One input, one output. Everything Rondo does around it (scanning tickets, eligibility, registry maintenance) is already handled by the runner — the adapter just has to dispatch one agent and come back with a handle on what it dispatched.

## Signature

```js
/**
 * @param {object} input
 * @param {string} input.repoFullName    — "owner/repo", for backends that need it.
 * @param {string} input.ticketFile      — Path (relative to repo root) of the ticket .md file.
 * @param {string} input.suggestedBranch — Branch name the runner would like the agent to use
 *                                         (from the registry for re-dispatches, or
 *                                         `<branchPrefix><slug>` on first dispatch). Some
 *                                         backends (e.g. Cursor Background Agents) auto-generate
 *                                         the branch and ignore this hint — that's fine, just
 *                                         return the real branch.
 * @param {string} input.baseBranch      — Branch to PR against (e.g. "main").
 * @param {string} input.model           — Model identifier. "default" means "pick for me".
 * @param {string} input.prompt          — Full prompt text (already loaded + merged).
 *
 * @returns {Promise<{ agentId: string, branchName: string }>}
 *   agentId    — Opaque identifier. Logged for observability; Rondo does not call back with it.
 *   branchName — The branch the agent will actually push to. If the backend honors
 *                `suggestedBranch`, return it verbatim. If the backend generates its own
 *                branch (Cursor does), return whatever the backend told you.
 */
async function dispatch(input) { ... }
```

## Why `branchName` must be part of the return value

The runner persists `branchName` in the registry Issue so that, on subsequent cycles, it can match an open PR against the right branch for each ticket — especially when the backend chose a branch name that doesn't follow the `<branchPrefix><slug>` convention.

Some backends — notably [Cursor Background Agents](https://forum.cursor.com/t/issue-with-autobranch-parameter-and-autocreatepr-functionality/152294/10) — auto-generate the branch and only reveal it after the dispatch call returns. Others (a generic HTTP receiver, a CLI runner) let you choose. The contract accommodates both: the runner passes a **suggestion** (`suggestedBranch`), the adapter returns the **reality** (`branchName`).

## Error semantics

The adapter **MUST** throw on any non-recoverable failure (bad credentials, quota exceeded, unreachable endpoint, 5xx). The runner catches, logs it, and counts the ticket as `failed` for this cycle. Do **not** return `{ agentId: "error", branchName: "" }` to signal failure — that would record a phantom dispatch in the registry.

Recoverable failures (rate limits, transient 503) SHOULD be retried inside the adapter with exponential backoff before throwing.

## What an adapter MUST NOT do

- **Write to the registry Issue.** The runner owns its body.
- **Open the PR itself.** That's the dispatched agent's job, per [PROMPT.md](../../../PROMPT.md).
- **Clone the repo, checkout files, run the agent inline.** All of that is the backend's responsibility. An adapter is an HTTP call (or equivalent), not a coding environment.
- **Persist state outside the return value.** No local files, no env vars — the runner+registry handle all persistence.

## Reference adapters

| File | Status | Notes |
|---|---|---|
| [`http.mjs`](./http.mjs) | ✅ Shipped | POST a JSON payload, receive `{ agentId, branchName }`. Zero external API deps. Good starting point for any self-hosted or custom backend. |
| [`cursor-api.mjs`](./cursor-api.mjs) | ✅ Shipped | Targets Cursor's Background Agents API (`POST /v0/agents`). Payload mirrors the current dashboard "Copy API payload" shape. |
| `claude-code-remote.mjs` | ❌ Not shipped | Contract is the same; wire it against the Claude Code remote API when you install it. |
| `codex-cloud.mjs` | ❌ Not shipped | Same. |

## Adding a new adapter

1. Create `action/src/adapters/<name>.mjs`.
2. Export a factory: `export function create<Name>Adapter({ /* backend-specific config */, fetchImpl })`.
3. Return an object with `{ backend: "<name>", async dispatch(input) { ... } }`.
4. Make sure the promise resolves to `{ agentId, branchName }` — both non-empty strings.
5. Wire it in [`action/src/index.mjs`](../index.mjs) by mapping the `agent-backend` input value `"<name>"` to your factory.
6. Add tests under [`internal/tests/`](../../../internal/tests/) using a mocked `fetchImpl`.

That's the whole surface. No hidden hooks, no lifecycle events, no callbacks — just dispatch and return.
