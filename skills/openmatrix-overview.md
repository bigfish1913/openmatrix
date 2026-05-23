---
name: om:help
description: "OpenMatrix 帮助 - 列出所有可用命令和质量门禁设置"
priority: low
---

# OpenMatrix Skills Package

你的代码没测试？OpenMatrix 自动帮你补，覆盖率 >80%

## 可用 Skills

| Skill | 描述 | 用途 |
|-------|------|------|
| `/om` | 默认入口 | AI 推荐路由，用户确认后执行 |
| `/om:start` | 标准流程 | 完整追踪，质量门禁，任务明确可直接执行 |
| `/om:feature` | 小需求流程 | 2-5 个任务块，轻量追踪，适合单一改动点 |
| `/om:brainstorm` | 澄清/设计 | 先澄清不明确点或设计方案，再执行 |
| `/om:auto` | 全自动执行 | 零交互，无审批，适合批量任务 |
| `/om:debug` | 系统化调试 | 问题诊断，根因分析 |
| `/om:status` | 查看状态 | 任务执行进度 |
| `/om:meeting` | 处理阻塞 | 处理 blocked 任务 |
| `/om:report` | 生成报告 | 执行报告生成 |
| `/om:resume` | 恢复任务 | 恢复中断的任务 |
| `/om:research` | 领域调研 | 技术方案调研 |

## 快速开始

```
/om 实现用户登录功能

# AI 分析任务 → 推荐路由 → 用户确认 → 执行
```

## 质量门禁

| 模式 | TDD | 覆盖率 | Lint | 安全扫描 |
|------|:---:|:------:|:----:|:--------:|
| 严格模式 | Y | >80% | Y | Y |
| 平衡模式 | N | >60% | Y | Y |
| 快速模式 | N | 无 | N | N |

## 安装

```bash
npm install -g openmatrix
openmatrix install-skills
```

## 文档

- GitHub: https://github.com/bigfish1913/openmatrix
- NPM: https://www.npmjs.com/package/openmatrix