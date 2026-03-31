---
name: om:start
description: 启动新的任务执行周期
---

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<MANDATORY-EXECUTION-ORDER>
## 执行顺序 - 必须严格按此顺序，不得跳过任何步骤

```
Step 1:  初始化 .openmatrix 目录
Step 2:  解析任务输入（文件或描述）
Step 3:  智能分析任务类型
Step 4:  必选问题（质量等级、E2E、执行模式）← 不可跳过
Step 5:  可选问题（仅复杂任务）+ 展示执行计划
Step 6:  AI 提取 goals，生成 plan
Step 7:  写入 .openmatrix/tasks-input.json          ← 必须完成
Step 8:  调用 openmatrix start --tasks-json          ← 必须完成，不可跳过
Step 9:  从 CLI 返回结果中读取 subagentTasks 列表     ← 必须完成
Step 10: 逐个执行 subagentTasks（调用 Agent 工具）    ← 只有这步才能写代码
```

**违反以下任一规则将导致任务执行失败：**

❌ **禁止在 Step 8 之前写任何业务代码** — 所有代码必须在 Step 10 通过 Agent 执行
❌ **禁止跳过 Step 4 必选问题** — 质量等级、执行模式必须由用户选择
❌ **禁止跳过 Step 8** — 必须调用 CLI，不能用其他方式代替
❌ **禁止自行规划 Phase** — 任务由 CLI 的 TaskPlanner 拆分，AI 只提取 goals
❌ **禁止用 Bash/npm/write 直接写业务代码** — 业务代码只能通过 Step 10 的 Agent 执行
</MANDATORY-EXECUTION-ORDER>

<objective>
解析任务文档，通过必选问答确定质量等级、E2E测试、执行模式，确认后通过 CLI 拆分任务并执行。

⚠️ **Step 4 必选问题不可跳过** — 必须让用户选择：
1. 质量等级 (strict/balanced/fast)
2. E2E 测试 (当选择 strict/balanced 时必问)
3. 执行模式 (全自动/关键节点确认/每阶段确认)
</objective>

<process>

## === 准备阶段（此阶段不得写任何业务代码）===

### Step 1: 智能检测状态

检查 `.openmatrix/` 目录和 `state.json` 的状态:

| 状态 | 处理方式 |
|------|---------|
| `.openmatrix/` 不存在 | 全新初始化: `openmatrix start --init-only` |
| `status: initialized` | 正常继续（首次使用） |
| `status: completed` | 提示用户：开始新任务会清理旧数据，确认后继续 |
| `status: running` | 提示用户先完成或暂停当前任务，然后退出 |
| `status: paused` | 询问用户：继续上次任务（→`/om:resume`）还是开始新任务 |
| `status: failed` | 询问用户：重试失败任务（→`/om:retry`）还是开始新任务 |

**如果是全新初始化:**
```bash
openmatrix start --init-only
```

检查 Git 仓库:
- 无 `.git` → 询问用户是否初始化
- 无远程仓库 → 提示用户添加

智能检测 `.gitignore`，自动补充缺失的忽略项（不询问）。

### Step 2: 解析任务输入

- `$ARGUMENTS` 为文件路径 → 读取文件内容
- `$ARGUMENTS` 为任务描述 → 直接使用
- 无参数 → AskUserQuestion 询问任务内容

### Step 3: 智能分析

根据任务内容判断是否需要额外问题（质量等级、执行模式、E2E 始终必选）:

| 任务类型 | 额外问题 | 默认配置 |
|---------|---------|---------|
| Bug 修复 / 小改动 | 跳过复杂度问题 | fast |
| 新功能开发 | 询问技术栈等 | balanced |
| 重构 | 跳过 E2E 相关 | balanced |
| 测试编写 | 跳过文档相关 | 无需文档 |

### Step 4: 必选问题（所有任务都必须回答）

**⚠️ 以下问题为必选，不可跳过：**

#### 4.1 质量等级（必选）

```typescript
AskUserQuestion({
  questions: [
    {
      question: "选择质量等级（决定测试覆盖、Lint、安全扫描等要求）:",
      header: "质量等级",
      options: [
        { label: "strict", description: "TDD + >80%覆盖率 + 严格Lint + 安全扫描 — 生产级代码" },
        { label: "balanced (推荐)", description: ">60%覆盖率 + Lint + 安全扫描 — 日常开发" },
        { label: "fast", description: "无质量门禁 — 快速原型/验证" }
      ],
      multiSelect: false
    }
  ]
})
```

#### 4.2 E2E 测试（当质量等级为 strict 或 balanced 时必选）

如果用户选择了 `strict` 或 `balanced`，继续询问:

```typescript
AskUserQuestion({
  questions: [
    {
      question: "是否启用端到端 (E2E) 测试？（适用于 Web/Mobile/GUI 项目，耗时较长）",
      header: "E2E 测试",
      options: [
        { label: "启用 E2E 测试", description: "使用 Playwright/Cypress 等框架进行端到端测试" },
        { label: "不启用 (推荐)", description: "仅进行单元测试和集成测试，节省时间" }
      ],
      multiSelect: false
    }
  ]
})
```

**注意:** 如果用户选择 `fast` 质量等级，跳过 E2E 问题（fast 模式不启用 E2E）。

#### 4.3 执行模式（必选）

```typescript
AskUserQuestion({
  questions: [
    {
      question: "选择执行模式（控制 AI 执行过程中的审批节点）:",
      header: "执行模式",
      options: [
        { label: "全自动执行 (推荐)", description: "全自动执行，无需人工审批，遇到阻塞自动 Meeting" },
        { label: "关键节点确认", description: "plan/merge/deploy 时暂停确认" },
        { label: "每阶段确认", description: "每个阶段（develop/verify/accept）完成后暂停" }
      ],
      multiSelect: false
    }
  ]
})
```

### Step 5: 可选问题（仅复杂任务）

根据任务类型，可能需要额外询问:

- 技术栈偏好
- 文档级别
- 风险评估
- 验收标准

展示 AI 生成的执行计划:

```
📋 执行计划
（展示 plan 内容）

📊 统计
  Goals: N 个（将生成 N个开发 + N个测试 + 审查）
  质量级别: xxx
  E2E 测试: 启用/不启用
```

### Step 6: AI 提取 goals + 生成 plan

从任务描述中提取:
- **goals**: 至少 3-8 个明确功能目标，每个是独立可交付模块
- **constraints**: 技术栈、兼容性等约束
- **deliverables**: 交付物列表
- **plan**: 技术方案、模块划分、接口设计、关键决策

### Step 7: 写入 tasks-input.json

用 Write 工具写入 `.openmatrix/tasks-input.json`:

```json
{
  "title": "任务标题",
  "description": "整体描述",
  "goals": ["目标1", "目标2", "目标3"],
  "constraints": ["约束1"],
  "deliverables": ["src/xxx.ts"],
  "answers": { "技术栈": "..." },
  "quality": "strict|balanced|fast",
  "mode": "confirm-all|confirm-key|auto",
  "plan": "## 技术方案\n1. ...\n2. ..."
}
```

**E2E 测试:** 如果用户在 Step 4 选择了"启用 E2E"，在 quality 后面加上:
```
"e2eTests": true
```
这会让 CLI 的 TaskPlanner 在任务拆分时生成额外的 E2E 测试任务。

### Step 8: 调用 CLI 创建任务 ⚠️ 不可跳过

**必须执行此命令，禁止跳过：**

```bash
openmatrix start --tasks-json @.openmatrix/tasks-input.json --json
```

此命令返回 JSON 包含 `subagentTasks` 列表。

### Step 9: 读取 subagentTasks

CLI 返回 JSON 中 `subagentTasks` 数组包含待执行任务。

## === 执行阶段（只有此阶段才能写业务代码）===

### Step 10: 逐个执行 subagentTasks（禁止中断）

<LOOP-ENFORCEMENT>
**此步骤是执行循环，必须执行完所有任务后才能停止。**

❌ **禁止在还有未完成任务时停止** — 即使 Agent 返回了大段输出，也必须继续下一个
❌ **禁止询问"是否继续"** — 直接执行下一个任务
❌ **禁止输出"让我知道是否..."后停止** — 继续执行
❌ **禁止因为上下文压缩而忘记剩余任务** — 通过 `openmatrix step --json` 重新获取状态

**文件持久化循环（防止上下文压缩丢失状态）:**
```bash
# 每个 Agent 完成后执行:
# --summary 传入执行摘要，自动追加到全局 context.md
openmatrix complete TASK-XXX --success --summary "决策: xxx; 文件: xxx"

# 提交验证（防止 commit 静默失败）:
git status --porcelain                        # 检查是否有未提交的文件
# 如果有未提交文件 → 必须手动提交:
git add -A && git commit -m "feat: (TASK-XXX) 任务标题"

openmatrix step --json                       # 获取下一个任务 + 检查是否全部完成
```
`openmatrix step` 会从磁盘读取真实状态，不依赖上下文记忆。
</LOOP-ENFORCEMENT>

对每个任务调用 Agent 工具:

```typescript
Agent({
  subagent_type: task.subagent_type,
  description: task.description,
  prompt: task.prompt,
  isolation: task.isolation
})
```

每个 Agent 完成后:
1. **标记完成并更新统计（必须执行）:**
```bash
# --summary 参数传入 Agent 执行摘要，自动追加到全局 context.md
openmatrix complete TASK-XXX --success --summary "关键决策: xxx; 创建文件: xxx"
```

2. **全局上下文文件** — 所有任务的上下文累积在 `.openmatrix/context.md`:
   - 每次任务完成后，通过 `--summary` 参数追加写入
   - 后续 Agent 可读取此文件了解前序任务的决策和发现

3. Git 自动提交（必须使用下方统一提交格式）

3. Git 自动提交（必须使用下方统一提交格式）
4. **获取下一个任务（防止上下文压缩丢失）:**
```bash
openmatrix step --json
```
如果返回 `status: "next"` → 继续执行返回的 task
如果返回 `status: "done"` → 所有任务完成，进入最终提交
如果返回 `status: "blocked"` → 有阻塞任务，处理 Meeting
5. 检查审批点（auto 模式自动批准，其他模式按配置暂停）

6. **审批点处理（根据执行模式）:**

根据用户选择的执行模式处理审批:

| 执行模式 | 审批点 | 处理方式 |
|---------|--------|---------|
| 全自动执行 | 无 | 自动批准所有操作 |
| 关键节点确认 | plan, merge, deploy | 到达审批点时暂停，交互式确认 |
| 每阶段确认 | develop, verify, accept | 每个阶段完成后暂停，交互式确认 |

**交互式审批流程（非全自动模式）:**

当到达审批点时，使用 `openmatrix approve --list` 查看待审批项，然后通过 AskUserQuestion 请求用户确认:

```typescript
// 检查是否有待审批项
// 通过 CLI: openmatrix approve --list --json

AskUserQuestion({
  questions: [
    {
      question: "审批请求: [审批类型]

[审批内容摘要]

是否批准?",
      header: "审批",
      options: [
        { label: "批准", description: "同意继续执行" },
        { label: "拒绝", description: "拒绝并停止执行" },
        { label: "查看详情", description: "查看完整审批内容后再决定" }
      ],
      multiSelect: false
    }
  ]
})
```

用户选择后，执行对应命令:
- 批准: `openmatrix approve <approval-id> --approve`
- 拒绝: `openmatrix approve <approval-id> --reject`
- 查看详情: 读取 `.openmatrix/approvals/<approval-id>.json` 并展示完整内容


**Agent 上下文共享机制 (Agent Memory):**

每个 Agent 执行时会自动接收前序 Agent 的上下文信息（通过 `context.md` 文件）。
这确保 Agent 之间共享知识、避免重复工作、保持决策一致性。

```
Agent-1 完成 → 写入 context.md → Agent-2 读取 Agent-1 的上下文 → 写入 context.md → ...
```

**中断恢复:** 如果会话中断，再次执行 `/om:start` 时:
1. 读取 `.openmatrix/state.json`
2. 如果 `status === 'running'`，读取所有任务，找到 status 不是 completed 的任务
3. 从中断的任务继续执行，不需要重新开始

**Meeting 处理（auto 模式）:** 记录并跳过，执行完成后统一展示。

**执行完成后:**

### Meeting 机制

在「全自动执行」模式下:
- 遇到阻塞任务时，创建 Meeting 记录并跳过该任务
- 继续执行其他独立任务，最大化并行度
- 所有非阻塞任务完成后，提示用户使用 `/om:meeting` 统一处理阻塞问题

```bash
openmatrix meeting --list
```

如有 pending Meeting，交互式处理。

所有任务完成后，执行最终 Git 提交（**必须使用 HEREDOC 格式**）:
```bash
git add -A && git commit -m "$(cat <<'EOF'
feat: 完成所有任务

- 任务1标题
- 任务2标题
- ...

影响范围: 全部模块
文件改动: 统计变更文件数

Run: run-XXX
Co-Authored-By: OpenMatrix <https://github.com/bigfish1913/openmatrix>
EOF
)"
```

**Git 提交格式规范（所有提交必须遵守）:**

```
<type>: (TASK-XXX) 简短描述

- 改动点1
- 改动点2

影响范围: 模块名
文件改动: 文件1, 文件2

Run: run-XXX
Co-Authored-By: OpenMatrix <https://github.com/bigfish1913/openmatrix>
```

**type 映射:** feat(新功能) / fix(修复) / test(测试) / refactor(重构) / docs(文档)
**禁止使用:** `Co-Authored-By: Claude` 格式，必须使用 `Co-Authored-By: OpenMatrix <https://github.com/bigfish1913/openmatrix>`
**禁止使用 emoji**，使用纯文本格式

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:start
/om:start docs/task.md
/om:start "实现用户登录功能"
</examples>

<notes>
## 质量级别

| 级别 | TDD | 覆盖率 | Lint | 安全 |
|------|:---:|:------:|:----:|:----:|
| strict | ✅ | >80% | ✅ | ✅ |
| balanced | ❌ | >60% | ✅ | ✅ |
| fast | ❌ | 无 | ❌ | ❌ |

## 执行流程

```
Step 1-5: 初始化 + 问答 + 确认
    ↓
Step 6: AI 提取 goals + 生成 plan
    ↓
Step 7: 写入 tasks-input.json
    ↓
Step 8: openmatrix start --tasks-json   ← 必须执行
    ↓
Step 9: 读取 subagentTasks
    ↓
Step 10: Agent 逐个执行                ← 只有这里写代码
```
</notes>
