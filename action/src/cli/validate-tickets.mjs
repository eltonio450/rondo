#!/usr/bin/env node
// Rondo ticket validator — CI gate per SPEC.md §3.
// Usage: node validate-tickets.mjs <ticketsDir>
// Exit 0 if all tickets parse and match schemas/ticket.schema.json.
// Exit 1 if any ticket is invalid. Exit 2 on IO/setup errors.

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isIsoCalendarDate, parseFrontmatter } from "../lib/frontmatter.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SLUG_FILE_RE = /^[a-z0-9][a-z0-9-]{0,62}\.md$/;

let cachedSchema = null;
function loadSchema() {
  if (cachedSchema) return cachedSchema;
  const schemaPath = resolve(__dirname, "../../../schemas/ticket.schema.json");
  cachedSchema = JSON.parse(readFileSync(schemaPath, "utf8"));
  return cachedSchema;
}

function validateValue(value, schema, path) {
  const errors = [];
  if (schema.oneOf) {
    const matched = schema.oneOf.some(
      (alt) => validateValue(value, alt, path).length === 0,
    );
    if (!matched) errors.push(`${path}: does not match any allowed shape`);
    return errors;
  }
  if (schema.type === "string" && typeof value !== "string") {
    errors.push(`${path}: expected string, got ${typeof value}`);
    return errors;
  }
  if (schema.type === "integer" && !Number.isInteger(value)) {
    errors.push(`${path}: expected integer, got ${typeof value}`);
    return errors;
  }
  if (schema.type === "boolean" && typeof value !== "boolean") {
    errors.push(`${path}: expected boolean, got ${typeof value}`);
    return errors;
  }
  if ("const" in schema && value !== schema.const) {
    errors.push(`${path}: expected ${JSON.stringify(schema.const)}`);
  }
  if (schema.pattern && typeof value === "string") {
    if (!new RegExp(schema.pattern).test(value)) {
      errors.push(`${path}: does not match /${schema.pattern}/`);
    }
  }
  if (schema.format === "date" && typeof value === "string" && !isIsoCalendarDate(value)) {
    errors.push(`${path}: must be a real calendar date in YYYY-MM-DD form`);
  }
  if ("minimum" in schema && typeof value === "number" && value < schema.minimum) {
    errors.push(`${path}: must be >= ${schema.minimum}`);
  }
  if ("maximum" in schema && typeof value === "number" && value > schema.maximum) {
    errors.push(`${path}: must be <= ${schema.maximum}`);
  }
  if (
    "minLength" in schema &&
    typeof value === "string" &&
    value.length < schema.minLength
  ) {
    errors.push(`${path}: must be at least ${schema.minLength} char(s)`);
  }
  return errors;
}

function validateFrontmatter(fm, schema) {
  const errors = [];
  for (const key of schema.required || []) {
    if (!(key in fm)) errors.push(`missing required key \`${key}\``);
  }
  for (const [key, value] of Object.entries(fm)) {
    const propSchema = schema.properties?.[key];
    if (!propSchema) continue;
    errors.push(...validateValue(value, propSchema, key));
  }
  return errors;
}

export function validateTicketFile(filename, content, schema = loadSchema()) {
  const errors = [];
  if (!SLUG_FILE_RE.test(filename)) {
    errors.push(
      `filename \`${filename}\` does not match /^[a-z0-9][a-z0-9-]{0,62}\\.md$/`,
    );
  }
  const { frontmatter } = parseFrontmatter(content);
  errors.push(...validateFrontmatter(frontmatter, schema));
  if (SLUG_FILE_RE.test(filename) && typeof frontmatter.depends === "string") {
    const slug = filename.slice(0, -3);
    if (dependencySlugs(frontmatter.depends).includes(slug)) {
      errors.push(`depends: ticket \`${slug}\` cannot depend on itself`);
    }
  }
  return errors;
}

function dependencySlugs(depends) {
  return depends
    .split(",")
    .map((value) => value.trim().replace(/\.md$/, ""))
    .filter(Boolean);
}

/**
 * Validate a complete queue, including graph constraints that cannot be
 * checked one file at a time.
 *
 * @param {Array<{filename: string, content: string}>} ticketFiles
 * @returns {Array<{filename: string, errors: string[]}>}
 */
export function validateTicketSet(ticketFiles, schema = loadSchema()) {
  const results = ticketFiles.map(({ filename, content }) => ({
    filename,
    errors: validateTicketFile(filename, content, schema),
  }));
  const resultByFilename = new Map(results.map((result) => [result.filename, result]));
  const nodes = new Map();

  for (const { filename, content } of ticketFiles) {
    if (!SLUG_FILE_RE.test(filename)) continue;
    const slug = filename.slice(0, -3);
    const { frontmatter } = parseFrontmatter(content);
    const dependencies =
      typeof frontmatter.depends === "string" ? dependencySlugs(frontmatter.depends) : [];
    nodes.set(slug, { filename, dependencies });
  }

  // Tarjan strongly-connected components. An SCC with more than one ticket is
  // a dependency cycle and can never become eligible under delete-to-complete
  // semantics. Self-dependencies are reported by validateTicketFile above.
  let nextIndex = 0;
  const indexes = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];

  function visit(slug) {
    indexes.set(slug, nextIndex);
    lowLinks.set(slug, nextIndex);
    nextIndex += 1;
    stack.push(slug);
    onStack.add(slug);

    for (const dependency of nodes.get(slug).dependencies) {
      if (dependency === slug || !nodes.has(dependency)) continue;
      if (!indexes.has(dependency)) {
        visit(dependency);
        lowLinks.set(slug, Math.min(lowLinks.get(slug), lowLinks.get(dependency)));
      } else if (onStack.has(dependency)) {
        lowLinks.set(slug, Math.min(lowLinks.get(slug), indexes.get(dependency)));
      }
    }

    if (lowLinks.get(slug) !== indexes.get(slug)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== slug);
    components.push(component);
  }

  for (const slug of [...nodes.keys()].sort()) {
    if (!indexes.has(slug)) visit(slug);
  }

  for (const component of components.filter((members) => members.length > 1)) {
    const members = component.sort();
    const message = `depends: dependency cycle detected among: ${members.join(", ")}`;
    for (const slug of members) {
      resultByFilename.get(nodes.get(slug).filename).errors.push(message);
    }
  }

  return results;
}

export function main(argv) {
  const ticketsDir = resolve(argv[2] || "tickets");
  let files;
  try {
    files = readdirSync(ticketsDir)
      .filter((f) => f.endsWith(".md"))
      .sort();
  } catch (e) {
    if (e.code === "ENOENT") {
      console.log(`rondo-validate: no tickets in ${ticketsDir} — nothing to validate.`);
      return 0;
    }
    console.error(`rondo-validate: cannot read ${ticketsDir}: ${e.message}`);
    return 2;
  }
  if (files.length === 0) {
    console.log(`rondo-validate: no tickets in ${ticketsDir} — nothing to validate.`);
    return 0;
  }
  const schema = loadSchema();
  let ticketFiles;
  try {
    ticketFiles = files.map((filename) => ({
      filename,
      content: readFileSync(join(ticketsDir, filename), "utf8"),
    }));
  } catch (e) {
    console.error(`rondo-validate: cannot read a ticket in ${ticketsDir}: ${e.message}`);
    return 2;
  }
  const results = validateTicketSet(ticketFiles, schema);
  let failed = 0;
  for (const { filename, errors } of results) {
    if (errors.length > 0) {
      failed++;
      console.error(`✗ ${filename}`);
      for (const e of errors) console.error(`  - ${e}`);
    } else {
      console.log(`✓ ${filename}`);
    }
  }
  if (failed > 0) {
    console.error(`\n${failed} of ${files.length} ticket(s) invalid`);
    return 1;
  }
  console.log(`\nAll ${files.length} ticket(s) valid`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv));
}
