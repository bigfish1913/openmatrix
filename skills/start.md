---
name: om:start
description: 启动新的任务执行周期
---

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
解析任务文档，通过交互式问答澄清需求（3-7个问题，支持多轮追问），确认后启动执行。
</objective>

<process>
1. **检查当前状态**
   - 读取 `.openmatrix/state.json`
   - 如果 `status === 'running'`，提示用户先完成或暂停

2. **检查 Git 仓库**
   - 检查当前目录是否存在 `.git` 文件夹
   - 如果没有：
     - 询问用户是否初始化 Git 仓库 (使用 AskUserQuestion)
     - 如果用户确认，执行 `git init`
     - 创建初始 commit: `git add -A && git commit -m "Initial commit"`
   - 检查是否有远程仓库配置:
     - 如果没有远程仓库，提示用户添加: `git remote add origin <url>`

3. **解析任务输入**
   - 如果 `$ARGUMENTS` 提供文件路径 → 读取文件内容
   - 如果 `$ARGUMENTS` 是任务描述 → 直接使用
   - 如果无参数 → **使用 AskUserQuestion 询问用户要执行的任务**

4. **⚠️ 交互式问答 (必须执行)**

   **重要**: 除非用户明确指定 `--skip-questions`，否则必须执行交互式问答。

   使用 `AskUserQuestion` 工具，逐个提出以下问题：

   **问题 0: 质量级别 (最重要，第一个问)**
   ```typescript
   AskUserQuestion({
     questions: [{
       question: "选择质量级别 (决定 TDD、覆盖率、安全扫描等):",
       header: "质量级别",
       options: [
         {
           label: "🚀 strict (推荐生产代码)",
           description: "TDD + 80%覆盖率 + 严格Lint + 安全扫描 + AI验收"
         },
         {
           label: "⚖️ balanced (日常开发)",
           description: "60%覆盖率 + Lint + 安全扫描 + AI验收"
         },
         {
           label: "⚡ fast (快速原型)",
           description: "无质量门禁，最快速度"
         }
       ],
       multiSelect: false
     }]
   })
   ```

   **问题 1: 任务目标**
   ```typescript
   AskUserQuestion({
     questions: [{
       question: "这个任务的主要目标是什么？",
       header: "目标",
       options: [
         { label: "实现新功能", description: "添加新的功能特性" },
         { label: "修复 Bug", description: "修复已知问题" },
         { label: "重构优化", description: "改进代码结构或性能" },
         { label: "其他", description: "其他类型任务" }
       ],
       multiSelect: false
     }]
   })
   ```

   **问题 2: 技术栈** (根据任务内容动态生成)
   ```typescript
   AskUserQuestion({
     questions: [{
       question: "使用什么技术栈？",
       header: "技术栈",
       options: [
         { label: "TypeScript", description: "类型安全的 JavaScript" },
         { label: "Python", description: "Python 语言" },
         { label: "Go", description: "Go 语言" },
         { label: "其他", description: "其他技术栈" }
       ],
       multiSelect: true
     }]
   })
   ```

   **问题 3: 文档要求**
   ```typescript
   AskUserQuestion({
     questions: [{
       question: "需要什么级别的文档？",
       header: "文档",
       options: [
         { label: "完整文档", description: "API + 使用指南 + 架构" },
         { label: "基础文档", description: "README + API" },
         { label: "最小文档", description: "仅 README" },
         { label: "无需文档", description: "不生成文档" }
       ],
       multiSelect: false
     }]
   })
   ```

   **多轮追问**: 如果用户选择"其他"，必须追问详情：
   ```typescript
   if (answer.includes("其他")) {
     AskUserQuestion({
       questions: [{
         question: "请详细描述:",
         header: "详情",
         options: [] // 允许自由输入
       }]
     })
   }
   ```

5. **任务拆解**
   - 根据用户回答拆解任务
   - 生成子任务列表和依赖图

6. **展示执行计划**

```
📋 执行计划

## Phase 1: 设计阶段
  └─ TASK-001: 架构设计 (15min)

## Phase 2: 开发阶段
  ├─ TASK-002: 数据模型 (20min)
  ├─ TASK-003: API 接口 (30min)
  └─ TASK-004: 前端页面 (40min)

## Phase 3: 测试阶段
  ├─ TASK-005: 单元测试 (20min)
  └─ TASK-006: 集成测试 (15min)

## Phase 4: 收尾阶段
  ├─ TASK-007: 文档编写 (15min)
  └─ TASK-008: 代码审查 (10min)

📊 统计
  总任务: 8
  预计耗时: ~2.5小时
  审批点: plan, merge
```

6. **执行模式确认** (使用 AskUserQuestion)

```typescript
AskUserQuestion({
  questions: [{
    question: "请选择执行模式:",
    header: "执行模式",
    options: [
      {
        label: "每阶段确认 (推荐)",
        description: "每个阶段完成后暂停，等待确认，适合重要任务"
      },
      {
        label: "关键节点确认",
        description: "仅在 plan/merge/deploy 时暂停，平衡速度和控制"
      },
      {
        label: "全自动执行",
        description: "无需确认，自动完成所有任务，适合简单低风险任务"
      }
    ],
    multiSelect: false
  }]
})
```

7. **开始执行** (⚠️ 严格模式)

**重要**: 从此步骤开始，除非遇到 meeting 审批或失败，否则**不得暂停询问用户**。

用户选择执行模式后：

a) 调用 CLI 初始化状态:
```bash
openmatrix start --mode <mode>
```

b) CLI 返回 SubagentTask 列表

c) **执行循环** (由 Skill 驱动):

```
while (有待执行任务) {
  1. 读取状态文件获取 SubagentTask
  2. 调用 Agent 工具执行 Subagent
  3. Subagent 完成后，更新状态文件
  4. Git 提交 (如果配置了自动提交)
  5. Phase 验收测试 (verify phase)
  6. **检查是否需要审批**:
     - 如果配置了 auto 模式 (`approvalPoints` 为空):
       - **plan/merge/deploy 审批**: 自动批准 ✓
       - **meeting 审批**: 不自动批准，只记录并跳过阻塞任务，供最后统一处理
     - 如果配置了非 auto 模式: 在配置的审批点暂停等待确认
     - 其他情况: 暂停等待人工确认

**Meeting 处理** (auto 模式):
```
执行任务中...
├── 任务A 完成 ✓
├── 任务B 阻塞 → 创建Meeting → **跳过任务，继续执行** ↷
├── 任务C 完成 ✓
└── 任务D 阻塞 → 创建Meeting → **跳过任务，继续执行** ↷

所有任务执行完成!
```

d) **执行完成后自动处理 Meeting**:

```bash
# 检查是否有 pending 的 Meeting
openmatrix meeting --list --pending
```

**如果有 pending 的 Meeting，立即进入交互式处理**:

```
📋 检测到待处理的 Meeting (2个)

┌─────────────────────────────────────────┐
│ [1] 🔴 TASK-001 - 数据库连接失败          │
│     阻塞原因: 无法连接到远程数据库         │
│                                         │
│ [2] 🤔 TASK-003 - API设计决策             │
│     问题: 选择 REST 还是 GraphQL         │
└─────────────────────────────────────────┘
```

**使用 AskUserQuestion 逐个处理**:

```typescript
// 1. 先选择要处理的 Meeting
AskUserQuestion({
  questions: [{
    question: "请选择要处理的 Meeting:",
    header: "Meeting",
    options: [
      { label: "[1] TASK-001 - 数据库连接失败", description: "阻塞 - 需要信息" },
      { label: "[2] TASK-003 - API设计决策", description: "决策 - 技术选型" },
      { label: "全部跳过", description: "标记所有 Meeting 为跳过" }
    ],
    multiSelect: false
  }]
})

// 2. 根据类型展示处理选项
// 阻塞型:
AskUserQuestion({
  questions: [{
    question: "如何处理此阻塞?",
    header: "处理方式",
    options: [
      { label: "💡 提供信息", description: "提供解决问题所需的信息后重试" },
      { label: "⏭️ 跳过任务", description: "标记为可选，继续执行" },
      { label: "🔄 重试", description: "直接重试此任务" }
    ],
    multiSelect: false
  }]
})

// 决策型:
AskUserQuestion({
  questions: [{
    question: "请做出决策:",
    header: "决策",
    options: [
      { label: "方案 A", description: "方案A描述" },
      { label: "方案 B", description: "方案B描述" }
    ],
    multiSelect: false
  }]
})
```

**处理完成后，如果用户提供了信息或选择重试，重新执行阻塞任务**:
```bash
openmatrix meeting APPR-001 --action provide-info --info "..."
# 或
openmatrix meeting APPR-001 --action retry

# 然后重新执行阻塞的任务
openmatrix resume TASK-001
```

**⚠️ 重要**: Meeting 处理是执行流程的一部分，必须在任务结束前完成。不要让用户手动调用 /om:meeting。

  7. 继续下一个任务
}
```

**⚠️ 重要**: 在 **auto 模式** 下，Skill **不得**询问用户任何确认问题：
- 不得询问"是否继续执行"
- 不得询问"是否执行下一 Phase"
- 不得询问"是否处理 Meeting"
- **plan/merge/deploy 自动批准，meeting 记录但不批准，最后统一展示**

d) 执行 Agent 工具示例:

```typescript
// 使用 Agent 工具执行 Subagent
Agent({
  subagent_type: task.subagent_type,
  description: task.description,
  prompt: task.prompt,
  isolation: task.isolation
})
```

**⚠️ 执行约束 - 必须遵守**

当执行 Agent 工具时，**禁止**向用户询问以下问题：
- "是否继续执行？"
- "是否执行下一阶段？"
- "是否继续 Phase X？"
- "任务量较大，是否需要分批次？"

**正确的行为**:
- 如果当前是 auto 模式 (`approvalPoints` 为空数组)，Agent 执行完毕后**直接继续**，无任何确认
- 只有遇到 **meeting** 类型的审批时才暂停
- 其他情况下，让 Agent 完整执行任务并在完成后自动返回结果

8. **状态更新**

每个 Subagent 完成后，更新任务状态:
```bash
openmatrix complete <taskId> --success/--failed
```

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:start                      # 交互式输入任务
/om:start docs/task.md         # 从文件读取任务
/om:start "实现用户登录功能"    # 直接描述任务
</examples>

<notes>
## 质量级别详解

| 级别 | TDD | 覆盖率 | Lint | 安全扫描 | AI验收 | 适用场景 |
|------|:---:|:------:|:----:|:--------:|:------:|---------|
| **strict** | ✅ | 80% | ✅ 严格 | ✅ | ✅ | 生产代码、核心功能 |
| **balanced** | ❌ | 60% | ✅ | ✅ | ✅ | 日常开发 (默认) |
| **fast** | ❌ | 0% | ❌ | ❌ | ❌ | 快速原型、POC |

### strict 模式 (推荐生产代码)
```
🧪 TDD 阶段:   先写测试 (RED) → 测试必须失败
✨ 开发阶段:   再写代码 (GREEN) → 测试必须通过
✅ 验证阶段:   6道质量门禁
   ├── Gate 1: 编译检查 (必须通过)
   ├── Gate 2: 测试运行 (必须通过)
   ├── Gate 3: 覆盖率 >= 80% (必须达标)
   ├── Gate 4: Lint 无 error (必须通过)
   ├── Gate 5: 安全扫描无高危 (必须通过)
   └── Gate 6: 验收标准全部满足
🎉 验收阶段:   AI Reviewer 最终确认
```

### balanced 模式 (日常开发)
```
✨ 开发阶段:   编写代码
✅ 验证阶段:   4道质量门禁
   ├── Gate 1: 编译检查
   ├── Gate 2: 测试运行
   ├── Gate 3: 覆盖率 >= 60%
   └── Gate 4: 验收标准
🎉 验收阶段:   AI Reviewer 确认
```

### fast 模式 (快速原型)
```
✨ 开发阶段:   编写代码
✅ 验证阶段:   仅编译检查
🎉 完成
```

## 交互式问答流程图

```
┌─────────────────┐
│   开始任务解析   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 问题0: 质量级别  │ ◀── 最重要，第一个问
│ strict/balanced │
│    /fast        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 问题1: 任务目标  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 问题2: 技术栈    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 问题3: 文档要求  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   展示执行计划   │
│  (含质量配置)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  确认执行模式    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    开始执行     │
│  (应用质量配置)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  所有任务完成?   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
   否        是
    │         │
    ▼         ▼
┌───────┐ ┌─────────────────┐
│继续执行│ │有 pending       │
└───────┘ │Meeting?         │
          └────────┬────────┘
                   │
              ┌────┴────┐
              │         │
             否        是
              │         │
              ▼         ▼
          ┌───────┐ ┌─────────────┐
          │  完成  │ │ 交互式处理  │
          └───────┘ │ Meeting     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ 重新执行    │
                    │ 阻塞任务    │
                    └─────────────┘
```

## 执行模式对比

| 模式 | 审批点 | Phase间确认 | 适用场景 |
|------|--------|-------------|---------|
| 每阶段确认 | 每阶段结束 | ✅ 是 | 重要任务 |
| 关键节点确认 | plan/merge/deploy | ❌ 否 | 常规任务 |
| 全自动执行 | 无 | ❌ 否 | 简单任务 |

## CLI 和 Skill 协作

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Skill     │────▶│    CLI      │────▶│   状态文件   │
│  (用户交互)  │     │ (状态管理)   │     │  (.openmat) │
└─────────────┘     └─────────────┘     └─────────────┘
       │                                        │
       │         读取 SubagentTask              │
       │◀───────────────────────────────────────┘
       │
       │         调用 Agent 工具
       ▼
┌─────────────┐
│   Subagent  │
│  (任务执行)  │
└─────────────┘
```

## SubagentTask 格式

```typescript
{
  subagent_type: 'general-purpose' | 'Explore' | 'Plan',
  description: string,      // 简短描述 (3-5词)
  prompt: string,           // 完整执行提示词
  isolation?: 'worktree',   // 是否隔离
  taskId: string,
  agentType: AgentType,
  timeout: number,
  needsApproval: boolean
}
```

## Git 自动提交

当配置了自动提交时，每个子任务完成后自动执行:

```bash
git add -A
git commit -m "feat(task-id): 任务标题

- 修改内容1
- 修改内容2

影响范围: [模块名]
任务ID: TASK-XXX
RunID: run-XXX"
```

## Phase 验收流程

每个 Phase 完成后:

1. **Verify Phase**
   - 运行测试: `npm test`
   - 构建检查: `npm run build`
   - 代码检查: `npm run lint` (如有)

2. **AI Reviewer**
   - 代码质量审查
   - 安全性检查
   - 性能评估

3. **结果输出**
   - ✅ 通过 → 进入下一 Phase
   - ⚠️ 警告 → 记录但继续
   - ❌ 失败 → 暂停等待处理
</notes>
