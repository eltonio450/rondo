---
name: rondo-cloud-runtime
description: Audit and design Stage 3 of a software factory—running the exact same local agent + ticketing loop in an isolated cloud runtime (VM, container, sandbox, or cloud runner) with working Git, CI, ticketing, dependencies, secrets, timeouts, and logs.
---

# Cloud Runtime Setup & Audit

**Stage 3 of 7 — Build Your Software Factory**

A local agent that stops the moment you close your laptop is still tied to your machine. Stage 3 moves the exact working loop from Stages 1 and 2 into a **cloud runtime** (remote VM, container, ephemeral sandbox, GitHub Actions / Coder / Fly / Hetzner / cloud agent host) where every connection actually works unattended: Git clone/push/PR, CI logs, ticketing access, package registries, scoped secrets, hard time/cost limits, and persistent logs.

Use this skill to audit what currently prevents your agent loop from running cleanly in the cloud and produce a concrete blueprint to stand up Stage 3.

## Guardrails

- **Audit read-only first.** Inspect Dockerfiles, devcontainers, CI workflows, infra configs, and scripts without provisioning paid infrastructure, mutating remote servers, or exposing secrets.
- **Verify real connectivity requirements, not assumptions.** Local laptops hide implicit dependencies (SSH keys, macOS keychain, VPNs, local Docker daemons, cached npm/pip tokens, logged-in browsers). Surface every one of them.
- **Never read, print, or request secret values.** Output exact secret names and `gh secret set` / secret-manager instructions for a human operator.

## What to inspect

Examine six concrete surfaces:

1. **Reproducible cloud image / sandbox**
   - Existing `Dockerfile`, `.devcontainer/devcontainer.json`, `mise.toml`, Nix, or setup scripts.
   - Can a clean Linux container/VM install system packages, runtimes, and repo dependencies deterministically without manual clicks or macOS-only tools?

2. **All external connections working unattended**
   - **Git & PRs:** scoped GitHub App / bot token or deploy key able to clone, push feature branches, open PRs, and read CI logs (never a personal super-admin token).
   - **Ticketing (Stage 2):** non-interactive service token for Linear, Notion, GitHub Issues, or Jira.
   - **Model provider:** API key or supported non-interactive auth for the coding agent harness (Claude Code, Codex, OpenCode, Cursor Background Agents, etc.).
   - **Private registries / databases:** private npm/PyPI/Docker registries, test containers, or staging/fixture access needed to run tests.

3. **Workspace & process isolation**
   - Clean checkout per run (fresh container/VM or isolated worktree), no shared mutable state leaking between runs, no credentials written into tracked files or PR diffs.

4. **Hard operational bounds**
   - Wall-clock timeout per run (e.g. 30–60 min), token/spend budget cap, CPU/RAM/disk limits, and automatic cleanup of dead containers or orphan processes.

5. **Observability & artifacts after teardown**
   - When the cloud sandbox stops or is destroyed, are the branch, PR, test output, run logs, and exit status still inspectable by a human?

6. **Manual cloud smoke test path**
   - Before adding an orchestrator in Stage 4, is there one simple manual trigger (CLI command, `workflow_dispatch`, or API call) to launch a single ticket in the cloud runtime and verify every connection end-to-end?

## Diagnostic rubric

Score each surface as `Ready`, `Partial`, `Missing`, or `Unverified`:

| Surface | Healthy (`Ready`) | Fragile (`Partial` / `Missing`) | What breaks without it |
|---|---|---|---|
| **1. Reproducible image** | Clean Linux container/VM installs and runs Stage 1 precheck cleanly. | Only works on a developer's pre-configured laptop. | Cloud runs fail immediately on missing tools or OS differences. |
| **2. Unattended connections** | Git/PR, CI logs, ticketing, model API, and private registries work non-interactively. | Relies on local browser logins, SSH agent forwarding, or VPN. | Agent runs blind or hangs on auth prompts in the cloud. |
| **3. Scoped secrets & isolation** | Fresh sandbox per run, least-privilege tokens injected via env/secret store. | Shared long-lived machine with personal admin keys or `.env` files on disk. | Cross-run contamination or high blast radius on compromise. |
| **4. Time & cost bounds** | Hard timeout, spend limit, and automatic teardown enforced outside the prompt. | Unbounded remote runs. | One stuck loop burns budget or fills disk overnight. |
| **5. Post-run artifacts** | PR, logs, test proof, and exit status survive sandbox destruction. | Logs vanish when the container exits. | Impossible to debug why a cloud run failed. |

## Audit report format

Return the audit in this structure:

```markdown
## Stage 3 Audit — Cloud Runtime

**Verdict:** <Ready for Stage 4 | Partially ready | Not ready>
<2–3 concrete sentences: can your Stage 1–2 agent loop run today in an isolated cloud environment with your laptop closed, and which missing connection blocks it?>

### Scorecard
| Surface | Status | Exact evidence | What breaks |
|---|---|---|---|
| Reproducible image | ... | `<Dockerfile/devcontainer/CI>` | ... |
| Unattended connections | ... | `<Git/CI/ticketing/registries>` | ... |
| Scoped secrets & isolation | ... | `<secret injection/sandbox>` | ... |
| Time & cost bounds | ... | `<timeouts/budgets/cleanup>` | ... |
| Post-run artifacts | ... | `<logs/PR/test outputs>` | ... |

### Recommended cloud runtime architecture
<Concrete 10-line recommendation fitting this stack (e.g. Docker image + remote VM/Fly/Coder/GitHub Actions/Cursor Background Agents), listing exact required secret names (values never included) and exact network/auth boundaries.>

### What to build next

#### P0 — Get 1 manual cloud run working
1. **<Concrete step>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact Dockerfile, runner script, or workflow>`
   - **Action:** <Exact change.>
   - **Verify:** `<exact smoke-test command in a clean container/remote runner>`

#### P1 — Hardening
1. **<Concrete step>** (`Agent PR` | `Human / Admin`)
   - **Target:** `<exact path>`
   - **Action:** <Exact improvement.>
   - **Verify:** `<exact check>`

#### Not yet — Skip for now
- <Do not turn on automatic cron/webhook dispatching (Stage 4) until 1 manually triggered cloud run opens a green PR cleanly.>

### Stage 3 exit test
Trigger ONE real ticket manually in the cloud runtime, close your laptop, and verify the remote agent fetches the ticket (Stage 2), passes tests, opens a PR, reads CI, and leaves full logs after the container shuts down. Only then move to Stage 4 (`rondo-orchestrator`).
```

End by offering to draft the `Dockerfile` / devcontainer, cloud runner entrypoint script, or connection smoke-test workflow on a branch.
