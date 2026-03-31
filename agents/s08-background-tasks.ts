#!/usr/bin/env npx tsx
// Harness: background execution -- the model thinks while the harness waits.
/**
 * s08-background-tasks.ts - Background Tasks
 *
 * Run commands in background threads/processes. A notification queue is drained
 * before each LLM call to deliver results.
 *
 * Key insight: "Fire and forget -- the agent doesn't block while the command runs."
 *
 * Ref: .reference/agents/s08_background_tasks.py
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
const SYSTEM = `You are a coding agent at ${WORKDIR}. Use background_run for long-running commands.`;

interface BackgroundTask {
  status: "running" | "completed" | "timeout" | "error";
  result: string | null;
  command: string;
}

interface BackgroundNotification {
  taskId: string;
  status: BackgroundTask["status"];
  command: string;
  result: string;
}

class BackgroundManager {
  private tasks = new Map<string, BackgroundTask>();
  private notificationQueue: BackgroundNotification[] = [];

  run(command: string): string {
    // TODO: 启动后台任务，立即返回 task id
    throw new Error("TODO: implement BackgroundManager.run");
  }

  check(taskId?: string): string {
    // TODO: 查询单个任务或列出所有任务
    throw new Error("TODO: implement BackgroundManager.check");
  }

  drainNotifications(): BackgroundNotification[] {
    // TODO: 返回并清空通知队列
    throw new Error("TODO: implement BackgroundManager.drainNotifications");
  }
}

const BG = new BackgroundManager();

function safePath(p: string): string { throw new Error("TODO: implement safePath"); }
function runBash(command: string): string { throw new Error("TODO: implement runBash"); }
function runRead(filePath: string, limit?: number): string { throw new Error("TODO: implement runRead"); }
function runWrite(filePath: string, content: string): string { throw new Error("TODO: implement runWrite"); }
function runEdit(filePath: string, oldText: string, newText: string): string { throw new Error("TODO: implement runEdit"); }

const TOOLS: Anthropic.Tool[] = [
  { name: "bash", description: "Run a shell command (blocking).", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "read_file", description: "Read file contents.", input_schema: { type: "object", properties: { path: { type: "string" }, limit: { type: "integer" } }, required: ["path"] } },
  { name: "write_file", description: "Write content to file.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "edit_file", description: "Replace exact text in file.", input_schema: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] } },
  { name: "background_run", description: "Run command in background. Returns task_id immediately.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "check_background", description: "Check background task status. Omit task_id to list all.", input_schema: { type: "object", properties: { task_id: { type: "string" } } } },
];

async function agentLoop(messages: Anthropic.MessageParam[]): Promise<void> {
  // TODO: 每轮调用模型前先 drainNotifications()
  // 如果有后台结果，注入 <background-results>...</background-results>
  throw new Error("TODO: implement agentLoop");
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
    console.log();
  }
  rl.close();
}

main().catch(console.error);
