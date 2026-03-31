#!/usr/bin/env npx tsx
// Harness: planning -- keeping the model on course without scripting the route.
/**
 * s03-todo-write.ts - TodoWrite
 *
 * The model tracks its own progress via a TodoManager. A nag reminder
 * forces it to keep updating when it forgets.
 *
 *     +----------+      +-------+      +---------+
 *     |   User   | ---> |  LLM  | ---> | Tools   |
 *     |  prompt  |      |       |      | + todo  |
 *     +----------+      +---+---+      +----+----+
 *                           ^               |
 *                           |   tool_result |
 *                           +---------------+
 *                                 |
 *                     +-----------+-----------+
 *                     | TodoManager state     |
 *                     | [ ] task A            |
 *                     | [>] task B <- doing   |
 *                     | [x] task C            |
 *                     +-----------------------+
 *                                 |
 *                     if roundsSinceTodo >= 3:
 *                       inject <reminder>
 *
 * Key insight: "The agent can track its own progress -- and I can see it."
 *
 * Ref: .reference/agents/s03_todo_write.py
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
const SYSTEM = `You are a coding agent at ${WORKDIR}.
Use the todo tool to plan multi-step tasks. Mark in_progress before starting, completed when done.
Prefer tools over prose.`;

// -- Types --
type TodoStatus = "pending" | "in_progress" | "completed";

interface TodoItem {
  id: string;
  text: string;
  status: TodoStatus;
}

// -- TodoManager: structured state the LLM writes to --
class TodoManager {
  private items: TodoItem[] = [];

  update(items: Array<{ id: string; text: string; status: string }>): string {
    // TODO: 实现 todo 更新逻辑
    // 验证: 最多 20 条、只能有一个 in_progress、状态值合法
    // 更新 this.items 并返回 this.render()
    throw new Error("TODO: implement TodoManager.update");
  }

  render(): string {
    // TODO: 渲染待办列表为可读字符串
    // 格式: [ ] #1: task A  [>] #2: task B  [x] #3: task C
    throw new Error("TODO: implement TodoManager.render");
  }
}

const TODO = new TodoManager();

// -- Tool implementations (base tools same as s02) --
function safePath(p: string): string {
  throw new Error("TODO: implement safePath");
}
function runBash(command: string): string {
  throw new Error("TODO: implement runBash");
}
function runRead(filePath: string, limit?: number): string {
  throw new Error("TODO: implement runRead");
}
function runWrite(filePath: string, content: string): string {
  throw new Error("TODO: implement runWrite");
}
function runEdit(filePath: string, oldText: string, newText: string): string {
  throw new Error("TODO: implement runEdit");
}

type ToolInput = Record<string, unknown>;
const TOOL_HANDLERS: Record<string, (input: ToolInput) => string> = {
  bash: (i) => runBash(i.command as string),
  read_file: (i) => runRead(i.path as string, i.limit as number | undefined),
  write_file: (i) => runWrite(i.path as string, i.content as string),
  edit_file: (i) => runEdit(i.path as string, i.old_text as string, i.new_text as string),
  todo: (i) =>
    TODO.update(
      i.items as Array<{ id: string; text: string; status: string }>
    ),
};

const TOOLS: Anthropic.Tool[] = [
  {
    name: "bash",
    description: "Run a shell command.",
    input_schema: {
      type: "object",
      properties: { command: { type: "string" } },
      required: ["command"],
    },
  },
  {
    name: "read_file",
    description: "Read file contents.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" }, limit: { type: "integer" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to file.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" } },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description: "Replace exact text in file.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string" },
        old_text: { type: "string" },
        new_text: { type: "string" },
      },
      required: ["path", "old_text", "new_text"],
    },
  },
  {
    name: "todo",
    description: "Update task list. Track progress on multi-step tasks.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              text: { type: "string" },
              status: { type: "string", enum: ["pending", "in_progress", "completed"] },
            },
            required: ["id", "text", "status"],
          },
        },
      },
      required: ["items"],
    },
  },
];

// -- Agent loop with nag reminder injection --
async function agentLoop(messages: Anthropic.MessageParam[]): Promise<void> {
  // TODO: 与 s02 相同的循环
  // 新增: 记录 roundsSinceTodo，>= 3 时在 tool_results 中注入 <reminder>
  throw new Error("TODO: implement agentLoop");
}

// -- REPL --
async function main() {
  const rl = readline.createInterface({ input, output });
  const history: Anthropic.MessageParam[] = [];

  console.log('s03 todo write. Type "q" or "exit" to quit.');

  while (true) {
    let query: string;
    try {
      query = await rl.question("\x1b[36ms03 >> \x1b[0m");
    } catch {
      break;
    }
    if (!query.trim() || ["q", "exit"].includes(query.trim().toLowerCase())) break;
    history.push({ role: "user", content: query });
    await agentLoop(history);
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
