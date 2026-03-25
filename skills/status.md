---
name: om:status
description: 查看当前任务执行状态
---

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
