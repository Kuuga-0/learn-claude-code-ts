#!/usr/bin/env npx tsx
// Harness: context isolation -- noise that doesn't bleed back into the parent.
/**
 * s04-subagent.ts - Subagent
 *
 * Ref: .reference/agents/s04_subagent.py
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ToolInput } from "../src/types/agent.js";
import { runBash, runRead, runWrite, runEdit } from "../src/tools/base-tools.js";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import "dotenv/config";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});
const MODEL = process.env.MODEL_ID ?? "claude-sonnet-4-6";
const SYSTEM = `You are a coding agent at ${process.cwd()}. Use the task tool to delegate exploration or subtasks.`;
const SUBAGENT_SYSTEM = `You are a coding subagent at ${process.cwd()}. Complete the given task, then summarize your findings.`;

const BASE_HANDLERS: Record<string, (input: ToolInput) => string> = {
  bash: (i) => runBash(i.command as string),
  read_file: (i) => runRead(i.path as string, i.limit as number | undefined),
  write_file: (i) => runWrite(i.path as string, i.content as string),
  edit_file: (i) => runEdit(i.path as string, i.old_text as string, i.new_text as string),
};

const BASE_TOOLS: Anthropic.Tool[] = [
  { name: "bash", description: "Run a shell command.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "read_file", description: "Read file contents.", input_schema: { type: "object", properties: { path: { type: "string" }, limit: { type: "integer" } }, required: ["path"] } },
  { name: "write_file", description: "Write content to file.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "edit_file", description: "Replace exact text in file.", input_schema: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] } },
];

const TASK_TOOL: Anthropic.Tool = {
  name: "task",
  description: "Spawn a subagent with fresh context. It shares the filesystem but not conversation history.",
  input_schema: {
    type: "object",
    properties: {
      prompt: { type: "string" },
      description: { type: "string", description: "Short description of the task" },
    },
    required: ["prompt"],
  },
};

async function runSubagent(prompt: string): Promise<string> {
  const subMessages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  let response: Awaited<ReturnType<typeof client.messages.create>> | null = null;

  for (let i = 0; i < 30; i++) {
    response = await client.messages.create({
      model: MODEL,
      system: SUBAGENT_SYSTEM,
      messages: subMessages,
      tools: BASE_TOOLS,
      max_tokens: 8000,
    });

    subMessages.push({ role: "assistant", content: response.content });
    if (response.stop_reason !== "tool_use") break;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const handler = BASE_HANDLERS[block.name];
        const output = handler ? handler(block.input as ToolInput) : `Unknown tool: ${block.name}`;
        results.push({ type: "tool_result", tool_use_id: block.id, content: String(output).slice(0, 50_000) });
      }
    }
    subMessages.push({ role: "user", content: results });
  }

  if (!response) return "(no summary)";
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("") || "(no summary)";
}

async function agentLoop(messages: Anthropic.MessageParam[]): Promise<void> {
  while (true) {
    const response = await client.messages.create({
      model: MODEL,
      system: SYSTEM,
      messages,
      tools: [...BASE_TOOLS, TASK_TOOL],
      max_tokens: 8000,
    });

    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason !== "tool_use") return;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        let output: string;
        if (block.name === "task") {
          const description = String((block.input as ToolInput).description ?? "subtask");
          console.log(`> task (${description}): ${String((block.input as ToolInput).prompt ?? "").slice(0, 80)}`);
          output = await runSubagent(String((block.input as ToolInput).prompt ?? ""));
        } else {
          const handler = BASE_HANDLERS[block.name];
          output = handler ? handler(block.input as ToolInput) : `Unknown tool: ${block.name}`;
        }
        console.log(`  ${output.slice(0, 200)}`);
        results.push({ type: "tool_result", tool_use_id: block.id, content: output });
      }
    }

    messages.push({ role: "user", content: results });
  }
}

async function main() {
  const rl = readline.createInterface({ input, output });
  const history: Anthropic.MessageParam[] = [];
  console.log('s04 subagent. Type "q" or "exit" to quit.');
  while (true) {
    let query: string;
    try { query = await rl.question("\x1b[36ms04 >> \x1b[0m"); } catch { break; }
    if (!query.trim() || ["q", "exit"].includes(query.trim().toLowerCase())) break;
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
