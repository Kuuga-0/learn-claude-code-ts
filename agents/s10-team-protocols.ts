#!/usr/bin/env npx tsx
// Harness: protocols -- structured handshakes between models.
/**
 * s10-team-protocols.ts - Team Protocols
 *
 * Shutdown protocol and plan approval protocol, both using request_id correlation.
 *
 *     Shutdown FSM: pending -> approved | rejected
 *     Plan approval FSM: pending -> approved | rejected
 *
 * Key insight: "Same request_id correlation pattern, two domains."
 *
 * Ref: .reference/agents/s10_team_protocols.py
 */

import Anthropic from "@anthropic-ai/sdk";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import "dotenv/config";

const WORKDIR = process.cwd();
const TEAM_DIR = `${WORKDIR}/.team`;
const INBOX_DIR = `${TEAM_DIR}/inbox`;
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
});
const MODEL = process.env.MODEL_ID ?? "claude-sonnet-4-6";
const SYSTEM = `You are a team lead at ${WORKDIR}. Manage teammates with shutdown and plan approval protocols.`;

type MsgType =
  | "message"
  | "broadcast"
  | "shutdown_request"
  | "shutdown_response"
  | "plan_approval_response";

// -- Request trackers --
const shutdownRequests = new Map<string, { target: string; status: "pending" | "approved" | "rejected" }>();
const planRequests = new Map<string, { from: string; plan: string; status: "pending" | "approved" | "rejected" }>();

class MessageBus {
  constructor(private readonly inboxDir: string) {}

  send(sender: string, to: string, content: string, msgType: MsgType = "message", extra?: Record<string, unknown>): string {
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

class TeammateManager {
  constructor(private readonly teamDir: string) {}

  spawn(name: string, role: string, prompt: string): string {
    // TODO: 同 s09，但 teammate_loop 额外处理 shutdown_response / plan_approval
    throw new Error("TODO: implement TeammateManager.spawn");
  }

  shutdown(name: string): string {
    // TODO: 向 teammate 发送 shutdown_request，记录到 shutdownRequests
    throw new Error("TODO: implement TeammateManager.shutdown");
  }

  listAll(): string {
    throw new Error("TODO: implement TeammateManager.listAll");
  }
}

const TEAM = new TeammateManager(TEAM_DIR);

// base tools
function runBash(command: string): string { throw new Error("TODO: implement runBash"); }
function runRead(filePath: string): string { throw new Error("TODO: implement runRead"); }
function runWrite(filePath: string, content: string): string { throw new Error("TODO: implement runWrite"); }
function runEdit(filePath: string, oldText: string, newText: string): string { throw new Error("TODO: implement runEdit"); }

const TOOLS: Anthropic.Tool[] = [
  { name: "bash", description: "Run a shell command.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "read_file", description: "Read file contents.", input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "write_file", description: "Write content to file.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "edit_file", description: "Replace exact text in file.", input_schema: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] } },
  { name: "spawn_teammate", description: "Spawn a persistent named agent.", input_schema: { type: "object", properties: { name: { type: "string" }, role: { type: "string" }, prompt: { type: "string" } }, required: ["name", "role", "prompt"] } },
  { name: "shutdown_request", description: "Request a teammate to shut down.", input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  { name: "plan_approval", description: "Submit or approve/reject a plan.", input_schema: { type: "object", properties: { action: { type: "string", enum: ["submit", "review"] }, plan: { type: "string" }, request_id: { type: "string" }, approve: { type: "boolean" } }, required: ["action"] } },
  { name: "send_message", description: "Send message to a teammate.", input_schema: { type: "object", properties: { to: { type: "string" }, content: { type: "string" }, msg_type: { type: "string" } }, required: ["to", "content"] } },
  { name: "read_inbox", description: "Read and drain your inbox.", input_schema: { type: "object", properties: {} } },
  { name: "list_teammates", description: "List all teammates and status.", input_schema: { type: "object", properties: {} } },
];

async function agentLoop(messages: Anthropic.MessageParam[]): Promise<void> {
  // TODO: 标准循环，增加 shutdown_request / plan_approval 工具处理
  throw new Error("TODO: implement agentLoop");
}

async function main() {
  const rl = readline.createInterface({ input, output });
  const history: Anthropic.MessageParam[] = [];
  console.log('s10 team protocols. Type "q" or "exit" to quit.');
  while (true) {
    let query: string;
    try { query = await rl.question("\x1b[36ms10 >> \x1b[0m"); } catch { break; }
    if (!query.trim() || ["q", "exit"].includes(query.trim().toLowerCase())) break;
    history.push({ role: "user", content: query });
    await agentLoop(history);
    console.log();
  }
  rl.close();
}

main().catch(console.error);
