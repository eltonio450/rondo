// Loads the prompt passed to a dispatched agent.
//
// Convention-based override — zero config:
//   - Default:  the bundled `PROMPT.md` at the Rondo repo root.
//   - Override: if `./rondo.prompt.md` exists at the host repo root, it is used
//               instead of (or on top of) the bundled prompt.
//
// Behavior of the override file:
//   - If it starts with `# Rondo agent prompt` (same H1 as the bundled file),
//     treat it as a full replacement.
//   - Otherwise, treat it as a prepend — the host's additions come first,
//     then the bundled prompt verbatim, separated by an `---` rule.
//
// The filename is fixed and matches what INSTALL.md Brick 2 tells the agent to
// create — no `promptPath` indirection, no `rondo.config.json` lookup.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// action/src/lib/prompt-loader.mjs → repo root is three levels up.
const BUNDLED_PROMPT = join(__dirname, "..", "..", "..", "PROMPT.md");

const OVERRIDE_FILENAME = "rondo.prompt.md";
// Full-override mode is triggered only when the override file's FIRST
// non-empty line is the canonical H1. Anchored to the start of the file —
// not a multiline match — so an H1 mentioned anywhere below (e.g. in a
// "the Rondo default prompt follows" paragraph) does not flip the mode.
const FULL_OVERRIDE_H1 = "# Rondo agent prompt";

function isFullOverride(content) {
  const firstLine = content.replace(/^\uFEFF/, "").trimStart().split(/\r?\n/, 1)[0] ?? "";
  return firstLine.trim() === FULL_OVERRIDE_H1 || firstLine.trim().startsWith(FULL_OVERRIDE_H1 + " ");
}

export async function loadPrompt({ repoRoot }) {
  const base = await readFile(BUNDLED_PROMPT, "utf8");
  const overridePath = join(repoRoot, OVERRIDE_FILENAME);
  let override;
  try {
    override = await readFile(overridePath, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return base;
    throw err;
  }
  if (isFullOverride(override)) return override;
  return override.trimEnd() + "\n\n---\n\n" + base;
}
