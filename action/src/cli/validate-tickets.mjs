#!/usr/bin/env node
// Rondo ticket validator — CI gate per SPEC.md §3.
// Usage: node validate-tickets.mjs <ticketsDir>
// Exit 0 if all tickets parse and match schemas/ticket.schema.json.
// Exit 1 if any ticket is invalid. Exit 2 on IO/setup errors.

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../lib/frontmatter.mjs";

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
  return errors;
}

function main(argv) {
  const ticketsDir = resolve(argv[2] || "tickets");
  let files;
  try {
    files = readdirSync(ticketsDir)
      .filter((f) => f.endsWith(".md"))
      .sort();
  } catch (e) {
    console.error(`rondo-validate: cannot read ${ticketsDir}: ${e.message}`);
    return 2;
  }
  if (files.length === 0) {
    console.log(`rondo-validate: no tickets in ${ticketsDir} — nothing to validate.`);
    return 0;
  }
  const schema = loadSchema();
  let failed = 0;
  for (const filename of files) {
    const content = readFileSync(join(ticketsDir, filename), "utf8");
    const errors = validateTicketFile(filename, content, schema);
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
