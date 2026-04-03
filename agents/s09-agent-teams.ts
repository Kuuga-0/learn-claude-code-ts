#!/usr/bin/env npx tsx
// Harness: team mailboxes -- multiple models, coordinated through files.
/**
 * s09-agent-teams.ts - Agent Teams
 *
 * Ref: .reference/agents/s09_agent_teams.py
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ToolInput } from "../src/types/agent.js";
import { runBash, runRead, runWrite, runEdit } from "../src/tools/base-tools.js";
import { MessageBus, TeammateManager } from "../src/managers/team.js";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import "dotenv/config";

const WORKDIR = process.cwd();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL });
const MODEL = process.env.MODEL_ID ?? "claude-sonnet-4-6";
const SYSTEM = `You are a team lead at ${WORKDIR}. Spawn teammates and communicate via inboxes.`;

const TEAM = new TeammateManager({ workdir: WORKDIR, teamDir: path.join(WORKDIR, ".team"), model: MODEL, apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL });
const BUS = TEAM.getBus();

const TOOL_HANDLERS: Record<string, (i: ToolInput) => string> = {
  bash: (i) => runBash(i["command"] as string),
  read_file: (i) => runRead(i["path"] as string, i["limit"] as number | undefined),
  write_file: (i) => runWrite(i["path"] as string, i["content"] as string),
  edit_file: (i) => runEdit(i["path"] as string, i["old_text"] as string, i["new_text"] as string),
  spawn_teammate: (i) => TEAM.spawn(i["name"] as string, i["role"] as string, i["prompt"] as string),
  list_teammates: () => TEAM.listAll(),
  send_message: (i) => BUS.send("lead", i["to"] as string, i["content"] as string, (i["msg_type"] as "message") ?? "message"),
  read_inbox: () => JSON.stringify(BUS.readInbox("lead"), null, 2),
  broadcast: (i) => BUS.broadcast("lead", i["content"] as string, TEAM.memberNames()),
};

const TOOLS: Anthropic.Tool[] = [
  { name: "bash", description: "Run a shell command.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "read_file", description: "Read file contents.", input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "write_file", description: "Write content to file.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "edit_file", description: "Replace exact text in file.", input_schema: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] } },
  { name: "spawn_teammate", description: "Spawn a persistent teammate.", input_schema: { type: "object", properties: { name: { type: "string" }, role: { type: "string" }, prompt: { type: "string" } }, required: ["name", "role", "prompt"] } },
  { name: "list_teammates", description: "List all teammates.", input_schema: { type: "object", properties: {} } },
  { name: "send_message", description: "Send message to a teammate.", input_schema: { type: "object", properties: { to: { type: "string" }, content: { type: "string" }, msg_type: { type: "string" } }, required: ["to", "content"] } },
  { name: "read_inbox", description: "Read and drain lead's inbox.", input_schema: { type: "object", properties: {} } },
  { name: "broadcast", description: "Send message to all teammates.", input_schema: { type: "object", properties: { content: { type: "string" } }, required: ["content"] } },
];

async function agentLoop(messages: Anthropic.MessageParam[]): Promise<void> {
  while (true) {
    const inbox = BUS.readInbox("lead");
    if (inbox.length > 0) {
      messages.push({ role: "user", content: `<inbox>${JSON.stringify(inbox, null, 2)}</inbox>` });
    }
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
  console.log('s09 agent teams. Type "q" or "/team" or "/inbox". Type "q" to quit.');
  while (true) {
    let query: string;
    try { query = await rl.question("\x1b[36ms09 >> \x1b[0m"); } catch { break; }
    if (!query.trim() || ["q", "exit"].includes(query.trim().toLowerCase())) break;
    if (query.trim() === "/team") { console.log(TEAM.listAll()); continue; }
    if (query.trim() === "/inbox") { console.log(JSON.stringify(BUS.readInbox("lead"), null, 2)); continue; }
    history.push({ role: "user", content: query });
    await agentLoop(history);
    const last = history[history.length - 1];
    if (Array.isArray(last.content)) for (const b of last.content) if (b.type === "text") console.log(b.text);
    console.log();
  }
  rl.close();
}

main().catch(console.error);
