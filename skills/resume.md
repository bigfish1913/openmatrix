---
name: om:resume
description: 恢复暂停或中断的任务
---
<objective>
恢复之前暂停或中断的任务执行。
</objective>

<process>
1. 读取 `.openmatrix/state.json` 获取上次状态
2. 识别暂停位置和上下文
3. 恢复执行流程
4. 如果有关键节点等待确认，提示用户使用 `/om:approve`
</process>
