# OpenMatrix: Resume

从状态文件恢复中断的任务.

## 使用

```
/om:resume
```

## 流程

1. 读取 `.openmatrix/state.json`
2. 恢复任务队列
3. 恢复 Agent 池
4. 继续执行

5. 展示恢复进度

## 示例

```
📊 Resuming execution...

Run ID: run-20240323-abc1
Status: paused
Phase: execution
Paused at: 2024-03-23 10:30:00
Reason: Waiting for approval

📋 Restoring state...

✅ Tasks restored: 5
✅ Agents restored: 2
  - TASK-001: in_progress
  - TASK-002: in_progress

🚀 Resuming...

✅ Execution resumed
Next: TASK-003: Code generation
```
