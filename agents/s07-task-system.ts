#!/usr/bin/env npx tsx
// Harness: persistent tasks -- goals that outlive any single conversation.
/**
 * s07-task-system.ts - Tasks
 *
 * Tasks persist as JSON files in .tasks/ so they survive context compression.
 * Each task has a dependency graph (blockedBy).
 *
 * Key insight: "State that survives compression -- because it's outside the conversation."
 *
 * Ref: .reference/agents/s07_task_system.py
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import "dotenv/config";

const WORKDIR = process.cwd();
const TASKS_DIR = path.join(WORKDIR, ".tasks");
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});
const MODEL = process.env.MODEL_ID ?? "claude-sonnet-4-6";
const SYSTEM = `You are a coding agent at ${WORKDIR}. Use task tools to plan and track work.`;

type TaskStatus = "pending" | "in_progress" | "completed";

interface TaskRecord {
  id: number;
  subject: string;
  description: string;
  status: TaskStatus;
  blockedBy: number[];
  owner: string;
}

class TaskManager {
  constructor(private readonly tasksDir: string) {
    // TODO: 确保 .tasks 目录存在并初始化 next id
  }

  create(subject: string, description = ""): string {
    // TODO: 创建 task_*.json
    throw new Error("TODO: implement TaskManager.create");
  }

  get(taskId: number): string {
    // TODO: 读取单个任务
    throw new Error("TODO: implement TaskManager.get");
  }

  update(taskId: number, status?: TaskStatus, addBlockedBy?: number[], removeBlockedBy?: number[]): string {
    // TODO: 更新状态和依赖，完成时清理其他任务 blockedBy
    throw new Error("TODO: implement TaskManager.update");
  }

  listAll(): string {
    // TODO: 读取全部任务并渲染摘要
    throw new Error("TODO: implement TaskManager.listAll");
  }
}

const TASKS = new TaskManager(TASKS_DIR);

function safePath(p: string): string { throw new Error("TODO: implement safePath"); }
function runBash(command: string): string { throw new Error("TODO: implement runBash"); }
function runRead(filePath: string, limit?: number): string { throw new Error("TODO: implement runRead"); }
function runWrite(filePath: string, content: string): string { throw new Error("TODO: implement runWrite"); }
function runEdit(filePath: string, oldText: string, newText: string): string { throw new Error("TODO: implement runEdit"); }

const TOOLS: Anthropic.Tool[] = [
  { name: "bash", description: "Run a shell command.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "read_file", description: "Read file contents.", input_schema: { type: "object", properties: { path: { type: "string" }, limit: { type: "integer" } }, required: ["path"] } },
  { name: "write_file", description: "Write content to file.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "edit_file", description: "Replace exact text in file.", input_schema: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] } },
  { name: "task_create", description: "Create a new task.", input_schema: { type: "object", properties: { subject: { type: "string" }, description: { type: "string" } }, required: ["subject"] } },
  { name: "task_update", description: "Update a task's status or dependencies.", input_schema: { type: "object", properties: { task_id: { type: "integer" }, status: { type: "string", enum: ["pending", "in_progress", "completed"] }, addBlockedBy: { type: "array", items: { type: "integer" } }, removeBlockedBy: { type: "array", items: { type: "integer" } } }, required: ["task_id"] } },
  { name: "task_list", description: "List all tasks with status summary.", input_schema: { type: "object", properties: {} } },
  { name: "task_get", description: "Get full details of a task by ID.", input_schema: { type: "object", properties: { task_id: { type: "integer" } }, required: ["task_id"] } },
];

async function agentLoop(messages: Anthropic.MessageParam[]): Promise<void> {
  // TODO: 与 s02 相同，但支持 task_create/task_update/task_list/task_get
  throw new Error("TODO: implement agentLoop");
}

async function main() {
  const rl = readline.createInterface({ input, output });
  const history: Anthropic.MessageParam[] = [];
  console.log('s07 task system. Type "q" or "exit" to quit.');
  while (true) {
    let query: string;
    try { query = await rl.question("\x1b[36ms07 >> \x1b[0m"); } catch { break; }
    if (!query.trim() || ["q", "exit"].includes(query.trim().toLowerCase())) break;
    history.push({ role: "user", content: query });
    await agentLoop(history);
    console.log();
  }
  rl.close();
}

main().catch(console.error);
