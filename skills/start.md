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

2. **解析任务输入**
   - 如果 `$ARGUMENTS` 提供文件路径 → 读取文件内容
   - 如果 `$ARGUMENTS` 是任务描述 → 直接使用
   - 如果无参数 → **使用 AskUserQuestion 询问用户要执行的任务**

3. **⚠️ 交互式问答 (必须执行)**

   **重要**: 除非用户明确指定 `--skip-questions`，否则必须执行交互式问答。

   使用 `AskUserQuestion` 工具，逐个提出以下问题：

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

   **问题 3: 测试要求**
   ```typescript
   AskUserQuestion({
     questions: [{
       question: "测试覆盖率要求？",
       header: "测试",
       options: [
         { label: ">80% (严格)", description: "完整单元测试和集成测试" },
         { label: ">60% (标准)", description: "核心功能测试" },
         { label: ">40% (基础)", description: "关键路径测试" },
         { label: "无要求", description: "不强制测试" }
       ],
       multiSelect: false
     }]
   })
   ```

   **问题 4: 文档要求**
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

4. **任务拆解**
   - 根据用户回答拆解任务
   - 生成子任务列表和依赖图

5. **展示执行计划**

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

7. **开始执行**

用户确认后：

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
  6. 检查是否需要审批 → 如需则暂停
  7. 继续下一个任务
}
```

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
## 交互式问答流程图

```
┌─────────────────┐
│   开始任务解析   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 生成第一个问题   │◀─────────────┐
└────────┬────────┘              │
         │                       │
         ▼                       │
┌─────────────────┐              │
│ AskUserQuestion │              │
└────────┬────────┘              │
         │                       │
         ▼                       │
   ┌───────────┐                 │
   │ 用户回答   │                 │
   └─────┬─────┘                 │
         │                       │
         ▼                       │
   ┌───────────┐     是          │
   │ 需要追问？ │─────────────────┘
   └─────┬─────┘
         │ 否
         ▼
   ┌───────────┐     是
   │ 还有问题？ │─────────────────┐
   └─────┬─────┘                 │
         │ 否                     │
         ▼                       │
┌─────────────────┐              │
│   展示执行计划   │◀─────────────┘
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
└─────────────────┘
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
