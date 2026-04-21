# Brick 5 — Agent runner

## What it does

When the scheduler finds an eligible ticket, this brick is what actually **launches a background AI agent** against that ticket — handing it the `.md` file path, the branch name, and the base branch, and waking it up to do the work described in [`PROMPT.md`](../PROMPT.md).

## Default we ship

**Cursor Background Agents API**, one shared `CURSOR_API_KEY` secret stored at the repo (or org) level in GitHub Actions secrets.

Why this default:
- Cursor's Background Agents API is the most mature of the background-agent APIs at time of writing: reliable, fast, good defaults on model selection, clean dispatch with no extra infra to host.
- One shared key ≈ one shared seat used by the runner itself, which is billed and tracked at the org level. Simple.
- The runner calls Cursor → Cursor clones, edits, opens the PR → runner records the branch name in the registry Issue. No custom receiver to host.

## Questions to ask the human

1. *"Which agent backend? `cursor-api` (default, adapter shipped) · `http` (adapter shipped) · `claude-code-remote` / `codex-cloud` (no adapter shipped — route through `http` or write your own)."*
2. For `cursor-api`: *"One shared `CURSOR_API_KEY` for the repo (default), or per-user tokens (see Alternatives)?"*
3. For `http`: *"What is the URL Rondo should POST dispatch payloads to?"* — record as `<httpUrl>`.

All answers land in the workflow file from Brick 4 — there is no separate config file to edit.

## Steps

In each case below, edit `.github/workflows/rondo.yml` (created by Brick 4) to keep only the env vars and `with:` entries for the chosen backend. Every other `*_API_KEY` / `*_OAUTH_TOKEN` / `*_ENV_ID` line should be removed.

### If `cursor-api` (default)

**Prerequisite (tell the human, do not attempt yourself):** the **Cursor GitHub App** must be installed on this repository. The adapter dispatches with `openAsCursorGithubApp: true` (see [`action/src/adapters/cursor-api.mjs`](../action/src/adapters/cursor-api.mjs)); without the App installed, the first dispatch silently fails to open a PR and you only notice at the next cycle. Verify at **https://github.com/apps/cursor-agent** → *Configure* → add this repo. If the human is not an admin on the repo, they need to ask one.

1. The workflow's `with:` block already has `agent-backend: "cursor-api"` as the default — no change needed unless you previously set something else. The `env:` block should contain:

   ```yaml
   env:
     GH_TOKEN: ${{ github.token }}
     CURSOR_API_KEY: ${{ secrets.CURSOR_API_KEY }}
   ```

2. Print to the human (do **not** run):

   ```bash
   gh secret set CURSOR_API_KEY
   ```

   Tell them: "run this now; it will prompt for the key value. You generate the key in your Cursor dashboard → API keys."

### If `claude-code-remote` or `codex-cloud`

> **⚠ No adapter is shipped for these backends in v0.2.** Setting `agent-backend: "claude-code-remote"` or `"codex-cloud"` directly will crash the runner (see [`action/src/index.mjs`](../action/src/index.mjs), which explicitly throws for these values).
>
> Two options:
> 1. **Use the `http` backend below** and have your own receiver forward dispatches to Claude Code remote or Codex Cloud. This is the recommended path today.
> 2. **Write a dedicated adapter** at `action/src/adapters/<name>.mjs` conforming to [`action/src/adapters/CONTRACT.md`](../action/src/adapters/CONTRACT.md), wire it in `action/src/index.mjs`, and open a PR against the Rondo repo.

### If `http`

1. Ask the human for the dispatch URL and (optional) shared secret. Record the URL as `<httpUrl>`.
2. In `with:`, set both `agent-backend` and `http-url` — the runner rejects `agent-backend: "http"` with an empty `http-url`:

   ```yaml
   with:
     agent-backend: "http"
     http-url: "<httpUrl>"
   env:
     GH_TOKEN: ${{ github.token }}
     RONDO_HTTP_SECRET: ${{ secrets.RONDO_HTTP_SECRET }}
   ```

   (`http-url` is a plain input, not a secret — the URL itself isn't sensitive. Only the shared secret is.)

3. Print: `gh secret set RONDO_HTTP_SECRET` (skip if the human declined a shared secret).
4. Tell the human their receiver is responsible for: cloning the repo, running the agent with the passed prompt + ticket context, opening a PR on the agreed branch. See [`SPEC.md §8`](../SPEC.md) for the dispatch contract.

## Alternatives (documented, not implemented by default)

- **Per-user Cursor tokens** — each ticket's `owner:` frontmatter maps to that user's `CURSOR_API_KEY_<GH_USER>` secret, so usage is billed to the right dev. Nice for cost attribution and fair-share. Not implemented in v0.2; easy addition to the Cursor adapter (read secret name from `owner`).
- **Claude.ai web (Projects / Agents)** — no public API as of today; would need a browser-automation adapter (Playwright in a GH Action). Brittle, not recommended, not implemented.
- **Twill** — if you're running Twill as your "agent fleet manager", point Rondo at Twill's dispatch endpoint via the `http` backend. Not a dedicated adapter yet, but the HTTP contract is enough.
- **Self-hosted model (Ollama, vLLM, …)** — use the `http` backend to call your own inference endpoint. The agent side (clone repo, edit files, push branch, open PR) is on you. Not trivial.
- **Multi-backend fallback** — dispatch to Cursor, and if that fails, to Claude Code, and if that fails, to Codex. In production at OVRSEA but not yet generalized in the OSS code; the adapter interface supports it.
- **A cloud sandbox (Anthropic/OpenAI managed agents)** — if the provider you use ships a managed agents product, write a thin adapter against its API. Follows the same 4-field dispatch contract.

## Self-check

- [ ] `.github/workflows/rondo.yml` `with:` block declares the chosen `agent-backend` (or leaves it at the default `cursor-api`).
- [ ] The `env:` block contains only the secret(s) for the chosen backend.
- [ ] For `http`: `with: http-url: "<httpUrl>"` is set.
- [ ] The human has been told exactly which `gh secret set ...` command to run.
- [ ] (Reminder to the human) the secret must be set before the first scheduled run, or the workflow will fail loudly.
