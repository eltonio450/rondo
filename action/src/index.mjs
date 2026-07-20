// Entry point for the reusable GitHub Action. Wires env → config → runner.

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createCursorAdapter } from "./adapters/cursor-api.mjs";
import { createHttpAdapter } from "./adapters/http.mjs";
import { runCycle } from "./core/runner.mjs";
import {
  assertValidBranchName,
  assertValidBranchPrefix,
  assertValidModel,
  assertValidRelativeDirectory,
  assertValidRepoFullName,
  validateHttpEndpoint,
} from "./lib/validation.mjs";
import { createGhClient } from "./vcs/gh-client.mjs";

const SUPPORTED_BACKENDS = new Set([
  "cursor-api",
  "http",
  "claude-code-remote",
  "codex-cloud",
]);

/**
 * Read an Action input from the environment.
 *
 * GitHub uppercases input ids and preserves dashes (`dry-run` becomes
 * `INPUT_DRY-RUN`). The underscore key is accepted as a local/legacy alias.
 */
export function input(name, fallback = "", env = process.env) {
  const githubKey = `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
  const underscoreAlias = githubKey.replace(/-/g, "_");
  for (const key of githubKey === underscoreAlias ? [githubKey] : [githubKey, underscoreAlias]) {
    const value = env[key];
    if (value !== undefined && value !== "") return value;
  }
  return fallback;
}

function booleanInput(name, fallback, env) {
  const value = String(input(name, String(fallback), env)).trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be either "true" or "false".`);
}

function integerInput(name, fallback, env, { min, max }) {
  const raw = String(input(name, String(fallback), env)).trim();
  if (!/^\d+$/.test(raw)) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

/** Build and validate the runner config from Action inputs. */
export function readConfig({ env = process.env } = {}) {
  const dryRun = booleanInput("dry-run", false, env);
  const ticketsDir = String(input("tickets-dir", "tickets", env)).trim();
  const branchPrefix = String(input("branch-prefix", "rondo/", env)).trim();
  const baseBranch = String(input("base-branch", "main", env)).trim();
  const agentBackend = String(input("agent-backend", "cursor-api", env)).trim();
  const acceptedRaw = String(input("accepted-models", "", env)).trim();
  const httpUrlRaw = String(input("http-url", "", env)).trim();
  const httpAllowInsecure = booleanInput("http-allow-insecure", false, env);
  const maxDispatchesPerCycle = integerInput("max-dispatches-per-cycle", 10, env, {
    min: 1,
    max: 1_000,
  });
  const requestTimeoutSeconds = integerInput("request-timeout-seconds", 120, env, {
    min: 1,
    max: 3_600,
  });

  assertValidRelativeDirectory(ticketsDir);
  assertValidBranchPrefix(branchPrefix);
  assertValidBranchName(baseBranch, "base-branch");
  if (!SUPPORTED_BACKENDS.has(agentBackend)) {
    throw new Error(
      `Unknown agent-backend "${agentBackend}". Expected one of: ${[...SUPPORTED_BACKENDS].join(", ")}.`,
    );
  }

  const acceptedModels = acceptedRaw
    ? acceptedRaw.split(",").map((model) => model.trim()).filter(Boolean)
    : undefined;
  for (const model of acceptedModels ?? []) assertValidModel(model, "accepted-models entry");

  let httpUrl;
  if (agentBackend === "http") {
    if (!httpUrlRaw) {
      throw new Error(
        `agent-backend is "http" but http-url is empty. Set 'with: http-url: ...' in your workflow.`,
      );
    }
    httpUrl = validateHttpEndpoint(httpUrlRaw, { allowInsecure: httpAllowInsecure });
  } else if (httpAllowInsecure) {
    throw new Error("http-allow-insecure can only be true when agent-backend is http.");
  }

  return {
    dryRun,
    ticketsDir,
    branchPrefix,
    baseBranch,
    agentBackend,
    acceptedModels,
    httpUrl,
    httpAllowInsecure,
    maxDispatchesPerCycle,
    requestTimeoutMs: requestTimeoutSeconds * 1_000,
  };
}

/** Build the configured backend adapter. */
export function createAdapter(
  config,
  { env = process.env, fetchImpl = globalThis.fetch } = {},
) {
  switch (config.agentBackend) {
    case "cursor-api":
      return createCursorAdapter({
        apiKey: env.CURSOR_API_KEY,
        requestTimeoutMs: config.requestTimeoutMs,
        fetchImpl,
      });
    case "http":
      return createHttpAdapter({
        url: config.httpUrl,
        secret: env.RONDO_HTTP_SECRET,
        allowInsecure: config.httpAllowInsecure,
        requestTimeoutMs: config.requestTimeoutMs,
        fetchImpl,
      });
    case "claude-code-remote":
    case "codex-cloud":
      throw new Error(
        `agent-backend "${config.agentBackend}" has no adapter shipped in this Rondo release. ` +
        `Write one per action/src/adapters/CONTRACT.md and wire it here, or switch to "http" ` +
        `and have your infrastructure forward the dispatch to ${config.agentBackend}.`,
      );
    default:
      throw new Error(`Unknown agent-backend "${config.agentBackend}".`);
  }
}

/** Run one Action cycle and return the desired process exit code. */
export async function main({
  env = process.env,
  cwd = process.cwd(),
  fetchImpl = globalThis.fetch,
  nowImpl = () => new Date(),
  log = console.log,
  ghFactory = createGhClient,
  adapterFactory = createAdapter,
  runCycleImpl = runCycle,
} = {}) {
  const config = readConfig({ env });
  const repoRoot = env.GITHUB_WORKSPACE || cwd;
  const repoFullName = env.GITHUB_REPOSITORY;
  assertValidRepoFullName(repoFullName, "GITHUB_REPOSITORY");
  const [owner, repo] = repoFullName.split("/");

  const gh = ghFactory({
    token: env.GH_TOKEN,
    owner,
    repo,
    requestTimeoutMs: config.requestTimeoutMs,
    fetchImpl,
  });

  // Dry-run performs GitHub reads but cannot dispatch, so backend credentials
  // are deliberately not required and no adapter is instantiated.
  const adapter = config.dryRun
    ? null
    : adapterFactory(config, { env, fetchImpl });

  const now = nowImpl();
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error("nowImpl must return a valid Date.");
  }

  const result = await runCycleImpl({
    config,
    gh,
    adapter,
    repoRoot,
    repoFullName,
    dryRun: config.dryRun,
    today: now.toISOString().slice(0, 10),
    log,
  });

  log(
    `cycle done — dispatched ${result.dispatched.length}, ` +
    `skipped ${result.skipped.length}, failed ${result.failed.length}`,
  );
  return result.failed.length > 0 ? 2 : 0;
}

export function isDirectExecution(metaUrl = import.meta.url, argv1 = process.argv[1]) {
  return Boolean(argv1) && metaUrl === pathToFileURL(resolve(argv1)).href;
}

if (isDirectExecution()) {
  main()
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
