// The main dispatch loop — environment-independent. It uses only the
// abstractions in ./eligibility.mjs, ./registry.mjs, ../lib/*, ../adapters/*;
// swapping the adapter requires no change to this file.

import { readdir, readFile } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { createHash } from "node:crypto";

import { parseFrontmatter } from "../lib/frontmatter.mjs";
import { assertValidAgentId, assertValidBranchName } from "../lib/validation.mjs";
import { isEligible } from "./eligibility.mjs";
import { loadPrompt } from "../lib/prompt-loader.mjs";
import {
  parseRegistry,
  renderRegistry,
  REGISTRY_LABEL,
  REGISTRY_TITLE,
} from "./registry.mjs";

/**
 * One full cycle: scan tickets, evaluate eligibility, dispatch one agent per
 * eligible ticket, and checkpoint the registry Issue after every success.
 *
 * @param {object} deps
 * @param {object} deps.config       Runner config (built from action inputs — see src/index.mjs).
 * @param {object} deps.gh           From vcs/gh-client.mjs.
 * @param {object} deps.adapter      From adapters/*.mjs (see adapters/CONTRACT.md).
 * @param {string} deps.repoRoot     Absolute repo root (where checkout happened).
 * @param {string} deps.repoFullName owner/repo
 * @param {boolean} deps.dryRun      If true, log but do not dispatch.
 * @param {string} deps.today        ISO date for paused-until comparisons.
 * @param {(msg: string) => void} [deps.log]
 *
 * @returns {Promise<{ dispatched: Array<{slug: string, agentId: string, branchName: string}>, skipped: Array<{slug: string, reason: string}>, failed: Array<{slug: string, error: string}> }>}
 */
export async function runCycle({
  config,
  gh,
  adapter,
  repoRoot,
  repoFullName,
  dryRun,
  today,
  log = console.log,
}) {
  const ticketsDir = join(repoRoot, config.ticketsDir);
  const maxDispatchesPerCycle = normalizeMaxDispatches(config.maxDispatchesPerCycle);
  const prompt = await loadPrompt({ repoRoot });

  const tickets = await scanTickets(ticketsDir, log);
  const existingTicketSlugs = tickets.map((t) => t.slug);
  const normalizedRepoFullName = repoFullName.toLowerCase();
  const openPRs = (await gh.listAllOpenPRs())
    .map((pr) => ({
      branchName: pr.head?.ref,
      number: pr.number,
      headRepoFullName: pr.head?.repo?.full_name,
    }))
    // GitHub's `head.ref` omits the fork owner. Ignore a same-named branch
    // from another repository, while retaining compatibility with historical
    // mocks/API shapes that do not include head.repo.full_name.
    .filter(
      (pr) =>
        !pr.headRepoFullName || pr.headRepoFullName.toLowerCase() === normalizedRepoFullName,
    );

  const registryIssue = await findOrCreateRegistry({ gh, log, dryRun });
  // A missing registry in dry-run mode is expected and side-effect free. An
  // existing malformed registry must fail closed: silently falling back to a
  // conventional branch can duplicate an agent already running on a
  // backend-generated branch.
  const mapping = registryIssue
    ? parseRegistry(registryIssue.body, { strict: true })
    : parseRegistry("");

  // Drop completed tickets before any checkpoint so every persisted snapshot
  // contains only the current queue.
  for (const slug of Object.keys(mapping)) {
    if (!existingTicketSlugs.includes(slug)) delete mapping[slug];
  }

  // Sort by priority asc, then slug lex asc (SPEC §3.2 tie-break).
  tickets.sort((a, b) => {
    const pa = validPriorityOrLast(a.frontmatter.priority);
    const pb = validPriorityOrLast(b.frontmatter.priority);
    if (pa !== pb) return pa - pb;
    return a.slug.localeCompare(b.slug);
  });

  const dispatched = [];
  const skipped = [];
  const failed = [];
  let dispatchAttempts = 0;
  let registryPersisted = false;
  const dispatchedSlugs = new Set();

  for (const ticket of tickets) {
    const branchName = Object.hasOwn(mapping, ticket.slug)
      ? mapping[ticket.slug]
      : `${config.branchPrefix}${ticket.slug}`;

    const verdict = isEligible({
      ticket,
      existingTicketSlugs,
      openPRs,
      today,
      branchName,
      acceptedModels: config.acceptedModels,
    });

    if (!verdict.eligible) {
      log(`[skip] ${ticket.slug}: ${verdict.reason}`);
      skipped.push({ slug: ticket.slug, reason: verdict.reason });
      continue;
    }

    if (dispatchAttempts >= maxDispatchesPerCycle) {
      const reason = "max_dispatches_per_cycle_reached";
      log(`[skip] ${ticket.slug}: ${reason}`);
      skipped.push({ slug: ticket.slug, reason });
      continue;
    }
    dispatchAttempts += 1;

    if (dryRun) {
      log(`[dry-run] would dispatch ${ticket.slug} on ${branchName}`);
      continue;
    }

    try {
      const result = await adapter.dispatch({
        repoFullName,
        ticketFile: `${config.ticketsDir}/${ticket.slug}.md`,
        suggestedBranch: branchName,
        baseBranch: config.baseBranch,
        model: ticket.frontmatter.model,
        prompt,
        idempotencyKey: makeIdempotencyKey({
          repoFullName,
          ticketFile: `${config.ticketsDir}/${ticket.slug}.md`,
          raw: ticket.raw,
        }),
      });
      const validatedResult = validateDispatchResult(result);
      mapping[ticket.slug] = validatedResult.branchName;
      dispatched.push({
        slug: ticket.slug,
        agentId: validatedResult.agentId,
        branchName: validatedResult.branchName,
      });
      dispatchedSlugs.add(ticket.slug);
      log(
        `[dispatched] ${ticket.slug} → ${validatedResult.agentId} on ${validatedResult.branchName}`,
      );

      // The branch returned by an adapter is the only durable correlation
      // between this ticket and its future PR. Checkpoint it before launching
      // another agent; failure is fatal because continuing would create
      // untracked dispatches and likely duplicates on the next cycle.
      await persistRegistry({
        gh,
        registryIssue,
        mapping,
        tickets,
        openPRs,
        today,
        existingTicketSlugs,
        acceptedModels: config.acceptedModels,
        branchPrefix: config.branchPrefix,
        dispatchedSlugs,
      });
      registryPersisted = true;
    } catch (err) {
      if (err.code === "RONDO_REGISTRY_PERSIST_FAILED") throw err;
      log(`[fail] ${ticket.slug}: adapter dispatch failed — ${err.message}`);
      failed.push({ slug: ticket.slug, error: err.message });
    }
  }

  // A cycle without a successful dispatch still rewrites the registry to
  // refresh derived states and prune completed tickets.
  if (registryIssue && !dryRun && !registryPersisted) {
    await persistRegistry({
      gh,
      registryIssue,
      mapping,
      tickets,
      openPRs,
      today,
      existingTicketSlugs,
      acceptedModels: config.acceptedModels,
      branchPrefix: config.branchPrefix,
      dispatchedSlugs,
    });
  }

  return { dispatched, skipped, failed };
}

function normalizeMaxDispatches(value) {
  if (value === undefined || value === null) return 10;
  if (!Number.isInteger(value) || value < 1 || value > 1000) {
    throw new Error("config.maxDispatchesPerCycle must be an integer from 1 to 1000");
  }
  return value;
}

function validPriorityOrLast(value) {
  return Number.isInteger(value) && value >= 0 && value <= 99 ? value : 100;
}

function makeIdempotencyKey({ repoFullName, ticketFile, raw }) {
  return createHash("sha256")
    .update(repoFullName)
    .update("\0")
    .update(ticketFile)
    .update("\0")
    .update(raw)
    .digest("hex");
}

function validateDispatchResult(result) {
  if (!result || typeof result !== "object") {
    throw new Error("adapter returned an invalid dispatch result: expected an object");
  }
  try {
    assertValidAgentId(result.agentId, "adapter result agentId");
    assertValidBranchName(result.branchName, "adapter result branchName");
  } catch (error) {
    throw new Error(
      `adapter returned an invalid dispatch result: ${error.message}`,
      { cause: error },
    );
  }
  return result;
}

async function persistRegistry({
  gh,
  registryIssue,
  mapping,
  tickets,
  openPRs,
  today,
  existingTicketSlugs,
  acceptedModels,
  branchPrefix,
  dispatchedSlugs,
}) {
  if (!registryIssue) return;
  try {
    const newBody = renderRegistry({
      mapping,
      tickets,
      openPRs,
      today,
      existingTicketSlugs,
      acceptedModels,
      branchPrefix,
      dispatchedSlugs,
    });
    await gh.updateIssueBody(registryIssue.number, newBody);
  } catch (err) {
    const fatal = new Error(
      `could not persist registry Issue #${registryIssue.number} — ${err.message}`,
      { cause: err },
    );
    fatal.code = "RONDO_REGISTRY_PERSIST_FAILED";
    throw fatal;
  }
}

async function findOrCreateRegistry({ gh, log, dryRun }) {
  const existing = await gh.listIssuesByLabel(REGISTRY_LABEL);
  if (existing.length > 0) {
    if (existing.some((issue) => !Number.isInteger(issue?.number) || issue.number < 1)) {
      throw new Error("registry lookup returned an Issue without a positive integer number");
    }
    const candidates = [...existing].sort((left, right) => {
      return left.number - right.number;
    });
    const selected = candidates[0];
    if (existing.length > 1) {
      log(
        `[warn] found ${existing.length} issues with label '${REGISTRY_LABEL}' — ` +
        `deterministically using oldest #${selected.number}`,
      );
    }
    return selected;
  }
  if (dryRun) {
    log(`[dry-run] would create registry Issue with label '${REGISTRY_LABEL}'`);
    return null;
  }
  log(`[info] no registry Issue found — creating one`);
  const created = await gh.createIssue({
    title: REGISTRY_TITLE,
    body: renderRegistry({ mapping: Object.create(null), tickets: [], openPRs: [] }),
    labels: [REGISTRY_LABEL],
  });
  if (!Number.isInteger(created?.number) || created.number < 1) {
    throw new Error("registry creation returned an Issue without a positive integer number");
  }
  return created;
}

async function scanTickets(ticketsDir, log) {
  let entries;
  try {
    entries = await readdir(ticketsDir);
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  const out = [];
  for (const name of entries) {
    if (extname(name) !== ".md") continue;
    const slug = basename(name, ".md");
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) {
      log(`[warn] skipping ${name}: slug doesn't match SPEC §3.1`);
      continue;
    }
    const raw = await readFile(join(ticketsDir, name), "utf8");
    const { frontmatter, body } = parseFrontmatter(raw);
    const title = (body.match(/^#\s+(.+?)\s*$/m) || [])[1] ?? slug;
    out.push({
      slug,
      frontmatter,
      body,
      raw,
      title,
      path: join(ticketsDir, name),
    });
  }
  return out;
}
