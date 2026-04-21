// Frontmatter parser/serializer per SPEC.md §3.2.
// Keys are parsed line by line until the first blank line or the first line
// that does not match ^[a-z_]+:\s*.+$. No YAML fences. Unknown keys are preserved.

const KEY_RE = /^([a-z_]+):\s*(.+)$/;

export function parseFrontmatter(content) {
  const lines = content.split(/\r?\n/);
  const frontmatter = {};
  const order = [];
  let i = 0;
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") break;
    const m = line.match(KEY_RE);
    if (!m) break;
    const [, key, rawValue] = m;
    frontmatter[key] = coerce(rawValue.trim());
    order.push(key);
  }
  // Skip the blank line separating frontmatter from body, if present.
  const bodyStart = lines[i] !== undefined && lines[i].trim() === "" ? i + 1 : i;
  return {
    frontmatter,
    order,
    body: lines.slice(bodyStart).join("\n"),
  };
}

export function serializeFrontmatter({ frontmatter, order, body }) {
  const keys = order && order.length > 0 ? order : Object.keys(frontmatter);
  const seen = new Set();
  const lines = [];
  for (const key of keys) {
    if (seen.has(key)) continue;
    if (!(key in frontmatter)) continue;
    seen.add(key);
    lines.push(`${key}: ${stringify(frontmatter[key])}`);
  }
  // Append any keys not in the order array (new keys added by the agent).
  for (const key of Object.keys(frontmatter)) {
    if (seen.has(key)) continue;
    lines.push(`${key}: ${stringify(frontmatter[key])}`);
  }
  const prefix = lines.join("\n");
  if (!body) return prefix + "\n";
  return prefix + "\n\n" + body;
}

function coerce(raw) {
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (/^-?\d+$/.test(raw)) return parseInt(raw, 10);
  return raw;
}

function stringify(value) {
  if (value === true) return "true";
  if (value === false) return "false";
  return String(value);
}
