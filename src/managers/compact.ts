/**
 * src/managers/compact.ts - Context compaction helpers (s06)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const KEEP_RECENT = 3;
const PRESERVE_RESULT_TOOLS = new Set(["read_file"]);

/** Rough token estimate: ~4 chars per token */
export function estimateTokens(messages: Anthropic.MessageParam[]): number {
  return JSON.stringify(messages).length / 4;
}

/**
 * Layer 1: replace old tool_result content (except read_file) with placeholders.
 * Modifies messages in-place.
 */
export function microCompact(messages: Anthropic.MessageParam[]): void {
  // Build tool_use_id -> tool_name map from assistant turns
  const toolNameMap = new Map<string, string>();
  for (const msg of messages) {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (typeof block === "object" && block.type === "tool_use") {
          toolNameMap.set(block.id, block.name);
        }
      }
    }
  }

  // Collect all tool_result entries
  type ResultEntry = { msg: Anthropic.MessageParam; idx: number; result: Anthropic.ToolResultBlockParam };
  const results: ResultEntry[] = [];

  for (const msg of messages) {
    if (msg.role === "user" && Array.isArray(msg.content)) {
      msg.content.forEach((part, idx) => {
        if (
          typeof part === "object" &&
          "type" in part &&
          part.type === "tool_result"
        ) {
          results.push({ msg, idx, result: part as Anthropic.ToolResultBlockParam });
        }
      });
    }
  }

  if (results.length <= KEEP_RECENT) return;

  const toCompact = results.slice(0, results.length - KEEP_RECENT);
  for (const { result } of toCompact) {
    const content = typeof result.content === "string" ? result.content : "";
    if (content.length <= 100) continue;
    const toolName = toolNameMap.get(result.tool_use_id) ?? "unknown";
    if (PRESERVE_RESULT_TOOLS.has(toolName)) continue;
    result.content = `[Previous: used ${toolName}]`;
  }
}

/**
 * Layer 2/3: save transcript and replace messages with an LLM summary.
 * Returns new (compressed) messages array.
 */
export async function autoCompact(
  messages: Anthropic.MessageParam[],
  client: Anthropic,
  model: string,
  transcriptDir: string
): Promise<Anthropic.MessageParam[]> {
  // Save transcript
  fs.mkdirSync(transcriptDir, { recursive: true });
  const transcriptPath = path.join(transcriptDir, `transcript_${Date.now()}.jsonl`);
  const stream = fs.createWriteStream(transcriptPath, { flags: "a" });
  for (const msg of messages) {
    stream.write(JSON.stringify(msg, (_k, v) => (typeof v === "bigint" ? String(v) : v)) + "\n");
  }
  stream.end();
  console.log(`[transcript saved: ${transcriptPath}]`);

  // Ask LLM to summarize
  const conversationText = JSON.stringify(messages, (_k, v) =>
    typeof v === "bigint" ? String(v) : v
  ).slice(-80_000);

  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content:
          "Summarize this conversation for continuity. Include: " +
          "1) What was accomplished, 2) Current state, 3) Key decisions made. " +
          "Be concise but preserve critical details.\n\n" +
          conversationText,
      },
    ],
  });

  const summary =
    response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "(summary)";

  return [
    {
      role: "user",
      content: `[Conversation compressed. Transcript: ${transcriptPath}]\n\n${summary}`,
    },
  ];
}
