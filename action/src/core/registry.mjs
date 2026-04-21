// Single Issue that maps slug → branchName for every ticket the runner has
// ever dispatched. Per SPEC.md §6.
//
// Why persist it: some agent backends (notably Cursor) generate their own
// branch names at dispatch time. Without a registry, the next cycle would
// not know which branch to check for an open PR. With the registry, a simple
// `slug → branch` lookup is enough. The runner rewrites the whole body every
// cycle from current reality (tickets on disk + open PRs + this cycle's
// dispatches), so there is no state machine to keep in sync.

export const REGISTRY_LABEL = "rondo-registry";
export const REGISTRY_TITLE = "[Rondo] Ticket registry";
const MARKER_START = "<!-- rondo-registry";
const MARKER_END = "-->";

/**
 * Extract the `slug → branchName` mapping from an Issue body.
 * Returns {} if the marker is missing or the payload is malformed —
 * a malformed registry is harmless, the runner just re-derives branches
 * from `<branchPrefix><slug>` defaults on the next cycle.
 *
 * @param {string} body
 * @returns {Record<string, string>}
 */
export function parseRegistry(body) {
  if (!body) return {};
  const start = body.indexOf(MARKER_START);
  if (start < 0) return {};
  const end = body.indexOf(MARKER_END, start + MARKER_START.length);
  if (end < 0) return {};
  const payload = body.slice(start + MARKER_START.length, end).trim();
  if (!payload) return {};
  try {
    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out = {};
    for (const [slug, branch] of Object.entries(parsed)) {
      if (typeof branch === "string" && branch.length > 0) out[slug] = branch;
    }
    return out;
  } catch {
    return {};
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
 * @returns {string}
 */
export function renderRegistry({ mapping, tickets, openPRs, now = new Date() }) {
  const sortedSlugs = Object.keys(mapping).sort();
  const sortedMapping = {};
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
    const branchName = mapping[t.slug] ?? "—";
    const state = describeState({ ticket: t, branchName, openPRs });
    return `| \`${t.slug}\` | \`${branchName}\` | ${state} |`;
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

function describeState({ ticket, branchName, openPRs }) {
  const paused = ticket.frontmatter?.paused;
  if (paused === true) return "paused (indefinitely)";
  if (typeof paused === "string" && /^\d{4}-\d{2}-\d{2}$/.test(paused)) {
    return `paused (until ${paused})`;
  }
  const openPR = openPRs.find((pr) => pr.branchName === branchName);
  if (openPR) return `pr-open (#${openPR.number})`;
  if (ticket.frontmatter?.depends) return `blocked-by: ${ticket.frontmatter.depends}`;
  return "eligible";
}
