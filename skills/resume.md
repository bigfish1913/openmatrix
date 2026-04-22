---
name: om:resume
description: "恢复中断的任务执行。智能检测数据源：轻量流程 (feature-session.json) 或完整流程 (state.json)。Triggers on: 恢复, resume, continue task, 继续执行, interrupted, 中断, paused, 暂停."
priority: high
---

<NO-OTHER-SKILLS>
**绝对禁止**调用以下技能：
- ❌ superpowers:brainstorming → 用 /om:brainstorm 代替
- ❌ superpowers:* → 全部被 OpenMatrix 替代
- ❌ gsd:* → 全部被 OpenMatrix 替代
- ❌ /om:start / /om:auto → 本 skill 是恢复流程，不调用完整流程
</NO-OTHER-SKILLS>

<objective>
智能恢复中断的任务执行：自动检测轻量流程或完整流程，继续执行剩余任务。
</objective>

<process>

## Step 1: 检测数据源类型

```bash
# 优先检查轻量流程
ls -la .openmatrix/feature-session.json 2>/dev/null && echo "FEATURE_SESSION" || \
ls -la .openmatrix/state.json 2>/dev/null && echo "STATE_JSON" || \
echo "NOT_FOUND"
```

| 检查结果 | 处理 |
|---------|------|
| `FEATURE_SESSION` | 执行轻量流程恢复（Step 2A） |
| `STATE_JSON` | 执行完整流程恢复（Step 2B） |
| `NOT_FOUND` | 提示"未找到持久化文件，请使用 /om:feature 或 /om:start 重新开始"并退出 |

---

## Step 2A: 轻量流程恢复（feature-session.json）

### 读取会话状态

```bash
cat .openmatrix/feature-session.json
```

解析以下信息：
- `sessionId` - 会话 ID
- `status` - 当前状态（running/paused/failed）
- `tasks` - 任务列表
- `currentTaskIndex` - 当前任务索引
- `quality` - 质量等级
- `failureCount` - 各任务失败次数统计

同时读取：
- `.openmatrix/feature-context.md` - 项目上下文
- `.openmatrix/feature-progress.md` - Agent 执行进度

### 恢复 TodoWrite 状态

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

### 展示恢复状态

```
🔄 恢复轻量会话：${sessionId}

📊 当前状态：
- 质量等级：${quality}
- 已完成任务：${completedCount}/${totalCount}
- 当前任务：${currentTask.content}
- 失败次数：${failureCount[currentTaskIndex] || 0}

📝 已完成的决策（来自 feature-progress.md）：
${显示前序任务的关键决策}
```

### 继续执行当前任务

从 `currentTaskIndex` 位置继续：

**如果当前任务是 in_progress 状态（之前失败）：**

AskUserQuestion: `header: "继续方式"`, `multiSelect: false`
**question:** 当前任务之前验证失败，如何继续？

| label | description |
|-------|-------------|
| `重试当前任务` | 重新执行当前任务块 |
| `跳过当前任务` | 标记为完成，继续下一任务（风险较高） |
| `重新拆分` | 返回 /om:feature 重新规划 |

**如果当前任务是 pending 状态（正常恢复）：**

调用 Agent 执行：

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

## 禁止行为
❌ 执行 git commit（由主流程处理）
❌ 执行 git checkout/merge/pull/push/rebase/branch
❌ 修改与当前任务无关的文件

✅ 允许：git status, git diff, git log`,
  run_in_background: true
})
```

### 验证（按质量等级）

| 质量等级 | 验证命令 |
|---------|---------|
| `strict` | `npm test -- --run && npm run lint && npm audit --audit-level=moderate` |
| `balanced` | `npm test -- --run && npm run lint && npm audit --audit-level=moderate` |
| `fast` | 跳过验证 |

验证失败处理：
- 更新 `failureCount`
- 同一任务失败 3 次，提示质疑拆分方案
- 停止执行，提示再次使用 `/om:resume`

### Git 提交与状态更新

验证通过后提交并更新 `currentTaskIndex`。

---

## Step 2B: 完整流程恢复（state.json）

### 读取全局状态

```bash
cat .openmatrix/state.json
```

### 识别可恢复的任务

- status=in_progress (中断)
- status=retry_queue (等待重试)
- status=failed (可重试)
- 全局 status=paused

### 展示可恢复任务列表

```
🔄 可恢复任务

  [1] TASK-001: 任务名称 (中断)
  [2] TASK-003: 任务名称 (重试队列, 已重试2次)
  [3] TASK-005: 任务名称 (失败: 错误信息)

选择要恢复的任务 [1-3] 或 [A] 全部: _
```

### 用户选择后

调用 CLI 恢复执行: `openmatrix resume {taskId}`

CLI 会从上次暂停点继续。

### 显示恢复结果

---

</process>

<arguments>
$ARGUMENTS

如果提供任务ID，直接恢复指定任务。
如果无参数，自动检测数据源并列出可恢复任务供选择。
</arguments>

<notes>

## 数据源检测优先级

| 优先级 | 数据源 | 来源 skill |
|-------|--------|-----------|
| 1 | `.openmatrix/feature-session.json` | /om:feature |
| 2 | `.openmatrix/state.json` | /om:start |

## 与 /om:approve 的区别

| 命令 | 用途 | 场景 |
|------|------|------|
| /om:approve | 人工决策 | plan/merge/deploy 审批, Meeting |
| /om:resume | 继续执行 | 中断、超时、失败重试 |

## 恢复后行为

**轻量流程**：
- 从断点继续执行任务块
- 验证失败可重试

**完整流程**：
- 中断任务：从断点继续
- 重试任务：重新执行
- 失败任务：根据重试策略决定

## 失败次数限制

同一任务失败 3 次以上：
- 建议用户质疑拆分方案
- 提示可能需要切换到 `/om:start`

## 持久化文件说明

| 文件 | 来源 | 内容 |
|-----|------|------|
| `feature-session.json` | /om:feature | 会话状态、任务列表、质量等级、失败次数 |
| `feature-context.md` | /om:feature | 项目上下文 |
| `feature-progress.md` | /om:feature | Agent 执行决策 |
| `state.json` | /om:start | 全局状态、任务状态、配置 |
| `tasks/*.json` | /om:start | 单个任务详情 |

</notes>

<examples>
/om:resume              # 自动检测数据源，列出可恢复任务
/om:resume TASK-001     # 恢复指定任务（完整流程）
/om:resume --all        # 恢复所有可恢复任务
</examples>