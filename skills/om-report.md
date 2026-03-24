# OpenMatrix: Report

生成执行报告.

## 使用

```
/om:report [--format json|md]
```

## 报告内容

- 任务执行摘要
- Agent 执行记录
- 测试结果
- 问题列表
- 建议

- 时间统计

## 示例

```
📊 OpenMatrix Execution Report

Run ID: run-20240323-abc1
Duration: 2h 30m
Status: completed

📋 Task Summary

Total: 10
Completed: 9
Failed: 1
Pending: 0

🤖 Agent Execution

| Agent | Runs | Success | Failed | Avg Duration |
|-------|------|---------|--------|--------------|
| planner | 1 | 1 | 0 | 45s |
| coder | 5 | 4 | 1 | 38s |
| tester | 3 | 3 | 0 | 22s |

📋 Test Results

Passed: 21
Failed: 0
Skipped: 0
Coverage: 87%

⚠️ Issues

- None

💡 Recommendations

- All tasks completed successfully
- Ready for next phase
```
