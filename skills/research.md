---
name: om:research
description: 领域调研和问题探索 - 为后续任务提供知识基础
---

<NO-OTHER-SKILLS>
执行此技能时，不得调用其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
在执行垂直领域任务前，由 AI 分析主题、识别领域、引导用户补全信息、生成领域专属文档，为后续 start 提供扎实的知识基础。
</objective>

<process>
1. **初始化研究会话**

   调用 CLI 创建研究会话:
   ```bash
   openmatrix research "$ARGUMENTS" --json
   ```

   返回:
   ```json
   {
     "status": "initialized",
     "message": "研究会话已创建，需要 AI 分析领域",
     "topic": "做一个游戏",
     "hint": "请使用 Agent 分析主题，识别领域和调研方向"
   }
   ```

2. **AI 分析主题 (关键步骤)**

   启动 Agent 分析用户主题，识别领域和调研方向:

   ```
   Agent (Explore): 分析主题 "${topic}"

   分析要求:
   1. 识别领域: 这属于什么行业/技术领域？
   2. 调研方面: 这个领域有哪些核心方面需要了解？(5-10个)
   3. 关键决策: 用户需要做出哪些重要选择？
   4. 问题估算: 预计需要问多少个问题？

   严格输出 JSON:
   {
     "domain": "领域名称",
     "aspects": ["方面1", "方面2", ...],
     "keyDecisions": ["决策1", "决策2", ...],
     "estimatedQuestions": 数字
   }
   ```

   Agent prompt:
   ```
   你是一个领域分析专家。请分析以下主题:

   ## 用户主题
   {topic}

   ## 分析要求
   1. 识别领域: 这属于什么行业/技术领域？要具体，如"游戏开发"而不是"软件开发"
   2. 调研方面: 这个领域有哪些核心方面需要了解？列出 5-10 个
   3. 关键决策: 用户需要做出哪些重要选择？如"技术选型"、"平台选择"
   4. 问题估算: 预计需要问多少个问题才能收集足够信息？

   ## 输出格式
   请严格输出以下 JSON 格式，不要有其他内容:
   ```json
   {
     "domain": "领域名称",
     "aspects": ["方面1", "方面2", "方面3", ...],
     "keyDecisions": ["决策1", "决策2", ...],
     "estimatedQuestions": 数字
   }
   ```
   ```

3. **更新会话并展示预览**

   Agent 返回分析结果后，更新会话文件:
   ```bash
   # 读取当前会话并更新
   # 将 domain, aspects, estimatedQuestions 写入 .openmatrix/research/session.json
   # status 改为 'preview'
   ```

   然后展示给用户确认:
   ```typescript
   AskUserQuestion({
     questions: [{
       question: `检测到「${domain}」领域，将调研以下方面:\n\n${aspects.map(a => `• ${a}`).join('\n')}\n\n预计 ${estimatedQuestions} 个问题，是否开始？`,
       header: "确认研究",
       options: [
         { label: "开始研究", description: "启动并行 Agent 进行深度调研" },
         { label: "跳过研究", description: "直接进入任务执行" },
         { label: "调整范围", description: "修改研究方向" }
       ],
       multiSelect: false
     }]
   })
   ```

4. **确认后启动并行研究**

   用户确认后，调用 CLI:
   ```bash
   openmatrix research --confirm --json
   ```

   返回:
   ```json
   {
     "status": "researching",
     "message": "开始深度研究",
     "topic": "做一个游戏",
     "domain": "游戏开发",
     "aspects": [...],
     "agents": [
       { "role": "domain_researcher", "focus": "...", "status": "pending" },
       { "role": "tech_explorer", "focus": "...", "status": "pending" },
       { "role": "scenario_analyst", "focus": "...", "status": "pending" }
     ],
     "hint": "使用 Agent 工具并行执行研究"
   }
   ```

5. **并行启动研究 Agent**

   使用 Agent 工具并行启动 2-3 个研究 Agent:

   ```
   Agent 1 (domain_researcher): 用 WebSearch 搜索 {domain} 领域核心概念、行业标准
   Agent 2 (tech_explorer): 用 WebSearch 搜索 {domain} 主流技术方案、架构模式
   Agent 3 (scenario_analyst): 结合 "{topic}" 分析实际应用场景、常见挑战
   ```

6. **基于研究结果生成领域问卷**

   研究完成后，从报告中提取关键决策点，转化为问题:

   ```typescript
   // 批量提问 (每次最多 4 个问题)
   AskUserQuestion({ questions: domainQuestions.slice(0, 4) });
   ```

7. **生成领域专属文档**

   基于研究结果和用户回答，生成领域文档:

   | 领域 | 文档类型 |
   |------|----------|
   | 游戏开发 | GDD (游戏设计文档) |
   | Web 网站 | PRD (产品需求文档) |
   | 支付系统 | 技术方案文档 |
   | 后台管理 | 功能规格文档 |
   | 通用 | 研究报告 |

8. **完成研究并接入 start**

   ```bash
   openmatrix research --complete --results '<json>' --json
   ```

   然后询问用户是否开始执行:
   ```typescript
   AskUserQuestion({
     questions: [{
       question: `研究完成！已生成「${domain}」领域文档。\n\n下一步？`,
       header: "下一步",
       options: [
         { label: "开始执行 (推荐)", description: "自动接入 /om:start" },
         { label: "查看报告", description: "先查看研究报告" },
         { label: "继续研究", description: "深入某个方向" }
       ],
       multiSelect: false
     }]
   })
   ```

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:research "做一个游戏"
/om:research "开发一个支付系统"
/om:research "构建一个电商网站"
</examples>

<notes>
## 核心变化

**AI 分析领域，而非关键词匹配**

旧方式: CLI 内置关键词列表，硬编码领域检测
新方式: Agent 分析主题，动态识别领域和调研方向

## 流程图

```
┌──────────────────────┐
│ /om:research "做游戏" │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ CLI: 创建初始会话     │  status: "initialized"
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Agent: 分析主题       │  识别领域、方面、决策
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 更新会话 → preview    │
│ 展示给用户确认        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 用户确认 → --confirm  │
│ 并行 Agent 研究       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 问卷 → 领域文档       │
│ → --complete          │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ 接入 /om:start        │
└──────────────────────┘
```

## 与 brainstorm 的集成

brainstorm 检测到垂直领域时，返回 `suggestResearch`。
brainstorm skill 询问用户是否进入 research，确认后调用 `/om:research`。

## 输出文件

```
.openmatrix/research/
├── session.json          # 研究会话状态
├── RESEARCH.md           # 领域专属文档 (GDD/PRD/技术方案)
├── knowledge/
│   ├── finding-1.md      # 关键发现
│   └── finding-2.md
└── context.json          # → start 的任务上下文
```
</notes>