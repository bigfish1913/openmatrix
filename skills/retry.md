---
name: om:retry
description: "Use when retrying failed tasks after execution errors, test failures, or timeouts. Triggers on RETRY intent: user wants to retry a previously failed task, rerun execution, or recover from error. DO NOT trigger on: starting new tasks, status checks, or debugging root causes. Intent signals: user mentions 'retry', 'rerun', 'try again', or refers to a specific failed task to re-execute."
---

<INTENT-JUDGMENT>
## 意图判断指南

**AI 应根据用户语义判断意图：**

### 触发信号（重试意图）

- 用户想重试失败的任务
- 重新执行之前的任务
- 从错误恢复重新尝试

### 不触发信号

| 用户意图 | 应调用 |
|---------|--------|
| 开始新任务 | /om:start |
| 调查失败原因 | /om:debug |
| 查看状态 | /om:status |

### 示例判断

| 用户消息 | 判断 | 结果 |
|---------|------|------|
| "重试这个任务" | 重试意图 | 触发 ✓ |
| "重新执行" | 重试意图 | 触发 ✓ |
| "再试一次" | 重试意图 | 触发 ✓ |
| "为什么失败" | 调查意图 | /om:debug |
| "开始新功能" | 开发意图 | /om:start |
</INTENT-JUDGMENT>

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

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
