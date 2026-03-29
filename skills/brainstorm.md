---
name: om:brainstorm
description: 头脑风暴 - 探索需求和设计后再执行任务
---

<NO-OTHER-SKILLS>
执行此技能时，不得调用其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
在进行任务执行前，先进行头脑风暴，深入探索需求、设计和技术方案，确保理解完整后再开始执行。
</objective>

<process>
1. **初始化头脑风暴会话**

   调用 CLI 创建头脑风暴会话:
   ```bash
   openmatrix brainstorm --json
   ```

   这会返回:
   ```json
   {
     "status": "brainstorming",
     "message": "开始头脑风暴",
     "taskTitle": "任务标题",
     "questions": [
       {
         "id": "core_objective",
         "question": "这个任务的核心目标是什么？",
         "header": "核心目标",
         "options": [...],
         "multiSelect": false
       }
     ],
     "hint": "请逐一回答问题，完成后再调用 --complete"
   }
   ```

2. **交互式问答**

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

3. **深入追问** (可选)

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

4. **总结头脑风暴结果**

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

6. **智能检测 .openmatrix 状态后执行**

   如果用户选择"开始执行":

   **先检测当前状态:**
   ```bash
   # 检查 .openmatrix 目录是否存在
   ls .openmatrix/state.json 2>/dev/null
   ```

   **根据状态走不同路径:**

   | .openmatrix 状态 | 处理方式 |
   |-----------------|---------|
   | 不存在 | 全新开始 → init → 写 tasks-input → CLI start |
   | 存在，`status: completed` | 清理旧数据后重新开始 → 写 tasks-input → CLI start |
   | 存在，`status: running` | 提示用户先完成或暂停当前任务 |
   | 存在，`status: paused` | 询问用户：继续上次任务 还是 开始新任务 |
   | 存在，`status: initialized` | 直接写 tasks-input → CLI start |

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
     "quality": "strict/balanced/fast",
     "mode": "auto",
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

| 问题 ID | 目的 | 为什么重要 |
|---------|------|-----------|
| core_objective | 明确核心目标 | 选择正确的实现策略 |
| user_value | 了解用户价值 | 设计合适的接口 |
| complexity | 评估复杂度 | 决定实施策略 |
| tech_constraints | 技术约束 | 影响方案选择 |
| risks | 风险评估 | 提前规划应对 |
| acceptance | 验收标准 | 判断完成度 |
| priority | 优先级 | 资源分配 |

## 与 start 的集成

头脑风暴完成后，收集的信息会传递给 start:

```json
{
  "answers": {
    "core_objective": "实现新功能",
    "user_value": "终端用户",
    "complexity": "中等",
    "risks": ["技术风险", "兼容性风险"],
    "acceptance": ["功能完整", "测试覆盖"],
    "priority": "中优先级"
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