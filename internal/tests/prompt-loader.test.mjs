import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

import { loadPrompt } from "../../action/src/lib/prompt-loader.mjs";

async function withTempRepo(run) {
  const repoRoot = await mkdtemp(join(tmpdir(), "rondo-prompt-test-"));
  try {
    return await run(repoRoot);
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
}

test("loadPrompt returns the bundled prompt when no override exists", async () => {
  await withTempRepo(async (repoRoot) => {
    const prompt = await loadPrompt({ repoRoot });
    assert.match(prompt, /^# Rondo agent prompt/m);
    assert.match(prompt, /`IDEMPOTENCY_KEY`/);
  });
});

test("loadPrompt prepends a partial host override", async () => {
  await withTempRepo(async (repoRoot) => {
    await writeFile(join(repoRoot, "rondo.prompt.md"), "# Team additions\n\nUse the local test harness.\n");
    const prompt = await loadPrompt({ repoRoot });
    assert.ok(prompt.startsWith("# Team additions\n\nUse the local test harness."));
    assert.match(prompt, /\n\n---\n\n# Rondo agent prompt/);
  });
});

test("loadPrompt treats the canonical first H1 as a full replacement", async () => {
  await withTempRepo(async (repoRoot) => {
    const override = "\uFEFF  \n# Rondo agent prompt — team edition\n\nReplacement body.\n";
    await writeFile(join(repoRoot, "rondo.prompt.md"), override);
    assert.equal(await loadPrompt({ repoRoot }), override);
  });
});

test("loadPrompt does not mistake a later canonical H1 for a full replacement", async () => {
  await withTempRepo(async (repoRoot) => {
    const override = "# Team preface\n\nThe default follows.\n\n# Rondo agent prompt\n";
    await writeFile(join(repoRoot, "rondo.prompt.md"), override);
    const prompt = await loadPrompt({ repoRoot });
    assert.equal(prompt.match(/# Rondo agent prompt/g)?.length, 2);
    assert.match(prompt, /^# Team preface/);
  });
});
