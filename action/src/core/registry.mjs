// Single Issue that maps slug → branchName for every ticket the runner has
// ever dispatched. Per SPEC.md §6.
//
// Why persist it: some agent backends (notably Cursor) generate their own
// branch names at dispatch time. Without a registry, the next cycle would
// not know which branch to check for an open PR. With the registry, a simple
// `slug → branch` lookup is enough. The runner rewrites the whole body every
// cycle from current reality (tickets on disk + open PRs + this cycle's
// dispatches), so there is no state machine to keep in sync.

import { isEligible } from "./eligibility.mjs";
import { assertValidBranchName } from "../lib/validation.mjs";

export const REGISTRY_LABEL = "rondo-registry";
export const REGISTRY_TITLE = "[Rondo] Ticket registry";
const MARKER_START = "<!-- rondo-registry";
const MARKER_END = "-->";

function emptyMapping() {
  // Ticket slugs such as "constructor" are valid. A null-prototype object
  // prevents inherited object properties from being mistaken for mappings and
  // makes registry parsing resistant to prototype-polluting keys.
  return Object.create(null);
}

function mappedBranch(mapping, slug) {
  if (!mapping || !Object.hasOwn(mapping, slug)) return undefined;
  const branch = mapping[slug];
  return typeof branch === "string" && branch.trim() === branch && branch.length > 0
    ? branch
    : undefined;
}

/**
 * Extract the `slug → branchName` mapping from an Issue body.
 * Non-strict mode returns an empty null-prototype mapping if the marker is
 * missing or malformed, which is useful for tolerant tooling. The runner uses
 * strict mode and fails closed: falling back to a conventional branch could
 * duplicate work already running on a backend-generated branch.
 *
 * @param {string} body
 * @param {{strict?: boolean}} [options]
 * @returns {Record<string, string>}
 */
export function parseRegistry(body, { strict = false } = {}) {
  const invalid = (message) => {
    if (strict) throw new Error(`Invalid Rondo registry: ${message}`);
    return emptyMapping();
  };

  if (!body) return invalid("Issue body is empty");
  const start = body.indexOf(MARKER_START);
  if (start < 0) return invalid("machine-readable marker is missing");
  const end = body.indexOf(MARKER_END, start + MARKER_START.length);
  if (end < 0) return invalid("closing marker is missing");
  const payload = body.slice(start + MARKER_START.length, end).trim();
  if (!payload) return invalid("JSON payload is empty");
  try {
    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return invalid("JSON payload must be an object");
    }
    const out = emptyMapping();
    for (const [slug, branch] of Object.entries(parsed)) {
      if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) {
        if (strict) throw new Error(`Invalid Rondo registry: invalid ticket slug ${JSON.stringify(slug)}`);
        continue;
      }
      if (
        typeof branch !== "string" ||
        branch.trim().length === 0 ||
        branch.trim() !== branch ||
        /[\u0000-\u001f\u007f]/.test(branch)
      ) {
        if (strict) {
          throw new Error(
            `Invalid Rondo registry: branch for ${JSON.stringify(slug)} must be a trimmed non-empty string without control characters`,
          );
        }
        continue;
      }
      try {
        assertValidBranchName(branch, `registry branch for ${slug}`);
      } catch (error) {
        if (strict) {
          throw new Error(
            `Invalid Rondo registry: invalid Git branch for ${JSON.stringify(slug)} (${error.message})`,
            { cause: error },
          );
        }
        continue;
      }
      out[slug] = branch;
    }
    return out;
  } catch (err) {
    if (strict && err.message.startsWith("Invalid Rondo registry:")) throw err;
    return invalid(`malformed JSON (${err.message})`);
  }
}

/**
 * Render the full Issue body: a machine-readable JSON marker + a human-readable
 * table. The runner overwrites the Issue body with this on every cycle.
 *
 * @param {object} params
 * @param {Record<string, string>} params.mapping       slug → branchName
 * @param {Array<{slug: string, frontmatter: object}>} params.tickets  For the human table.
 * @param {Array<{branchName: string, number: number}>} params.openPRs
 * @param {Date} [params.now]
 * @param {string} [params.today] ISO date used by the eligibility predicate.
 * @param {string[]} [params.existingTicketSlugs]
 * @param {string[]} [params.acceptedModels]
 * @param {string} [params.branchPrefix]
 * @param {Iterable<string>} [params.dispatchedSlugs] Tickets launched during the current cycle.
 * @returns {string}
 */
export function renderRegistry({
  mapping,
  tickets,
  openPRs,
  now = new Date(),
  today = now.toISOString().slice(0, 10),
  existingTicketSlugs = tickets.map((ticket) => ticket.slug),
  acceptedModels,
  branchPrefix = "rondo/",
  dispatchedSlugs = [],
}) {
  const dispatchedSet = dispatchedSlugs instanceof Set ? dispatchedSlugs : new Set(dispatchedSlugs);
  const sortedSlugs = Object.keys(mapping).sort();
  const sortedMapping = emptyMapping();
  for (const slug of sortedSlugs) sortedMapping[slug] = mapping[slug];
  const marker = `${MARKER_START}\n${JSON.stringify(sortedMapping, null, 2)}\n${MARKER_END}`;

  const header = [
    `# Rondo — ticket registry`,
    ``,
    `Updated ${now.toISOString()}. The runner rewrites this body at the end of every cycle. Do not edit by hand — humans edit the ticket \`.md\` files, the runner mirrors the resulting reality here.`,
    ``,
  ].join("\n");

  if (tickets.length === 0) {
    return `${marker}\n\n${header}\n_No tickets on the queue._\n`;
  }

  const rows = tickets.map((t) => {
    const recordedBranch = mappedBranch(mapping, t.slug);
    const effectiveBranch = recordedBranch ?? `${branchPrefix}${t.slug}`;
    const state = describeState({
      ticket: t,
      branchName: effectiveBranch,
      existingTicketSlugs,
      openPRs,
      today,
      acceptedModels,
      dispatched: dispatchedSet.has(t.slug),
    });
    return `| ${codeCell(t.slug)} | ${codeCell(recordedBranch ?? "—")} | ${tableText(state)} |`;
  });

  return [
    marker,
    ``,
    header,
    `| Ticket | Branch | State |`,
    `|---|---|---|`,
    ...rows,
    ``,
  ].join("\n");
}

function tableText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("|", "&#124;");
}

function codeCell(value) {
  return `<code>${tableText(value)}</code>`;
}

function describeState({
  ticket,
  branchName,
  existingTicketSlugs,
  openPRs,
  today,
  acceptedModels,
  dispatched,
}) {
  const verdict = isEligible({
    ticket,
    existingTicketSlugs,
    openPRs,
    today,
    branchName,
    acceptedModels,
  });

  if (verdict.eligible) return dispatched ? "dispatched (awaiting PR)" : "eligible";
  if (verdict.reason === "paused_indefinitely") return "paused (indefinitely)";
  if (verdict.reason.startsWith("paused_until:")) {
    return `paused (until ${verdict.reason.slice("paused_until:".length)})`;
  }
  if (verdict.reason.startsWith("depends_on:")) {
    return `blocked-by: ${verdict.reason.slice("depends_on:".length)}`;
  }
  if (verdict.reason === "open_pr_exists") {
    const openPR = openPRs.find((pr) => pr.branchName === branchName);
    return openPR?.number === undefined ? "pr-open" : `pr-open (#${openPR.number})`;
  }
  if (verdict.reason.startsWith("unknown_model:")) {
    return `unknown-model: ${verdict.reason.slice("unknown_model:".length)}`;
  }
  return "invalid-frontmatter";
}
