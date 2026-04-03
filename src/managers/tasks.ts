/**
 * src/managers/tasks.ts - Persistent file-backed task manager (s07)
 */

import * as fs from "node:fs";
import * as path from "node:path";

export type TaskStatus = "pending" | "in_progress" | "completed";

export interface TaskRecord {
  id: number;
  subject: string;
  description: string;
  status: TaskStatus;
  blockedBy: number[];
  owner: string;
  worktree?: string;
  created_at?: number;
  updated_at?: number;
}

const MARKERS: Record<TaskStatus, string> = {
  pending: "[ ]",
  in_progress: "[>]",
  completed: "[x]",
};

export class TaskManager {
  private nextId: number;

  constructor(private readonly tasksDir: string) {
    fs.mkdirSync(tasksDir, { recursive: true });
    this.nextId = this.computeMaxId() + 1;
  }

  private computeMaxId(): number {
    const ids = fs.readdirSync(this.tasksDir)
      .filter((f) => f.match(/^task_\d+\.json$/))
      .map((f) => parseInt(f.replace(/[^0-9]/g, ""), 10))
      .filter((n) => !isNaN(n));
    return ids.length > 0 ? Math.max(...ids) : 0;
  }

  private taskPath(id: number): string {
    return path.join(this.tasksDir, `task_${id}.json`);
  }

  private load(id: number): TaskRecord {
    const p = this.taskPath(id);
    if (!fs.existsSync(p)) throw new Error(`Task ${id} not found`);
    return JSON.parse(fs.readFileSync(p, "utf8")) as TaskRecord;
  }

  private save(task: TaskRecord): void {
    fs.writeFileSync(this.taskPath(task.id), JSON.stringify(task, null, 2), "utf8");
  }

  private clearDependency(completedId: number): void {
    for (const file of fs.readdirSync(this.tasksDir).filter((f) => f.match(/^task_\d+\.json$/))) {
      const p = path.join(this.tasksDir, file);
      const t = JSON.parse(fs.readFileSync(p, "utf8")) as TaskRecord;
      if (t.blockedBy.includes(completedId)) {
        t.blockedBy = t.blockedBy.filter((id) => id !== completedId);
        fs.writeFileSync(p, JSON.stringify(t, null, 2), "utf8");
      }
    }
  }

  create(subject: string, description = ""): string {
    const task: TaskRecord = {
      id: this.nextId,
      subject,
      description,
      status: "pending",
      blockedBy: [],
      owner: "",
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    this.save(task);
    this.nextId++;
    return JSON.stringify(task, null, 2);
  }

  get(taskId: number): string {
    return JSON.stringify(this.load(taskId), null, 2);
  }

  update(
    taskId: number,
    status?: TaskStatus,
    addBlockedBy?: number[],
    removeBlockedBy?: number[],
    owner?: string,
    worktree?: string
  ): string {
    const task = this.load(taskId);
    if (status) {
      if (!["pending", "in_progress", "completed"].includes(status)) {
        throw new Error(`Invalid status: ${status}`);
      }
      task.status = status;
      if (status === "completed") this.clearDependency(taskId);
    }
    if (addBlockedBy) {
      task.blockedBy = [...new Set([...task.blockedBy, ...addBlockedBy])];
    }
    if (removeBlockedBy) {
      task.blockedBy = task.blockedBy.filter((id) => !removeBlockedBy.includes(id));
    }
    if (owner !== undefined) task.owner = owner;
    if (worktree !== undefined) task.worktree = worktree;
    task.updated_at = Date.now();
    this.save(task);
    return JSON.stringify(task, null, 2);
  }

  bindWorktree(taskId: number, worktree: string, owner = ""): string {
    return this.update(taskId, "in_progress", undefined, undefined, owner || undefined, worktree);
  }

  unbindWorktree(taskId: number): string {
    return this.update(taskId, undefined, undefined, undefined, undefined, "");
  }

  listAll(): string {
    const files = fs.readdirSync(this.tasksDir)
      .filter((f) => f.match(/^task_\d+\.json$/))
      .sort((a, b) => {
        const na = parseInt(a.replace(/[^0-9]/g, ""), 10);
        const nb = parseInt(b.replace(/[^0-9]/g, ""), 10);
        return na - nb;
      });
    if (files.length === 0) return "No tasks.";
    return files.map((file) => {
      const t = JSON.parse(fs.readFileSync(path.join(this.tasksDir, file), "utf8")) as TaskRecord;
      const marker = MARKERS[t.status] ?? "[?]";
      const blocked = t.blockedBy.length > 0 ? ` (blocked by: ${t.blockedBy.join(", ")})` : "";
      const owner = t.owner ? ` owner=${t.owner}` : "";
      const wt = t.worktree ? ` wt=${t.worktree}` : "";
      return `${marker} #${t.id}: ${t.subject}${blocked}${owner}${wt}`;
    }).join("\n");
  }

  exists(taskId: number): boolean {
    return fs.existsSync(this.taskPath(taskId));
  }

  scanUnclaimed(): TaskRecord[] {
    const files = fs.readdirSync(this.tasksDir)
      .filter((f) => f.match(/^task_\d+\.json$/))
      .sort();
    return files
      .map((f) => JSON.parse(fs.readFileSync(path.join(this.tasksDir, f), "utf8")) as TaskRecord)
      .filter((t) => t.status === "pending" && !t.owner && t.blockedBy.length === 0);
  }
}
