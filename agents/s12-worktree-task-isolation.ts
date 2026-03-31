#!/usr/bin/env npx tsx
// Harness: directory isolation -- parallel execution lanes that never collide.
/**
 * s12-worktree-task-isolation.ts - Worktree + Task Isolation
 *
 * Directory-level isolation for parallel task execution.
 * Tasks are the control plane; worktrees are the execution plane.
 *
 *     .tasks/task_12.json  { id:12, subject:"...", status:"in_progress", worktree:"auth-refactor" }
 *     .worktrees/index.json  { worktrees: [{ name, path, branch, task_id, status }] }
 *
 * Key insight: "Isolate by directory, coordinate by task ID."
 *
 * Ref: .reference/agents/s12_worktree_task_isolation.py
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { execSync } from "node:child_process";
import "dotenv/config";

const WORKDIR = process.cwd();
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});
const MODEL = process.env.MODEL_ID ?? "claude-sonnet-4-6";

function detectRepoRoot(cwd: string): string | null {
  // TODO: 运行 git rev-parse --show-toplevel，返回 repo 根路径或 null
  return null;
}

const REPO_ROOT = detectRepoRoot(WORKDIR) ?? WORKDIR;
const SYSTEM = `You are a coding agent at ${WORKDIR}. Use task + worktree tools for multi-task work.`;

// -- EventBus --
class EventBus {
  constructor(private readonly eventLogPath: string) {}

  emit(event: string, task?: Record<string, unknown>, worktree?: Record<string, unknown>, error?: string): void {
    // TODO: 追加 JSON 行到 .worktrees/events.jsonl
    throw new Error("TODO: implement EventBus.emit");
  }

  listRecent(limit = 20): string {
    // TODO: 读取最近 N 条事件
    throw new Error("TODO: implement EventBus.listRecent");
  }
}

// -- TaskManager --
interface WorktreeTask {
  id: number;
  subject: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  owner: string;
  worktree: string;
  blockedBy: number[];
  created_at: number;
  updated_at: number;
}

class TaskManager {
  constructor(private readonly tasksDir: string) {}

  create(subject: string, description = ""): string {
    throw new Error("TODO: implement TaskManager.create");
  }

  get(taskId: number): string {
    throw new Error("TODO: implement TaskManager.get");
  }

  update(taskId: number, status?: string, owner?: string): string {
    throw new Error("TODO: implement TaskManager.update");
  }

  bindWorktree(taskId: number, worktree: string, owner = ""): string {
    throw new Error("TODO: implement TaskManager.bindWorktree");
  }

  unbindWorktree(taskId: number): string {
    throw new Error("TODO: implement TaskManager.unbindWorktree");
  }

  listAll(): string {
    throw new Error("TODO: implement TaskManager.listAll");
  }
}

// -- WorktreeManager --
interface WorktreeRecord {
  name: string;
  path: string;
  branch: string;
  task_id: number | null;
  status: "active" | "removed";
}

class WorktreeManager {
  constructor(
    private readonly repoRoot: string,
    private readonly tasks: TaskManager,
    private readonly events: EventBus
  ) {}

  create(name: string, taskId?: number): string {
    // TODO: git worktree add .worktrees/{name} -b wt/{name}
    // 更新 index.json，绑定 task，emit worktree_created
    throw new Error("TODO: implement WorktreeManager.create");
  }

  list(): string {
    throw new Error("TODO: implement WorktreeManager.list");
  }

  run(name: string, command: string): string {
    // TODO: 在 worktree 目录内执行命令
    throw new Error("TODO: implement WorktreeManager.run");
  }

  remove(name: string): string {
    // TODO: git worktree remove, 更新 index.json
    throw new Error("TODO: implement WorktreeManager.remove");
  }

  keep(name: string): string {
    // TODO: 将 worktree 标记为 kept（不删除）
    throw new Error("TODO: implement WorktreeManager.keep");
  }

  status(name: string): string {
    // TODO: 在 worktree 内运行 git status
    throw new Error("TODO: implement WorktreeManager.status");
  }
}

const TASKS = new TaskManager(path.join(REPO_ROOT, ".tasks"));
const EVENTS = new EventBus(path.join(REPO_ROOT, ".worktrees", "events.jsonl"));
const WORKTREES = new WorktreeManager(REPO_ROOT, TASKS, EVENTS);

function runBash(command: string): string { throw new Error("TODO: implement runBash"); }

const TOOLS: Anthropic.Tool[] = [
  { name: "bash", description: "Run a shell command.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "task_create", description: "Create a task.", input_schema: { type: "object", properties: { subject: { type: "string" }, description: { type: "string" } }, required: ["subject"] } },
  { name: "task_list", description: "List all tasks.", input_schema: { type: "object", properties: {} } },
  { name: "task_update", description: "Update task status.", input_schema: { type: "object", properties: { task_id: { type: "integer" }, status: { type: "string" } }, required: ["task_id"] } },
  { name: "worktree_create", description: "Create a git worktree for a task.", input_schema: { type: "object", properties: { name: { type: "string" }, task_id: { type: "integer" } }, required: ["name"] } },
  { name: "worktree_list", description: "List all worktrees.", input_schema: { type: "object", properties: {} } },
  { name: "worktree_run", description: "Run command in a worktree.", input_schema: { type: "object", properties: { name: { type: "string" }, command: { type: "string" } }, required: ["name", "command"] } },
  { name: "worktree_status", description: "Get git status of a worktree.", input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "worktree_keep", description: "Mark worktree to keep.", input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "worktree_remove", description: "Remove a worktree.", input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "worktree_events", description: "List recent lifecycle events.", input_schema: { type: "object", properties: { limit: { type: "integer" } } } },
];

async function agentLoop(messages: Anthropic.MessageParam[]): Promise<void> {
  throw new Error("TODO: implement agentLoop");
}

async function main() {
  const rl = readline.createInterface({ input, output });
  const history: Anthropic.MessageParam[] = [];
  console.log('s12 worktree isolation. Type "q" or "exit" to quit.');
  while (true) {
    let query: string;
    try { query = await rl.question("\x1b[36ms12 >> \x1b[0m"); } catch { break; }
    if (!query.trim() || ["q", "exit"].includes(query.trim().toLowerCase())) break;
    history.push({ role: "user", content: query });
    await agentLoop(history);
    console.log();
  }
  rl.close();
}

main().catch(console.error);
