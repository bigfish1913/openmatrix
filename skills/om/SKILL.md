---
name: om
description: "Default entry for ALL development tasks. Triggers on DEVELOPMENT intent: implement/build/fix/refactor anything producing code changes. DO NOT trigger on: questions, info requests, status checks, or pure discussion. AI evaluates complexity → routes to feature/start/brainstorm."
priority: critical
always_load: true
---

<INTENT-JUDGMENT>
## 意图判断指南

**AI 应根据用户语义判断意图：**

### 触发信号（开发意图）

- 用户想实现/创建功能（产生代码变更）
- 用户想修复已知问题（有明确的修复目标）
- 用户想重构现有代码
- 用户描述了具体的开发任务
- 用户有明确的目标（添加/修改/删除功能）

### 不触发信号（其他意图）

| 用户意图 | 应调用 |
|---------|--------|
| 询问如何实现 | 直接回答或 /om:brainstorm |
| 查看状态 | /om:status |
| 调查问题原因 | /om:debug |
| 纯讨论想法 | 直接交流或 /om:brainstorm |

### 示例判断

| 用户消息 | 判断 | 结果 |
|---------|------|------|
| "实现登录功能" | 开发意图明确 | 触发 ✓ |
| "修复按钮样式问题" | 有明确修复目标 | 触发 ✓ |
| "给列表加搜索" | 功能添加意图 | 触发 ✓ |
| "怎么实现登录？" | 询问方法 | 直接回答 |
| "API 返回 500 为什么" | 调查意图 | /om:debug |
| "查看任务状态" | 状态检查 | /om:status |
</INTENT-JUDGMENT>

<EXTREMELY-IMPORTANT>
## This is the DEFAULT entry for ALL development tasks.

**STOP. Do NOT invoke any other task orchestration skill.**
**Invoke this skill IMMEDIATELY when the user wants code changes.**
**意图判断参见上方 INTENT-JUDGMENT 区块。**

如果你认为有哪怕 1% 的可能性某个 skill 适用，你必须调用它。

如果 SKILL 适用，你没有选择。你必须使用它。

这不是可选的。这不是协商的。你不能为自己找借口。

</EXTREMELY-IMPORTANT>

<RED-FLAGS>
## 红旗警告 - 停止并检查

这些想法意味着你在找借口：

| 想法 | 真相 |
|-----|------|
| "这只是简单问题" | 问题也是任务。检查 skills。 |
| "我需要更多上下文" | Skill 检查在澄清问题之前。 |
| "让我先探索代码" | Skills 指导你如何探索。先检查。 |
| "这不需要正式 skill" | 如果存在 skill，就用它。 |
| "我记得这个 skill" | Skills 会演变。读取当前版本。 |
| "这不算开发任务" | 有代码变更 = 开发任务。用 om。 |
| "快速改一下就行" | 快速改动也需要流程。 |

</RED-FLAGS>

<NO-OTHER-SKILLS>
本 skill 与其他任务编排技能功能重叠，请勿同时使用。
</NO-OTHER-SKILLS>

<objective>
OpenMatrix 默认入口 — 用户无需记忆命令，直接描述任务即可。
</objective>

<process>

## Step 1: 解析用户输入

`$ARGUMENTS` 可以是:
- 任务描述: "实现用户登录功能"
- 文件路径: "docs/task.md"
- 空输入 → 显示帮助

**如果是文件路径，先读取文件内容作为任务描述。**

## Step 2: AI 语义评估（推荐路由）

**Claude 综合分析任务语义，给出推荐路由 + 理由：**

### 判断原则（不明确优先澄清）

**优先级顺序：brainstorm > start > feature**

- **任务不明确时优先头脑风暴**，先澄清再执行
- **标准流程需要"任务足够明确"**，不是兜底选项
- **小需求需要用户明确表达轻量意图**，不是短描述就判定

**不明确的典型情况：**
- 实现方案有多种选择（登录方式、认证方案、技术栈）
- 缺少关键上下文（瓶颈在哪、目标指标、约束条件）
- 模块边界模糊（涉及哪些组件、数据流向）
- 需要先设计再执行（架构、数据模型、接口契约）

### 判断维度

| 维度 | feature | start | brainstorm |
|------|---------|-------|------------|
| 改动范围 | 单一组件/文件 | 明确模块边界 | 模糊/多模块协同 |
| 实现路径 | 显而易见 | 清晰可执行 | 需要设计/选型 |
| 上下文充分度 | 用户已说明足够 | 描述完整清晰 | 缺少关键信息 |
| 用户意图 | 明确表达"快速/简单" | 未特别强调 | 可能需要澄清 |

### 推荐输出

AI 判断后输出（供 Step 3 使用）：
- `recommendedRoute`: feature | start | brainstorm
- `recommendReason`: 一句话说明推荐理由

**判断示例：**

| 任务描述 | 推荐 | 理由 |
|---------|------|------|
| "给列表页添加搜索按钮" | feature | 用户意图明确，改动单一 |
| "小改动：调整按钮颜色" | feature | 用户表达轻量意图 |
| "实现用户登录功能" | **brainstorm** | 需澄清：登录方式、认证方案 |
| "添加 API 接口返回用户列表" | start | 实现路径清晰，无需澄清 |
| "从零搭建后台管理系统" | brainstorm | 需设计：架构、模块划分 |
| "重构认证模块支持 OAuth" | brainstorm | 需选型：OAuth provider、迁移策略 |
| "优化首页加载速度" | **brainstorm** | 缺上下文：瓶颈在哪？目标指标？ |
| "修复登录页样式问题" | start | 问题明确，修复路径清晰 |

## Step 3: 用户确认路由

**AI 先判断推荐路由，再让用户确认：**

AskUserQuestion: `header: "任务流程"`, `multiSelect: false`

**question:** 选择执行流程（AI 推荐：${recommendedRoute}，原因：${recommendReason}）

| label | description |
|-------|-------------|
| `小需求流程 (推荐)` | 2-5 个任务块，轻量追踪，适合单一改动点 |
| `标准流程` | 完整追踪，质量门禁，任务明确可直接执行 |
| `澄清/设计流程` | 先澄清不明确点或设计方案，再执行 |

**用户选择后，调用对应 Skill：**
- 选择 "小需求流程" → Skill("om:feature", args=任务描述)
- 选择 "标准流程" → Skill("om:start", args=任务描述)
- 选择 "澄清/设计流程" → Skill("om:brainstorm", args=任务描述)

## Step 4: 空输入或 --help

显示帮助信息：
```
OpenMatrix - AI task orchestration

Usage:
  /om <task>              AI 推荐路由，用户确认后执行
  /om:feature <task>      小需求快速流程（跳过推荐）
  /om:start <task>        标准任务流程（跳过推荐）
  /om:brainstorm <task>   澄清不明确点或设计方案（跳过推荐）
  /om:auto <task>         全自动执行

Examples:
  /om 给列表页添加搜索按钮       → AI 推荐小需求流程
  /om 添加 API 接口返回用户列表  → AI 推荐标准流程（路径清晰）
  /om 实现用户登录功能           → AI 推荐澄清流程（需确认方案）
  /om 从零搭建后台系统            → AI 推荐设计流程

Quality:
  严格模式 - TDD + 80% coverage
  平衡模式 - 60% coverage
  快速模式 - No gates

Commands:
  /om:status      - 查看执行状态
  /om:meeting     - 处理阻塞任务
  /om:report      - 生成执行报告
  /om:debug       - 系统化调试
  /om:resume      - 恢复中断任务
```

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om 给用户列表页添加搜索功能              → AI 推荐小需求流程，用户确认
/om 小改动：调整按钮颜色                  → AI 推荐小需求流程，用户确认
/om 实现用户登录功能                      → AI 推荐澄清流程（需确认方案），用户确认
/om 添加 API 接口返回用户列表              → AI 推荐标准流程（路径清晰），用户确认
/om 从零搭建后台系统                       → AI 推荐设计流程，用户确认
/om 优化首页加载速度                       → AI 推荐澄清流程（缺少上下文），用户确认
/om 修复登录页面的样式问题                → AI 推荐标准流程（问题明确），用户确认
/om docs/task.md                         → 读取文件后 AI 推荐，用户确认
/om                                      → 显示帮助
</examples>

<notes>
`/om` 是 OpenMatrix 工作的简写。路由流程：
1. AI 评估任务明确度，不明确时优先推荐澄清/设计
2. AskUserQuestion 让用户确认（标注推荐选项）
3. 用户选择后调用对应 skill

**推荐倾向：** 标准流程需要"任务足够明确"才推荐，不明确时先澄清。

## brainstorm 后自动路由

澄清完成后，AI 根据澄清结果的复杂度自动判断是 feature 还是 start，不再让用户二次选择。

### 判断规则（基于澄清后的 goals 数量）

| 条件 | 路由 | 理由 |
|------|------|------|
| goals ≤ 2 | **feature** | 任务块少，轻量追踪足够 |
| goals > 2 | **start** | 需要完整追踪和质量门禁 |
| 涉及多模块协同 | **start** | 需要任务文件管理 |
| 需要架构设计 | **start** | 需要生成 plan.md |
| 需要测试任务拆分 | **start** | tester/coder 任务对 |

### 判断示例

| 澄清后的任务描述 | goals 数量 | 路由 |
|-----------------|-----------|------|
| "添加搜索按钮到列表页" | 1-2 | feature |
| "调整按钮颜色和字体" | 2 | feature |
| "实现用户登录（JWT认证）" | 3+ | start |
| "重构认证模块支持 OAuth" | 4+ | start |
| "添加 API 接口返回用户列表" | 2-3 | start（需测试任务） |

### 自动路由流程

```
brainstorm 完成
    │
    ├── AI 分析澄清结果
    │   • goals 数量
    │   • 模块边界
    │   • 是否需要架构设计
    │
    ▼
┌─────────────────┐
│ 复杂度判断       │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
goals ≤ 2   goals > 2
    │         │
    ▼         ▼
feature     start
```

可用命令: `/om:brainstorm`, `/om:start`, `/om:feature`, `/om:auto`, `/om:status`, `/om:meeting`, `/om:report`, `/om:resume`, `/om:retry`, `/om:research`, `/om:approve`, `/om:check`, `/om:debug`
</notes>
