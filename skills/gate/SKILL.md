---
name: om:gate
description: "Quality gate check - compare current results against original requirements/design at critical milestones. Triggers on GATE-CHECK intent: verify output matches requirements, check plan alignment, validate task breakdown completeness, confirm completion meets acceptance criteria. Use after: document output, plan generation, task breakdown, task completion."
---

<INTENT-JUDGMENT>
## 意图判断指南

**AI 应根据用户语义判断意图：**

### 触发信号（质量门禁检查意图）

- 用户想验证产出是否符合需求
- 检查设计与实现的差距
- 确认任务是否完整
- 验收前检查对齐度
- 用户表达"检查"、"验证"、"对齐"、"差距"

### 不触发信号

| 用户意图 | 应调用 |
|---------|--------|
| 开始新任务 | /om:start |
| 调查问题原因 | /om:debug |
| 查看状态 | /om:status |

### 示例判断

| 用户消息 | 判断 | 结果 |
|---------|------|------|
| "检查当前产出是否符合需求" | 门禁检查意图 | 触发 ✓ |
| "验证设计与实现的对齐度" | 对齐检查意图 | 触发 ✓ |
| "任务完成后验收检查" | 验收意图 | 触发 ✓ |
| "开始实现新功能" | 执行意图 | /om:start |
| "为什么和设计不一样" | 调查意图 | /om:debug |
</INTENT-JUDGMENT>

<NO-OTHER-SKILLS>
本 skill 是质量门禁检查，不执行任务编排。
</NO-OTHER-SKILLS>

<objective>
在关键里程碑节点进行质量门禁检查：对比当前产出与原始需求/设计，识别差距，给出修正建议。确保"做什么"和"做出来"之间的对齐。
</objective>

<process>

## Step 1: 确定检查节点类型

**检查 `$ARGUMENTS` 或自动检测当前阶段：**

```bash
# 检查当前状态
cat .openmatrix/current.json
cat .openmatrix/${runId}/state.json
```

| 检查节点 | 触发条件 | 检查内容 |
|---------|---------|---------|
| **文档输出** | brainstorm/plan 完成后 | 设计文档 vs 用户原始需求 |
| **计划阶段** | tasks-input.json 生成后 | goals vs 设计文档 |
| **任务拆分** | 任务列表创建后 | 任务列表 vs goals |
| **任务完成** | 任务执行完成后 | 实现结果 vs 任务描述 + 验收标准 |

**自动检测逻辑：**

```bash
# 检查是否存在关键文件
ls .openmatrix/${runId}/tasks-input.json
ls .openmatrix/${runId}/plan.md
ls docs/openmatrix/*-design.md
ls .openmatrix/${runId}/tasks/
```

## Step 2: 读取原始需求/设计

**根据检查节点读取不同来源：**

### 2.1 文档输出节点

**读取来源：**
```bash
# 用户原始需求（来自 brainstorm 对话或任务描述）
cat docs/openmatrix/*-design.md

# 如果有 tasks-input.json，读取 goals
cat .openmatrix/${runId}/tasks-input.json
```

**提取关键信息：**
- 核心目标（goals）
- 约束条件（constraints）
- 验收标准（acceptance criteria）
- 设计要点（架构、数据模型、API）

### 2.2 计划阶段节点

**读取来源：**
```bash
cat .openmatrix/${runId}/tasks-input.json
cat .openmatrix/${runId}/plan.md
cat docs/openmatrix/*-design.md
```

**提取关键信息：**
- goals（来自 tasks-input.json）
- plan 中的技术方案
- 设计文档中的架构设计

### 2.3 任务拆分节点

**读取来源：**
```bash
cat .openmatrix/${runId}/tasks-input.json
cat .openmatrix/${runId}/state.json

# 列出所有任务
ls .openmatrix/${runId}/tasks/
```

**提取关键信息：**
- goals vs 任务列表
- 每个 goal 是否有对应任务
- 任务覆盖完整性

### 2.4 任务完成节点

**读取来源：**
```bash
# 读取完成的任务详情
cat .openmatrix/${runId}/tasks/TASK-XXX/task.json

# 读取执行结果
cat .openmatrix/${runId}/tasks/TASK-XXX/artifacts/result.md

# 读取验收标准
cat .openmatrix/${runId}/tasks-input.json
```

**提取关键信息：**
- 任务描述 vs 实现结果
- 验收标准 vs 实际产出
- 代码变更 vs 设计预期

## Step 3: 执行差距分析

**AI 分析任务（对比原始需求和当前产出）：**

### 3.1 对齐度评估

**对比检查：**

| 检查维度 | 原始需求 | 当前产出 | 差距 |
|---------|---------|---------|------|
| 功能覆盖 | goals 列表 | 实现功能 | 缺失/多余功能 |
| 约束遵守 | constraints | 实际实现 | 约束违反 |
| 架构一致 | 设计架构 | 实际结构 | 结构偏差 |
| 接口匹配 | API 设计 | 实际接口 | 接口偏差 |
| 质量标准 | 验收标准 | 测试结果 | 未达标项 |

### 3.2 量化评分

**对齐度评分（0-100）：**

```
对齐度 = (完全匹配项数 / 总检查项数) × 100

分级：
- 90-100: 优秀（完全对齐）
- 70-89:  良好（轻微偏差）
- 50-69:  一般（明显差距）
- 0-49:   不合格（严重偏离）
```

### 3.3 差距识别

**列出每个差距项：**

```
差距项 #N:
- 类型: 功能缺失/约束违反/架构偏差/接口不匹配/质量未达标
- 预期: [原始需求描述]
- 实际: [当前产出描述]
- 影响: 高/中/低
- 建议: [修正方案]
```

## Step 4: 输出差距报告

**在界面展示差距分析报告：**

```
🎯 质量门禁检查报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

检查节点: ${checkpointType}
检查时间: ${timestamp}

对齐度评分: ${score}/100 (${grade})

## 检查结果摘要

✅ 完全对齐 (${matchedCount}项)
⚠️ 需要关注 (${warningCount}项)
❌ 存在差距 (${gapCount}项)

## 详细差距分析

${gaps.map(g => `
### 差距项 #${index}
- **类型**: ${g.type}
- **预期**: ${g.expected}
- **实际**: ${g.actual}
- **影响**: ${g.impact}
- **建议**: ${g.suggestion}
`).join('\n')}

## 修正建议

${recommendations}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Step 5: 决策与行动

**根据对齐度评分决定下一步：**

### 5.1 对齐度 >= 90

AskUserQuestion: `header: "检查结果"`, `multiSelect: false`
**question:** 对齐度评分 **${score}/100**（优秀），产出与需求高度一致。是否继续？

| label | description |
|-------|-------------|
| 继续（推荐） | 对齐度良好，继续下一步 |
| 查看详情 | 展示完整差距报告 |

### 5.2 对齐度 70-89

AskUserQuestion: `header: "检查结果"`, `multiSelect: false`
**question:** 对齐度评分 **${score}/100**（良好），存在轻微偏差。如何处理？

| label | description |
|-------|-------------|
| 接受并继续 | 轻微偏差可接受 |
| 修正偏差 | 针对差距项进行修正 |
| 查看详情 | 展示完整差距报告 |

### 5.3 对齐度 50-69

AskUserQuestion: `header: "检查结果"`, `multiSelect: false`
**question:** 对齐度评分 **${score}/100**（一般），存在明显差距。建议修正后继续。

| label | description |
|-------|-------------|
| 修正差距（推荐） | 针对差距项进行修正 |
| 接受风险 | 接受差距并继续（有风险） |
| 重新设计 | 回到设计阶段重新规划 |

### 5.4 对齐度 < 50

**立即暂停并输出警告：**

```
⚠️ 质量门禁失败！

对齐度评分: ${score}/100（不合格）
产出与需求严重偏离，必须修正。

建议: 回到设计阶段重新规划，或与用户澄清需求。
```

AskUserQuestion: `header: "门禁失败"`, `multiSelect: false`
**question:** ⛔ **质量门禁失败**，对齐度仅 **${score}/100**。下一步？

| label | description |
|-------|-------------|
| 重新设计 | 回到 brainstorm/plan 重新规划 |
| 修正差距 | 针对差距项逐一修正 |
| 澄清需求 | 与用户重新确认需求 |

## Step 6: 记录门禁结果

**写入门禁检查记录：**

```bash
# 确保目录存在
mkdir -p .openmatrix/${runId}/gates
```

**写入 gate-${checkpointType}-${timestamp}.json：**

```json
{
  "checkpointType": "task_completion",
  "timestamp": "2026-06-12T10:00:00Z",
  "score": 85,
  "grade": "良好",
  "matchedCount": 8,
  "warningCount": 2,
  "gapCount": 0,
  "gaps": [],
  "recommendations": "轻微偏差可接受",
  "decision": "接受并继续"
}
```

</process>

<arguments>
$ARGUMENTS

可选参数：
- `--checkpoint <type>` 指定检查节点（document/plan/breakdown/completion）
- `--json` 输出 JSON 格式
</arguments>

<examples>
/om:gate                          # 自动检测当前阶段并检查
/om:gate --checkpoint completion  # 指定检查任务完成节点
/om:gate TASK-001                 # 检查指定任务的对齐度
</examples>

<notes>

## 检查节点说明

| 节点 | 时机 | 目的 |
|------|------|------|
| **文档输出** | brainstorm/plan 完成后 | 验证设计文档是否覆盖所有需求 |
| **计划阶段** | tasks-input.json 生成后 | 验证 goals 是否完整提取 |
| **任务拆分** | 任务列表创建后 | 验证任务是否覆盖所有 goals |
| **任务完成** | 任务执行完成后 | 验证实现是否符合设计和验收标准 |

## 对齐度评分标准

| 分数 | 等级 | 说明 |
|------|------|------|
| 90-100 | 优秀 | 产出与需求完全一致 |
| 70-89 | 良好 | 存在轻微偏差，可接受 |
| 50-69 | 一般 | 明显差距，建议修正 |
| 0-49 | 不合格 | 严重偏离，必须重新规划 |

## 与其他指令的关系

| 指令 | 用途 | 关系 |
|------|------|------|
| /om:review | 代码质量审查 | 代码层面的检查 |
| /om:gate | 需求对齐检查 | 需求层面的检查 |
| /om:debug | 问题诊断 | 检查失败时调查原因 |

## 修正循环

差距修正后，重新执行 gate 检查：
```
修正差距 → 重新执行 om:gate → 通过 → 继续
修正差距 → 重新执行 om:gate → 失败 → 再次修正
```

最多重试 3 次，超过 3 欀建议重新设计。

</notes>