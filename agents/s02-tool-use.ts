#!/usr/bin/env npx tsx
// Harness: tool dispatch -- expanding what the model can reach.
/**
 * s02-tool-use.ts - Tools
 *
 * The agent loop from s01 didn't change. We just added tools to the array
 * and a dispatch map to route calls.
 *
 *     +----------+      +-------+      +------------------+
 *     |   User   | ---> |  LLM  | ---> | Tool Dispatch    |
 *     |  prompt  |      |       |      | {                |
 *     +----------+      +---+---+      |   bash: runBash  |
 *                           ^          |   read: runRead  |
 *                           |          |   write: runWrite|
 *                           +----------+   edit: runEdit  |
 *                           tool_result| }                |
 *                                      +------------------+
 *
 * Key insight: "The loop didn't change at all. I just added tools."
 *
 * Ref: .reference/agents/s02_tool_use.py
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import "dotenv/config";

const WORKDIR = process.cwd();
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});
const MODEL = process.env.MODEL_ID ?? "claude-sonnet-4-6";
const SYSTEM = `You are a coding agent at ${WORKDIR}. Use tools to solve tasks. Act, don't explain.`;

// -- Path safety guard --
function safePath(p: string): string {
  // TODO: 实现路径安全检查，防止逃逸工作目录
  throw new Error("TODO: implement safePath");
}

// -- Tool implementations --
function runBash(command: string): string {
  // TODO: 实现危险命令检测和子进程执行（同 s01）
  throw new Error("TODO: implement runBash");
}

function runRead(filePath: string, limit?: number): string {
  // TODO: 读取文件内容，支持行数限制
  throw new Error("TODO: implement runRead");
}

function runWrite(filePath: string, content: string): string {
  // TODO: 写入文件，自动创建父目录
  throw new Error("TODO: implement runWrite");
}

function runEdit(filePath: string, oldText: string, newText: string): string {
  // TODO: 替换文件中的精确文本（第一次出现）
  throw new Error("TODO: implement runEdit");
}

// -- The dispatch map: { tool_name: handler } --
type ToolInput = Record<string, unknown>;
const TOOL_HANDLERS: Record<string, (input: ToolInput) => string> = {
  bash: (i) => runBash(i.command as string),
  read_file: (i) => runRead(i.path as string, i.limit as number | undefined),
  write_file: (i) => runWrite(i.path as string, i.content as string),
  edit_file: (i) => runEdit(i.path as string, i.old_text as string, i.new_text as string),
};

const TOOLS: Anthropic.Tool[] = [
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

// -- Agent loop (same structure as s01) --
async function agentLoop(messages: Anthropic.MessageParam[]): Promise<void> {
  // TODO: 与 s01 相同的循环，但使用 TOOL_HANDLERS dispatch
  throw new Error("TODO: implement agentLoop");
}

// -- REPL --
async function main() {
  const rl = readline.createInterface({ input, output });
  const history: Anthropic.MessageParam[] = [];

  console.log('s02 tool use. Type "q" or "exit" to quit.');

  while (true) {
    let query: string;
    try {
      query = await rl.question("\x1b[36ms02 >> \x1b[0m");
    } catch {
      break;
    }
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
