#!/usr/bin/env npx tsx
// Harness: the loop -- the model's first connection to the real world.
/**
 * s01-agent-loop.ts - The Agent Loop
 *
 * The entire secret of an AI coding agent in one pattern:
 *
 *     while stop_reason === "tool_use":
 *         response = LLM(messages, tools)
 *         execute tools
 *         append results
 *
 *     +----------+      +-------+      +---------+
 *     |   User   | ---> |  LLM  | ---> |  Tool   |
 *     |  prompt  |      |       |      | execute |
 *     +----------+      +---+---+      +----+----+
 *                           ^               |
 *                           |   tool_result |
 *                           +---------------+
 *                           (loop continues)
 *
 * Ref: .reference/agents/s01_agent_loop.py
 */

import Anthropic from "@anthropic-ai/sdk";
import { execSync } from "node:child_process";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import "dotenv/config";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});
const MODEL = process.env.MODEL_ID ?? "claude-sonnet-4-6";
const SYSTEM = `You are a coding agent at ${process.cwd()}. Use bash to solve tasks. Act, don't explain.`;

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
];

// -- Tool implementation --
function runBash(command: string): string {
  // TODO: 实现危险命令检测和子进程执行
  throw new Error("TODO: implement runBash");
}

// -- The core pattern: a while loop that calls tools until the model stops --
async function agentLoop(messages: Anthropic.MessageParam[]): Promise<void> {
  // TODO: 实现 agent 循环
  // 1. 调用 client.messages.create(...)
  // 2. 将 assistant 响应追加到 messages
  // 3. 如果 stop_reason !== "tool_use"，返回
  // 4. 执行工具调用，收集 tool_result
  // 5. 将 tool_result 追加到 messages，继续循环
  throw new Error("TODO: implement agentLoop");
}

// -- REPL --
async function main() {
  const rl = readline.createInterface({ input, output });
  const history: Anthropic.MessageParam[] = [];

  console.log('s01 agent loop. Type "q" or "exit" to quit.');

  while (true) {
    let query: string;
    try {
      query = await rl.question("\x1b[36ms01 >> \x1b[0m");
    } catch {
      break;
    }
    if (!query.trim() || ["q", "exit"].includes(query.trim().toLowerCase())) {
      break;
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
