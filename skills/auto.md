---
name: om:auto
description: "Use when the user wants fully automated task execution with zero manual approvals. Triggers on: 全自动, 无人值守, hands-free, non-stop, don't ask me, 直接执行, skip all confirmations, batch refactor, large migration, bulk changes. Use for multi-task execution where the user doesn't want to be interrupted at any approval point (plan/merge/deploy)."
---

<NOTE>
## 注意：区分 `/om:auto` 指令与「全自动执行」模式

- **`/om:auto`** 是一个 **Skill 指令**，为 Agent 无障碍执行准备
- **「全自动执行」**是 `/om:start` 中用户选择的 **执行模式选项**

**关键区别**：`/om:auto` 不创建 Meeting 记录，直接跳过阻塞任务。

**相关技能**: `/om:start` (交互式) | `/om:status` (状态查看) | `/om:report` (报告)
</NOTE>

<NO-OTHER-SKILLS>
**绝对禁止**调用以下任何技能或工具：
- ❌ gsd-executor、gsd:* 等 GSD 相关技能
- ❌ superpowers:* 等 superpowers 相关技能
- ❌ 任何其他任务编排相关的 Agent 或工具

**Step 6 只能使用 Agent 工具** — 直接调用 Agent，不通过任何中间层。

违规调用将导致执行失败。
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

### Step 6: 逐个执行 subagentTasks（禁止中断）

<LOOP-ENFORCEMENT>
**此步骤是执行循环，必须执行完所有任务后才能停止。**

❌ **禁止在还有未完成任务时停止** — 即使 Agent 返回了大段输出，也必须继续下一个
❌ **禁止询问"是否继续"** — 直接执行下一个任务
❌ **禁止输出"让我知道是否..."后停止** — 继续执行
❌ **禁止因为上下文压缩而忘记剩余任务** — 通过 CLI 命令从磁盘获取真实状态

**文件持久化循环（防止上下文压缩丢失状态）:**
```bash
# 每个 Agent 完成后执行:
openmatrix complete TASK-XXX --success       # 标记完成 + 更新统计（含自动 git commit）

# 提交验证（防止 commit 静默失败）:
git status --porcelain                        # 检查是否有未提交的文件
# 如果有未提交文件 → 必须手动提交:
git add -A && git commit -m "feat(TASK-XXX): 任务标题"

openmatrix step --json                       # 获取下一个任务 + 检查是否全部完成
```
`openmatrix step` 从磁盘读取真实状态，不依赖上下文记忆。

**中断恢复:** 如果会话中断，再次执行 `/om:auto` 时:
1. 执行 `openmatrix step --json`
2. 如果返回 `status: "next"` → 从返回的任务继续执行
3. 如果返回 `status: "done"` → 所有任务已完成
4. 如果返回 `status: "blocked"` → 有阻塞任务需要处理
</LOOP-ENFORCEMENT>

对 `subagentTasks` 列表中的每个任务，**必须使用 Agent 工具**（禁止用 gsd-executor 或其他技能替代）:

```typescript
Agent({
  subagent_type: task.subagent_type,
  description: task.description,
  prompt: task.prompt + "\n\n⚠️ 完成后请输出简短摘要（不超过3行）：\n1. 关键决策\n2. 创建/修改的文件\n3. 对后续任务的建议\n\n🚫 **禁止执行以下 Git 命令**：\n- ❌ git commit — 所有提交统一通过 openmatrix complete 执行\n- ❌ git checkout — 不要切换分支\n- ❌ git merge — 不要合并其他分支\n- ❌ git pull — 不要拉取远程更新\n- ❌ git push — 不要推送代码\n- ❌ git rebase — 不要变基\n- ❌ git branch — 不要创建/删除分支\n\n✅ 允许：git status, git diff, git log",
  isolation: task.isolation,
  run_in_background: true
})
```

> ⚠️ **必须使用原生 Agent 工具** — 禁止调用 gsd-executor、superpowers 或任何其他编排技能。
>
> **上下文节省**: 使用 `run_in_background: true` 后台执行，Agent 完成后仅返回简短摘要，大幅节省主会话上下文。
>
> 🚫 **Agent 内部禁止 Git 操作** — 禁止执行：git commit, git checkout, git merge, git pull, git push, git rebase, git branch。所有提交必须通过 `openmatrix complete` 执行。

每个 Agent 完成后:
1. **保存 Agent 上下文** — 将执行结果摘要写入 `.openmatrix/tasks/TASK-XXX/context.md`，格式如下:

```markdown
## 任务: TASK-XXX 任务标题

### 关键决策
- [做出的重要决策]

### 创建/修改的文件
- `path/to/file1.ts` - 简述用途
- `path/to/file2.ts` - 简述用途

### 重要发现
- [发现的问题、模式、注意事项]

### 对后续任务的建议
- [下一个 Agent 应该注意什么]
```

2. **标记完成并更新统计（必须执行）:**
```bash
openmatrix complete TASK-XXX --success
```

3. **获取下一个任务（必须执行，防止上下文压缩丢失）:**
```bash
openmatrix step --json
```

**返回值解析：**

| status | 含义 | 后续操作 |
|--------|------|---------|
| `next` | 有下一个任务 | 继续执行返回的 `subagent` 配置 |
| `done` | 所有任务完成 | 进入最终提交 |
| `blocked` | 无可执行任务 | `/om:auto` 直接跳过，继续执行其他任务 |

**`next` 返回结构：**
```json
{
  "status": "next",
  "task": { "id": "TASK-XXX", "title": "...", "status": "in_progress" },
  "subagent": { "subagent_type": "...", "description": "...", "prompt": "...", "timeout": 120000 },
  "statistics": { "total": 5, "completed": 2, "remaining": 3, "failed": 0 }
}
```

**Meeting 处理机制:**
 `/om:auto` 不创建 Meeting 记录，直接跳过阻塞任务，无障碍执行。


**Agent 上下文共享机制 (Agent Memory):**

每个 Agent 执行时会自动接收前序 Agent 的上下文信息（通过 `context.md` 文件）。
这确保 Agent 之间共享知识、避免重复工作、保持决策一致性。

```
Agent-1 完成 → 写入 context.md → Agent-2 读取 Agent-1 的上下文 → 写入 context.md → ...
```
```bash
git add -A && git commit -m "$(cat <<'EOF'
feat: 任务标题

改动点1
改动点2

影响范围: 模块名
文件改动: 文件1, 文件2

Co-Authored-By: OpenMatrix https://github.com/bigfish1913/openmatrix
EOF
)"
```

**在 auto 模式下不得询问用户确认，自动批准所有审批点。**

**Git 提交格式规范（所有提交必须遵守）:**

```
<type>(TASK-XXX): 简短描述

改动点1
改动点2

影响范围: 模块名
文件改动: 文件1, 文件2

Co-Authored-By: OpenMatrix https://github.com/bigfish1913/openmatrix
```

**type 映射:** feat(新功能) / fix(修复) / test(测试) / refactor(重构) / docs(文档)
**禁止使用 emoji**，使用纯文本格式

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
Step 1: 初始化 .openmatrix → Step 2: 提取 goals + plan → Step 3: 写入 tasks-input.json
→ Step 4: openmatrix start --tasks-json (必须) → Step 5: 读取 subagentTasks
→ Step 6: Agent 逐个执行 (只有这里写代码)
```

## Git 提交格式

```
<type>(TASK-XXX): 简短描述

改动点1 / 改动点2
影响范围: 模块名
文件改动: 文件1, 文件2
Co-Authored-By: OpenMatrix https://github.com/bigfish1913/openmatrix
```

type: feat/fix/test/refactor/docs。禁止 emoji。
</notes>
