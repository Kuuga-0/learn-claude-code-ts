/**
 * src/tools/base-tools.ts - Shared file/shell tool implementations
 *
 * Used by all chapter agents. Mirrors the Python helpers in each s0x_*.py file.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";

const WORKDIR = process.cwd();
const DANGEROUS = ["rm -rf /", "sudo", "shutdown", "reboot", "> /dev/"];

/**
 * Resolve a user-supplied path inside the workspace.
 * Throws if the resolved path escapes WORKDIR.
 */
export function safePath(p: string): string {
  const resolved = path.resolve(WORKDIR, p);
  const rel = path.relative(WORKDIR, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Path escapes workspace: ${p}`);
  }
  return resolved;
}

/** Run a shell command (blocking, max 120s). */
export function runBash(command: string): string {
  if (DANGEROUS.some((d) => command.includes(d))) {
    return "Error: Dangerous command blocked";
  }
  try {
    const out = execSync(command, {
      cwd: WORKDIR,
      timeout: 120_000,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return out.slice(0, 50_000) || "(no output)";
  } catch (err: unknown) {
    if (err && typeof err === "object") {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      const combined = ((e.stdout ?? "") + (e.stderr ?? "")).trim();
      if (combined) return combined.slice(0, 50_000);
      if (e.message?.includes("ETIMEDOUT") || e.message?.includes("SIGTERM")) {
        return "Error: Timeout (120s)";
      }
      return `Error: ${e.message ?? String(err)}`;
    }
    return `Error: ${String(err)}`;
  }
}

/** Read a file, optionally limiting to N lines. */
export function runRead(filePath: string, limit?: number): string {
  try {
    const abs = safePath(filePath);
    const lines = fs.readFileSync(abs, "utf8").split("\n");
    if (limit && limit < lines.length) {
      return [...lines.slice(0, limit), `... (${lines.length - limit} more)`]
        .join("\n")
        .slice(0, 50_000);
    }
    return lines.join("\n").slice(0, 50_000);
  } catch (e) {
    return `Error: ${(e as Error).message}`;
  }
}

/** Write content to a file, creating parent directories as needed. */
export function runWrite(filePath: string, content: string): string {
  try {
    const abs = safePath(filePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, "utf8");
    return `Wrote ${content.length} bytes to ${filePath}`;
  } catch (e) {
    return `Error: ${(e as Error).message}`;
  }
}

/** Replace the first occurrence of oldText with newText in a file. */
export function runEdit(filePath: string, oldText: string, newText: string): string {
  try {
    const abs = safePath(filePath);
    const content = fs.readFileSync(abs, "utf8");
    if (!content.includes(oldText)) {
      return `Error: Text not found in ${filePath}`;
    }
    fs.writeFileSync(abs, content.replace(oldText, newText), "utf8");
    return `Edited ${filePath}`;
  } catch (e) {
    return `Error: ${(e as Error).message}`;
  }
}
