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
   - 如果已有运行中的任务，提示用户先完成或暂停

2. **解析任务输入**
   - 如果提供文件路径 → 读取文件内容
   - 如果提供任务描述 → 直接使用
   - 如果无参数 → 询问用户要执行的任务

3. **交互式问题生成 (使用 AskUserQuestion 工具)**

   **重要**: 必须使用 `AskUserQuestion` 工具进行交互式问答，而不是直接输出文本。

   a) 分析任务内容，识别不确定项
   b) 根据任务复杂度生成 3-7 个问题
   c) **逐个提问** - 使用 AskUserQuestion 一次问一个问题
   d) **多轮追问** - 根据回答动态生成后续问题

   示例调用:

   ```typescript
   // 第一个问题
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

   e) 如果用户选择"其他"，触发追问:

   ```typescript
   // 追问 (条件触发)
   if (answer.includes("其他")) {
     AskUserQuestion({
       questions: [{
         question: "请详细描述任务目标:",
         header: "详情",
         options: [] // 允许用户自由输入
       }]
     })
   }
   ```

   f) 问题类型覆盖:
   - **目标澄清** - 明确要做什么
   - **技术选择** - 确定技术栈
   - **范围界定** - 包含/排除什么
   - **质量要求** - 测试、文档标准
   - **约束条件** - 时间、资源限制
   - **风险识别** - 潜在问题和依赖

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
