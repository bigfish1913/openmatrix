---
name: om:resume
description: "Use when resuming interrupted or paused task execution. Triggers on: 恢复, resume, continue task, 继续执行, interrupted, 中断, paused, 暂停, retry from checkpoint, 从断点继续."
---

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
恢复因中断、超时、失败等原因暂停的任务。
</objective>

<process>
1. 读取 `.openmatrix/state.json` 获取当前状态
2. 识别可恢复的任务：
   - status=in_progress (中断)
   - status=retry_queue (等待重试)
   - status=failed (可重试)
   - 全局 status=paused

3. 展示可恢复任务列表：

```
🔄 可恢复任务

  [1] TASK-001: 任务名称 (中断)
  [2] TASK-003: 任务名称 (重试队列, 已重试2次)
  [3] TASK-005: 任务名称 (失败: 错误信息)

选择要恢复的任务 [1-3] 或 [A] 全部: _
```

4. 用户选择后：
   - 调用 CLI 恢复执行: `openmatrix resume {taskId}`
   - CLI 会从上次暂停点继续

5. 显示恢复结果

</process>

<arguments>
$ARGUMENTS

如果提供任务ID，直接恢复指定任务。
如果无参数，列出所有可恢复任务供选择。
</arguments>

<notes>
## 与 /om:approve 的区别

| 命令 | 用途 | 场景 |
|------|------|------|
| /om:approve | 人工决策 | plan/merge/deploy 审批, Meeting |
| /om:resume | 继续执行 | 中断、超时、失败重试 |

## 恢复后行为

- **中断任务**: 从断点继续执行
- **重试任务**: 重新执行
- **失败任务**: 根据重试策略决定是否重试
</notes>

<examples>
/om:resume              # 列出可恢复任务
/om:resume TASK-001     # 恢复指定任务
/om:resume --all        # 恢复所有可恢复任务
</examples>
