/**
 * src/managers/skills.ts - Skill loader (s05)
 *
 * Scans skills/{name}/SKILL.md files, parses YAML frontmatter,
 * provides two-layer access: metadata descriptions + full body on demand.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { parse as parseYaml } from "yaml";

export interface SkillMeta {
  name: string;
  description: string;
  tags?: string;
  [key: string]: unknown;
}

export interface Skill {
  meta: SkillMeta;
  body: string;
  filePath: string;
}

export class SkillLoader {
  private skills = new Map<string, Skill>();

  constructor(private readonly skillsDir: string) {
    this.loadAll();
  }

  private loadAll() {
    if (!fs.existsSync(this.skillsDir)) return;
    this.scanDir(this.skillsDir);
  }

  private scanDir(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.scanDir(full);
      } else if (entry.name === "SKILL.md") {
        const text = fs.readFileSync(full, "utf8");
        const { meta, body } = this.parseFrontmatter(text);
        const name = (meta.name as string) ?? path.basename(path.dirname(full));
        this.skills.set(name, { meta: meta as SkillMeta, body, filePath: full });
      }
    }
  }

  private parseFrontmatter(text: string): { meta: Record<string, unknown>; body: string } {
    const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { meta: {}, body: text.trim() };
    try {
      const meta = (parseYaml(match[1]) as Record<string, unknown>) ?? {};
      return { meta, body: match[2].trim() };
    } catch {
      return { meta: {}, body: match[2].trim() };
    }
  }

  /** Layer 1: short descriptions for system prompt injection */
  getDescriptions(): string {
    if (this.skills.size === 0) return "(no skills available)";
    return [...this.skills.entries()]
      .map(([name, skill]) => {
        const desc = skill.meta.description ?? "No description";
        const tags = skill.meta.tags ? ` [${skill.meta.tags}]` : "";
        return `  - ${name}: ${desc}${tags}`;
      })
      .join("\n");
  }

  /** Layer 2: full skill body returned in tool_result */
  getContent(name: string): string {
    const skill = this.skills.get(name);
    if (!skill) {
      return `Error: Unknown skill '${name}'. Available: ${[...this.skills.keys()].join(", ")}`;
    }
    return `<skill name="${name}">\n${skill.body}\n</skill>`;
  }

  get size(): number {
    return this.skills.size;
  }
}
