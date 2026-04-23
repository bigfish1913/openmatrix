---
name: om:report
description: "Use when generating a task execution report with statistics, task details, approval history, and agent performance. Triggers on REPORT intent: user wants a summary of execution, statistics overview, or deliverables documentation. DO NOT trigger on: starting tasks, debugging, or status checks. Intent signals: user asks for 'report', 'summary', 'statistics', 'what was done', or wants comprehensive output of execution results."
---

<INTENT-JUDGMENT>
## 意图判断指南

**AI 应根据用户语义判断意图：**

### 触发信号（报告意图）

- 用户想要执行总结
- 需要统计数据报告
- 查看任务完成详情
- 生成交付物概述

### 不触发信号

| 用户意图 | 应调用 |
|---------|--------|
| 查看实时进度 | /om:status |
| 开始任务 | /om:start |
| 调查问题 | /om:debug |

### 示例判断

| 用户消息 | 判断 | 结果 |
|---------|------|------|
| "生成报告" | 报告意图 | 触发 ✓ |
| "执行总结" | 总结意图 | 触发 ✓ |
| "查看统计" | 统计意图 | 触发 ✓ |
| "当前进度" | 实时状态 | /om:status |
| "为什么失败" | 调查意图 | /om:debug |
</INTENT-JUDGMENT>

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
生成当前运行周期的完整执行报告。
</objective>

<process>
1. **收集数据**
   - 全局状态 (state.json)
   - 所有任务 (tasks/)
   - 审批历史 (approvals/)
   - Agent 执行日志 (agents/)

2. **生成报告**

```
📊 OpenMatrix 执行报告
=====================

🆔 Run ID: run-20240323-abc1
📅 时间: 2024-03-23 10:00 - 12:30
⏱️ 总耗时: 2小时30分钟

## 📈 任务统计

| 状态 | 数量 | 占比 |
|------|------|------|
| ✅ 完成 | 8 | 80% |
| ❌ 失败 | 1 | 10% |
| ⏳ 跳过 | 1 | 10% |

## 📋 任务详情

### ✅ 已完成
- TASK-001: 需求分析 (15min)
- TASK-002: 数据库设计 (20min)
- TASK-003: API 开发 (45min)
...

### ❌ 失败
- TASK-007: 集成测试
  原因: 测试用例失败
  重试: 3次后仍失败

### ⏳ 跳过
- TASK-008: 性能优化
  原因: 依赖任务失败

## 🔔 审批记录

| ID | 类型 | 决策 | 时间 |
|----|----|------|------|
| APPR-001 | plan | ✅ 批准 | 10:05 |
| APPR-002 | merge | ✅ 批准 | 11:30 |

## 🤖 Agent 执行

| Agent | 任务数 | 成功率 |
|-------|--------|--------|
| planner | 2 | 100% |
| coder | 4 | 75% |
| tester | 2 | 50% |

## 📝 建议

1. TASK-007 集成测试失败，建议检查测试用例
2. 考虑增加代码审查环节

## 📁 产出物

- src/api/users.ts
- src/api/auth.ts
- tests/integration/*.test.ts
```

3. **保存报告**
   - 保存到 `.openmatrix/reports/report-{timestamp}.md`
   - 可选输出到指定路径

</process>

<arguments>
$ARGUMENTS

--format json|markdown  输出格式
--output path           输出路径
</arguments>

<examples>
/om:report                    # 生成并显示报告
/om:report --output report.md # 保存到文件
/om:report --format json      # JSON 格式
</examples>
