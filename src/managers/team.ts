/**
 * src/managers/team.ts - Team messaging & teammate management (s09-s11)
 *
 * MessageBus: JSONL inbox per teammate in .team/inbox/
 * TeammateManager: persistent config.json + Node.js Worker threads for teammates
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { randomBytes } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { runBash, runRead, runWrite, runEdit } from "../tools/base-tools.js";
import type { ToolInput } from "../types/agent.js";

export type MsgType =
  | "message"
  | "broadcast"
  | "shutdown_request"
  | "shutdown_response"
  | "plan_approval_response";

export interface TeamMessage {
  type: MsgType;
  from: string;
  content: string;
  timestamp: number;
  [key: string]: unknown;
}

export interface TeamMember {
  name: string;
  role: string;
  status: "working" | "idle" | "shutdown";
}

export interface TeamConfig {
  team_name: string;
  members: TeamMember[];
}

const VALID_MSG_TYPES: Set<string> = new Set([
  "message",
  "broadcast",
  "shutdown_request",
  "shutdown_response",
  "plan_approval_response",
]);

// ------- MessageBus -------

export class MessageBus {
  constructor(private readonly inboxDir: string) {
    fs.mkdirSync(inboxDir, { recursive: true });
  }

  send(
    sender: string,
    to: string,
    content: string,
    msgType: MsgType = "message",
    extra?: Record<string, unknown>
  ): string {
    if (!VALID_MSG_TYPES.has(msgType)) {
      return `Error: Invalid type '${msgType}'. Valid: ${[...VALID_MSG_TYPES].join(", ")}`;
    }
    const msg: TeamMessage = {
      type: msgType,
      from: sender,
      content,
      timestamp: Date.now() / 1000,
      ...(extra ?? {}),
    };
    const inboxPath = path.join(this.inboxDir, `${to}.jsonl`);
    fs.appendFileSync(inboxPath, JSON.stringify(msg) + "\n", "utf8");
    return `Sent ${msgType} to ${to}`;
  }

  readInbox(name: string): TeamMessage[] {
    const inboxPath = path.join(this.inboxDir, `${name}.jsonl`);
    if (!fs.existsSync(inboxPath)) return [];
    const lines = fs.readFileSync(inboxPath, "utf8").trim().split("\n").filter(Boolean);
    fs.writeFileSync(inboxPath, "", "utf8");
    return lines.map((l) => JSON.parse(l) as TeamMessage);
  }

  broadcast(sender: string, content: string, teammates: string[]): string {
    let count = 0;
    for (const name of teammates) {
      if (name !== sender) {
        this.send(sender, name, content, "broadcast");
        count++;
      }
    }
    return `Broadcast to ${count} teammates`;
  }
}

// ------- TeammateManager -------

export interface TeammateManagerOptions {
  workdir: string;
  teamDir: string;
  model: string;
  apiKey?: string;
  baseURL?: string;
  pollInterval?: number;
  idleTimeout?: number;
}

export class TeammateManager {
  config: TeamConfig;
  private configPath: string;
  private bus: MessageBus;
  private workers = new Map<string, Worker>();
  private opts: TeammateManagerOptions;

  constructor(opts: TeammateManagerOptions) {
    this.opts = opts;
    this.configPath = path.join(opts.teamDir, "config.json");
    fs.mkdirSync(opts.teamDir, { recursive: true });
    const inboxDir = path.join(opts.teamDir, "inbox");
    this.bus = new MessageBus(inboxDir);
    this.config = this.loadConfig();
  }

  private loadConfig(): TeamConfig {
    if (fs.existsSync(this.configPath)) {
      return JSON.parse(fs.readFileSync(this.configPath, "utf8")) as TeamConfig;
    }
    return { team_name: "default", members: [] };
  }

  private saveConfig(): void {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), "utf8");
  }

  private findMember(name: string): TeamMember | undefined {
    return this.config.members.find((m) => m.name === name);
  }

  getBus(): MessageBus {
    return this.bus;
  }

  spawn(name: string, role: string, prompt: string, autonomous = false): string {
    const member = this.findMember(name);
    if (member) {
      if (!["idle", "shutdown"].includes(member.status)) {
        return `Error: '${name}' is currently ${member.status}`;
      }
      member.status = "working";
      member.role = role;
    } else {
      this.config.members.push({ name, role, status: "working" });
    }
    this.saveConfig();

    const workerData = {
      name,
      role,
      prompt,
      teamName: this.config.team_name,
      workdir: this.opts.workdir,
      teamDir: this.opts.teamDir,
      model: this.opts.model,
      apiKey: this.opts.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "",
      baseURL: this.opts.baseURL ?? process.env.ANTHROPIC_BASE_URL ?? "",
      pollInterval: this.opts.pollInterval ?? 5000,
      idleTimeout: this.opts.idleTimeout ?? 60000,
      autonomous,
    };

    // Run teammate loop inline (in the same process) using async so main loop stays responsive
    // (Node worker_threads complicates imports; we use a simpler approach for teaching clarity)
    this.runTeammateAsync(workerData);
    return `Spawned '${name}' (role: ${role})`;
  }

  private async runTeammateAsync(data: {
    name: string;
    role: string;
    prompt: string;
    teamName: string;
    workdir: string;
    teamDir: string;
    model: string;
    apiKey: string;
    baseURL: string;
    pollInterval: number;
    idleTimeout: number;
    autonomous: boolean;
  }): Promise<void> {
    const client = new Anthropic({ apiKey: data.apiKey, baseURL: data.baseURL || undefined });
    const bus = new MessageBus(path.join(data.teamDir, "inbox"));
    const tasksDir = path.join(data.workdir, ".tasks");

    const TEAMMATE_TOOLS: Anthropic.Tool[] = [
      { name: "bash", description: "Run a shell command.", input_schema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
      { name: "read_file", description: "Read file contents.", input_schema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
      { name: "write_file", description: "Write content to file.", input_schema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
      { name: "edit_file", description: "Replace exact text in file.", input_schema: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] } },
      { name: "send_message", description: "Send message to a teammate.", input_schema: { type: "object", properties: { to: { type: "string" }, content: { type: "string" }, msg_type: { type: "string" } }, required: ["to", "content"] } },
      { name: "read_inbox", description: "Read and drain your inbox.", input_schema: { type: "object", properties: {} } },
      { name: "shutdown_response", description: "Respond to a shutdown request.", input_schema: { type: "object", properties: { request_id: { type: "string" }, approve: { type: "boolean" }, reason: { type: "string" } }, required: ["request_id", "approve"] } },
      { name: "plan_approval", description: "Submit a plan for lead approval.", input_schema: { type: "object", properties: { plan: { type: "string" } }, required: ["plan"] } },
      { name: "idle", description: "Signal that you have no more immediate work. Enters idle poll.", input_schema: { type: "object", properties: {} } },
      { name: "claim_task", description: "Claim an unclaimed task by ID.", input_schema: { type: "object", properties: { task_id: { type: "integer" } }, required: ["task_id"] } },
    ];

    const sysprompt = `You are '${data.name}', role: ${data.role}, team: ${data.teamName}, at ${data.workdir}. Use send_message to communicate. Complete your task.${data.autonomous ? " Use idle tool when you have no more work. You will auto-claim new tasks." : ""}`;

    const messages: Anthropic.MessageParam[] = [{ role: "user", content: data.prompt }];
    let shouldExit = false;

    const exec = (toolName: string, args: ToolInput): string => {
      if (toolName === "bash") return runBash(args["command"] as string);
      if (toolName === "read_file") return runRead(args["path"] as string);
      if (toolName === "write_file") return runWrite(args["path"] as string, args["content"] as string);
      if (toolName === "edit_file") return runEdit(args["path"] as string, args["old_text"] as string, args["new_text"] as string);
      if (toolName === "send_message") return bus.send(data.name, args["to"] as string, args["content"] as string, (args["msg_type"] as MsgType | undefined) ?? "message");
      if (toolName === "read_inbox") return JSON.stringify(bus.readInbox(data.name), null, 2);
      if (toolName === "shutdown_response") {
        const approve = args["approve"] as boolean;
        bus.send(data.name, "lead", String(args["reason"] ?? ""), "shutdown_response", { request_id: args["request_id"], approve });
        if (approve) shouldExit = true;
        return `Shutdown ${approve ? "approved" : "rejected"}`;
      }
      if (toolName === "plan_approval") {
        const reqId = randomBytes(4).toString("hex");
        const plan = String(args["plan"] ?? "");
        bus.send(data.name, "lead", plan, "plan_approval_response", { request_id: reqId, plan });
        return `Plan submitted (request_id=${reqId}). Waiting for lead approval.`;
      }
      if (toolName === "idle") return "Entering idle phase. Will poll for new tasks.";
      if (toolName === "claim_task") {
        const taskId = args["task_id"] as number;
        const p = path.join(tasksDir, `task_${taskId}.json`);
        if (!fs.existsSync(p)) return `Error: Task ${taskId} not found`;
        const t = JSON.parse(fs.readFileSync(p, "utf8")) as { status: string; owner: string; blockedBy: number[] };
        if (t.owner) return `Error: Task ${taskId} already claimed by ${t.owner}`;
        if (t.status !== "pending") return `Error: Task ${taskId} cannot be claimed (status: ${t.status})`;
        if (t.blockedBy.length > 0) return `Error: Task ${taskId} is blocked`;
        Object.assign(t, { owner: data.name, status: "in_progress" });
        fs.writeFileSync(p, JSON.stringify(t, null, 2), "utf8");
        return `Claimed task #${taskId} for ${data.name}`;
      }
      return `Unknown tool: ${toolName}`;
    };

    // WORK phase
    const work = async (): Promise<boolean> => {
      for (let i = 0; i < 50; i++) {
        const inbox = bus.readInbox(data.name);
        for (const msg of inbox) {
          if (msg.type === "shutdown_request") {
            this.updateStatus(data.name, "shutdown");
            return true;
          }
          messages.push({ role: "user", content: JSON.stringify(msg) });
        }
        if (shouldExit) { this.updateStatus(data.name, "shutdown"); return true; }

        let response: Awaited<ReturnType<typeof client.messages.create>>;
        try {
          response = await client.messages.create({ model: data.model, system: sysprompt, messages, tools: TEAMMATE_TOOLS, max_tokens: 8000 });
        } catch { this.updateStatus(data.name, "idle"); return true; }

        messages.push({ role: "assistant", content: response.content });
        if (response.stop_reason !== "tool_use") break;

        const results: Anthropic.ToolResultBlockParam[] = [];
        let wantsIdle = false;
        for (const block of response.content) {
          if (block.type === "tool_use") {
            const output = exec(block.name, block.input as ToolInput);
            console.log(`  [${data.name}] ${block.name}: ${output.slice(0, 120)}`);
            results.push({ type: "tool_result", tool_use_id: block.id, content: output });
            if (block.name === "idle") wantsIdle = true;
            if (block.name === "shutdown_response" && (block.input as ToolInput)["approve"]) {
              this.updateStatus(data.name, "shutdown");
              return true;
            }
          }
        }
        messages.push({ role: "user", content: results });
        if (wantsIdle) return false;
      }
      return false;
    };

    // Main loop: work -> idle -> work
    while (true) {
      const done = await work();
      if (done) break;

      // IDLE phase
      if (data.autonomous) {
        this.updateStatus(data.name, "idle");
        const deadline = Date.now() + data.idleTimeout;
        let resumed = false;
        while (Date.now() < deadline) {
          await sleep(data.pollInterval);
          const inbox = bus.readInbox(data.name);
          if (inbox.length > 0) {
            for (const msg of inbox) messages.push({ role: "user", content: JSON.stringify(msg) });
            this.updateStatus(data.name, "working");
            resumed = true;
            break;
          }
          const unclaimed = this.scanUnclaimed(tasksDir);
          if (unclaimed.length > 0) {
            const task = unclaimed[0];
            messages.push({ role: "user", content: makeIdentityBlock(data.name, data.role, data.teamName) });
            messages.push({ role: "user", content: `Unclaimed task found: ${JSON.stringify(task)}. Claim it if suitable.` });
            this.updateStatus(data.name, "working");
            resumed = true;
            break;
          }
        }
        if (!resumed) break;
      } else {
        break;
      }
    }

    this.updateStatus(data.name, "idle");
  }

  private scanUnclaimed(tasksDir: string): Array<{ id: number; subject: string }> {
    if (!fs.existsSync(tasksDir)) return [];
    return fs.readdirSync(tasksDir)
      .filter((f) => f.match(/^task_\d+\.json$/))
      .map((f) => JSON.parse(fs.readFileSync(path.join(tasksDir, f), "utf8")) as { id: number; subject: string; status: string; owner: string; blockedBy: number[] })
      .filter((t) => t.status === "pending" && !t.owner && t.blockedBy.length === 0);
  }

  private updateStatus(name: string, status: TeamMember["status"]): void {
    const member = this.findMember(name);
    if (member) {
      member.status = status;
      this.saveConfig();
    }
  }

  listAll(): string {
    if (this.config.members.length === 0) return "No teammates.";
    const lines = [`Team: ${this.config.team_name}`];
    for (const m of this.config.members) lines.push(`  ${m.name} (${m.role}): ${m.status}`);
    return lines.join("\n");
  }

  memberNames(): string[] {
    return this.config.members.map((m) => m.name);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeIdentityBlock(name: string, role: string, teamName: string): string {
  return `<identity>You are '${name}', role: ${role}, team: ${teamName}. Continue your work.</identity>`;
}
