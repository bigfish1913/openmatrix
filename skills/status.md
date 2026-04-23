---
name: om:status
description: "Use when checking task execution progress, run status, completion statistics, or pending approvals. Triggers on STATUS-CHECK intent: user wants to see current execution state, task progress, statistics, or pending items. DO NOT trigger on: development tasks, debugging, or starting new tasks. Intent signals: user asks 'how's progress', 'check status', 'what's left', or wants overview of execution."
---

<INTENT-JUDGMENT>
## 意图判断指南

**AI 应根据用户语义判断意图：**

### 触发信号（状态检查意图）

- 用户想查看执行进度
- 询问任务完成情况
- 检查运行状态
- 查看统计数据

### 不触发信号

| 用户意图 | 应调用 |
|---------|--------|
| 开始任务 | /om:start |
| 调查问题 | /om:debug |
| 查看报告 | /om:report |

### 示例判断

| 用户消息 | 判断 | 结果 |
|---------|------|------|
| "查看进度" | 状态意图 | 触发 ✓ |
| "任务完成多少了" | 进度检查意图 | 触发 ✓ |
| "当前执行状态" | 状态查看意图 | 触发 ✓ |
| "实现功能" | 开发意图 | /om:start |
| "为什么卡住了" | 调查意图 | /om:debug |
</INTENT-JUDGMENT>

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
显示 OpenMatrix 任务执行状态概览。
</objective>

<process>
1. 读取 `.openmatrix/state.json` 获取全局状态
2. 读取 `.openmatrix/tasks/` 下所有任务
3. 读取 `.openmatrix/approvals/` 下待处理审批
4. 展示格式化状态概览

## 输出格式

```
📊 OpenMatrix Status

  Run ID: run-xxx
  Status: running | paused | completed
  Phase: planning | execution | verification

📈 Statistics
  Total: X | ✅ Completed: X | 🔄 In Progress: X | ⏳ Pending: X | ❌ Failed: X

📋 Tasks
  ✅ TASK-001: 任务名称
  🔄 TASK-002: 任务名称
  ⏳ TASK-003: 任务名称
  ❌ TASK-004: 任务名称 (失败原因)

🔴 Pending Approvals
  APPR-001: 计划审批 (TASK-002)
  APPR-002: Meeting - 阻塞问题 (TASK-003)

💡 Next Actions
  /om:approve - 处理待审批
  /om:resume  - 恢复暂停任务
```
</process>
