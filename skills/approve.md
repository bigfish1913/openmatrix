---
name: om:approve
description: 审批关键节点的执行结果
---
<objective>
审批当前等待确认的关键节点。
</objective>

<arguments>
$ARGUMENTS
</arguments>

<process>
1. 查找状态为 `waiting` 的任务
2. 展示任务执行结果供用户审核
3. 等待用户输入：
   - `approve` / `确认` - 通过，继续执行
   - `reject` / `拒绝` - 拒绝，进入重试队列
   - `modify` / `修改` - 提供修改建议后重试
4. 更新任务状态并继续流程
</process>
