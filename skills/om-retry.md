# OpenMatrix: Retry

重试失败任务.

## 使用

```
/om:retry [task-id]
```

## 流程

1. 读取失败任务
2. 重新加入重试队列
3. 展示重试状态

4. 手动触发重试

5. 觿告结果

## 示例

```
Failed tasks:

TASK-001: Login Feature
  Status: failed
  Error: API timeout
  Retry count: 1/3
  Last retry: 2 minutes ago

TASK-002: Database Connection
  Status: failed
  Error: Connection refused
  Retry count: 3/3
  Max retries reached

---

> Select task to retry (1-2) or retry all (a):
```
