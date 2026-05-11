---
name: rondo-install
description: Install Rondo in this repository. Walks through the modular brick menu, asking the human which bricks to install and running each one. Invoke when the user says "install rondo" or "set up rondo".
---

# rondo-install

You are going to install [Rondo](https://github.com/eltonio450/rondo) in the current repository.

## What to do

1. Read [`INSTALL.md`](../../INSTALL.md) at the repo root of the Rondo source. If this skill was installed into the host repo as a standalone file, fetch `INSTALL.md` directly from the upstream Rondo repo at the same pin the scheduler brick uses — `https://github.com/eltonio450/rondo/blob/v0.3/INSTALL.md` — so the install steps stay aligned with the action version. Rondo is not vendored into the host repo by the install.
2. Follow it **to the letter**. It contains:
   - A mandatory pre-flight checklist.
   - A menu of 7 bricks the user chooses from.
   - Per-brick detailed instructions under [`install/`](../../install/).
3. Ask the user which bricks to install **before touching anything**. Recommended first install: bricks 1–6 (Tickets · Prompt · Registry Issue · Scheduler · Agent runner · Validation CI).
4. For each chosen brick, open the corresponding `install/NN-*.md` file, read it in full, ask its listed questions, and run its steps.
5. Never set GitHub secrets yourself. Print the `gh secret set …` commands — the human runs them.
6. Never open a PR as part of the install — commit on the current branch only.

## What you must NOT do

- Do not skip the pre-flight.
- Do not silently overwrite `tickets/`, `rondo.prompt.md`, or any existing workflow file.
- Do not invent new bricks. If the user asks for something exotic, point them at the Alternatives section of the relevant brick file.

## When done

Print the completion message at the bottom of `INSTALL.md` verbatim.
