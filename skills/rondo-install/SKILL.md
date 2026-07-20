---
name: rondo-install
description: Install or update the Rondo GitHub reference profile safely, using an immutable reviewed source ref and the host repository's normal delivery policy.
---

# Rondo install

Use this skill when a human asks to install, update, suspend, or inspect Rondo in a repository.

## Guardrails

- Start with read-only discovery and preserve unrelated changes.
- Ask for `<RONDO_REF>`, a reviewed immutable 40-character Rondo commit SHA. Never use `main` or assume a version tag exists.
- Respect the host's branch protection and PR policy. Do not insist on direct commits.
- Never set, read, print, or request a secret value. Print the `gh secret set ...` command for the human.
- Do not run a new remote workflow until its file has been pushed and, when required, merged to the default branch.
- Only Cursor and generic HTTP adapters are shipped.
- Dispatch is at least once. The runner requests but does not verify exactly one relevant PR, reused on retry.
- Stop before destructive or unapproved external mutation.

## Discover

Inspect:

1. repository root, current branch, dirty files, and contributor/agent guidance;
2. default branch, remote identity, branch/Actions policy, and `gh` authentication;
3. ticket directory, `rondo.prompt.md`, `rondo*.yml` workflows, installed skills, and registry Issue/label;
4. who may install GitHub Apps, create labels, set secrets, and require checks;
5. whether outbound prompt/repository metadata may go to Cursor or the proposed HTTP receiver.

Show any existing Rondo artifact before changing it.

## Source instructions

Prefer an already reviewed local Rondo checkout at `<RONDO_REF>`. Otherwise, after the human supplies that SHA, retrieve the raw files at exactly:

```text
https://raw.githubusercontent.com/eltonio450/rondo/<RONDO_REF>/INSTALL.md
https://raw.githubusercontent.com/eltonio450/rondo/<RONDO_REF>/install/<brick-file>
```

Do not fetch from `main`. Read `INSTALL.md` and every selected brick completely.

## Recommended reference profile

Offer bricks 1–6, with skills optional:

1. flat ticket directory, with optional `.gitkeep` for discoverability;
2. bundled prompt or explicit host override;
3. one GitHub Issue registry;
4. serialized GitHub Actions scheduler;
5. Cursor or HTTPS adapter;
6. ticket-validation CI;
7. optional standalone skills.

Collect once: ticket path, detected base branch, manual/scheduled cadence, backend, model allowlist, dispatch cap (`10`, first real run `1`), timeout (`120` seconds), HTTP URL/policy, delivery route, and immutable refs.

## Delivery sequence

1. Apply approved repository-file changes without overwriting existing content.
2. Keep `.gitkeep` optional; an absent ticket directory after the final deletion is a valid empty queue and must pass validation.
3. Review diff, placeholders, refs, permissions, and absence of secrets.
4. Validate locally where possible.
5. Deliver through the normal branch/PR route; ask before commit/push.
6. After workflow delivery, have humans set secrets/install Apps and create the registry label.
7. Run remote dry-run; it needs no provider secret and performs no dispatch.
8. Run one real cycle capped at `1`, then inspect cost, provider state, Issue registry, and PR.

Report exact checks, files, selected SHA, data destination, remaining human actions, and rollback. Never call an unrun check successful.
