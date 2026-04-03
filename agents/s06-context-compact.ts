#!/usr/bin/env npx tsx
// Harness: compression -- clean memory for infinite sessions.
/**
 * s06-context-compact.ts - Compact
 *
 * Ref: .reference/agents/s06_context_compact.py
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ToolInput } from "../src/types/agent.js";
import { runBash, runRead, runWrite, runEdit } from "../src/tools/base-tools.js";
import { estimateTokens, microCompact, autoCompact } from "../src/managers/compact.js";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import * as path from "node:path";
import "dotenv/config";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});
const MODEL = process.env.MODEL_ID ?? "claude-sonnet-4-6";
const SYSTEM = `You are a coding agent at ${process.cwd()}. Use tools to solve tasks.`;
const THRESHOLD = 50_000;
const TRANSCRIPT_DIR = path.join(process.cwd(), ".transcripts");

const TOOL_HANDLERS: Record<string, (input: ToolInput) => string> = {
  bash: (i) => runBash(i.command as string),
  read_file: (i) => runRead(i.path as string, i.limit as number | undefined),
  write_file: (i) => runWrite(i.path as string, i.content as string),
  edit_file: (i) => runEdit(i.path as string, i.old_text as string, i.new_text as string),
  compact: () => "Manual compression requested.",
};

const TOOLS: Anthropic.Tool[] = [
  { name: "bash", description: "Run a shell command.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "read_file", description: "Read file contents.", input_schema: { type: "object", properties: { path: { type: "string" }, limit: { type: "integer" } }, required: ["path"] } },
  { name: "write_file", description: "Write content to file.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "edit_file", description: "Replace exact text in file.", input_schema: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] } },
  { name: "compact", description: "Trigger manual conversation compression.", input_schema: { type: "object", properties: { focus: { type: "string", description: "What to preserve in the summary" } } } },
];

async function agentLoop(messages: Anthropic.MessageParam[]): Promise<Anthropic.MessageParam[]> {
  while (true) {
    microCompact(messages);
    if (estimateTokens(messages) > THRESHOLD) {
      console.log("[auto_compact triggered]");
      messages = await autoCompact(messages, client, MODEL, TRANSCRIPT_DIR);
    }

    const response = await client.messages.create({ model: MODEL, system: SYSTEM, messages, tools: TOOLS, max_tokens: 8000 });
    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason !== "tool_use") return messages;

    const results: Anthropic.ToolResultBlockParam[] = [];
    let manualCompact = false;
    for (const block of response.content) {
      if (block.type === "tool_use") {
        let output: string;
        if (block.name === "compact") {
          manualCompact = true;
          output = "Compressing...";
        } else {
          const handler = TOOL_HANDLERS[block.name];
          try {
            output = handler ? handler(block.input as ToolInput) : `Unknown tool: ${block.name}`;
          } catch (e) {
            output = `Error: ${(e as Error).message}`;
          }
        }
        console.log(`> ${block.name}:`);
        console.log(output.slice(0, 200));
        results.push({ type: "tool_result", tool_use_id: block.id, content: output });
      }
    }
    messages.push({ role: "user", content: results });

    if (manualCompact) {
      console.log("[manual compact]");
      messages = await autoCompact(messages, client, MODEL, TRANSCRIPT_DIR);
      return messages;
    }
  }
}

async function main() {
  const rl = readline.createInterface({ input, output });
  let history: Anthropic.MessageParam[] = [];
  console.log('s06 context compact. Type "q" or "exit" to quit.');
  while (true) {
    let query: string;
    try { query = await rl.question("\x1b[36ms06 >> \x1b[0m"); } catch { break; }
    if (!query.trim() || ["q", "exit"].includes(query.trim().toLowerCase())) break;
    history.push({ role: "user", content: query });
    history = await agentLoop(history);
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
