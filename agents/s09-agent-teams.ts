#!/usr/bin/env npx tsx
// Harness: team mailboxes -- multiple models, coordinated through files.
/**
 * s09-agent-teams.ts - Agent Teams
 *
 * Persistent named agents with file-based JSONL inboxes.
 * Each teammate runs its own agent loop in a separate thread (Worker).
 *
 * Subagent (s04):  spawn -> execute -> return summary -> destroyed
 * Teammate (s09):  spawn -> work -> idle -> work -> ... -> shutdown
 *
 * Key insight: "Teammates that can talk to each other."
 *
 * Ref: .reference/agents/s09_agent_teams.py
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import "dotenv/config";

const WORKDIR = process.cwd();
const TEAM_DIR = path.join(WORKDIR, ".team");
const INBOX_DIR = path.join(TEAM_DIR, "inbox");
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});
const MODEL = process.env.MODEL_ID ?? "claude-sonnet-4-6";
const SYSTEM = `You are a team lead at ${WORKDIR}. Spawn teammates and communicate via inboxes.`;

type MsgType =
  | "message"
  | "broadcast"
  | "shutdown_request"
  | "shutdown_response"
  | "plan_approval_response";

interface TeamMessage {
  type: MsgType;
  from: string;
  content: string;
  timestamp: number;
  [key: string]: unknown;
}

interface TeamMember {
  name: string;
  role: string;
  status: "working" | "idle" | "shutdown";
}

interface TeamConfig {
  team_name: string;
  members: TeamMember[];
}

// -- MessageBus: JSONL inbox per teammate --
class MessageBus {
  constructor(private readonly inboxDir: string) {
    // TODO: 确保 inbox 目录存在
  }

  send(sender: string, to: string, content: string, msgType: MsgType = "message", extra?: Record<string, unknown>): string {
    // TODO: 追加 JSON 行到 .team/inbox/{to}.jsonl
    throw new Error("TODO: implement MessageBus.send");
  }

  readInbox(name: string): TeamMessage[] {
    // TODO: 读取并清空 .team/inbox/{name}.jsonl
    throw new Error("TODO: implement MessageBus.readInbox");
  }

  broadcast(sender: string, content: string, teammates: string[]): string {
    // TODO: 向所有 teammate（除发送者外）发送广播
    throw new Error("TODO: implement MessageBus.broadcast");
  }
}

const BUS = new MessageBus(INBOX_DIR);

// -- TeammateManager: persistent named agents with config.json --
class TeammateManager {
  private config: TeamConfig;

  constructor(private readonly teamDir: string) {
    // TODO: 加载或初始化 config.json
    this.config = { team_name: "default", members: [] };
  }

  spawn(name: string, role: string, prompt: string): string {
    // TODO: 在新线程/Worker 中启动 teammate_loop
    throw new Error("TODO: implement TeammateManager.spawn");
  }

  listAll(): string {
    // TODO: 列出所有 teammate 的状态
    throw new Error("TODO: implement TeammateManager.listAll");
  }

  memberNames(): string[] {
    return this.config.members.map((m) => m.name);
  }
}

const TEAM = new TeammateManager(TEAM_DIR);

// base tools
function safePath(p: string): string { throw new Error("TODO: implement safePath"); }
function runBash(command: string): string { throw new Error("TODO: implement runBash"); }
function runRead(filePath: string, limit?: number): string { throw new Error("TODO: implement runRead"); }
function runWrite(filePath: string, content: string): string { throw new Error("TODO: implement runWrite"); }
function runEdit(filePath: string, oldText: string, newText: string): string { throw new Error("TODO: implement runEdit"); }

const TOOLS: Anthropic.Tool[] = [
  { name: "bash", description: "Run a shell command.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "read_file", description: "Read file contents.", input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "write_file", description: "Write content to file.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "edit_file", description: "Replace exact text in file.", input_schema: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] } },
  { name: "spawn_teammate", description: "Spawn a persistent named agent.", input_schema: { type: "object", properties: { name: { type: "string" }, role: { type: "string" }, prompt: { type: "string" } }, required: ["name", "role", "prompt"] } },
  { name: "list_teammates", description: "List all teammates and status.", input_schema: { type: "object", properties: {} } },
  { name: "send_message", description: "Send message to a teammate.", input_schema: { type: "object", properties: { to: { type: "string" }, content: { type: "string" }, msg_type: { type: "string" } }, required: ["to", "content"] } },
  { name: "read_inbox", description: "Read and drain your inbox.", input_schema: { type: "object", properties: {} } },
  { name: "broadcast", description: "Send message to all teammates.", input_schema: { type: "object", properties: { content: { type: "string" } }, required: ["content"] } },
];

async function agentLoop(messages: Anthropic.MessageParam[]): Promise<void> {
  // TODO: 标准循环，新增 spawn/list/send/read_inbox/broadcast 工具处理
  throw new Error("TODO: implement agentLoop");
}

async function main() {
  const rl = readline.createInterface({ input, output });
  const history: Anthropic.MessageParam[] = [];
  console.log('s09 agent teams. Type "q" or "exit" to quit.');
  while (true) {
    let query: string;
    try { query = await rl.question("\x1b[36ms09 >> \x1b[0m"); } catch { break; }
    if (!query.trim() || ["q", "exit"].includes(query.trim().toLowerCase())) break;
    history.push({ role: "user", content: query });
    await agentLoop(history);
    console.log();
  }
  rl.close();
}

main().catch(console.error);
