/**
 * src/types/agent.ts - Shared types used across all chapter agents
 */

export type ToolInput = Record<string, unknown>;

export type TaskStatus = "pending" | "in_progress" | "completed";

export interface TaskRecord {
  id: number;
  subject: string;
  description: string;
  status: TaskStatus;
  blockedBy: number[];
  owner: string;
  [key: string]: unknown;
}
