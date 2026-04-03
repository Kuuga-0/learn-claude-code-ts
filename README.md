# learn-claude-code-ts

`shareAI-lab/learn-claude-code` 的 TypeScript 移植版。

这个仓库保留了原项目的章节式教学结构，把实现语言从 Python 切换为 TypeScript，并保留独立的 `web/` 学习站点子项目。

## 对照关系

- 参考仓库：`.reference/`
- TypeScript 章节：`agents/*.ts`
- 原版 Python 章节：`.reference/agents/*.py`
- 学习站点：`web/`

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
- `s-full.ts` — 完整集成版

## 目录结构

```text
agents/      TypeScript 章节实现
src/         共享基础模块（tools / managers / types）
skills/      复用原仓库技能文件
docs/        复用原仓库文档（en / zh / ja）
web/         独立 Next.js 学习站点
tests/       基础 smoke test
.reference/  原版 Python 参考实现（已忽略）
```

## 开始使用

1. 安装根目录依赖：

```bash
npm install
```

2. 复制环境变量：

```bash
cp .env.example .env
```

3. 运行任一章节：

```bash
npm run s01
npm run s02
npm run s03
# ...
npm run full
```

## 根目录开发命令

```bash
npm run typecheck
npm test
npm run s01
npm run s02
npm run s03
npm run s04
npm run s05
npm run s06
npm run s07
npm run s08
npm run s09
npm run s10
npm run s11
npm run s12
npm run full
```

## Web 学习站点

进入 `web/` 后：

```bash
npm install
npm run extract
npm run dev
npm run build
```

说明：
- `web/scripts/extract-content.ts` 会从根目录 `agents/*.ts` 和 `docs/*` 提取内容
- 生成文件输出到 `web/src/data/generated/`
- 站点支持 `en / zh / ja` 三种语言

## 说明

- 每个 `.ts` 文件顶部都标注了对应的原版 `.py` 文件
- 共享逻辑被提取到 `src/`，但各章节仍保持清晰的教学边界
- 你可以对照 `.reference/agents/` 和 `web/` 页面逐章学习与验证
