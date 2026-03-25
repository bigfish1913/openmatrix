# OpenMatrix

AI Agent 任务编排系统，集成 Claude Code Skills。

## 安装

```bash
# 从 GitHub 安装
npm install -g github:bigfish1913/openmatrix

# 安装 Skills（手动）
mkdir -p ~/.claude/commands/om
cp $(npm root -g)/openmatrix/skills/*.md ~/.claude/commands/om/
```

## 使用

安装后可用以下 Claude Code Skills：

| 命令 | 说明 |
|------|------|
| `/om:status` | 查看任务状态 |
| `/om:start` | 启动新任务 |
| `/om:approve` | 审批关键节点 |
| `/om:resume` | 恢复暂停任务 |
| `/om:retry` | 重试失败任务 |
| `/om:report` | 生成执行报告 |

## CLI 命令

```bash
openmatrix status    # 查看状态
openmatrix start     # 启动任务
openmatrix --help    # 帮助
```

## License

MIT
