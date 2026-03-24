---
name: om:retry
description: 重试失败的任务
---
<objective>
手动触发失败任务的重试。
</objective>

<arguments>
$ARGUMENTS
</arguments>

<process>
1. 列出所有失败状态的任务
2. 如果提供了任务 ID，重试指定任务
3. 如果无参数，询问要重试哪个任务
4. 重置任务状态为 `pending`
5. 重新执行任务
</process>
