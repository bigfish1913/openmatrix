---
name: om:brainstorm
description: 头脑风暴 - 探索需求和设计后再执行任务
---

<NO-OTHER-SKILLS>
**绝对禁止**调用其他任务编排相关的技能（OpenMatrix 完全替代它们）:
- ❌ 头脑风暴类 → 你已经在 brainstorm 中了
- ❌ 计划编写类 → OpenMatrix 有自己的任务拆分
- ❌ 计划执行类 → OpenMatrix 有自己的执行流程
- ❌ 项目管理类 → OpenMatrix 独立运行
- ❌ 任何其他任务编排相关的技能

OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
在进行任务执行前，先进行头脑风暴，深入探索需求、设计和技术方案，确保理解完整后再开始执行。
</objective>

<process>
1. **初始化头脑风暴会话**

   调用 CLI 创建头脑风暴会话:
   ```bash
   openmatrix brainstorm "$ARGUMENTS" --json
   ```

   这会返回:
   ```json
   {
     "status": "brainstorming",
     "message": "开始头脑风暴",
     "taskTitle": "任务标题",
     "questions": [...],
     "suggestResearch": "游戏开发",
     "researchHint": "检测到垂直领域「游戏开发」，建议先进行领域调研",
     "hint": "请逐一回答问题，完成后写入 tasks-input.json 并调用 /om:start"
   }
   ```

2. **检测垂直领域** (如果 suggestResearch 存在)

   如果 CLI 返回了 `suggestResearch` 字段，说明检测到垂直领域:

   ```typescript
   if (result.suggestResearch) {
     AskUserQuestion({
       questions: [{
         question: `检测到垂直领域「${result.suggestResearch}」，建议先进行领域调研。\n\n领域调研可以帮助您:\n• 了解行业最佳实践\n• 获取技术方案建议\n• 生成领域专属文档 (如 GDD/PRD)\n\n是否进入领域调研？`,
         header: "领域调研",
         options: [
           { label: "进入调研 (推荐)", description: "启动 /om:research 进行深度调研" },
           { label: "跳过调研", description: "直接进行头脑风暴问答" }
         ],
         multiSelect: false
       }]
     })
   }
   ```

   - 如果用户选择"进入调研"，调用 `/om:research`，研究完成后自动返回 start
   - 如果用户选择"跳过调研"，继续下面的问答流程

3. **交互式问答**

   对每个问题使用 `AskUserQuestion` 进行提问:

   ```typescript
   AskUserQuestion({
     questions: [{
       question: questions[0].question,
       header: questions[0].header,
       options: questions[0].options,
       multiSelect: questions[0].multiSelect
     }]
   })
   ```

   **收集回答并记录洞察**:
   - 每个回答后，思考其含义
   - 记录可能的设计决策
   - 识别潜在风险

4. **深入追问** (可选)

   如果用户选择了"其他"或回答不够清晰，进行追问:
   ```typescript
   AskUserQuestion({
     questions: [{
       question: "请详细描述:",
       header: "详情",
       options: []
     }]
   })
   ```

5. **总结头脑风暴结果**

   所有问题回答完成后，总结:
   - 核心目标
   - 用户价值
   - 技术方案要点
   - 风险和应对
   - 验收标准

   展示总结:
   ```
   🧠 头脑风暴总结

   📋 任务: 实现登录功能

   🎯 核心目标
      - 实现用户登录功能，支持邮箱和密码

   👥 用户价值
      - 终端用户可以安全登录系统

   🔧 技术方案
      - 使用 JWT 进行身份验证
      - 密码使用 bcrypt 加密

   ⚠️ 风险评估
      - 安全风险: 需要防止暴力破解

   ✅ 验收标准
      - 功能完整
      - 测试覆盖
   ```

5. **确认并开始执行**

   ```typescript
   AskUserQuestion({
     questions: [{
       question: "头脑风暴完成，是否开始执行任务？",
       header: "下一步",
       options: [
         { label: "✅ 开始执行 (推荐)", description: "使用收集的信息开始执行任务" },
         { label: "🔄 继续探索", description: "还有问题需要进一步讨论" },
         { label: "📋 仅生成计划", description: "生成详细计划但不执行" }
       ],
       multiSelect: false
     }]
   })
   ```

   如果用户选择"开始执行"，写入 `tasks-input.json` 后调用 `/om:start`。

6. **写入 tasks-input.json 并调用 /om:start**

   **先检测当前状态:**
   ```bash
   # 检查 .openmatrix 目录是否存在
   ls .openmatrix/state.json 2>/dev/null
   ```

   **如果需要初始化:**
   ```bash
   openmatrix start --init-only
   ```

   **将头脑风暴结论转换为 goals 并写入 `.openmatrix/tasks-input.json`:**
   ```json
   {
     "title": "任务标题",
     "description": "基于头脑风暴的整体描述",
     "goals": [
       "目标1: 独立功能模块",
       "目标2: 独立功能模块",
       "..."
     ],
     "constraints": ["约束"],
     "deliverables": ["交付物"],
     "answers": { "问答答案" },
     "plan": "## 技术方案\n..."
   }
   ```

   **注意:** `quality`、`mode`、`e2eTests` 不在此写入，由 `/om:start` 的必选问题决定。

   **⚠️ 最后一步（必须执行，不可跳过）：使用 Skill 工具调用 `/om:start`**

   写入文件后，**必须立即** 使用 Skill 工具调用 om:start：

   ```
   Skill 工具: skill = "om:start"
   ```

   这不是可选的 — 如果不调用 `/om:start`，任务不会开始执行。
   `/om:start` 会检测到已存在的 `tasks-input.json`，然后询问必选问题（质量等级、E2E、执行模式）。

   **路径 A: 全新开始 / 重新开始**
   ```bash
   # 初始化 (如果不存在)
   openmatrix start --init-only

   # 如果是重新开始，清理旧数据
   # rm -rf .openmatrix/tasks/ .openmatrix/approvals/ .openmatrix/meetings/
   ```

   **将头脑风暴结论转换为 goals:**
   ```json
   {
     "title": "任务标题",
     "description": "基于头脑风暴的整体描述",
     "goals": [
       "目标1: 独立功能模块",
       "目标2: 独立功能模块",
       "..."
     ],
     "constraints": ["约束"],
     "deliverables": ["交付物"],
     "answers": { "问答答案" },
     "quality": "用户选择的质量等级 (strict/balanced/fast)",
     "mode": "用户选择的执行模式 (auto/confirm-key/confirm-all)",
     "e2eTests": true或false,
     "plan": "## 技术方案\n..."
   }
   ```

   写入 `.openmatrix/tasks-input.json` 后执行:
   ```bash
   openmatrix start --tasks-json @.openmatrix/tasks-input.json --json
   ```

   **路径 B: 继续上次任务**
   ```bash
   openmatrix step --json
   ```
   从返回的 next task 继续执行。

   **最终：从 CLI 返回的 `subagentTasks` 开始逐个执行 Agent**

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:brainstorm                      # 交互式头脑风暴
/om:brainstorm docs/task.md         # 基于任务文件头脑风暴
/om:brainstorm "实现用户登录功能"    # 基于描述头脑风暴
</examples>

<notes>
## 头脑风暴流程图

```
┌─────────────────┐
│   开始头脑风暴   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  CLI 初始化会话  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 获取问题列表     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 交互式问答       │◀─────┐
│ (AskUserQuestion)│      │
└────────┬────────┘       │
         │                │
    ┌────┴────┐           │
    │         │           │
  有下一题   无下一题      │
    │         │           │
    └────────┤           │
             │           │
             ▼           │
┌─────────────────┐      │
│ 总结头脑风暴结果 │      │
└────────┬────────┘      │
         │               │
         ▼               │
┌─────────────────┐      │
│ 用户确认         │      │
└────────┬────────┘      │
         │               │
    ┌────┴────┐          │
    │         │          │
  开始执行   继续探索 ────┘
    │
    ▼
┌─────────────────┐
│ 自动执行 start   │
└─────────────────┘
```

## 问题类型

### 项目配置问题（智能管道生成）

| 问题 ID | 目的 | 为什么重要 |
|---------|------|-----------|
| objective | 明确任务目标（新功能/修复/重构） | 选择正确的实现策略 |
| tech_stack | 技术栈选择 | 决定使用什么框架和工具 |
| test_coverage | 测试覆盖率要求 | 影响测试任务生成 |
| documentation_level | 文档要求级别 | 影响文档任务生成 |
| risks | 风险评估 | 提前规划应对策略 |
| acceptance | 验收标准 | 判断任务完成度 |

> **注意**: 质量等级、E2E 测试、执行模式这些必选问题在 `/om:start` 时由用户选择，不在头脑风暴阶段询问。

> **智能预填**：当 `SmartQuestionAnalyzer` 对某个问题有高置信度推断时，该问题会被自动跳过，不需要用户回答。

### 领域分析问题（底层逻辑思考）

| 问题 ID | 目的 | 为什么重要 |
|---------|------|-----------|
| domain_entities | 核心领域实体建模 | 决定数据模型和 API 设计的基础 |
| data_flow | 数据流转路径分析 | 决定架构选型（请求驱动 vs 事件驱动 vs 流处理） |
| invariants | 关键不变量/业务约束 | 决定哪里需要加锁、事务、校验 |
| core_scenarios | 核心用户场景链路 | 决定 MVP 功能范围和优先级排序 |

> **领域分析的价值**：这四个问题帮助 AI 在执行前建立对系统的深层理解，而不是机械地按需求列表编码。答案会作为上下文注入到每个 Agent 的执行提示词中。

## 与 start 的集成

头脑风暴完成后，收集的信息会传递给 start:

```json
{
  "answers": {
    "objective": "new_feature",
    "tech_stack": ["typescript", "react"],
    "test_coverage": "medium",
    "documentation_level": "basic",
    "risks": ["technical", "compatibility"],
    "acceptance": ["functional", "tested"]
  },
  "insights": [
    "需要考虑安全性",
    "应该支持多种登录方式"
  ],
  "designNotes": [
    "使用 JWT 认证",
    "密码需要加密存储"
  ]
}
```

这些信息会影响:
- 任务拆解策略
- 质量级别选择
- 技术栈确认
- 风险应对措施
</notes>