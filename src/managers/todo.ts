/**
 * src/managers/todo.ts - In-memory todo manager (s03)
 */

export type TodoStatus = "pending" | "in_progress" | "completed";

export interface TodoItem {
  id: string;
  text: string;
  status: TodoStatus;
}

const MARKERS: Record<TodoStatus, string> = {
  pending: "[ ]",
  in_progress: "[>]",
  completed: "[x]",
};

export class TodoManager {
  private items: TodoItem[] = [];

  update(raw: Array<{ id: string; text: string; status: string }>): string {
    if (raw.length > 20) throw new Error("Max 20 todos allowed");
    const validated: TodoItem[] = [];
    let inProgressCount = 0;
    for (const item of raw) {
      const text = String(item.text ?? "").trim();
      const status = String(item.status ?? "pending").toLowerCase() as TodoStatus;
      const id = String(item.id ?? validated.length + 1);
      if (!text) throw new Error(`Item ${id}: text required`);
      if (!["pending", "in_progress", "completed"].includes(status)) {
        throw new Error(`Item ${id}: invalid status '${status}'`);
      }
      if (status === "in_progress") inProgressCount++;
      validated.push({ id, text, status });
    }
    if (inProgressCount > 1) throw new Error("Only one task can be in_progress at a time");
    this.items = validated;
    return this.render();
  }

  render(): string {
    if (this.items.length === 0) return "No todos.";
    const lines = this.items.map(
      (item) => `${MARKERS[item.status]} #${item.id}: ${item.text}`
    );
    const done = this.items.filter((t) => t.status === "completed").length;
    lines.push(`\n(${done}/${this.items.length} completed)`);
    return lines.join("\n");
  }
}
