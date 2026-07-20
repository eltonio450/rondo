# Brick 5 — Agent dispatch port

## Purpose

Configure the remote service that receives one bounded, timed dispatch request for each selected ticket.

Only `cursor-api` and `http` are shipped. Claude Code, Codex Cloud, and other providers require an HTTP receiver or a new adapter implementing the contract.

## Cursor reference adapter

Prerequisites owned by an authorized human:

- install the Cursor GitHub App on the host repository;
- generate a Cursor API key;
- approve the provider's pricing and data handling.

Workflow configuration:

```yaml
with:
  agent-backend: cursor-api
  request-timeout-seconds: "120"
env:
  GH_TOKEN: ${{ github.token }}
  CURSOR_API_KEY: ${{ secrets.CURSOR_API_KEY }}
```

Print, do not run with or inspect the value:

```bash
gh secret set CURSOR_API_KEY
```

Cursor's API is an external, evolving surface. A timeout or workflow failure does not prove the remote agent stopped; inspect Cursor and GitHub before retrying.

## Generic HTTP adapter

Require an existing receiver and read its operational contract before configuring it.

```yaml
with:
  agent-backend: http
  http-url: https://agents.example.internal/rondo/dispatch
  http-allow-insecure: "false"
  request-timeout-seconds: "120"
env:
  GH_TOKEN: ${{ github.token }}
  RONDO_HTTP_SECRET: ${{ secrets.RONDO_HTTP_SECRET }}
```

Print if a shared secret is used:

```bash
gh secret set RONDO_HTTP_SECRET
```

The adapter sends `Idempotency-Key`. When a shared secret is configured, it also sends `X-Rondo-Timestamp` and `X-Rondo-Signature: sha256=<hex>`, an HMAC-SHA256 of `<timestamp>.<exact-body>`. The receiver must use a timing-safe comparison and reject stale timestamps. Use HTTPS. Set `http-allow-insecure: true` only after explicit approval for a controlled environment.

The receiver must return a valid agent ID and actual branch name, and must own cloning, authorization, agent execution, pushing, and PR creation. See `action/src/adapters/CONTRACT.md`.

## Timeouts, retries, and cost

- Each network request uses `request-timeout-seconds`.
- The shipped adapters do not blindly retry dispatch POSTs. A receiver should honor the idempotency key before adding retries.
- An adapter failure consumes the cycle's dispatch-cap slot.
- A timed-out request may still be running remotely.
- Every successful or ambiguous dispatch may incur provider cost.

## Self-check

- The workflow names only a shipped backend.
- Unused secret variables are removed.
- URL transport and data destination were approved.
- Human-owned App/secret tasks are explicit.
- The first real cycle is capped at one dispatch.
