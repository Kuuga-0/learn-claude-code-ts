#!/usr/bin/env npx tsx
// Harness: full cockpit -- all capabilities from s01-s11 combined.
/**
 * s-full.ts - Full Agent
 *
 * Capstone implementation combining the mechanisms from s01-s11.
 * Session s12 (worktree isolation) is taught separately.
 *
 * REPL commands: /compact /tasks /team /inbox
 *
 * Ref: .reference/agents/s_full.py
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ToolInput } from "../src/types/agent.js";
import { runBash, runRead, runWrite, runEdit } from "../src/tools/base-tools.js";
import { TodoManager } from "../src/managers/todo.js";
import { SkillLoader } from "../src/managers/skills.js";
import { estimateTokens, microCompact, autoCompact } from "../src/managers/compact.js";
import { TaskManager } from "../src/managers/tasks.js";
import { BackgroundManager } from "../src/managers/background.js";
import { MessageBus, TeammateManager } from "../src/managers/team.js";
import * as path from "node:path";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import "dotenv/config";

const WORKDIR = process.cwd();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, baseURL: process.env.ANTHROPIC_BASE_URL });
const MODEL = process.env.MODEL_ID ?? "claude-sonnet-4-6";
const TOKEN_THRESHOLD = 100_000;
const POLL_INTERVAL = 5_000;
const IDLE_TIMEOUT = 60_000;

const TODO = new TodoManager();
const TASKS = new TaskManager(path.join(WORKDIR, ".tasks"));
const BG = new BackgroundManager();
const SKILLS = new SkillLoader(path.join(WORKDIR, "skills"));
const TEAM = new TeammateManager({
  workdir: WORKDIR,
  teamDir: path.join(WORKDIR, ".team"),
  model: MODEL,
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
  pollInterval: POLL_INTERVAL,
  idleTimeout: IDLE_TIMEOUT,
});
const BUS = TEAM.getBus();

const SYSTEM = `You are a full-capability coding agent at ${WORKDIR}.
You have access to tools for shell, file operations, todos, subagents, skills, compaction, durable tasks, background jobs, and team management.
Use tasks for durable work tracking and todo for short-horizon planning.

Skills available:
${SKILLS.getDescriptions()}`;

// --- Subagent helper (same pattern as s04) ---
const SUBAGENT_TOOLS: Anthropic.Tool[] = [
  { name: "bash", description: "Run a shell command.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "read_file", description: "Read file contents.", input_schema: { type: "object", properties: { path: { type: "string" }, limit: { type: "integer" } }, required: ["path"] } },
  { name: "write_file", description: "Write content to file.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "edit_file", description: "Replace exact text in file.", input_schema: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] } },
];

async function runSubagent(prompt: string): Promise<string> {
  const subMessages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  let response: Awaited<ReturnType<typeof client.messages.create>> | null = null;
  for (let i = 0; i < 30; i++) {
    response = await client.messages.create({ model: MODEL, system: `You are a coding subagent at ${WORKDIR}. Complete the given task, then summarize your findings.`, messages: subMessages, tools: SUBAGENT_TOOLS, max_tokens: 8000 });
    subMessages.push({ role: "assistant", content: response.content });
    if (response.stop_reason !== "tool_use") break;
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === "tool_use") {
        const out = dispatchBase(block.name, block.input as ToolInput);
        results.push({ type: "tool_result", tool_use_id: block.id, content: out });
      }
    }
    subMessages.push({ role: "user", content: results });
  }
  if (!response) return "(no summary)";
  return response.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("") || "(no summary)";
}

// --- Base dispatch ---
function dispatchBase(toolName: string, i: ToolInput): string {
  if (toolName === "bash") return runBash(i["command"] as string);
  if (toolName === "read_file") return runRead(i["path"] as string, i["limit"] as number | undefined);
  if (toolName === "write_file") return runWrite(i["path"] as string, i["content"] as string);
  if (toolName === "edit_file") return runEdit(i["path"] as string, i["old_text"] as string, i["new_text"] as string);
  return `Unknown tool: ${toolName}`;
}

// --- Full tool dispatch ---
const TOOL_HANDLERS: Record<string, (i: ToolInput) => string | Promise<string>> = {
  bash: (i) => dispatchBase("bash", i),
  read_file: (i) => dispatchBase("read_file", i),
  write_file: (i) => dispatchBase("write_file", i),
  edit_file: (i) => dispatchBase("edit_file", i),
  todo: (i) => TODO.update(i["items"] as Array<{ id: string; text: string; status: string }>),
  task: (i) => runSubagent(i["prompt"] as string),
  load_skill: (i) => SKILLS.getContent(i["name"] as string),
  compact: () => "Manual compression requested.",
  task_create: (i) => TASKS.create(i["subject"] as string, i["description"] as string | undefined),
  task_update: (i) => TASKS.update(i["task_id"] as number, i["status"] as ("pending" | "in_progress" | "completed") | undefined, i["addBlockedBy"] as number[] | undefined, i["removeBlockedBy"] as number[] | undefined),
  task_list: () => TASKS.listAll(),
  task_get: (i) => TASKS.get(i["task_id"] as number),
  background_run: (i) => BG.run(i["command"] as string),
  check_background: (i) => BG.check(i["task_id"] as string | undefined),
  spawn_teammate: (i) => TEAM.spawn(i["name"] as string, i["role"] as string, i["prompt"] as string, true),
  list_teammates: () => TEAM.listAll(),
  send_message: (i) => BUS.send("lead", i["to"] as string, i["content"] as string, (i["msg_type"] as "message") ?? "message"),
  read_inbox: () => JSON.stringify(BUS.readInbox("lead"), null, 2),
  broadcast: (i) => BUS.broadcast("lead", i["content"] as string, TEAM.memberNames()),
  shutdown_request: (i) => {
    BUS.send("lead", i["teammate"] as string, "Please shut down gracefully.", "shutdown_request");
    return `Shutdown request sent to '${String(i["teammate"])}'`;
  },
  plan_approval: (i) => {
    BUS.send("lead", i["to"] as string, String(i["feedback"] ?? ""), "plan_approval_response", { request_id: i["request_id"], approve: i["approve"] });
    return `Plan review sent for request ${String(i["request_id"] ?? "")}`;
  },
};

const TOOLS: Anthropic.Tool[] = [
  // base
  { name: "bash", description: "Run a shell command.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "read_file", description: "Read file contents.", input_schema: { type: "object", properties: { path: { type: "string" }, limit: { type: "integer" } }, required: ["path"] } },
  { name: "write_file", description: "Write content to file.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
  { name: "edit_file", description: "Replace exact text in file.", input_schema: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] } },
  // todo
  { name: "todo", description: "Update task list. Track progress on multi-step tasks.", input_schema: { type: "object", properties: { items: { type: "array", items: { type: "object" } } }, required: ["items"] } },
  // subagent
  { name: "task", description: "Spawn a subagent with fresh context.", input_schema: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] } },
  // skills
  { name: "load_skill", description: "Load specialized knowledge by name.", input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] } },
  // compact
  { name: "compact", description: "Trigger manual conversation compression.", input_schema: { type: "object", properties: { focus: { type: "string" } } } },
  // tasks
  { name: "task_create", description: "Create a new task.", input_schema: { type: "object", properties: { subject: { type: "string" }, description: { type: "string" } }, required: ["subject"] } },
  { name: "task_update", description: "Update task status or dependencies.", input_schema: { type: "object", properties: { task_id: { type: "integer" }, status: { type: "string" }, addBlockedBy: { type: "array", items: { type: "integer" } }, removeBlockedBy: { type: "array", items: { type: "integer" } } }, required: ["task_id"] } },
  { name: "task_list", description: "List all tasks.", input_schema: { type: "object", properties: {} } },
  { name: "task_get", description: "Get task details.", input_schema: { type: "object", properties: { task_id: { type: "integer" } }, required: ["task_id"] } },
  // bg
  { name: "background_run", description: "Run command in background.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
  { name: "check_background", description: "Check background task status.", input_schema: { type: "object", properties: { task_id: { type: "string" } } } },
  // team
  { name: "spawn_teammate", description: "Spawn a persistent teammate.", input_schema: { type: "object", properties: { name: { type: "string" }, role: { type: "string" }, prompt: { type: "string" } }, required: ["name", "role", "prompt"] } },
  { name: "list_teammates", description: "List all teammates.", input_schema: { type: "object", properties: {} } },
  { name: "send_message", description: "Send message to a teammate.", input_schema: { type: "object", properties: { to: { type: "string" }, content: { type: "string" }, msg_type: { type: "string" } }, required: ["to", "content"] } },
  { name: "read_inbox", description: "Read and drain lead's inbox.", input_schema: { type: "object", properties: {} } },
  { name: "broadcast", description: "Send message to all teammates.", input_schema: { type: "object", properties: { content: { type: "string" } }, required: ["content"] } },
  { name: "shutdown_request", description: "Request a teammate to shut down.", input_schema: { type: "object", properties: { teammate: { type: "string" } }, required: ["teammate"] } },
  { name: "plan_approval", description: "Send plan approval decision.", input_schema: { type: "object", properties: { to: { type: "string" }, request_id: { type: "string" }, approve: { type: "boolean" }, feedback: { type: "string" } }, required: ["to", "request_id", "approve"] } },
];

async function agentLoop(messages: Anthropic.MessageParam[]): Promise<Anthropic.MessageParam[]> {
  let roundsSinceTodo = 0;
  while (true) {
    // microcompact + auto compact
    microCompact(messages);
    if (estimateTokens(messages) > TOKEN_THRESHOLD) {
      messages = await autoCompact(messages, client, MODEL, path.join(WORKDIR, ".transcripts"));
    }

    // bg notifications
    const notifs = BG.drainNotifications();
    if (notifs.length > 0 && messages.length > 0) {
      messages.push({ role: "user", content: `<background-results>\n${notifs.map((n) => `[bg:${n.taskId}] ${n.status}: ${n.result}`).join("\n")}\n</background-results>` });
    }

    // lead inbox
    const inbox = BUS.readInbox("lead");
    if (inbox.length > 0) {
      messages.push({ role: "user", content: `<inbox>${JSON.stringify(inbox, null, 2)}</inbox>` });
    }

    const response = await client.messages.create({ model: MODEL, system: SYSTEM, messages, tools: TOOLS, max_tokens: 8000 });
    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason !== "tool_use") return messages;

    const results: (Anthropic.ToolResultBlockParam | Anthropic.TextBlockParam)[] = [];
    let usedTodo = false;
    let manualCompact = false;

    for (const block of response.content) {
      if (block.type === "tool_use") {
        let out: string;
        try {
          if (block.name === "compact") {
            manualCompact = true;
            out = "Compressing...";
          } else {
            const handler = TOOL_HANDLERS[block.name];
            const maybe = handler ? handler(block.input as ToolInput) : `Unknown tool: ${block.name}`;
            out = await Promise.resolve(maybe);
          }
        } catch (e) {
          out = `Error: ${(e as Error).message}`;
        }
        console.log(`> ${block.name}:`);
        console.log(out.slice(0, 200));
        results.push({ type: "tool_result", tool_use_id: block.id, content: out });
        if (block.name === "todo") usedTodo = true;
      }
    }

    roundsSinceTodo = usedTodo ? 0 : roundsSinceTodo + 1;
    if (roundsSinceTodo >= 3) {
      results.push({ type: "text", text: "<reminder>Update your todos.</reminder>" });
    }

    messages.push({ role: "user", content: results });

    if (manualCompact) {
      messages = await autoCompact(messages, client, MODEL, path.join(WORKDIR, ".transcripts"));
      return messages;
    }
  }
}

async function main() {
  const rl = readline.createInterface({ input, output });
  let history: Anthropic.MessageParam[] = [];
  console.log('Full agent. Slash commands: /compact /tasks /team /inbox. Type "q" to quit.');

  while (true) {
    let query: string;
    try { query = await rl.question("\x1b[36mfull >> \x1b[0m"); } catch { break; }
    if (!query.trim() || ["q", "exit"].includes(query.trim().toLowerCase())) break;

    // Slash commands
    if (query.startsWith("/")) {
      if (query.trim() === "/compact") {
        history = await autoCompact(history, client, MODEL, path.join(WORKDIR, ".transcripts"));
        console.log("Conversation compacted.");
        continue;
      }
      if (query.trim() === "/tasks") {
        console.log(TASKS.listAll());
        continue;
      }
      if (query.trim() === "/team") {
        console.log(TEAM.listAll());
        continue;
      }
      if (query.trim() === "/inbox") {
        console.log(JSON.stringify(BUS.readInbox("lead"), null, 2));
        continue;
      }
      console.log("Unknown slash command");
      continue;
    }

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
