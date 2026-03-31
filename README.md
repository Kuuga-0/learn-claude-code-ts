# learn-claude-code-ts

`shareAI-lab/learn-claude-code` 的 TypeScript 版脚手架。

这个仓库的目标不是一次性实现完整 Agent，而是**保留原仓库完全相同的章节结构**，把语言从 Python 切换为 TypeScript，方便你按章节一步一步自己实现。

## 对照关系

- 参考仓库：`.reference/`
- TypeScript 章节：`agents/*.ts`
- 原版 Python 章节：`.reference/agents/*.py`

## 章节列表

- `s01-agent-loop.ts` — 最小 Agent 循环
- `s02-tool-use.ts` — 工具分发
- `s03-todo-write.ts` — Todo 追踪
- `s04-subagent.ts` — 子代理
- `s05-skill-loading.ts` — 技能加载
- `s06-context-compact.ts` — 上下文压缩
- `s07-task-system.ts` — 持久化任务系统
- `s08-background-tasks.ts` — 后台任务
- `s09-agent-teams.ts` — 多代理团队
- `s10-team-protocols.ts` — 团队协议
- `s11-autonomous-agents.ts` — 自主代理
- `s12-worktree-task-isolation.ts` — Worktree 隔离
- `s-full.ts` — 完整版骨架

## 目录结构

```text
agents/     TypeScript 章节骨架
skills/     直接复用原仓库技能文件
docs/       直接复用原仓库文档（en / zh / ja）
tests/      最小 smoke test
.reference/ 原版 Python 参考实现（已忽略）
```

## 开始使用

1. 安装依赖：

```bash
npm install
```

2. 复制环境变量：

```bash
cp .env.example .env
```

3. 从第一章开始实现：

```bash
npm run s01
```

## 开发命令

```bash
npm run typecheck
npm test
npm run s01
npm run s02
npm run s03
# ...
npm run full
```

## 说明

- 当前仓库是**框架骨架**，核心逻辑大多保留为 `TODO`。
- 每个 `.ts` 文件顶部都标注了对应的原版 `.py` 文件。
- 你可以直接对照 `.reference/agents/` 逐章迁移���实现。
