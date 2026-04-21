// The main dispatch loop — environment-independent. It uses only the
// abstractions in ./eligibility.mjs, ./registry.mjs, ../lib/*, ../adapters/*;
// swapping the adapter requires no change to this file.

import { readdir, readFile } from "node:fs/promises";
import { join, basename, extname } from "node:path";

import { parseFrontmatter } from "../lib/frontmatter.mjs";
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
 * eligible ticket, rewrite the registry Issue.
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
  const prompt = await loadPrompt({ repoRoot });

  const tickets = await scanTickets(ticketsDir, log);
  const existingTicketSlugs = tickets.map((t) => t.slug);
  const openPRs = (await gh.listAllOpenPRs()).map((pr) => ({
    branchName: pr.head?.ref,
    number: pr.number,
  }));

  const registryIssue = await findOrCreateRegistry({ gh, log, dryRun });
  const mapping = parseRegistry(registryIssue?.body ?? "");

  // Sort by priority asc, then slug lex asc (SPEC §3.2 tie-break).
  tickets.sort((a, b) => {
    const pa = a.frontmatter.priority ?? 99;
    const pb = b.frontmatter.priority ?? 99;
    if (pa !== pb) return pa - pb;
    return a.slug.localeCompare(b.slug);
  });

  const dispatched = [];
  const skipped = [];
  const failed = [];

  for (const ticket of tickets) {
    const branchName = mapping[ticket.slug] ?? `${config.branchPrefix}${ticket.slug}`;

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
      });
      mapping[ticket.slug] = result.branchName;
      dispatched.push({ slug: ticket.slug, agentId: result.agentId, branchName: result.branchName });
      log(`[dispatched] ${ticket.slug} → ${result.agentId} on ${result.branchName}`);
    } catch (err) {
      log(`[fail] ${ticket.slug}: adapter dispatch failed — ${err.message}`);
      failed.push({ slug: ticket.slug, error: err.message });
    }
  }

  // Drop mapping entries whose ticket file no longer exists (output "Done").
  for (const slug of Object.keys(mapping)) {
    if (!existingTicketSlugs.includes(slug)) delete mapping[slug];
  }

  if (registryIssue && !dryRun) {
    const newBody = renderRegistry({ mapping, tickets, openPRs });
    try {
      await gh.updateIssueBody(registryIssue.number, newBody);
    } catch (err) {
      log(`[warn] could not update registry Issue #${registryIssue.number} — ${err.message}`);
    }
  }

  return { dispatched, skipped, failed };
}

async function findOrCreateRegistry({ gh, log, dryRun }) {
  const existing = await gh.listIssuesByLabel(REGISTRY_LABEL);
  if (existing.length > 0) {
    if (existing.length > 1) {
      log(`[warn] found ${existing.length} issues with label '${REGISTRY_LABEL}' — using #${existing[0].number}`);
    }
    return existing[0];
  }
  if (dryRun) {
    log(`[dry-run] would create registry Issue with label '${REGISTRY_LABEL}'`);
    return null;
  }
  log(`[info] no registry Issue found — creating one`);
  return gh.createIssue({
    title: REGISTRY_TITLE,
    body: renderRegistry({ mapping: {}, tickets: [], openPRs: [] }),
    labels: [REGISTRY_LABEL],
  });
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
    out.push({ slug, frontmatter, body, title, path: join(ticketsDir, name) });
  }
  return out;
}
