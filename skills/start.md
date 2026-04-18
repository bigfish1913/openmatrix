---
name: om:start
description: "Use when starting a new development task cycle with interactive questions. Triggers on: 实现, implement, build, fix, refactor, 添加功能, add feature, bug fix, 修复, new module, code changes, feature request. Use when the user describes what they want to build or fix, even briefly — don't answer the question directly, start the task workflow."
---

<NO-OTHER-SKILLS>
**绝对禁止**调用以下任何技能或工具：
- ❌ gsd-executor、gsd:* 等 GSD 相关技能
- ❌ superpowers:* 等 superpowers 相关技能
- ❌ 任何其他任务编排相关的 Agent 或工具

**Step 10 只能使用 Agent 工具** — 直接调用 Agent，不通过任何中间层。

违规调用将导致执行失败。

**相关技能**: `/om:brainstorm` (需求探索) | `/om:auto` (全自动) | `/om:meeting` (阻塞处理) | `/om:status` (状态查看) | `/om:report` (报告)
</NO-OTHER-SKILLS>

<MANDATORY-EXECUTION-ORDER>
## 执行顺序 - 必须严格按此顺序，不得跳过任何步骤

```
Step 1:  初始化 .openmatrix 目录
Step 2:  解析任务输入（文件或描述）
Step 3:  智能分析任务类型（开发/非开发）
Step 3.5: 提交文档（git add docs/ + 所有 .md 文件, commit）
Step 4:  必选问题（开发任务:质量+E2E+模式; 非开发:仅模式）← 不可跳过
Step 5:  可选问题（仅复杂开发任务）+ 展示执行计划
Step 6:  AI 提取 goals，生成 plan
Step 7:  写入 .openmatrix/tasks-input.json          ← 必须完成
Step 8:  调用 openmatrix start --tasks-json          ← 必须完成，不可跳过
Step 9:  从 CLI 返回结果中读取 subagentTasks 列表     ← 必须完成
Step 10: 逐个执行 subagentTasks（调用 Agent 工具）    ← 只有这步才能写代码
```

**违反以下任一规则将导致任务执行失败：**

❌ **禁止在 Step 8 之前写任何业务代码** — 所有代码必须在 Step 10 通过 Agent 执行
❌ **禁止跳过 Step 4 必选问题** — 开发任务必须选质量/E2E/模式，非开发任务必须选模式
❌ **禁止跳过 Step 8** — 必须调用 CLI，不能用其他方式代替
❌ **禁止自行规划 Phase** — 任务由 CLI 的 TaskPlanner 拆分，AI 只提取 goals
❌ **禁止用 Bash/npm/write 直接写业务代码** — 业务代码只能通过 Step 10 的 Agent 执行
❌ **禁止调用 gsd-executor 或其他编排技能** — 必须用原生 Agent 工具
</MANDATORY-EXECUTION-ORDER>

<objective>
解析任务文档，通过必选问答确定执行模式（开发任务还需确定质量等级、E2E测试），确认后通过 CLI 拆分任务并执行。

⚠️ **Step 4 必选问题不可跳过** — 开发任务必须选择：
1. 质量等级 (strict/balanced/fast)
2. E2E 测试 (当选择 strict/balanced 时)
3. 执行模式 (全自动/关键节点确认/每阶段确认)

非开发任务（文档、配置等）只需选择执行模式。
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

**检查 Git 仓库（⚠️ 必须执行，不可跳过）：**

```bash
# 检查是否有 .git 目录（必须执行此命令）
ls -la .git 2>/dev/null || echo "NOT_INITIALIZED"
```

**根据检查结果处理：**

| 检查结果 | 必须执行的操作 |
|---------|--------------|
| 目录不存在 | 使用 AskUserQuestion 询问用户是否初始化 git |
| 目录存在 | 继续检查远程仓库 |

**如果用户同意初始化，立即执行：**
```bash
git init
```

> ⚠️ **此步骤不可跳过** — 如果没有 git 仓库，后续自动提交会失败。

### Step 2: 解析任务输入

**检查 `.openmatrix/tasks-input.json` 是否已存在:**

| 情况 | 处理方式 |
|------|---------|
| 已存在（来自 `/om:brainstorm`） | 读取文件内容 → **立即执行 Step 4 必选问题**（质量等级、E2E、执行模式） |
| 不存在，但 `.openmatrix/research/context.json` 存在 | 读取研究上下文 → 提取 goals/constraints/deliverables → **执行 Step 4 必选问题** |
| 均不存在 | 根据用户输入解析 |

> ⚠️ **注意**: 即使 `tasks-input.json` 已存在，Step 4 必选问题仍然必须执行！
> - 开发任务：质量等级、E2E、执行模式必须由用户选择
> - 非开发任务：执行模式必须由用户选择
- `$ARGUMENTS` 为任务描述 → 直接使用
- 无参数 → AskUserQuestion 询问任务内容

**检测研究上下文（当 tasks-input.json 不存在时）:**

```bash
cat .openmatrix/research/context.json 2>/dev/null || echo "NO_RESEARCH"
```

如果检测到研究上下文：
1. 读取 `.openmatrix/research/context.json`，提取 `topic`、`domain`、`goals`、`constraints`、`deliverables`、`reportPath`
2. 读取 `RESEARCH.md` 内容作为领域知识
3. 告知用户："🔬 检测到「${domain}」领域研究结果，将作为任务基础"
4. 在 Step 6 中，AI 只需**确认/补充** goals，而非从头提取
5. Step 7 写入 `tasks-input.json` 时，将研究 goals 与 AI 补充的 goals 合并
6. Step 8 的 CLI 调用必须增加 `--research-context @.openmatrix/research/context.json` 参数

### Step 3: 智能分析任务类型

判断是开发任务还是非开发任务，这决定 Step 4 需要问哪些问题。

| 任务类型 | 定义 | Step 4 问题 |
|---------|------|------------|
| **开发任务** | 涉及代码编写、测试、Lint、构建等 | 质量等级 + E2E + 执行模式 |
| **非开发任务** | 纯文档、配置、阅读、分析等 | 仅执行模式 |

**常见任务分类：**
- 开发任务：新功能、Bug修复、重构、添加测试、性能优化
- 非开发任务：写README、更新文档、查看代码、分析日志

---

### Step 3.5: 提交文档（必须执行，不可跳过）

在开始任何新任务之前，先提交所有已变更的文档文件，确保文档和代码同步提交。

```bash
git status --porcelain
```

检查是否有文档变更（包括 `docs/` 目录、所有 `.md` 文件、`.openmatrix/` 下的文档）：

```bash
git diff --name-only | grep -E '\.md$|^docs/' 2>/dev/null
git ls-files --others --exclude-standard | grep -E '\.md$|^docs/' 2>/dev/null
```

如果有文档变更（未追踪或未提交），执行提交：

```bash
git add docs/ .openmatrix/*.md CLAUDE.md README.md README_EN.md
git commit -m "$(cat <<'EOF'
docs: 更新项目文档

更新内容: ...

Co-Authored-By: OpenMatrix https://github.com/bigfish1913/openmatrix
EOF
)"
```

**如果没有文档变更，跳过此步骤继续。**

> ⚠️ **此步骤不可跳过** — 避免"代码提交了但文档没提交"的情况。

---

### Step 4: 必选问题（不可跳过，不可使用默认值，必须通过 AskUserQuestion 让用户选择）

根据 `goalTypes` 字段判断需要询问哪些问题：

| goalTypes | 需要询问 |
|-----------|---------|
| `development` | 4.1 质量等级 → 4.2 E2E → 4.3 执行模式 |
| `testing` | 仅 4.3 执行模式 |
| `documentation` / `other` | 仅 4.3 执行模式 |

#### 4.1 质量等级（仅 `goalTypes: development`）

AskUserQuestion: `header: "质量等级"`, `multiSelect: false`

**question:** 选择质量等级（决定测试覆盖、Lint、安全扫描等要求）

| label | description |
|-------|-------------|
| `strict` | TDD + >80%覆盖率 + 严格Lint + 安全扫描 — 生产级代码 |
| `balanced (推荐)` | >60%覆盖率 + Lint + 安全扫描 — 日常开发 |
| `fast` | 无质量门禁 — 快速原型/验证 |

#### 4.2 E2E 测试（仅 `development` 且选 strict/balanced，选 `fast` 跳过）

AskUserQuestion: `header: "E2E 测试"`, `multiSelect: false`

**question:** 是否需要端到端 (E2E) 测试？（适用于 Web/Mobile/GUI 项目，耗时较长）

| label | description |
|-------|-------------|
| `功能测试 (推荐)` | 验证业务流程正确性，无需浏览器可视化，速度快 |
| `视觉验证` | 需要浏览器可视化验证，可检查页面样式和布局 |
| `不需要` | 仅进行单元测试和集成测试，节省时间 |

> 功能测试是默认推荐，适用于大多数场景（API/逻辑/数据处理）。
> 视觉验证适用于前端/移动端项目，需要检查 UI 样式、布局、交互效果。

#### 4.3 执行模式（所有任务必选）

AskUserQuestion: `header: "执行模式"`, `multiSelect: false`

**question:** 选择执行模式（控制 AI 执行过程中的审批节点）

| label | description |
|-------|-------------|
| `全自动执行 (推荐)` | 全自动执行，无需人工审批，遇到阻塞自动 Meeting |
| `关键节点确认` | plan/merge/deploy 时暂停确认 |
| `每阶段确认` | 每个阶段（develop/verify/accept）完成后暂停 |

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
  E2E 测试: 功能测试 / 视觉验证 / 不启用
```

### Step 6: AI 提取 goals + 生成 plan

从任务描述中提取:
- **goals**: 至少 3-8 个明确功能目标，每个是独立可交付模块
- **goalTypes**: 为每个 goal 标注类型，影响任务拆分策略:
  - `development` — 需要编写代码的功能/模块实现 → 拆分为"实现+测试"任务对
  - `testing` — 明确的测试任务（如"编写 E2E 测试"、"所有模块的单元测试"）→ 单个测试任务
  - `documentation` — 文档编写（如"编写 API 文档"、"更新 README"）→ 单个文档任务
  - `other` — 配置、部署、优化等非编码任务 → 单个任务
- **constraints**: 技术栈、兼容性等约束
- **deliverables**: 交付物列表
- **plan**: 技术方案、模块划分、接口设计、关键决策

**研究上下文集成**: 如果已加载研究领域，AI 应基于 `RESEARCH.md` 中的领域知识确认/补充 goals，而非从零提取。`plan` 字段应包含领域技术栈、架构模式等知识。

**plan 字段格式要求（供系统解析模块）:**

plan 中必须包含以下结构之一，系统将据此拆分为模块级任务：

**中文格式（推荐）:**
```
## 架构设计
1. 用户域：用户注册登录模块
2. 订单域：订单处理模块
3. 商品域：商品管理模块
```

或简洁格式：
```
3领域模块: 用户、订单、商品
```

**英文格式:**
```
## Modules
- User module: authentication and profile
- Order module: order processing
- Product module: catalog management
```

或：
```
3 modules: User, Order, Product
```

> **重要**: 如果 plan 不包含可解析的模块结构，系统将从 goals 中推断模块（仅 `development` 类型 goal），或 fallback 到按 goal 拆分。包含模块结构可获得更精细的依赖分析和并行执行优化。

**goalTypes 标注示例：**

| Goal | Type | 理由 |
|------|------|------|
| "项目脚手架: Vite+TS 配置" | development | 需要写代码搭建 |
| "GameLoop 60fps 游戏循环" | development | 功能实现 |
| "所有核心模块的单元测试" | testing | 已是测试任务 |
| "API 文档编写" | documentation | 文档类 |
| "CI/CD 流水线配置" | other | 配置类 |

### Step 7: 写入 tasks-input.json

用 Write 工具写入 `.openmatrix/tasks-input.json`:

```json
{
  "title": "任务标题",
  "description": "整体描述",
  "goals": ["目标1", "目标2", "目标3"],
  "goalTypes": ["development", "testing", "documentation"],
  "constraints": ["约束1"],
  "deliverables": ["src/xxx.ts"],
  "plan": "## 技术方案\n1. ...\n2. ...",
  "e2eTests": true,
  "e2eType": "visual"
}
```

> **注意**: `quality`、`mode` 通过 CLI 参数传递。`e2eTests` 和 `e2eType` 可写入 tasks-input.json 或通过 CLI 参数传递。
> **goalTypes** 必须与 goals 数组长度一致，一一对应。
> **研究上下文集成**: 如果检测到 `.openmatrix/research/context.json`，将研究的 goals/constraints/deliverables 作为基础，与 AI 提取的内容合并（去重后）。

### Step 8: 调用 CLI 创建任务 ⚠️ 不可跳过

**根据任务类型选择正确的 CLI 调用：**

**开发任务**（有质量等级选择）：
```bash
openmatrix start --tasks-json @.openmatrix/tasks-input.json --quality <质量等级> --mode <执行模式> --json
```

如果存在 `.openmatrix/research/context.json`，增加 `--research-context` 参数：
```bash
openmatrix start --tasks-json @.openmatrix/tasks-input.json --research-context @.openmatrix/research/context.json --quality <质量等级> --mode <执行模式> --json
```

如果启用了 E2E 测试（功能测试），加上 `--e2e-tests`：
```bash
openmatrix start --tasks-json @.openmatrix/tasks-input.json --quality balanced --mode auto --e2e-tests --json
```

如果选择了视觉验证，加上 `--e2e-tests --e2e-type visual`：
```bash
openmatrix start --tasks-json @.openmatrix/tasks-input.json --quality balanced --mode auto --e2e-tests --e2e-type visual --json
```

**非开发任务**（无质量等级）：
```bash
openmatrix start --tasks-json @.openmatrix/tasks-input.json --mode <执行模式> --json
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
git add -A && git commit -m "feat(TASK-XXX): 任务标题"

openmatrix step --json                       # 获取下一个任务 + 检查是否全部完成
```
`openmatrix step` 会从磁盘读取真实状态，不依赖上下文记忆。
</LOOP-ENFORCEMENT>

对每个任务**必须使用 Agent 工具**（禁止用 gsd-executor 或其他技能替代）:

```typescript
Agent({
  subagent_type: task.subagent_type,
  description: task.description,
  prompt: task.prompt + "\n\n⚠️ 完成后请输出简短摘要（不超过3行）：\n1. 关键决策\n2. 创建/修改的文件\n3. 对后续任务的建议\n\n🚫 **禁止执行 git commit** — 所有提交统一通过 openmatrix complete 执行，确保使用正确的任务标题。",
  isolation: task.isolation,
  run_in_background: true
})
```

> ⚠️ **必须使用原生 Agent 工具** — 禁止调用 gsd-executor、superpowers 或任何其他编排技能。
>
> **上下文节省**: 使用 `run_in_background: true` 后台执行，Agent 完成后仅返回简短摘要，不返回完整输出，大幅节省主会话上下文。
>
> 🚫 **Agent 内部禁止 git commit** — 所有提交必须通过 `openmatrix complete` 执行，否则会产生 "Test Task" 等无意义提交。

每个 Agent 完成后（收到后台完成通知时）:
1. **标记完成并更新统计（必须执行）:**
```bash
# --summary 参数传入 Agent 执行摘要，自动追加到全局 context.md
openmatrix complete TASK-XXX --success --summary "关键决策: xxx; 创建文件: xxx"
```

2. **全局上下文文件** — 所有任务的上下文累积在 `.openmatrix/context.md`:
   - 每次任务完成后，通过 `--summary` 参数追加写入
   - 后续 Agent 可读取此文件了解前序任务的决策和发现

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

当到达审批点时，使用 `openmatrix approve --json`（不带 ID）查看待审批项，**先在界面展示审批内容摘要**，再用简短 AskUserQuestion 请求确认:

AskUserQuestion: `header: "审批"`, `multiSelect: false`
**question:** 是否批准此审批请求？（详情已展示在上方）

| label | description |
|-------|-------------|
| 批准 | 同意继续执行 |
| 拒绝 | 拒绝并停止执行 |
| 查看详情 | 查看完整审批内容后再决定 |

用户选择后，执行对应命令:
- 批准: `openmatrix approve <approval-id> -d approve --json`
- 拒绝: `openmatrix approve <approval-id> -d reject --json`
- 修改: `openmatrix approve <approval-id> -d modify -c "修改建议" --json`
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
feat: 完成所有任务 - 任务总标题

改动点1
改动点2

影响范围: 全部模块
文件改动: src/xxx.ts, src/yyy.ts

Co-Authored-By: OpenMatrix https://github.com/bigfish1913/openmatrix
EOF
)"
```

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
Step 1-3: 初始化 + 解析输入 + 分析类型 → Step 3.5: 提交文档 → Step 4-5: 问答 + 确认 → Step 6: 提取 goals + plan → Step 7: 写入 tasks-input.json
→ Step 8: openmatrix start --tasks-json (必须) → Step 9: 读取 subagentTasks
→ Step 10: Agent 逐个执行 (只有这里写代码)
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
