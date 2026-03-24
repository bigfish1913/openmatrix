# OpenMatrix: Status

查看当前任务执行状态。

## 使用

```
/om:status
```

## 流程

1. 读取 `.openmatrix/state.json` 获取全局状态
2. 读取 `.openmatrix/tasks/` 下所有任务
3. 展示格式化状态概览

## 输出示例

```
📊 OpenMatrix Status

  Run ID: run-20240323-abc1
  Status: running
  Phase:  execution
  Started: 2024-03-23T10:00:00Z

📈 Statistics
  Total: 10
  ✅ Completed: 3
  🔄 In Progress: 2
  ⏳ Pending: 4
  ❌ Failed: 1

📋 Tasks
  ✅ TASK-001: 用户登录功能
  ✅ TASK-002: 数据验证模块
  🔄 TASK-003: API 接口开发
  🔄 TASK-004: 前端页面
  ⏳ TASK-005: 单元测试
  ...
```

## 状态文件位置

- 全局状态: `.openmatrix/state.json`
- 任务详情: `.openmatrix/tasks/TASK-XXX/task.json`

## CLI 替代方案

也可以直接运行 CLI 命令：

```bash
node dist/cli/index.js status
node dist/cli/index.js status --json
```
