#!/usr/bin/env npx tsx
// Harness: background execution -- the model thinks while the harness waits.
/**
 * s08-background-tasks.ts - Background Tasks
 *
 * Ref: .reference/agents/s08_background_tasks.py
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ToolInput } from "../src/types/agent.js";
import { runBash, runRead, runWrite, runEdit } from "../src/tools/base-tools.js";
import { BackgroundManager } from "../src/managers/background.js";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import "dotenv/config";

const WORKDIR = process.cwd();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL });
const MODEL = process.env.MODEL_ID ?? "claude-sonnet-4-6";
const SYSTEM = `You are a coding agent at ${WORKDIR}. Use background_run for long-running commands.`;

const BG = new BackgroundManager();

const TOOL_HANDLERS: Record<string, (i: ToolInput) => string> = {
  bash: (i) => runBash(i["command"] as string),
  read_file: (i) => runRead(i["path"] as string, i["limit"] as number | undefined),
  write_file: (i) => runWrite(i["path"] as string, i["content"] as string),
  edit_file: (i) => runEdit(i["path"] as string, i["old_text"] as string, i["new_text"] as string),
  background_run: (i) => BG.run(i["command"] as string),
  check_background: (i) => BG.check(i["task_id"] as string | undefined),
};

const TOOLS: Anthropic.Tool[] = [
  { name: "bash", description: "Run a shell command (blocking).", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "read_file", description: "Read file contents.", input_schema: { type: "object", properties: { path: { type: "string" }, limit: { type: "integer" } }, required: ["path"] } },
  { name: "write_file", description: "Write content to file.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "edit_file", description: "Replace exact text in file.", input_schema: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] } },
  { name: "background_run", description: "Run command in background. Returns task_id immediately.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "check_background", description: "Check background task status. Omit task_id to list all.", input_schema: { type: "object", properties: { task_id: { type: "string" } } } },
];

async function agentLoop(messages: Anthropic.MessageParam[]): Promise<void> {
  while (true) {
    // Drain background notifications before each LLM call
    const notifs = BG.drainNotifications();
    if (notifs.length > 0 && messages.length > 0) {
      const notifText = notifs.map((n) => `[bg:${n.taskId}] ${n.status}: ${n.result}`).join("\n");
      messages.push({ role: "user", content: `<background-results>\n${notifText}\n</background-results>` });
    }

    const response = await client.messages.create({ model: MODEL, system: SYSTEM, messages, tools: TOOLS, max_tokens: 8000 });
    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason !== "tool_use") return;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const handler = TOOL_HANDLERS[block.name];
        let out: string;
        try { out = handler ? handler(block.input as ToolInput) : `Unknown tool: ${block.name}`; }
        catch (e) { out = `Error: ${(e as Error).message}`; }
        console.log(`> ${block.name}:`);
        console.log(out.slice(0, 200));
        results.push({ type: "tool_result", tool_use_id: block.id, content: out });
      }
    }
    messages.push({ role: "user", content: results });
  }
}

async function main() {
  const rl = readline.createInterface({ input, output });
  const history: Anthropic.MessageParam[] = [];
  console.log('s08 background tasks. Type "q" or "exit" to quit.');
  while (true) {
    let query: string;
    try { query = await rl.question("\x1b[36ms08 >> \x1b[0m"); } catch { break; }
    if (!query.trim() || ["q", "exit"].includes(query.trim().toLowerCase())) break;
    history.push({ role: "user", content: query });
    await agentLoop(history);
    const last = history[history.length - 1];
    if (Array.isArray(last.content)) for (const b of last.content) if (b.type === "text") console.log(b.text);
    console.log();
  }
  rl.close();
}

main().catch(console.error);
