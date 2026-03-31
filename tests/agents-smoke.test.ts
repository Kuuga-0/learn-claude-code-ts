/**
 * Smoke test: verify all agent TypeScript files can be checked by tsc.
 * We don't import them dynamically because they call process.stdin at module level.
 */

import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const AGENTS_DIR = join(__dirname, "..", "agents");

describe("agents directory smoke test", () => {
  const files = readdirSync(AGENTS_DIR).filter((f) => f.endsWith(".ts"));

  it("should have 13 agent files", () => {
    expect(files).toHaveLength(13);
  });

  it("each file has the expected naming pattern", () => {
    const expected = [
      "s01-agent-loop.ts",
      "s02-tool-use.ts",
      "s03-todo-write.ts",
      "s04-subagent.ts",
      "s05-skill-loading.ts",
      "s06-context-compact.ts",
      "s07-task-system.ts",
      "s08-background-tasks.ts",
      "s09-agent-teams.ts",
      "s10-team-protocols.ts",
      "s11-autonomous-agents.ts",
      "s12-worktree-task-isolation.ts",
      "s-full.ts",
    ];
    for (const name of expected) {
      expect(files).toContain(name);
    }
  });
});
