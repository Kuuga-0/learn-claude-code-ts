/**
 * src/managers/background.ts - Background command runner (s08)
 *
 * Runs commands in detached child processes and queues completion notifications.
 * Node.js equivalent of Python's threading.Thread approach.
 */

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

export type BgStatus = "running" | "completed" | "timeout" | "error";

export interface BgTask {
  status: BgStatus;
  result: string | null;
  command: string;
}

export interface BgNotification {
  taskId: string;
  status: BgStatus;
  command: string;
  result: string;
}

export class BackgroundManager {
  private tasks = new Map<string, BgTask>();
  private notificationQueue: BgNotification[] = [];

  run(command: string): string {
    const taskId = randomBytes(4).toString("hex");
    const task: BgTask = { status: "running", result: null, command };
    this.tasks.set(taskId, task);

    const child = spawn("sh", ["-c", command], {
      detached: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });

    // 300s timeout
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      task.status = "timeout";
      task.result = "Error: Timeout (300s)";
      this.notificationQueue.push({ taskId, status: "timeout", command: command.slice(0, 80), result: task.result.slice(0, 500) });
    }, 300_000);

    child.on("close", () => {
      clearTimeout(timer);
      if (task.status === "running") {
        const out = (stdout + stderr).trim().slice(0, 50_000) || "(no output)";
        task.status = "completed";
        task.result = out;
        this.notificationQueue.push({ taskId, status: "completed", command: command.slice(0, 80), result: out.slice(0, 500) });
      }
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      task.status = "error";
      task.result = `Error: ${err.message}`;
      this.notificationQueue.push({ taskId, status: "error", command: command.slice(0, 80), result: task.result.slice(0, 500) });
    });

    return `Background task ${taskId} started: ${command.slice(0, 80)}`;
  }

  check(taskId?: string): string {
    if (taskId) {
      const t = this.tasks.get(taskId);
      if (!t) return `Error: Unknown task ${taskId}`;
      return `[${t.status}] ${t.command.slice(0, 60)}\n${t.result ?? "(running)"}`;
    }
    if (this.tasks.size === 0) return "No background tasks.";
    return [...this.tasks.entries()]
      .map(([id, t]) => `${id}: [${t.status}] ${t.command.slice(0, 60)}`)
      .join("\n");
  }

  drainNotifications(): BgNotification[] {
    const notifs = [...this.notificationQueue];
    this.notificationQueue.length = 0;
    return notifs;
  }
}
