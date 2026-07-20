# Security policy and deployment model

Rondo dispatches privileged remote coding agents. Treat it as automation that can read a repository and propose code, not as a harmless Markdown utility.

## Reporting a vulnerability

Prefer a private GitHub Security Advisory for this repository. If private reporting is unavailable, contact the maintainers privately before opening a public Issue. Do not include live credentials, private repository content, exploit payloads against third parties, or customer data in a report.

Include affected immutable commit, configuration, impact, minimal reproduction, and suggested mitigation. There is no hosted Rondo service to disable centrally; operators remain responsible for suspending their workflows and provider agents.

## Trust boundaries and data flow

| Boundary | Data sent | Credentials/authority |
|---|---|---|
| GitHub Action | checked-out ticket files, repository metadata, workflow config | `GITHUB_TOKEN` with contents read, issues write, PR read |
| Cursor API | repository URL, base/branch request, model, prompt and runtime paths | `CURSOR_API_KEY`; Cursor GitHub App clones/pushes/opens PRs |
| HTTP receiver | repository identity, ticket path, branches, model, full prompt, idempotency key | optional HMAC shared secret; receiver supplies its own VCS/agent authority |
| Registry Issue | ticket slugs, actual branches, derived status | workflow Issue write permission |
| Actions logs | slugs, agent IDs, branches, status, and bounded/truncated remote error text | visible according to repository Actions permissions |

The dispatched provider generally gains access to repository code through its own App/token after receiving the request. Review that provider's retention, training, residency, billing, and incident policies separately.

Remote error bodies are length-bounded, not capable of redacting arbitrary secrets returned by an endpoint. Providers and HTTP receivers must never include credentials or sensitive payload data in error responses.

## Secrets

- Store provider secrets only in GitHub Actions secrets or an equivalent secret manager.
- Never place secrets in tickets, prompt overrides, workflow inputs, registry bodies, URLs, PR text, or test fixtures.
- Do not print secret values during installation or debugging.
- Remove unused backend environment variables.
- Rotate a secret after suspected log, fork, receiver, or provider exposure.
- Scope provider Apps/tokens to the smallest repositories and privileges possible.

## Generic HTTP transport

HTTPS is required by default. `http-allow-insecure: true` is an explicit escape hatch for a controlled local/private network; it exposes prompts and repository metadata to interception and should not be used over an untrusted network.

Do not embed credentials in `http-url`; the reference runner rejects them. Keep receiver authentication in `RONDO_HTTP_SECRET` or a separately documented network identity layer.

When `RONDO_HTTP_SECRET` is configured, the adapter sends:

- `X-Rondo-Timestamp: <unix-seconds>`;
- `X-Rondo-Signature: sha256=<hex>`;
- HMAC-SHA256 computed over `<timestamp>.<exact-request-body>`.

Receivers must:

1. parse and bound the timestamp;
2. reject requests outside a short replay window;
3. compute HMAC over the exact body bytes;
4. compare signatures in constant time;
5. deduplicate `Idempotency-Key` independently of HMAC;
6. avoid logging prompt/body/secret material;
7. rate-limit and authorize the endpoint.

HMAC authenticates and integrity-protects the request; it does not encrypt it or guarantee exactly-once execution.

## At-least-once and remote execution

- A request timeout does not cancel a remote agent.
- A workflow cancellation does not necessarily cancel provider work.
- A dispatch may be repeated before its PR becomes visible.
- Inspect provider state and open PRs before manual retries.
- Keep `max-dispatches-per-cycle` bounded; begin at `1` in a new installation.
- Treat registry checkpoint failure as critical because lost branch correlation can cause duplicates.
- Review every PR through normal branch protection. Rondo does not verify the agent's PR or merge code automatically.

## Supply chain

- Pin Rondo and third-party Actions to reviewed immutable commit SHAs.
- Do not use `main` or an unpublished/movable tag in production workflows.
- Review changes to `action.yml`, network clients, adapters, prompts, install skills, and workflow examples as security-sensitive.
- Run the Node 24 tests and inspect the full diff before updating a pin.
- Skills fetched into host repositories must come from the same immutable Rondo ref.

## Host repository checklist

- Branch protection or rulesets require human review and relevant tests.
- Workflow token permissions are `contents: read`, `issues: write`, `pull-requests: read` unless a port documents otherwise.
- Fork PRs cannot access provider secrets through unsafe workflow triggers.
- Prompt and ticket authors know which external provider receives their content.
- Validator CI targets the same `tickets-dir` as the runner; an absent directory is an expected empty queue after the final ticket is removed.
- Schedules, dispatch cap, timeout, accepted models, and provider budgets are reviewed.
- Registry Issue and Actions logs have appropriate visibility.
- Operators know how to disable scheduling and cancel remote provider work.

## Supported code

Protocol v0.4 is unreleased until published in `CHANGELOG.md` with an immutable reviewed ref. Security fixes are made on the maintained release line; users should compare their pinned commit with the latest published advisory and changelog rather than assume a tag is current.
