#!/usr/bin/env npx tsx
// Harness: context compaction -- making long-running sessions sustainable.
/**
 * s06-context-compact.ts - Context Compact
 *
 * Long-running sessions need compaction to avoid context bloat.
 * This chapter introduces:
 * - estimateTokens(): rough token estimation
 * - microCompact(): replace old tool results with placeholders
 * - autoCompact(): save transcript to .transcripts/ and summarize history
 * - compact tool: manual compaction trigger
 *
 * Key insight: "State can be compressed while keeping enough to continue."
 *
 * Ref: .reference/agents/s06_context_compact.py
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import "dotenv/config";

const WORKDIR = process.cwd();
const TRANSCRIPTS_DIR = path.join(WORKDIR, ".transcripts");
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});
const MODEL = process.env.MODEL_ID ?? "claude-sonnet-4-6";
const SYSTEM = `You are a coding agent at ${WORKDIR}. Use compact when history grows too large.`;

function estimateTokens(messages: Anthropic.MessageParam[]): number {
  // TODO: 实现粗略 token 估算（例如 JSON.stringify 长度 / 4）
  throw new Error("TODO: implement estimateTokens");
}

function microCompact(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  // TODO: 将较旧的 tool_result 替换为 "[compacted]" 占位符，但保留 read_file 输出
  throw new Error("TODO: implement microCompact");
}

async function autoCompact(messages: Anthropic.MessageParam[]): Promise<Anthropic.MessageParam[]> {
  // TODO:
  // 1. 保存完整 transcript 到 .transcripts/<timestamp>.json
  // 2. 调用模型对历史做总结
  // 3. 返回 [systemSummaryBlock, ...recentMessages]
  throw new Error("TODO: implement autoCompact");
}

// base tools same as s02
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

type ToolInput = Record<string, unknown>;
const TOOL_HANDLERS: Record<string, (input: ToolInput) => string | Promise<string>> = {
  bash: (i) => runBash(i.command as string),
  read_file: (i) => runRead(i.path as string, i.limit as number | undefined),
  write_file: (i) => runWrite(i.path as string, i.content as string),
  edit_file: (i) => runEdit(i.path as string, i.old_text as string, i.new_text as string),
};

const TOOLS: Anthropic.Tool[] = [
  {
    name: "bash",
    description: "Run a shell command.",
    input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
  },
  {
    name: "read_file",
    description: "Read file contents.",
    input_schema: { type: "object", properties: { path: { type: "string" }, limit: { type: "integer" } }, required: ["path"] },
  },
  {
    name: "write_file",
    description: "Write content to file.",
    input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
  },
  {
    name: "edit_file",
    description: "Replace exact text in file.",
    input_schema: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] },
  },
  {
    name: "compact",
    description: "Compact conversation history. mode=micro replaces tool results; mode=auto summarizes.",
    input_schema: {
      type: "object",
      properties: { mode: { type: "string", enum: ["micro", "auto"] } },
    },
  },
];

// -- Agent loop with compaction support --
async function agentLoop(
  messages: Anthropic.MessageParam[]
): Promise<Anthropic.MessageParam[]> {
  // TODO: 标准循环，但当模型调用 compact 工具时执行相应压缩
  // 返回（可能已压缩的）messages
  throw new Error("TODO: implement agentLoop");
}

// -- REPL --
async function main() {
  const rl = readline.createInterface({ input, output });
  let history: Anthropic.MessageParam[] = [];

  console.log('s06 context compact. Type "q" or "exit" to quit.');

  while (true) {
    let query: string;
    try {
      query = await rl.question("\x1b[36ms06 >> \x1b[0m");
    } catch {
      break;
    }
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
