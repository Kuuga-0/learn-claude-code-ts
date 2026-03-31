#!/usr/bin/env npx tsx
// Harness: context isolation -- noise that doesn't bleed back into the parent.
/**
 * s04-subagent.ts - Subagent
 *
 * Parent agent gets a "task" tool. Child agent runs with fresh messages=[].
 * Child shares filesystem/tools but returns only a summary string.
 * Child cannot recursively spawn more task agents.
 *
 *     Parent context          Child context (isolated)
 *     +-----------------+     +-----------------+
 *     | messages: [...] |     | messages: []    |
 *     | task tool call  | --> | executes work   |
 *     |                 |     | returns summary |
 *     | tool_result:    | <-- |                 |
 *     |   "summary..."  |     +-----------------+
 *     +-----------------+
 *
 * Key insight: "Isolate noisy work without polluting parent context."
 *
 * Ref: .reference/agents/s04_subagent.py
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
const SYSTEM = `You are a coding agent at ${WORKDIR}. Use the task tool to delegate complex subtasks.`;

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

// -- Subagent runner: executes a task in an isolated context --
async function runSubagent(prompt: string): Promise<string> {
  // TODO: 创建空的 messages=[]，运行独立的 agent 循环
  // 子 agent 不能递归使用 task 工具
  // 从最终 assistant 消息中提取文本摘要并返回
  throw new Error("TODO: implement runSubagent");
}

type ToolInput = Record<string, unknown>;
const BASE_HANDLERS: Record<string, (input: ToolInput) => string> = {
  bash: (i) => runBash(i.command as string),
  read_file: (i) => runRead(i.path as string, i.limit as number | undefined),
  write_file: (i) => runWrite(i.path as string, i.content as string),
  edit_file: (i) => runEdit(i.path as string, i.old_text as string, i.new_text as string),
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

const TASK_TOOL: Anthropic.Tool = {
  name: "task",
  description: "Delegate a complex subtask to a subagent with isolated context.",
  input_schema: {
    type: "object",
    properties: { prompt: { type: "string", description: "The subtask description." } },
    required: ["prompt"],
  },
};

// -- Parent agent loop --
async function agentLoop(messages: Anthropic.MessageParam[]): Promise<void> {
  // TODO: 与 s02 相同，但工具列表包含 TASK_TOOL
  // 当调用 task 工具时，调用 runSubagent(prompt) 获取结果
  throw new Error("TODO: implement agentLoop");
}

// -- REPL --
async function main() {
  const rl = readline.createInterface({ input, output });
  const history: Anthropic.MessageParam[] = [];

  console.log('s04 subagent. Type "q" or "exit" to quit.');

  while (true) {
    let query: string;
    try {
      query = await rl.question("\x1b[36ms04 >> \x1b[0m");
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
