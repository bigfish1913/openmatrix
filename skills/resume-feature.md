---
name: om:resume-feature
description: "恢复中断的 /om:feature 流程。读取 .openmatrix/feature-session.json 状态文件，继续执行剩余任务。"
priority: high
---

<NO-OTHER-SKILLS>
**绝对禁止**调用以下技能：
- ❌ superpowers:brainstorming → 用 /om:brainstorm 代替
- ❌ superpowers:* → 全部被 OpenMatrix 替代
- ❌ gsd:* → 全部被 OpenMatrix 替代
- ❌ /om:start / /om:auto → 本 skill 是轻量恢复，不调用完整流程
</NO-OTHER-SKILLS>

<objective>
恢复中断的轻量级小需求开发流程：读取持久化状态，继续执行剩余任务块。
</objective>

<process>

## Step 1: 检查持久化文件是否存在

```bash
ls -la .openmatrix/feature-session.json 2>/dev/null || echo "NOT_FOUND"
```

| 检查结果 | 处理 |
|---------|------|
| `NOT_FOUND` | 提示"未找到持久化文件，请使用 /om:feature 重新开始"并退出 |
| 存在 | 继续执行 |

## Step 2: 读取会话状态

```bash
cat .openmatrix/feature-session.json
```

读取并解析以下信息：
- `sessionId` - 会话 ID
- `status` - 当前状态（running/paused/failed）
- `tasks` - 任务列表
- `currentTaskIndex` - 当前任务索引
- `quality` - 质量等级
- `failureCount` - 各任务失败次数统计

同时读取：
- `.openmatrix/feature-context.md` - 项目上下文
- `.openmatrix/feature-progress.md` - Agent 执行进度

## Step 3: 恢复 TodoWrite 状态

根据读取的任务列表，恢复 TodoWrite 状态：

```typescript
TodoWrite({
  todos: tasks.map((task, index) => ({
    activeForm: `正在执行 ${task.content}`,
    content: task.content,
    status: index < currentTaskIndex ? "completed" : 
            index === currentTaskIndex ? "in_progress" : "pending"
  }))
})
```

## Step 4: 展示恢复状态

```
🔄 恢复会话：${sessionId}

📊 当前状态：
- 质量等级：${quality}
- 已完成任务：${completedCount}/${totalCount}
- 当前任务：${currentTask.content}
- 失败次数：${failureCount[currentTaskIndex] || 0}

📝 已完成的决策（来自 feature-progress.md）：
${显示前序任务的关键决策}
```

## Step 5: 继续执行当前任务

从 `currentTaskIndex` 位置继续执行：

**5.1 如果当前任务是 in_progress 状态（之前失败）：**

询问用户：
AskUserQuestion: `header: "继续方式"`, `multiSelect: false`
**question:** 当前任务之前验证失败，如何继续？

| label | description |
|-------|-------------|
| `重试当前任务` | 重新执行当前任务块 |
| `跳过当前任务` | 标记为完成，继续下一任务（风险较高） |
| `重新拆分` | 返回 /om:feature 重新规划 |

**5.2 如果当前任务是 pending 状态（正常恢复）：**

直接调用 Agent 执行：

```typescript
Agent({
  subagent_type: "general-purpose",
  description: currentTask.content,
  prompt: `你是实现专家。执行以下任务块。

## 项目上下文（请读取文件）
请先读取 .openmatrix/feature-context.md 了解项目上下文。

## 前序任务结果（请读取文件）
请读取 .openmatrix/feature-progress.md 了解前序 Agent 的决策和发现。

## 当前任务
- 任务名称：${currentTask.content}
- 预估文件：${currentTask.files}
- 质量等级：${quality}

## 质量要求
${quality === 'strict' ? `
- 必须使用 TDD：先写测试，再写实现
- 测试覆盖率要求：>80%
- 必须通过严格 Lint
- 必须通过安全扫描
` : quality === 'balanced' ? `
- 测试覆盖率要求：>60%
- 必须通过 Lint
- 必须通过安全扫描
` : `
- 无质量门禁要求
`}

## 实施原则
1. 先阅读预估文件中的现有代码，理解上下文后再动手
2. 只修改当前任务相关的文件
3. 不做"顺便"的重构或优化

## 禁止行为
❌ 执行 git commit（由主流程处理）
❌ 执行 git checkout/merge/pull/push/rebase/branch
❌ 修改与当前任务无关的文件

✅ 允许：git status, git diff, git log`,
  run_in_background: true
})
```

## Step 6: 验证（按质量等级）

| 质量等级 | 验证命令 |
|---------|---------|
| `strict` | `npm test -- --run && npm run lint && npm run test:coverage && npm audit --audit-level=moderate` |
| `balanced` | `npm test -- --run && npm run lint && npm audit --audit-level=moderate` |
| `fast` | 跳过验证 |

验证失败处理：
- 更新 `.openmatrix/feature-session.json` 的 `failureCount`
- 如果同一任务失败 3 次，提示用户质疑拆分方案
- 停止执行，提示再次使用 `/om:resume-feature`

## Step 7: Git 提交

验证通过后：

```bash
git status --porcelain
git add ${modifiedFiles}
git commit -m "feat(feature): ${sessionId} - ${currentTask.content}"
```

## Step 8: 更新持久化状态

```bash
# 更新 currentTaskIndex
cat > .openmatrix/feature-session.json << EOF
{
  "sessionId": "${sessionId}",
  "status": "running",
  "tasks": ${tasks},
  "currentTaskIndex": ${currentTaskIndex + 1},
  "quality": "${quality}",
  "failureCount": ${failureCount}
}
EOF

# 更新进度文件
echo "## 任务 ${currentTaskIndex}: ${currentTask.content}" >> .openmatrix/feature-progress.md
echo "${agentOutput}" >> .openmatrix/feature-progress.md
```

## Step 9: 继续下一任务或完成

- 如果还有 pending 任务：回到 Step 5
- 如果所有任务完成：执行 Step 10

## Step 10: 全部任务完成

```bash
# 最终整体验证
npm test -- --run

# 清理持久化文件（可选）
# 用户可选择保留或删除
```

输出执行摘要并更新状态为 `completed`。

</process>

<notes>
## 恢复条件

- 必须存在 `.openmatrix/feature-session.json`
- 必须由 `/om:feature` 启用持久化后产生

## 失败次数限制

同一任务失败 3 次以上：
- 建议用户质疑拆分方案
- 提示可能需要切换到 `/om:start`

## 持久化文件说明

| 文件 | 内容 |
|-----|------|
| `feature-session.json` | 会话状态、任务列表、当前索引、质量等级、失败次数 |
| `feature-context.md` | 项目上下文（技术栈、目录结构、CLAUDE.md） |
| `feature-progress.md` | 各 Agent 的执行决策和发现 |
</notes>