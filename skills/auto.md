---
name: om:auto
description: 全自动执行任务 - AI 拆分，无阻塞，bypass permissions
---

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<MANDATORY-EXECUTION-ORDER>
## 执行顺序 - 必须严格按此顺序，不得跳过任何步骤

```
Step 1: 初始化 .openmatrix 目录
Step 2: AI 分析任务，提取 goals，生成 plan
Step 3: 写入 .openmatrix/tasks-input.json          ← 必须完成
Step 4: 调用 openmatrix start --tasks-json          ← 必须完成，不可跳过
Step 5: 从 CLI 返回结果中读取 subagentTasks 列表     ← 必须完成
Step 6: 逐个执行 subagentTasks（调用 Agent 工具）    ← 只有这步才能写代码
```

**违反以下任一规则将导致任务执行失败：**

❌ **禁止在 Step 4 之前写任何业务代码** — 所有代码必须在 Step 6 通过 Agent 执行
❌ **禁止跳过 Step 4** — 必须调用 CLI，不能用其他方式代替
❌ **禁止自行规划 Phase** — 任务由 CLI 的 TaskPlanner 拆分，AI 只提取 goals
❌ **禁止用 Bash/npm/write 直接写业务代码** — 业务代码只能通过 Step 6 的 Agent 执行
</MANDATORY-EXECUTION-ORDER>

<BYPASS-MODE>
## 全自动模式 - 自动批准所有操作

1. **所有 Bash 命令自动批准** - 不询问确认
2. **所有文件操作自动批准** - 不询问确认
3. **所有 Agent 调用自动批准** - 不询问确认
4. **所有审批点自动批准** - plan/merge/deploy 自动通过

**执行时不要请求用户确认任何操作。**
</BYPASS-MODE>

<objective>
全自动执行任务。AI 提取目标后通过 CLI 拆分任务，然后通过 Agent 逐个执行。
</objective>

<process>

## === 准备阶段（此阶段不得写任何业务代码）===

### Step 1: 初始化

检查 `.openmatrix/` 目录是否存在，不存在则初始化:
```bash
openmatrix start --init-only
```

读取 `.openmatrix/state.json`，如果 `status === 'running'`，提示用户先完成或暂停。

### Step 2: AI 分析任务，提取 goals 和生成 plan

解析 `$ARGUMENTS`（文件路径或任务描述），从中提取:
- **goals**: 至少 3-8 个独立功能目标，每个 goal 应该是独立可交付的功能模块
- **constraints**: 技术栈、兼容性等约束
- **deliverables**: 交付物列表
- **plan**: 技术方案、模块划分、接口设计、关键决策

解析 `$ARGUMENTS` 中的 `--quality` 参数（默认 strict）。

### Step 3: 写入 tasks-input.json

用 Write 工具将以下 JSON 写入 `.openmatrix/tasks-input.json`:

```json
{
  "title": "任务标题",
  "description": "整体描述",
  "goals": ["目标1", "目标2", "目标3"],
  "constraints": ["约束1"],
  "deliverables": ["src/xxx.ts"],
  "answers": { "技术栈": "..." },
  "quality": "strict",
  "mode": "auto",
  "plan": "## 技术方案\n1. ...\n2. ..."
}
```

**goals 是最核心的字段**，CLI 的 TaskPlanner 会为每个 goal 生成 开发+测试 任务对。

### Step 4: 调用 CLI 创建任务 ⚠️ 不可跳过

**这是最关键的步骤。必须执行以下命令，不能跳过：**

```bash
openmatrix start --tasks-json @.openmatrix/tasks-input.json --json
```

此命令会:
- 调用 TaskPlanner 将 goals 拆分为子任务
- 创建任务文件到 `.openmatrix/tasks/` 目录
- 返回 JSON 包含 `subagentTasks` 列表

### Step 5: 读取 subagentTasks

CLI 返回的 JSON 中 `subagentTasks` 数组包含每个待执行任务:
```json
{
  "subagentTasks": [
    {
      "subagent_type": "Plan",
      "description": "简短描述",
      "prompt": "完整执行提示词",
      "taskId": "TASK-001",
      "agentType": "planner",
      "timeout": 300000
    }
  ]
}
```

## === 执行阶段（只有此阶段才能写业务代码）===

### Step 6: 逐个执行 subagentTasks

对 `subagentTasks` 列表中的每个任务，调用 Agent 工具执行:

```typescript
Agent({
  subagent_type: task.subagent_type,
  description: task.description,
  prompt: task.prompt,
  isolation: task.isolation
})
```

每个 Agent 完成后:
1. 更新任务状态
2. Git 自动提交:
```bash
git add -A
git commit -m "feat(task-id): 任务标题

任务ID: TASK-XXX
RunID: run-XXX"
```

**在 auto 模式下不得询问用户确认，自动批准所有审批点。**

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:auto "实现用户登录功能"
/om:auto task.md --quality fast
/om:auto task.md --quality balanced
</examples>

<notes>
## 质量级别

| 级别 | TDD | 覆盖率 | Lint | 安全扫描 |
|------|:---:|:------:|:----:|:--------:|
| **strict** | ✅ | >80% | ✅ | ✅ |
| **balanced** | ❌ | >60% | ✅ | ✅ |
| **fast** | ❌ | 无要求 | ❌ | ❌ |

## 执行流程

```
Step 1: 初始化 .openmatrix
    ↓
Step 2: AI 提取 goals + 生成 plan
    ↓
Step 3: 写入 tasks-input.json
    ↓
Step 4: openmatrix start --tasks-json   ← 必须执行
    ↓
Step 5: 读取 subagentTasks
    ↓
Step 6: Agent 逐个执行                  ← 只有这里写代码
```
</notes>
