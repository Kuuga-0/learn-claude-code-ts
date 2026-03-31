#!/usr/bin/env npx tsx
// Harness: autonomy -- models that find work without being told.
/**
 * s11-autonomous-agents.ts - Autonomous Agents
 *
 * Idle cycle with task board polling, auto-claiming unclaimed tasks, and
 * identity re-injection after context compression.
 *
 *     Teammate lifecycle:
 *     spawn -> WORK -> idle (poll 5s, max 60s) -> claim task -> WORK -> ...
 *     If nothing to claim after 60s -> shutdown
 *
 * Key insight: "The agent finds work itself."
 *
 * Ref: .reference/agents/s11_autonomous_agents.py
 */

import Anthropic from "@anthropic-ai/sdk";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import "dotenv/config";

const WORKDIR = process.cwd();
const TEAM_DIR = `${WORKDIR}/.team`;
const INBOX_DIR = `${TEAM_DIR}/inbox`;
const TASKS_DIR = `${WORKDIR}/.tasks`;
const POLL_INTERVAL = 5_000;  // ms
const IDLE_TIMEOUT = 60_000; // ms
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});
const MODEL = process.env.MODEL_ID ?? "claude-sonnet-4-6";
const SYSTEM = `You are a team lead at ${WORKDIR}. Teammates are autonomous -- they find work themselves.`;

// -- Task board scanning --
interface TaskRecord {
  id: number;
  subject: string;
  status: string;
  owner: string;
  blockedBy: number[];
}

function scanUnclaimedTasks(): TaskRecord[] {
  // TODO: 扫描 .tasks/ 找 status=pending, owner='', blockedBy=[]
  return [];
}

function claimTask(taskId: number, owner: string): string {
  // TODO: 原子性地将任务 owner 设为 owner，status 设为 in_progress
  throw new Error("TODO: implement claimTask");
}

// -- Identity re-injection --
function makeIdentityBlock(name: string, role: string, teamName: string): Anthropic.MessageParam {
  return {
    role: "user",
    content: `<identity>You are '${name}', role: ${role}, team: ${teamName}. Continue your work.</identity>`,
  };
}

// Message types
type MsgType = "message" | "broadcast" | "shutdown_request" | "shutdown_response" | "plan_approval_response";

class MessageBus {
  constructor(private readonly inboxDir: string) {}
  send(sender: string, to: string, content: string, msgType: MsgType = "message"): string {
    throw new Error("TODO: implement MessageBus.send");
  }
  readInbox(name: string): unknown[] {
    throw new Error("TODO: implement MessageBus.readInbox");
  }
  broadcast(sender: string, content: string, teammates: string[]): string {
    throw new Error("TODO: implement MessageBus.broadcast");
  }
}

const BUS = new MessageBus(INBOX_DIR);

// -- Autonomous TeammateManager --
class TeammateManager {
  constructor(private readonly teamDir: string) {}

  spawn(name: string, role: string, prompt: string): string {
    // TODO: 启动包含 WORK + IDLE 循环的 teammate
    throw new Error("TODO: implement TeammateManager.spawn");
  }

  listAll(): string {
    throw new Error("TODO: implement TeammateManager.listAll");
  }
}

const TEAM = new TeammateManager(TEAM_DIR);

function runBash(command: string): string { throw new Error("TODO: implement runBash"); }
function runRead(filePath: string): string { throw new Error("TODO: implement runRead"); }
function runWrite(filePath: string, content: string): string { throw new Error("TODO: implement runWrite"); }
function runEdit(filePath: string, oldText: string, newText: string): string { throw new Error("TODO: implement runEdit"); }

const TOOLS: Anthropic.Tool[] = [
  { name: "bash", description: "Run a shell command.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "read_file", description: "Read file contents.", input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "write_file", description: "Write content to file.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "edit_file", description: "Replace exact text in file.", input_schema: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] } },
  { name: "spawn_teammate", description: "Spawn an autonomous named agent.", input_schema: { type: "object", properties: { name: { type: "string" }, role: { type: "string" }, prompt: { type: "string" } }, required: ["name", "role", "prompt"] } },
  { name: "send_message", description: "Send message to a teammate.", input_schema: { type: "object", properties: { to: { type: "string" }, content: { type: "string" } }, required: ["to", "content"] } },
  { name: "read_inbox", description: "Read and drain your inbox.", input_schema: { type: "object", properties: {} } },
  { name: "list_teammates", description: "List all teammates.", input_schema: { type: "object", properties: {} } },
];

async function agentLoop(messages: Anthropic.MessageParam[]): Promise<void> {
  throw new Error("TODO: implement agentLoop");
}

async function main() {
  const rl = readline.createInterface({ input, output });
  const history: Anthropic.MessageParam[] = [];
  console.log('s11 autonomous agents. Type "q" or "exit" to quit.');
  while (true) {
    let query: string;
    try { query = await rl.question("\x1b[36ms11 >> \x1b[0m"); } catch { break; }
    if (!query.trim() || ["q", "exit"].includes(query.trim().toLowerCase())) break;
    history.push({ role: "user", content: query });
    await agentLoop(history);
    console.log();
  }
  rl.close();
}

main().catch(console.error);
