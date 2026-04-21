// Ticket eligibility per SPEC.md §4.
// Pure function; no I/O. The caller gathers inputs and interprets the result.

/**
 * @param {object} params
 * @param {object} params.ticket               Parsed ticket with { slug, frontmatter }.
 * @param {string[]} params.existingTicketSlugs  Slugs currently present in <ticketsDir>.
 * @param {Array<{ branchName: string }>} params.openPRs  Open PRs in the repo, with their branch names.
 * @param {string} params.today                 ISO date `YYYY-MM-DD` used for paused-until comparisons.
 * @param {string} params.branchName            Branch the runner would check for an open PR
 *                                              (from the registry, or `<branchPrefix><slug>` default).
 * @param {string[]} [params.acceptedModels]    Models the runner accepts. `"default"` is always accepted;
 *                                              omit or pass an empty list to accept any model.
 * @returns {{ eligible: boolean, reason: string }}
 */
export function isEligible({
  ticket,
  existingTicketSlugs,
  openPRs,
  today,
  branchName,
  acceptedModels,
}) {
  const fm = ticket.frontmatter || {};

  if (!fm.owner || typeof fm.priority !== "number" || !fm.model) {
    return { eligible: false, reason: "invalid_frontmatter" };
  }

  if (acceptedModels && acceptedModels.length > 0 && fm.model !== "default" && !acceptedModels.includes(fm.model)) {
    return { eligible: false, reason: `unknown_model:${fm.model}` };
  }

  if (fm.paused !== undefined) {
    const paused = fm.paused;
    if (paused === true) {
      return { eligible: false, reason: "paused_indefinitely" };
    }
    if (typeof paused === "string" && /^\d{4}-\d{2}-\d{2}$/.test(paused)) {
      if (paused > today) {
        return { eligible: false, reason: `paused_until:${paused}` };
      }
      // paused <= today → treat as absent, fall through.
    } else {
      // Any other paused value (false, non-date string, number) is malformed
      // per SPEC §3.2 — the CI validator rejects it; stay aligned at runtime.
      return { eligible: false, reason: "invalid_frontmatter" };
    }
  }

  if (fm.depends) {
    const deps = String(fm.depends)
      .split(",")
      .map((s) => s.trim().replace(/\.md$/, ""))
      .filter(Boolean);
    const unresolved = deps.filter((d) => existingTicketSlugs.includes(d));
    if (unresolved.length > 0) {
      return { eligible: false, reason: `depends_on:${unresolved.join(",")}` };
    }
  }

  if (openPRs.some((pr) => pr.branchName === branchName)) {
    return { eligible: false, reason: "open_pr_exists" };
  }

  return { eligible: true, reason: "ok" };
}
