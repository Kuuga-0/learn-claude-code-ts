#!/usr/bin/env npx tsx
// Harness: full cockpit -- all capabilities from s01-s11 combined.
/**
 * s-full.ts - Full Agent
 *
 * Combines all capabilities from s01 through s11:
 * - base tools (bash, read, write, edit)
 * - todo tracking
 * - subagent delegation
 * - skill loading
 * - context compaction
 * - persistent task system
 * - background tasks
 * - agent teams with shutdown + plan approval protocols
 * - autonomous teammates
 *
 * REPL slash commands:
 *   /compact   - manually compact history
 *   /tasks     - list all tasks
 *   /team      - list all teammates
 *   /inbox     - read lead's inbox
 *
 * Note: worktree isolation (s12) is intentionally kept separate.
 *
 * Ref: .reference/agents/s_full.py
 */

import Anthropic from "@anthropic-ai/sdk";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import "dotenv/config";

const WORKDIR = process.cwd();
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});
const MODEL = process.env.MODEL_ID ?? "claude-sonnet-4-6";
const SYSTEM = `You are a full-capability coding agent at ${WORKDIR}.
You have access to all tools: bash, file operations, todos, tasks, subagents, skills, context compaction, background tasks, and team management.
Plan before acting. Use todos for short-term tracking, tasks for durable state.`;

// -- Compose all managers here --
// TODO: 复用 s03 的 TodoManager
// TODO: 复用 s04 的 runSubagent
// TODO: 复用 s05 的 SkillLoader + discoverSkills
// TODO: 复用 s06 的 microCompact / autoCompact / estimateTokens
// TODO: 复用 s07 的 TaskManager
// TODO: 复用 s08 的 BackgroundManager
// TODO: 复用 s09+s10+s11 的 MessageBus / TeammateManager

// -- Tool implementations (full set) --
// TODO: 实现所有工具处理器

const TOOLS: Anthropic.Tool[] = [
  // Base tools
  { name: "bash", description: "Run a shell command.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "read_file", description: "Read file contents.", input_schema: { type: "object", properties: { path: { type: "string" }, limit: { type: "integer" } }, required: ["path"] } },
  { name: "write_file", description: "Write content to file.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "edit_file", description: "Replace exact text in file.", input_schema: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] } },
  // Todo
  { name: "todo", description: "Update task list.", input_schema: { type: "object", properties: { items: { type: "array", items: { type: "object" } } }, required: ["items"] } },
  // Subagent
  { name: "task", description: "Delegate subtask to subagent.", input_schema: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] } },
  // Skill loading
  { name: "load_skill", description: "Load full instructions for a skill.", input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  // Context compaction
  { name: "compact", description: "Compact conversation history.", input_schema: { type: "object", properties: { mode: { type: "string", enum: ["micro", "auto"] } } } },
  // Task system
  { name: "task_create", description: "Create a new task.", input_schema: { type: "object", properties: { subject: { type: "string" }, description: { type: "string" } }, required: ["subject"] } },
  { name: "task_update", description: "Update task status.", input_schema: { type: "object", properties: { task_id: { type: "integer" }, status: { type: "string" } }, required: ["task_id"] } },
  { name: "task_list", description: "List all tasks.", input_schema: { type: "object", properties: {} } },
  { name: "task_get", description: "Get task details.", input_schema: { type: "object", properties: { task_id: { type: "integer" } }, required: ["task_id"] } },
  // Background tasks
  { name: "background_run", description: "Run command in background.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "check_background", description: "Check background task status.", input_schema: { type: "object", properties: { task_id: { type: "string" } } } },
  // Team management
  { name: "spawn_teammate", description: "Spawn a persistent named agent.", input_schema: { type: "object", properties: { name: { type: "string" }, role: { type: "string" }, prompt: { type: "string" } }, required: ["name", "role", "prompt"] } },
  { name: "shutdown_request", description: "Request a teammate to shut down.", input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "plan_approval", description: "Submit or approve/reject a plan.", input_schema: { type: "object", properties: { action: { type: "string" }, plan: { type: "string" }, request_id: { type: "string" }, approve: { type: "boolean" } }, required: ["action"] } },
  { name: "send_message", description: "Send message to a teammate.", input_schema: { type: "object", properties: { to: { type: "string" }, content: { type: "string" }, msg_type: { type: "string" } }, required: ["to", "content"] } },
  { name: "read_inbox", description: "Read and drain your inbox.", input_schema: { type: "object", properties: {} } },
  { name: "broadcast", description: "Send message to all teammates.", input_schema: { type: "object", properties: { content: { type: "string" } }, required: ["content"] } },
  { name: "list_teammates", description: "List all teammates.", input_schema: { type: "object", properties: {} } },
];

async function agentLoop(messages: Anthropic.MessageParam[]): Promise<void> {
  // TODO: 完整 agent 循环，支持所有工具
  throw new Error("TODO: implement agentLoop");
}

// -- REPL --
async function main() {
  const rl = readline.createInterface({ input, output });
  const history: Anthropic.MessageParam[] = [];

  console.log('Full agent. Slash commands: /compact /tasks /team /inbox. Type "q" to quit.');

  while (true) {
    let query: string;
    try {
      query = await rl.question("\x1b[36mfull >> \x1b[0m");
    } catch {
      break;
    }
    if (!query.trim() || ["q", "exit"].includes(query.trim().toLowerCase())) break;

    // Slash commands
    if (query.startsWith("/")) {
      // TODO: 实现 /compact /tasks /team /inbox 命令
      console.log("TODO: slash commands not yet implemented");
      continue;
    }

    history.push({ role: "user", content: query });
    await agentLoop(history);
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
