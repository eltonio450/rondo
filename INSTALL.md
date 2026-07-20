# Install Rondo — guided reference profile

> Protocol v0.4, **Unreleased**. These instructions are for a coding agent working with a human in a host repository.

Rondo installation is a small set of reviewable repository changes plus optional GitHub-side setup. It is not a package install and it must respect the host repository's normal branch, review, and deployment policy.

The reference profile uses:

- GitHub Actions as scheduler;
- one GitHub Issue as branch registry;
- Cursor Background Agents or a generic HTTP receiver;
- a separate ticket-validation workflow.

Dedicated Claude Code and Codex Cloud adapters are not shipped.

## Non-negotiable rules

1. Discover the environment before changing anything.
2. Read every selected brick completely before applying it.
3. Preserve user files and unrelated work; never overwrite a workflow or prompt silently.
4. Never write, print, inspect, or set a secret value. Give the human the secret command instead.
5. Do not bypass branch protection. Installation may and usually should go through a PR.
6. Do not trigger a workflow until the workflow file has been pushed and, where required, merged to the default branch.
7. Pin Rondo to `<RONDO_REF>`, a reviewed immutable 40-character commit SHA. Do not substitute `main` or assume a `v0.4` tag exists.
8. Pin third-party Actions to reviewed immutable SHAs when the host policy requires supply-chain pinning.
9. Do not claim exactly-once dispatch or PR verification. The reference runner is at least once.
10. Stop before destructive or external mutations that the human has not approved.

## Phase 1 — Discover the host

Run read-only checks first and summarize the result to the human:

1. Confirm repository root and inspect `git status --short --branch`. Do not disturb existing changes.
2. Inspect repository guidance: `AGENTS.md`, `CONTRIBUTING.md`, security policy, workflow conventions, branch rules, and existing package/runtime files.
3. Determine the GitHub repository and default branch. Prefer local Git metadata; if available, confirm with:

   ```bash
   gh auth status
   gh repo view --json nameWithOwner,defaultBranchRef --jq '{repo: .nameWithOwner, default: .defaultBranchRef.name}'
   ```

4. Discover the existing Rondo footprint:

   - candidate ticket directories;
   - `.github/workflows/rondo.yml` and validation workflows;
   - `rondo.prompt.md`;
   - installed Rondo skills;
   - an open Issue labelled `rondo-registry`;
   - legacy `rondo:*` labels or workflows.

5. Discover delivery constraints:

   - can the current branch be pushed directly, or is a PR required?
   - who can create labels, install GitHub Apps, set Actions secrets, and require checks?
   - are external Actions allowed and must they be SHA-pinned?
   - may workflows send repository metadata and prompts to the selected agent provider?
   - is cleartext HTTP prohibited? It is disabled by Rondo by default.

If Rondo artifacts already exist, show the current and proposed configuration and ask whether to adopt, update, or abort. Do not replace them wholesale.

## Phase 2 — Collect decisions once

Ask the human for the following choices in one concise message:

| Decision | Recommended default |
|---|---|
| Bricks | 1–6; add 7 only if skills are useful |
| Ticket directory | `tickets` |
| Base branch | detected repository default |
| Schedule | manual-only for pilot; hourly after validation |
| Backend | `cursor-api`, or `http` when a receiver already exists |
| Maximum dispatch attempts/cycle | `10`; use a smaller value such as `1` for the first real run |
| Request timeout | `120` seconds |
| Accepted models | empty, unless the organization needs an allowlist |
| Prompt override | none initially |
| Delivery | normal host branch/PR policy |
| `<RONDO_REF>` | reviewed immutable commit SHA |

For HTTP, also collect the HTTPS receiver URL and whether a shared secret is used. Only allow `http-allow-insecure: true` for an explicitly approved controlled environment; explain that traffic and prompt data are otherwise cleartext.

## Phase 3 — Select bricks

| # | Brick | File | Effect |
|---|---|---|---|
| 1 | Ticket directory | [`install/01-tickets-dir.md`](install/01-tickets-dir.md) | Creates the active queue and example format. |
| 2 | Prompt | [`install/02-prompt.md`](install/02-prompt.md) | Uses the bundled prompt or adds a host override. |
| 3 | Registry | [`install/03-state-store.md`](install/03-state-store.md) | Prepares the one-Issue branch registry. |
| 4 | Scheduler | [`install/04-scheduler.md`](install/04-scheduler.md) | Adds the pinned GitHub workflow and runtime inputs. |
| 5 | Agent backend | [`install/05-agent-runner.md`](install/05-agent-runner.md) | Configures Cursor or HTTP and tells the human which secret to set. |
| 6 | Validation CI | [`install/06-validate-tickets.md`](install/06-validate-tickets.md) | Adds author-time ticket validation. |
| 7 | Skills, optional | [`install/07-skills.md`](install/07-skills.md) | Installs standalone agent instructions. |
| — | Uninstall | [`install/99-uninstall.md`](install/99-uninstall.md) | Stops or removes the reference profile. |

Apply chosen bricks in numerical order. Bricks are designed to be repeatable when their preservation checks are followed; they are not permission to overwrite existing content.

## Phase 4 — Verify locally

Before committing or pushing:

1. Review the complete diff and confirm only approved files changed.
2. Confirm no secret value appears in the diff.
3. Confirm workflow references use `<RONDO_REF>` or its chosen SHA, never `main` or an assumed tag.
4. Confirm `base-branch`, `tickets-dir`, backend, capacity, timeout, and URL settings match the answers.
5. Confirm the configured ticket path is intentional. An absent path is a valid empty queue, so deleting the final ticket must not break validation. A `.gitkeep` is optional for discoverability.
6. From a reviewed Rondo checkout at the same ref, validate tickets:

   ```bash
   node action/src/cli/validate-tickets.mjs "<ticketsDir>"
   ```

7. If working in the Rondo source itself, run `cd action && npm test` on Node 24.

Report any check that could not run. Do not translate “not run” into “passed”.

## Phase 5 — Deliver through the host policy

The workflow must exist on GitHub before remote smoke testing.

- If the host requires review: create a branch, commit only approved files, push, open a PR, wait for review, and merge through the normal process.
- If direct delivery is explicitly allowed: ask before committing or pushing, then push the reviewed change to the appropriate branch.
- If another person owns delivery: leave the working tree ready and print the exact next commands without running them.

Do not force-push, bypass checks, or write directly to a protected branch.

## Phase 6 — Configure external state

After repository changes are available on GitHub:

1. Create or confirm the `rondo-registry` label if Brick 3 was selected.
2. Have an authorized human install the Cursor GitHub App when using Cursor.
3. Print the relevant command; the human enters the value:

   ```bash
   gh secret set CURSOR_API_KEY
   # or
   gh secret set RONDO_HTTP_SECRET
   ```

When configured, the shared secret HMAC-signs `<timestamp>.<exact-body>`. The receiver must validate `X-Rondo-Timestamp`, verify `X-Rondo-Signature: sha256=<hex>` with a timing-safe comparison, and enforce a replay window. HTTPS remains required.

## Phase 7 — Remote smoke test

Once the workflow is present on the default branch, run or ask the human to run:

```bash
gh workflow run rondo.yml -f dry_run=true
gh run list --workflow=rondo.yml --limit 1
```

Inspect the selected run log. Dry-run discovers tickets, applies ordering and the capacity limit, and performs required VCS reads, but does not construct a dispatch adapter or require its backend secret.

Expected summary:

```text
cycle done — dispatched 0, skipped <N>, failed 0
```

Then perform one controlled real run through Brick 4's manual capacity input:

```bash
gh workflow run rondo.yml -f dry_run=false -f max_dispatches=1
```

Watch provider usage, the registry Issue, and the resulting PR before raising the cap or enabling a frequent schedule.

## Completion report

Report:

- installed bricks and files;
- immutable Rondo ref;
- backend, schedule, capacity, timeout, and base branch;
- where data is sent;
- local and remote checks with exact outcomes;
- external steps still owned by the human;
- rollback path from [`install/99-uninstall.md`](install/99-uninstall.md).

Link to the upstream Rondo documentation at the chosen immutable ref, not to the host repository's README.
