# `action/` — the Rondo runner

> Reusable GitHub Action. The runner itself is environment-independent and complete; the only thing that varies by installation is the **adapter** — the file that dispatches one background agent against one ticket. See [`src/adapters/CONTRACT.md`](src/adapters/CONTRACT.md).

## Layout

```
action/
  action.yml                       # composite/node action metadata
  package.json                     # Node 20, no deps (uses built-in fetch)
  src/
    index.mjs                      # entry point (GitHub Actions runtime)
    core/
      runner.mjs                   # main dispatch loop (orchestrator)
      eligibility.mjs              # pure: is a ticket eligible this cycle? (tested)
      registry.mjs                 # pure: parse/render the registry Issue body (tested)
    lib/
      frontmatter.mjs              # pure: parse/serialize ticket frontmatter (tested)
      prompt-loader.mjs            # loads PROMPT.md + optional host override
    vcs/
      gh-client.mjs                # thin GitHub REST wrapper
    adapters/
      CONTRACT.md                  # NORMATIVE — the dispatch contract
      http.mjs                     # generic HTTP POST adapter (portable)
      cursor-api.mjs               # Cursor Background Agents adapter
    cli/
      validate-tickets.mjs         # standalone CI validator for tickets/*.md (tested)
```

## What is and isn't environment-specific

The runner draws a hard line between generic code (shipped complete) and team-specific code (contract + examples):

| File | Environment-dependent? | Ships as |
|---|---|---|
| `core/runner.mjs`, `core/eligibility.mjs`, `core/registry.mjs` | No — uses only adapter abstractions | **Complete** |
| `lib/frontmatter.mjs`, `lib/prompt-loader.mjs` | No — pure logic from SPEC | **Complete + tested** |
| `vcs/gh-client.mjs` | No — GitHub's REST API is stable | **Complete** |
| `cli/validate-tickets.mjs` | No | **Complete + tested** |
| `adapters/http.mjs` | No — HTTP POST is universal | **Complete** (portable reference) |
| `adapters/cursor-api.mjs` | Yes — Cursor's API may drift | **Complete** (verified against current `/v0/agents`) |
| `adapters/claude-code-remote.mjs`, `adapters/codex-cloud.mjs` | Yes | Not shipped — write per `CONTRACT.md` |
| `index.mjs` | Barely — only the adapter switch | **Complete** |

If you install with `agent-backend: "cursor-api"` (the default) or `agent-backend: "http"`, everything is off-the-shelf and should work as-is. For any other backend, you write one file (the adapter) that conforms to [`src/adapters/CONTRACT.md`](src/adapters/CONTRACT.md) and wire it into `index.mjs`.

## The adapter contract in one paragraph

An adapter exports `async dispatch({ repoFullName, ticketFile, suggestedBranch, baseBranch, model, prompt })` and returns `{ agentId, branchName }`. The runner passes `suggestedBranch` as a hint; the adapter returns the branch the backend actually chose (Cursor auto-generates; HTTP/custom can honor the hint). Throw on unrecoverable failure — the runner catches, logs it, and counts the ticket as `failed` for this cycle. Full spec in [`src/adapters/CONTRACT.md`](src/adapters/CONTRACT.md).

## Tests

```bash
# from repo root:
node --test 'internal/tests/*.test.mjs'

# or from this directory:
npm test
```

Tests live in [`../internal/tests/`](../internal/tests/) and cover the pure logic (eligibility, frontmatter, registry, validate-tickets). Integration tests against a real GitHub repo are out of scope for unit testing — use the `dry_run` workflow input to sanity-check a full cycle without dispatching.

## Contracts the installing agent must not break

These are the shapes the other bricks depend on. Change the internals freely; keep the boundaries.

1. **Ticket eligibility** — `core/eligibility.mjs` default export takes `{ ticket, existingTicketSlugs, openPRs, today, branchName, acceptedModels }` and returns `{ eligible: boolean, reason: string }`. Follows [`SPEC.md §4`](../SPEC.md).
2. **Frontmatter parse** — `lib/frontmatter.mjs :: parseFrontmatter(content)` returns `{ frontmatter, body }`. Follows [`SPEC.md §3.2`](../SPEC.md) — no YAML `---` fences; key:value per line until first blank line.
3. **Registry** — `core/registry.mjs :: parseRegistry(body)` / `renderRegistry({ mapping, tickets, openPRs, now })` read/write the `<!-- rondo-registry ... -->` block. Follows [`SPEC.md §6.2`](../SPEC.md).
4. **Adapter** — see [`src/adapters/CONTRACT.md`](src/adapters/CONTRACT.md).

## What this action does NOT do

- It does not bundle `node_modules`. Keep zero-dep; use `fetch`.
- It does not persist state outside the single registry Issue it owns.
- It does not commit anything to the host repo. Only the dispatched agent does.
- It does not retry adapter dispatches — the adapter itself is responsible for transient retries; unrecoverable failures are logged and the ticket is counted as `failed` for the cycle.
