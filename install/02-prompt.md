# Brick 2 — Prompt

## What it does

Sets the instructions the dispatched agent receives every cycle. The prompt is what tells the agent: "read the ticket, choose one of four outputs, always open exactly one PR."

## Default we ship

The reference prompt is [`PROMPT.md`](../PROMPT.md) bundled with the Rondo action. The runner loads it automatically. You install **nothing** by default — it's already in effect as soon as Brick 4 (scheduler) is installed.

Why this default: one canonical prompt, versioned with the action, reviewable by the OSS community, easy to diff when the method evolves. Teams that need to customize do so **locally per host repo**, not by forking Rondo.

## Convention-based override (no config)

If the host repo contains a file named exactly `rondo.prompt.md` **at the repo root**, the runner picks it up automatically. There is no config key, no path indirection — the filename is the contract.

Behavior of the override file:

- If it starts with `# Rondo agent prompt` (same H1 as the bundled file), it **replaces** the bundled prompt.
- Otherwise, it is **prepended** to the bundled prompt — the host's additions come first, then the bundled prompt verbatim, separated by a `---` rule.

This is implemented in [`action/src/lib/prompt-loader.mjs`](../action/src/lib/prompt-loader.mjs).

## Questions to ask the human

1. *"Do you want to customize the agent prompt for this repo? (default: no — use the Rondo default)"*
2. If yes: *"How much do you want to change? (a) Small additions on top of the default (preferred), (b) Full override."*

## Steps

**If the human picked "no" (default):** skip this brick. Nothing to install — the bundled `PROMPT.md` is used automatically.

**If the human picked "(a) small additions":**

1. Write `rondo.prompt.md` at the host repo root with a short prepend (do **not** start it with `# Rondo agent prompt` — that triggers full-replacement mode):

   ```markdown
   # Team-specific additions to the Rondo prompt

   > The Rondo default prompt follows below verbatim. The lines above are additions specific to this repo.

   - <team-specific rule 1>
   - <team-specific rule 2>

   ---
   ```

2. Tell the human: "the runner will automatically concatenate your additions with the default — no config needed."

**If the human picked "(b) full override":**

1. Copy the content of [`PROMPT.md`](../PROMPT.md) from the Rondo repo into `rondo.prompt.md` at the host repo root. **Keep the `# Rondo agent prompt` H1** at the top — that's the marker that tells the runner to use this file as a full replacement.
2. Tell the human to edit it. **Warn them clearly:** removing hard invariants (one PR per cycle, always modify the `.md`, push to `<BRANCH_NAME>` against `<BASE_BRANCH>`) will break the scheduler's eligibility checks and the registry mapping.

## Alternatives (documented, not implemented by default)

- **Per-ticket prompt override** — a ticket could carry a `prompt:` frontmatter key pointing to a custom prompt file. Useful for experimental tickets. Not in v0.1; open a PR if you want this.
- **Prompt-as-code** — load the prompt from a JS/TS function so it can be templated with ticket metadata. Risk: drift from the canonical Markdown form. Not implemented.
- **Prompt served from a remote URL** — fetched at dispatch time. Useful for orgs with central prompt governance. Not implemented; easy to add as an `INPUT_PROMPT_URL` action input in a follow-up.
- **Rename the convention file** — if `rondo.prompt.md` clashes with something in your repo, the only way today is to fork the action and edit `prompt-loader.mjs`. Deliberate — keeping the convention name fixed is the whole point of "no config".

## Self-check

- [ ] If skipped: no `rondo.prompt.md` exists at the host repo root — the bundled [`PROMPT.md`](../PROMPT.md) is used automatically.
- [ ] If "(a) small additions": `rondo.prompt.md` exists at the repo root and does **not** start with `# Rondo agent prompt`.
- [ ] If "(b) full override": `rondo.prompt.md` exists at the repo root and **does** start with `# Rondo agent prompt`.
