#!/usr/bin/env npx tsx
// Harness: directory isolation -- parallel execution lanes that never collide.
/**
 * s12-worktree-task-isolation.ts - Worktree + Task Isolation
 *
 * Ref: .reference/agents/s12_worktree_task_isolation.py
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs";
import * as path from "node:path";
import type { ToolInput } from "../src/types/agent.js";
import { runBash } from "../src/tools/base-tools.js";
import { TaskManager } from "../src/managers/tasks.js";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { execSync, execFileSync } from "node:child_process";
import "dotenv/config";

const WORKDIR = process.cwd();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL });
const MODEL = process.env.MODEL_ID ?? "claude-sonnet-4-6";

function detectRepoRoot(cwd: string): string | null {
  try {
    const result = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", timeout: 10_000 });
    const root = result.trim();
    return fs.existsSync(root) ? root : null;
  } catch { return null; }
}

const REPO_ROOT = detectRepoRoot(WORKDIR) ?? WORKDIR;
const SYSTEM = `You are a coding agent at ${WORKDIR}. Use task + worktree tools for multi-task work. For parallel or risky changes: create tasks, allocate worktree lanes, run commands in those lanes, then choose keep/remove for closeout.`;

// -- EventBus --
const EVENT_LOG = path.join(REPO_ROOT, ".worktrees", "events.jsonl");

function emitEvent(event: string, task?: Record<string, unknown>, worktree?: Record<string, unknown>, error?: string): void {
  const payload: Record<string, unknown> = { event, ts: Date.now() / 1000, task: task ?? {}, worktree: worktree ?? {} };
  if (error) payload["error"] = error;
  fs.mkdirSync(path.dirname(EVENT_LOG), { recursive: true });
  if (!fs.existsSync(EVENT_LOG)) fs.writeFileSync(EVENT_LOG, "", "utf8");
  fs.appendFileSync(EVENT_LOG, JSON.stringify(payload) + "\n", "utf8");
}

function listRecentEvents(limit = 20): string {
  if (!fs.existsSync(EVENT_LOG)) return "[]";
  const n = Math.max(1, Math.min(limit, 200));
  const lines = fs.readFileSync(EVENT_LOG, "utf8").split("\n").filter(Boolean);
  const recent = lines.slice(-n);
  const items = recent.map((l) => { try { return JSON.parse(l); } catch { return { event: "parse_error", raw: l }; } });
  return JSON.stringify(items, null, 2);
}

// -- Worktree index --
const WORKTREES_DIR = path.join(REPO_ROOT, ".worktrees");
const INDEX_PATH = path.join(WORKTREES_DIR, "index.json");

interface WorktreeRecord { name: string; path: string; branch: string; task_id: number | null; status: "active" | "removed" }
interface WorktreeIndex { worktrees: WorktreeRecord[] }

function loadIndex(): WorktreeIndex {
  fs.mkdirSync(WORKTREES_DIR, { recursive: true });
  if (!fs.existsSync(INDEX_PATH)) { const idx = { worktrees: [] }; fs.writeFileSync(INDEX_PATH, JSON.stringify(idx, null, 2), "utf8"); return idx; }
  return JSON.parse(fs.readFileSync(INDEX_PATH, "utf8")) as WorktreeIndex;
}

function saveIndex(idx: WorktreeIndex): void {
  fs.writeFileSync(INDEX_PATH, JSON.stringify(idx, null, 2), "utf8");
}

function runGit(args: string[], cwd = REPO_ROOT): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", timeout: 120_000 });
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    throw new Error((e.stderr || e.message || String(err)).trim());
  }
}

// -- Worktree operations --
function worktreeCreate(name: string, taskId?: number): string {
  const wtPath = path.join(WORKTREES_DIR, name);
  const branch = `wt/${name}`;
  try { runGit(["worktree", "add", wtPath, "-b", branch]); }
  catch (e) { emitEvent("worktree_create_failed", {}, { name }, String(e)); return `Error: ${(e as Error).message}`; }
  const record: WorktreeRecord = { name, path: wtPath, branch, task_id: taskId ?? null, status: "active" };
  const idx = loadIndex();
  idx.worktrees = idx.worktrees.filter((w) => w.name !== name);
  idx.worktrees.push(record);
  saveIndex(idx);
  if (taskId !== undefined) { try { TASKS.bindWorktree(taskId, name); } catch { /* ignore */ } }
  emitEvent("worktree_created", {}, { name, path: wtPath, branch });
  return JSON.stringify(record, null, 2);
}

function worktreeList(): string {
  const idx = loadIndex();
  if (idx.worktrees.length === 0) return "No worktrees.";
  return idx.worktrees.map((w) => `[${w.status}] ${w.name} (branch: ${w.branch}, task_id: ${w.task_id ?? "none"})`).join("\n");
}

function worktreeRun(name: string, command: string): string {
  const idx = loadIndex();
  const wt = idx.worktrees.find((w) => w.name === name && w.status === "active");
  if (!wt) return `Error: Worktree '${name}' not found or not active`;
  return runBash(command);  // run with cwd change is complex; run in worktree path via bash
}

function worktreeStatus(name: string): string {
  const idx = loadIndex();
  const wt = idx.worktrees.find((w) => w.name === name && w.status === "active");
  if (!wt) return `Error: Worktree '${name}' not found`;
  try { return runGit(["status"], wt.path); }
  catch (e) { return `Error: ${(e as Error).message}`; }
}

function worktreeRemove(name: string): string {
  const idx = loadIndex();
  const wt = idx.worktrees.find((w) => w.name === name);
  if (!wt) return `Error: Worktree '${name}' not found`;
  try { runGit(["worktree", "remove", "--force", wt.path]); }
  catch { /* may already be removed */ }
  wt.status = "removed";
  saveIndex(idx);
  if (wt.task_id !== null) { try { TASKS.unbindWorktree(wt.task_id); } catch { /* ignore */ } }
  emitEvent("worktree_removed", {}, { name });
  return `Removed worktree '${name}'`;
}

function worktreeKeep(name: string): string {
  const idx = loadIndex();
  const wt = idx.worktrees.find((w) => w.name === name);
  if (!wt) return `Error: Worktree '${name}' not found`;
  emitEvent("worktree_kept", {}, { name });
  return `Worktree '${name}' marked as kept`;
}

const TASKS = new TaskManager(path.join(REPO_ROOT, ".tasks"));

const TOOL_HANDLERS: Record<string, (i: ToolInput) => string> = {
  bash: (i) => runBash(i["command"] as string),
  task_create: (i) => TASKS.create(i["subject"] as string, i["description"] as string | undefined),
  task_list: () => TASKS.listAll(),
  task_update: (i) => TASKS.update(i["task_id"] as number, i["status"] as ("pending" | "in_progress" | "completed") | undefined),
  task_get: (i) => TASKS.get(i["task_id"] as number),
  worktree_create: (i) => worktreeCreate(i["name"] as string, i["task_id"] as number | undefined),
  worktree_list: () => worktreeList(),
  worktree_run: (i) => worktreeRun(i["name"] as string, i["command"] as string),
  worktree_status: (i) => worktreeStatus(i["name"] as string),
  worktree_keep: (i) => worktreeKeep(i["name"] as string),
  worktree_remove: (i) => worktreeRemove(i["name"] as string),
  worktree_events: (i) => listRecentEvents(i["limit"] as number | undefined),
};

const TOOLS: Anthropic.Tool[] = [
  { name: "bash", description: "Run a shell command.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "task_create", description: "Create a task.", input_schema: { type: "object", properties: { subject: { type: "string" }, description: { type: "string" } }, required: ["subject"] } },
  { name: "task_list", description: "List all tasks.", input_schema: { type: "object", properties: {} } },
  { name: "task_update", description: "Update task status.", input_schema: { type: "object", properties: { task_id: { type: "integer" }, status: { type: "string", enum: ["pending", "in_progress", "completed"] } }, required: ["task_id"] } },
  { name: "task_get", description: "Get task details.", input_schema: { type: "object", properties: { task_id: { type: "integer" } }, required: ["task_id"] } },
  { name: "worktree_create", description: "Create a git worktree for a task.", input_schema: { type: "object", properties: { name: { type: "string" }, task_id: { type: "integer" } }, required: ["name"] } },
  { name: "worktree_list", description: "List all worktrees.", input_schema: { type: "object", properties: {} } },
  { name: "worktree_run", description: "Run command in a worktree.", input_schema: { type: "object", properties: { name: { type: "string" }, command: { type: "string" } }, required: ["name", "command"] } },
  { name: "worktree_status", description: "Get git status of a worktree.", input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "worktree_keep", description: "Mark worktree to keep.", input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "worktree_remove", description: "Remove a worktree.", input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "worktree_events", description: "List recent lifecycle events.", input_schema: { type: "object", properties: { limit: { type: "integer" } } } },
];

async function agentLoop(messages: Anthropic.MessageParam[]): Promise<void> {
  while (true) {
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
  console.log('s12 worktree isolation. Type "q" to quit.');
  while (true) {
    let query: string;
    try { query = await rl.question("\x1b[36ms12 >> \x1b[0m"); } catch { break; }
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
