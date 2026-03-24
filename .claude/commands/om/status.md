---
name: om:status
description: 查看当前任务执行状态
---
<objective>
显示 OpenMatrix 任务执行状态概览。
</objective>

<process>
1. 读取 `.openmatrix/state.json` 获取全局状态
2. 读取 `.openmatrix/tasks/` 下所有任务
3. 展示格式化状态概览：

```
📊 OpenMatrix Status

  Run ID: run-xxx
  Status: running|paused|completed
  Phase: planning|execution|verification

📈 Statistics
  Total: X
  ✅ Completed: X
  🔄 In Progress: X
  ⏳ Pending: X
  ❌ Failed: X

📋 Tasks
  [状态] TASK-XXX: 任务名称
```
</process>
