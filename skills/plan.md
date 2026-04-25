---
name: om:plan
description: "Use when user needs to generate a technical plan before task execution. Triggers on PLAN-GENERATION intent: brainstorm completed and user wants to proceed, user explicitly requests plan generation, or needs to create plan.md + tasks-input.json before execution. DO NOT trigger on: direct execution requests (use /om:start), brainstorming (use /om:brainstorm), or status checks. Intent signals: user says 'generate plan', brainstorm outputs design document and routes here, or user wants to review technical plan before executing."
---

<INTENT-JUDGMENT>
## 意图判断指南

**AI 应根据用户语义判断意图：**

### 触发信号（技术方案生成意图）

- brainstorm 完成，需要生成技术方案
- 用户明确要"生成方案"、"制定计划"
- 需要在执行前形成完整的技术方案
- 已有设计文档，需要转化为可执行的技术方案

### 不触发信号

| 用户意图 | 应调用 |
|---------|--------|
| 需求不明确，需要探索 | /om:brainstorm |
| 已有方案，直接执行 | /om:start |
| 小改动，不需要方案 | /om:feature |
| 查看状态 | /om:status |

### 示例判断

| 用户消息 | 判断 | 结果 |
|---------|------|------|
| "基于刚才的设计生成方案" | 方案生成意图 | 触发 |
| brainstorm 路由过来 | 自动路由 | 触发 |
| "直接开始实现" | 执行意图 | /om:start |
| "这个功能怎么设计" | 设计探索 | /om:brainstorm |
</INTENT-JUDGMENT>

<NO-OTHER-SKILLS>
**绝对禁止**调用以下任何技能或工具：
- gsd-executor、gsd:* 等 GSD 相关技能
- superpowers:* 等 superpowers 相关技能
- 任何其他任务编排相关的 Agent 或工具

**相关技能**: `/om:brainstorm` (需求探索) | `/om:start` (标准执行) | `/om:feature` (轻量执行) | `/om:auto` (全自动)
</NO-OTHER-SKILLS>

<MANDATORY-EXECUTION-ORDER>
## 执行顺序 - 必须严格按此顺序，不得跳过任何步骤

```
Step 1:  读取输入（brainstorm 设计文档 / 用户描述 / 研究上下文）
Step 2:  生成技术方案，写入 .openmatrix/plan.md              <- 独立阶段
Step 3:  提取结构化元数据（goals/goalTypes/goalComplexity）
Step 4:  写入 .openmatrix/tasks-input.json                     <- 必须完成
Step 5:  展示执行计划，确认后路由到 start/feature
```

**违反以下任一规则将导致方案质量下降：**

- **禁止跳过 Step 2** - plan.md 是 Agent 执行的核心参考
- **禁止跳过 Step 3** - goalTypes/goalComplexity 决定任务拆分策略
- **禁止在 plan 阶段写任何业务代码** - 代码在 start/feature 阶段由 Agent 执行
</MANDATORY-EXECUTION-ORDER>

<objective>
基于需求分析（brainstorm 产出或用户描述），生成完整的技术方案（plan.md）和结构化元数据（tasks-input.json），为后续执行提供可操作的输入。

plan 阶段只做方案设计和元数据提取，不写任何业务代码。
</objective>

<process>

## Step 1: 读取输入

**按优先级检测输入来源：**

| 来源 | 检测方式 | 处理 |
|------|---------|------|
| brainstorm 设计文档 | `docs/openmatrix/YYYY-MM-DD-*-design.md` | 读取最新设计文档 |
| 研究上下文 | `.openmatrix/research/context.json` | 读取研究目标和报告 |
| `$ARGUMENTS` 直接描述 | 参数非空 | 直接使用 |
| 无输入 | 以上都不存在 | AskUserQuestion 询问 |

**检测 brainstorm 设计文档：**
```bash
ls -t docs/openmatrix/*-design.md 2>/dev/null | head -1
```

**检测研究上下文：**
```bash
cat .openmatrix/research/context.json 2>/dev/null || echo "NO_RESEARCH"
```

如果检测到研究上下文，同时读取研究报告作为领域知识。

## Step 2: 生成技术方案（plan.md）

**独立阶段 — 产出供 Agent 执行时参考的技术方案文档。**

AI 分析需求，生成完整的技术方案，用 Write 工具写入 `.openmatrix/plan.md`：

```markdown
# 技术方案: 任务标题

## 整体架构
（架构图、模块划分、数据流）

## 模块设计
（每个模块的职责、接口、依赖关系）

## 接口定义
（核心 API / 函数签名 / 数据结构）

## 数据模型
（实体关系、表结构、字段定义）

## 技术栈
（语言、框架、库、工具）

## 关键决策
（技术选型理由、权衡取舍）

## 实现顺序建议
（模块间依赖关系，建议的开发顺序）
```

**研究上下文集成**: 如果已加载研究领域，AI 应基于研究报告中领域知识生成 plan，包含领域技术栈、架构模式等。

## Step 3: 提取结构化元数据

从需求和 plan 中提取 CLI 需要的结构化信息：

- **goals**: 3-8 个明确功能目标，每个是独立可交付模块
- **goalTypes**: 为每个 goal 标注类型（必填，与 goals 一一对应）:
  - `development` - 需要编写代码的功能/模块实现 -> 拆分为"实现+测试"任务对
  - `testing` - 明确的测试任务（如"编写 E2E 测试"）-> 单个测试任务
  - `documentation` - 文档编写（如"编写 API 文档"）-> 单个文档任务
  - `other` - 配置、部署、优化等非编码任务 -> 单个任务
- **goalComplexity**: 为每个 goal 标注复杂度（必填，与 goals 一一对应）:
  - `low` - 简单配置、样式、工具函数
  - `medium` - 一般功能实现、测试任务
  - `high` - 架构设计、核心模块、复杂业务逻辑
- **constraints**: 技术栈、兼容性等约束
- **deliverables**: 交付物列表

**goalTypes 标注示例：**

| Goal | Type | Complexity | 理由 |
|------|------|------------|------|
| "项目脚手架: Vite+TS 配置" | development | low | 配置类 |
| "GameLoop 60fps 游戏循环" | development | high | 核心功能 |
| "所有核心模块的单元测试" | testing | medium | 测试任务 |
| "API 文档编写" | documentation | low | 文档类 |
| "CI/CD 流水线配置" | other | medium | 配置类 |

## Step 4: 写入 tasks-input.json

用 Write 工具写入 `.openmatrix/tasks-input.json`：

```json
{
  "title": "任务标题",
  "description": "整体描述",
  "goals": ["目标1", "目标2", "目标3"],
  "goalTypes": ["development", "development", "testing"],
  "goalComplexity": ["high", "medium", "medium"],
  "constraints": ["约束1"],
  "deliverables": ["src/xxx.ts"]
}
```

**注意：**
- `quality`、`mode`、`e2eTests` 不在此写入，由执行阶段（/om:start）的必选问题决定
- `plan` 不在此写入，plan.md 是独立文件，CLI 会自动读取
- **goalTypes** 必须与 goals 数组长度一致，一一对应
- **goalComplexity** 必须与 goals 数组长度一致，一一对应
- **研究上下文集成**: 如果检测到研究上下文，将研究的 goals/constraints/deliverables 与 AI 提取的内容合并（去重）

## Step 5: 展示执行计划并路由

**展示执行计划：**

```
执行计划

Goals:
  1. [development/high] 目标1
  2. [development/medium] 目标2
  3. [testing/medium] 目标3

质量配置、E2E、执行模式 将在执行阶段选择。

技术方案已写入: .openmatrix/plan.md
```

**路由判断：**

AI 根据 goals 数量和任务特征判断路由：

| 条件 | 路由 |
|------|------|
| goals <= 2 + 实现路径清晰 | /om:feature |
| goals > 2 + 需完整追踪 | /om:start |
| 用户明确要求全自动 | /om:auto |

**自动路由到对应 Skill：**

```
Skill 工具:
  - start → skill = "om:start"
  - feature → skill = "om:feature"
  - auto → skill = "om:auto"
```

- `/om:start` 会检测已存在的 `tasks-input.json` 和 `plan.md`，询问必选问题（质量等级、E2E、执行模式）后执行
- `/om:feature` 使用轻量流程执行小任务
- `/om:auto` 全自动执行，无交互无审批

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:plan                              # 基于 brainstorm 设计文档生成方案
/om:plan "实现用户登录功能"             # 基于描述生成方案
/om:plan docs/openmatrix/2024-01-01-login-design.md  # 基于指定设计文档
</examples>

<notes>
## 流程定位

```
brainstorm (澄清需求) → plan (生成方案) → start/feature (执行)
```

plan 是连接需求和执行的桥梁：
- 输入: brainstorm 产出的设计文档 / 用户描述
- 输出: plan.md (AI Agent 参考) + tasks-input.json (CLI 解析)

## 与其他 Skill 的关系

| Skill | plan 的角色 |
|-------|------------|
| /om:brainstorm | 完成后调用 /om:plan |
| /om:start | 读取 plan.md + tasks-input.json 执行 |
| /om:feature | 轻量任务可能不需要 plan |
| /om:auto | 读取 plan.md + tasks-input.json 全自动执行 |

## plan.md 的消费方式

- CLI (TaskPlanner) 不解析 plan 内容，只读取 tasks-input.json
- plan.md 原文注入到每个 Agent 的任务描述中
- Agent 自行理解 plan 中的技术栈、数据模型、接口定义等

## 检测已有 plan

如果 `.openmatrix/plan.md` 已存在：
- 询问用户：使用已有方案 / 重新生成
- 使用已有方案时，跳过 Step 2，直接进入 Step 3 提取元数据
</notes>
