// Entry point for the reusable GitHub Action. Wires env → config → runner.
//
// Zero-config by design: every runtime knob comes from action inputs (exposed
// in action.yml, passed via `with:` in the host-repo workflow). GitHub Actions
// forwards each input as the env var `INPUT_<NAME>` where <NAME> is upper-kebab
// with dashes turned into underscores (e.g. `tickets-dir` → `INPUT_TICKETS_DIR`).

import { createGhClient } from "./vcs/gh-client.mjs";
import { createCursorAdapter } from "./adapters/cursor-api.mjs";
import { createHttpAdapter } from "./adapters/http.mjs";
import { runCycle } from "./core/runner.mjs";

/** Read an action input. GitHub Actions sets `INPUT_<UPPER_SNAKE>` for each. */
function input(name, fallback = "") {
  const key = `INPUT_${name.replace(/-/g, "_").toUpperCase()}`;
  const v = process.env[key];
  return v === undefined || v === "" ? fallback : v;
}

/**
 * Build the runner config from action inputs. The shape matches what
 * core/runner.mjs expects. Keep this the only place where input names are read.
 */
function readConfig() {
  const agentBackend = input("agent-backend", "cursor-api");
  const httpUrl = input("http-url", "");
  if (agentBackend === "http" && !httpUrl) {
    throw new Error(
      `agent-backend is "http" but http-url is empty. Set 'with: http-url: ...' in your workflow.`,
    );
  }
  const acceptedRaw = input("accepted-models", "");
  const acceptedModels = acceptedRaw
    ? acceptedRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  return {
    ticketsDir: input("tickets-dir", "tickets"),
    branchPrefix: input("branch-prefix", "rondo/"),
    baseBranch: input("base-branch", "main"),
    agentBackend,
    acceptedModels,
    httpUrl: httpUrl || undefined,
  };
}

/**
 * Build the adapter named by `config.agentBackend`. The only env-dependent
 * part of the runner — everything else is generic. Adapters must conform to
 * [adapters/CONTRACT.md](./adapters/CONTRACT.md): dispatch(...) → { agentId, branchName }.
 */
function createAdapter(config) {
  switch (config.agentBackend) {
    case "cursor-api":
      return createCursorAdapter({ apiKey: process.env.CURSOR_API_KEY });
    case "http":
      return createHttpAdapter({
        url: config.httpUrl,
        secret: process.env.RONDO_HTTP_SECRET,
      });
    case "claude-code-remote":
    case "codex-cloud":
      throw new Error(
        `agent-backend "${config.agentBackend}" has no adapter shipped in this Rondo release. ` +
        `Write one per action/src/adapters/CONTRACT.md and wire it here, or switch to "http" ` +
        `and have your infrastructure forward the dispatch to ${config.agentBackend}.`,
      );
    default:
      throw new Error(
        `Unknown agent-backend "${config.agentBackend}". Expected one of: cursor-api, http, ` +
        `claude-code-remote, codex-cloud.`,
      );
  }
}

async function main() {
  const repoRoot = process.env.GITHUB_WORKSPACE || process.cwd();
  const dryRun = input("dry-run", "false") === "true";

  const config = readConfig();

  const [owner, repo] = (process.env.GITHUB_REPOSITORY || "owner/repo").split("/");
  const gh = createGhClient({ token: process.env.GH_TOKEN, owner, repo });
  const adapter = createAdapter(config);

  const today = new Date().toISOString().slice(0, 10);

  const result = await runCycle({
    config,
    gh,
    adapter,
    repoRoot,
    repoFullName: `${owner}/${repo}`,
    dryRun,
    today,
  });

  console.log(
    `cycle done — dispatched ${result.dispatched.length}, ` +
    `skipped ${result.skipped.length}, failed ${result.failed.length}`,
  );
  if (result.failed.length > 0) {
    // Non-zero exit so the Action run shows red and on-call notices.
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
