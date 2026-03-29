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
Step 3:  智能分析，动态决定是否需要交互问答
Step 4:  如需问答 → AskUserQuestion（可跳过简单任务）
Step 5:  展示执行计划 + 确认执行模式
Step 6:  AI 提取 goals，生成 plan
Step 7:  写入 .openmatrix/tasks-input.json          ← 必须完成
Step 8:  调用 openmatrix start --tasks-json          ← 必须完成，不可跳过
Step 9:  从 CLI 返回结果中读取 subagentTasks 列表     ← 必须完成
Step 10: 逐个执行 subagentTasks（调用 Agent 工具）    ← 只有这步才能写代码
```

**违反以下任一规则将导致任务执行失败：**

❌ **禁止在 Step 8 之前写任何业务代码** — 所有代码必须在 Step 10 通过 Agent 执行
❌ **禁止跳过 Step 8** — 必须调用 CLI，不能用其他方式代替
❌ **禁止自行规划 Phase** — 任务由 CLI 的 TaskPlanner 拆分，AI 只提取 goals
❌ **禁止用 Bash/npm/write 直接写业务代码** — 业务代码只能通过 Step 10 的 Agent 执行
</MANDATORY-EXECUTION-ORDER>

<objective>
解析任务文档，智能推断配置，仅对不确定的问题交互问答，确认后通过 CLI 拆分任务并执行。
</objective>

<process>

## === 准备阶段（此阶段不得写任何业务代码）===

### Step 1: 初始化

检查 `.openmatrix/` 目录是否存在，不存在则初始化:
```bash
openmatrix start --init-only
```

读取 `.openmatrix/state.json`，如果 `status === 'running'`，提示用户先完成或暂停。

检查 Git 仓库:
- 无 `.git` → 询问用户是否初始化
- 无远程仓库 → 提示用户添加

智能检测 `.gitignore`，自动补充缺失的忽略项（不询问）。

### Step 2: 解析任务输入

- `$ARGUMENTS` 为文件路径 → 读取文件内容
- `$ARGUMENTS` 为任务描述 → 直接使用
- 无参数 → AskUserQuestion 询问任务内容

### Step 3: 智能分析

根据任务内容判断是否需要交互问答:

| 任务类型 | 跳过问题 | 默认配置 |
|---------|---------|---------|
| Bug 修复 / 小改动 | 跳过所有 | fast + 最小文档 |
| 新功能开发 | 正常询问 | balanced |
| 重构 | 跳过 E2E | balanced |
| 测试编写 | 跳过文档 | 无需文档 |

### Step 4: 交互问答（仅对复杂任务）

如果需要确认配置，使用 AskUserQuestion 一次询问多个问题:

```typescript
AskUserQuestion({
  questions: [
    {
      question: "选择质量级别:",
      header: "质量",
      options: [
        { label: "strict", description: "TDD + >80%覆盖率 + Lint + 安全扫描" },
        { label: "balanced", description: ">60%覆盖率 + Lint + 安全扫描" },
        { label: "fast", description: "无质量门禁" }
      ],
      multiSelect: false
    }
  ]
})
```

### Step 5: 展示计划 + 确认模式

展示 AI 生成的执行计划:

```
📋 执行计划
（展示 plan 内容）

📊 统计
  Goals: N 个（将生成 N个开发 + N个测试 + 审查）
  质量级别: xxx
```

使用 AskUserQuestion 确认执行模式:

```typescript
AskUserQuestion({
  questions: [{
    question: "请选择执行模式:",
    header: "执行模式",
    options: [
      { label: "每阶段确认", description: "每个阶段完成后暂停" },
      { label: "关键节点确认", description: "plan/merge/deploy 时暂停" },
      { label: "全自动执行", description: "无需确认，自动完成" }
    ],
    multiSelect: false
  }]
})
```

**如果用户选择"全自动执行"，进入 BYPASS 模式（所有操作自动批准）。**

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
❌ **禁止因为上下文压缩而忘记剩余任务** — 每完成一个任务后，重新读取 state.json 确认剩余任务

**执行循环伪代码:**
```
remaining = subagentTasks 中 status !== 'completed' 的任务
while (remaining.length > 0) {
  task = remaining[0]
  result = Agent(task)           // 执行
  更新任务状态为 completed
  remaining = 从 state.json 重新读取未完成任务
}
```
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
1. 更新任务状态: `openmatrix complete <taskId>` 或更新 state
2. Git 自动提交（必须使用下方统一提交格式）
3. **立即检查是否还有未完成任务** — 读取 `.openmatrix/state.json` 中的 statistics，如果 completed < totalTasks，继续执行下一个
4. 检查审批点（auto 模式自动批准，其他模式按配置暂停）

**中断恢复:** 如果会话中断，再次执行 `/om:start` 时:
1. 读取 `.openmatrix/state.json`
2. 如果 `status === 'running'`，读取所有任务，找到 status 不是 completed 的任务
3. 从中断的任务继续执行，不需要重新开始

**Meeting 处理（auto 模式）:** 记录并跳过，执行完成后统一展示。

**执行完成后:**
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
