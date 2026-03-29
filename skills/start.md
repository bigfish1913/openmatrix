---
name: om:start
description: 启动新的任务执行周期
---

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
解析任务文档，通过智能分析自动推断配置，仅对不确定的问题进行交互式问答，确认后启动执行。
</objective>

<process>
1. **检查并初始化 .openmatrix 目录**
   - 检查 `.openmatrix/` 目录是否存在
   - 如果不存在，调用 CLI 初始化:
     ```bash
     openmatrix start --init-only
     ```
   - 这会创建 `.openmatrix/`、`.openmatrix/tasks/`、`.openmatrix/approvals/` 目录
   - 同时自动将 `.openmatrix/` 添加到 `.gitignore`

2. **检查当前状态**
   - 读取 `.openmatrix/state.json`
   - 如果 `status === 'running'`，提示用户先完成或暂停

3. **检查 Git 仓库**
   - 检查当前目录是否存在 `.git` 文件夹
   - 如果没有：
     - 询问用户是否初始化 Git 仓库 (使用 AskUserQuestion)
     - 如果用户确认，执行 `git init`
     - 创建初始 commit: `git add -A && git commit -m "Initial commit"`
   - 检查是否有远程仓库配置:
     - 如果没有远程仓库，提示用户添加: `git remote add origin <url>`

4. **智能检测 .gitignore**

   检查 `.gitignore` 文件是否存在并完善:
   ```bash
   openmatrix check-gitignore --json
   ```

   返回结果:
   ```json
   {
     "exists": true,
     "missingEntries": ["node_modules", "dist", ".env"],
     "suggestedContent": "# Node.js\nnode_modules/\ndist/\n\n# Environment\n.env\n.env.local"
   }
   ```

   **如果缺少常见忽略项**:
   - 自动补充缺失的条目到 `.gitignore`
   - 不询问用户，静默完成

   **常见忽略项清单** (按项目类型):

   | 类型 | 忽略项 |
   |------|--------|
   | Node.js | `node_modules/`, `dist/`, `build/`, `.npm/`, `*.log` |
   | TypeScript | `*.tsbuildinfo`, `.tsbuildinfo` |
   | Python | `__pycache__/`, `*.pyc`, `.venv/`, `venv/`, `.pytest_cache/` |
   | Java | `target/`, `.gradle/`, `build/`, `*.class` |
   | Go | `vendor/`, `bin/`, `*.exe` |
   | Rust | `target/`, `Cargo.lock` (库项目) |
   | 通用 | `.env`, `.env.local`, `.DS_Store`, `Thumbs.db`, `*.swp` |
   | IDE | `.idea/`, `.vscode/`, `*.iml` |

5. **解析任务输入**
   - 如果 `$ARGUMENTS` 提供文件路径 → 读取文件内容
   - 如果 `$ARGUMENTS` 是任务描述 → 直接使用
   - 如果无参数 → **使用 AskUserQuestion 询问用户要执行的任务**

6. **🔍 智能分析任务，动态决定问题**

   **注意: 此步骤由 Skill 直接调用 analyze CLI，不是 start 命令的内部逻辑。**
   ```bash
   openmatrix analyze --json
   ```

   返回分析结果包含:
   - `taskComplexity`: simple/medium/complex
   - `taskType`: bugfix/feature/refactor/docs/test
   - `inferences`: 自动推断的配置
   - `questionsNeeded`: 需要询问的问题列表（可能为空）

   **根据任务类型智能跳过问题:**

   | 任务类型 | 跳过的问题 | 默认值 |
   |---------|-----------|--------|
   | Bug 修复 | E2E测试、完整文档 | fast + 最小文档 |
   | Typo/小改动 | 所有问题 | fast 模式 |
   | 新功能开发 | 无 | 正常询问 |
   | 重构 | E2E测试 | balanced 模式 |
   | 测试编写 | 文档级别 | 无需文档 |

   **示例：简单任务自动跳过**
   ```
   任务: "修复登录页面的 typo"

   🔍 分析结果:
     • 任务类型: 简单修复
     • 推断配置: fast 模式, 无需文档

   ✅ 自动使用推断配置，无需额外确认
   ```

   **示例：复杂任务需要确认**
   ```
   任务: "实现用户登录功能"

   🔍 分析结果:
     • 任务类型: 新功能开发
     • 技术栈: TypeScript (检测到)
     • 需要确认: 质量级别
   ```

7. **只询问必要的问题**

   如果分析结果显示需要询问，使用 AskUserQuestion 询问。

   **智能合并问题（一次询问多个）:**
   ```typescript
   // 如果有多个问题需要确认，合并到一次询问
   AskUserQuestion({
     questions: [
       {
         question: "选择质量级别:",
         header: "质量",
         options: [...]
       },
       {
         question: "需要文档吗？",
         header: "文档",
         options: [...]
       }
     ]
   })
   ```

   **质量级别选择:**
   ```typescript
   AskUserQuestion({
     questions: [{
       question: "选择质量级别:",
       header: "质量级别",
       options: [
         { label: "🚀 strict", description: "TDD + >80%覆盖率 + 严格Lint + 安全扫描" },
         { label: "⚖️ balanced", description: ">60%覆盖率 + Lint + 安全扫描" },
         { label: "⚡ fast", description: "无质量门禁，最快速度" }
       ],
       multiSelect: false
     }]
   })
   ```

8. **最终确认（只显示实际配置）**

   ```typescript
   AskUserQuestion({
     questions: [{
       question: `📋 配置确认:\n${configSummary}\n\n确认开始执行？`,
       header: "确认",
       options: [
         { label: "✅ 确认开始", description: "开始执行任务" },
         { label: "🔄 修改配置", description: "调整配置项" }
       ],
       multiSelect: false
     }]
   })
   ```

9. **🧠 AI 解析任务 + 生成执行计划（由 Skill 自身完成）**

   **重要: AI 负责理解任务语义、生成执行计划、提取结构化信息。**
   任务拆分仍由 CLI 的 TaskPlanner 完成，但 AI 生成的计划会注入到每个子任务中供 agent 参考。

   **⚠️ 关键规则:**
   - **必须生成多个 goals** - 从任务中提取至少 3-8 个明确的功能目标
   - **必须写入 JSON 文件再调用 CLI** - 不能跳过 CLI 调用
   - **禁止自行规划 Phase 执行** - 任务拆分由 CLI 的 TaskPlanner 完成

   **解析原则:**
   - 从任务描述中提取明确的功能目标 (goals)，每个 goal 应该是独立可交付的功能模块
   - 识别隐含的约束条件 (constraints)，如技术栈、兼容性要求
   - 推断合理的交付物 (deliverables)
   - 将用户回答的上下文信息整理为 answers
   - **生成执行计划 (plan)**：技术方案、模块划分、接口设计、关键决策点

   **生成 ParsedTask JSON（含执行计划）:**

   ```json
   {
     "title": "任务标题",
     "description": "整体描述",
     "goals": ["目标1", "目标2", "目标3"],
     "constraints": ["约束1", "约束2"],
     "deliverables": ["src/xxx.ts", "tests/xxx.test.ts"],
     "answers": {
       "目标": "整体目标",
       "技术栈": "TypeScript, Vue.js",
       "文档": "basic"
     },
     "quality": "strict|balanced|fast",
     "mode": "confirm-all|confirm-key|auto",
     "plan": "## 技术方案\n\n1. 技术选型: ...\n2. 模块划分: ...\n3. 接口设计: ...\n4. 关键决策: ...\n\n## 实现步骤\n\n### Phase 1: 设计\n- 架构设计\n\n### Phase 2: 开发\n- 模块A: ...\n- 模块B: ...\n\n### Phase 3: 测试\n- 单元测试\n- 集成测试"
   }
   ```

   **注意:**
   - `goals` 是最核心的字段，TaskPlanner 会为每个 goal 生成 开发+测试 任务对
   - `plan` 是 AI 生成的执行计划，会被保存到 `.openmatrix/plan.md` 并注入每个子任务描述
   - plan 内容越详细，agent 执行效果越好（技术选型、接口定义、数据模型等）
   - 多个 goals 会自动并行执行（仅依赖设计任务）
   - constraints 和 deliverables 会影响集成测试和审查任务的生成

10. **展示执行计划**

   将第 9 步 AI 生成的 plan 内容展示给用户确认:

```
📋 执行计划

（展示第 9 步中 plan 字段的内容）

## 技术方案
1. ...
2. ...

## 模块划分
- 模块A: ...
- 模块B: ...

📊 统计
  Goals 数量: N（将生成 N个开发 + N个测试 + 审查 + 可选集成测试）
  质量级别: strict/balanced/fast
```

11. **执行模式确认** (使用 AskUserQuestion)

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

**⚠️ 如果用户选择"全自动执行":**
- 进入 **BYPASS 模式**，所有操作自动批准
- 不要请求用户确认任何 Bash 命令或文件操作
- 自动批准所有审批点 (plan/merge/deploy)

12. **⚠️ 调用 CLI 创建任务（必须执行，不可跳过）**

**重要**: 必须通过 CLI 创建任务，禁止自行规划 Phase 执行。

用户选择执行模式后：

a) 将第 9 步生成的 ParsedTask JSON 写入文件:
```
Write 工具: .openmatrix/tasks-input.json
内容: 第9步生成的ParsedTask JSON
```

b) 调用 CLI 创建任务（必须执行）:
```bash
openmatrix start --tasks-json @.openmatrix/tasks-input.json --json
```

c) CLI 返回 SubagentTask 列表

c) **执行循环** (由 Skill 驱动):

```
while (有待执行任务) {
  1. 读取状态文件获取 SubagentTask
  2. 调用 Agent 工具执行 Subagent
  3. Subagent 完成后，根据执行结果更新任务状态:
     - 成功: 任务通过 develop → verify → accept 阶段自动流转（由 OrchestratorExecutor 内部处理）
     - 失败: 任务标记为 failed，进入重试队列或等待处理
  4. **Git 自动提交** (每个子任务完成后):
     ```bash
     git add -A
     git commit -m "feat(task-id): 任务标题

     - 修改内容1
     - 修改内容2

     任务ID: TASK-XXX
     RunID: run-XXX"
     ```
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
openmatrix meeting --list
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

13. **执行完成 - 最终 Git 提交**

所有任务完成后，执行最终提交:
```bash
git add -A
git commit -m "feat: 完成所有任务

RunID: run-XXX
任务数: N
完成时间: YYYY-MM-DD HH:mm:ss"
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

| 级别 | TDD | 覆盖率 | Lint | 安全扫描 | E2E测试 | AI验收 | 适用场景 |
|------|:---:|:------:|:----:|:--------:|:-------:|:------:|---------|
| **strict** | ✅ | >80% | ✅ 严格 | ✅ | ❓ 可选 | ✅ | 生产代码、核心功能 |
| **balanced** | ❌ | >60% | ✅ | ✅ | ❓ 可选 | ✅ | 日常开发 (默认) |
| **fast** | ❌ | 无要求 | ❌ | ❌ | ❌ | ❌ | 快速原型、POC |

> E2E 测试耗时较长，即使在严格模式下也建议根据项目需要选择。strict 可配置为 100%。80% 覆盖核心业务逻辑，100% 成本高收益低。

### strict 模式 (推荐生产代码)
```
🧪 TDD 阶段:   先写测试 (RED) → 测试必须失败
✨ 开发阶段:   再写代码 (GREEN) → 测试必须通过
✅ 验证阶段:   7道质量门禁
   ├── Gate 1: 编译检查 (必须通过)
   ├── Gate 2: 测试运行 (必须通过)
   ├── Gate 3: 覆盖率 >= 80% (必须达标)
   ├── Gate 4: Lint 无 error (必须通过)
   ├── Gate 5: 安全扫描无高危 (必须通过)
   ├── Gate 6: E2E 测试通过 (必须通过，Web项目)
   └── Gate 7: 验收标准全部满足
🎉 验收阶段:   AI Reviewer 最终确认
```

### balanced 模式 (日常开发)
```
✨ 开发阶段:   编写代码
✅ 验证阶段:   4-5道质量门禁
   ├── Gate 1: 编译检查
   ├── Gate 2: 测试运行
   ├── Gate 3: 覆盖率 >= 60%
   ├── Gate 4: E2E 测试 (可选，Web项目)
   └── Gate 5: 验收标准
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
