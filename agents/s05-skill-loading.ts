#!/usr/bin/env npx tsx
// Harness: skill loading -- domain knowledge loaded on demand, not upfront.
/**
 * s05-skill-loading.ts - Skill Loading
 *
 * Scans skills/{*}/SKILL.md, parses YAML frontmatter, injects metadata into
 * the system prompt. Full skill body loaded on demand via load_skill tool.
 *
 *     skills/
 *       agent-builder/SKILL.md   <-- frontmatter: name, description, triggers
 *       code-review/SKILL.md
 *       mcp-builder/SKILL.md
 *       pdf/SKILL.md
 *
 *     Layer 1: skill metadata in system prompt (always present)
 *     Layer 2: full skill body returned by load_skill (on demand)
 *
 * Key insight: "Don't stuff large instructions into the initial prompt."
 *
 * Ref: .reference/agents/s05_skill_loading.py
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { parse as parseYaml } from "yaml";
import "dotenv/config";

const WORKDIR = process.cwd();
const SKILLS_DIR = path.join(WORKDIR, "skills");
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});
const MODEL = process.env.MODEL_ID ?? "claude-sonnet-4-6";

// -- Types --
interface SkillMeta {
  name: string;
  description: string;
  triggers?: string[];
  filePath: string;
}

// -- Skill loader --
function discoverSkills(): SkillMeta[] {
  // TODO: glob skills/**/SKILL.md，解析 YAML frontmatter（--- ... --- 块）
  // 返回包含 name, description, triggers, filePath 的数组
  return [];
}

function loadSkillBody(name: string, skills: SkillMeta[]): string {
  // TODO: 根据技能名称找到对应的 SKILL.md，返回完整内容（不含 frontmatter）
  throw new Error("TODO: implement loadSkillBody");
}

function buildSystemPrompt(skills: SkillMeta[]): string {
  // TODO: 将技能元数据注入 system prompt
  // 格式: "You are a coding agent... Available skills:\n- name: description [triggers: ...]"
  throw new Error("TODO: implement buildSystemPrompt");
}

// -- Base tool implementations (same as s02) --
function safePath(p: string): string {
  throw new Error("TODO: implement safePath");
}
function runBash(command: string): string {
  throw new Error("TODO: implement runBash");
}
function runRead(filePath: string, limit?: number): string {
  throw new Error("TODO: implement runRead");
}
function runWrite(filePath: string, content: string): string {
  throw new Error("TODO: implement runWrite");
}
function runEdit(filePath: string, oldText: string, newText: string): string {
  throw new Error("TODO: implement runEdit");
}

const LOAD_SKILL_TOOL: Anthropic.Tool = {
  name: "load_skill",
  description: "Load full instructions for a specific skill by name.",
  input_schema: {
    type: "object",
    properties: { name: { type: "string", description: "Skill name to load." } },
    required: ["name"],
  },
};

const BASE_TOOLS: Anthropic.Tool[] = [
  {
    name: "bash",
    description: "Run a shell command.",
    input_schema: {
      type: "object",
      properties: { command: { type: "string" } },
      required: ["command"],
    },
  },
  {
    name: "read_file",
    description: "Read file contents.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" }, limit: { type: "integer" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to file.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description: "Replace exact text in file.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_text: { type: "string" },
        new_text: { type: "string" },
      },
      required: ["path", "old_text", "new_text"],
    },
  },
];

// -- Agent loop --
async function agentLoop(
  messages: Anthropic.MessageParam[],
  system: string,
  skills: SkillMeta[]
): Promise<void> {
  // TODO: 与 s02 相同，但工具列表包含 LOAD_SKILL_TOOL
  // 当调用 load_skill 时，调用 loadSkillBody(name, skills)
  throw new Error("TODO: implement agentLoop");
}

// -- REPL --
async function main() {
  const skills = discoverSkills();
  const system = buildSystemPrompt(skills);
  const rl = readline.createInterface({ input, output });
  const history: Anthropic.MessageParam[] = [];

  console.log(`s05 skill loading. Loaded ${skills.length} skills. Type "q" to quit.`);

  while (true) {
    let query: string;
    try {
      query = await rl.question("\x1b[36ms05 >> \x1b[0m");
    } catch {
      break;
    }
    if (!query.trim() || ["q", "exit"].includes(query.trim().toLowerCase())) break;
    history.push({ role: "user", content: query });
    await agentLoop(history, system, skills);
    const last = history[history.length - 1];
    if (Array.isArray(last.content)) {
      for (const block of last.content) {
        if (block.type === "text") console.log(block.text);
      }
    }
    console.log();
  }

  rl.close();
}

main().catch(console.error);
