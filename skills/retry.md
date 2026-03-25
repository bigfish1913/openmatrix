---
name: om:retry
description: 重试失败的任务
---

<objective>
手动触发失败任务的重试。
</objective>

<process>
1. **列出失败任务**

```
❌ 失败任务列表

[1] TASK-003: API 接口开发
    失败原因: 超时
    重试次数: 2/3
    失败时间: 2024-03-23 10:30

[2] TASK-007: 集成测试
    失败原因: 测试用例失败
    重试次数: 0/3
    失败时间: 2024-03-23 11:00

选择要重试的任务 [1-2] 或 [A] 全部: _
```

2. **用户选择后**
   - 重置任务状态为 `pending`
   - 重置 retryCount（可选）
   - 调用 CLI: `openmatrix retry {taskId}`

3. **显示重试结果**

```
🔄 重试任务: TASK-003

✅ 任务已加入执行队列
   状态: pending
   等待调度...

使用 /om:status 查看执行进度
```

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:retry              # 列出失败任务
/om:retry TASK-003     # 重试指定任务
/om:retry --all        # 重试所有失败任务
/om:retry --reset      # 重试并重置重试计数
</examples>
