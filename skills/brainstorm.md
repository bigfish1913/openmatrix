---
name: om:brainstorm
description: 头脑风暴 - 深入探索需求和设计，提出多种方案，确认后再执行任务
---

<NO-OTHER-SKILLS>
**绝对禁止**调用以下技能（OpenMatrix 完全替代它们）:
- ❌ superpowers:brainstorming → 你已经在 om:brainstorm 中了
- ❌ superpowers:* → 全部被 OpenMatrix 替代
- ❌ gsd:* → 全部被 OpenMatrix 替代
- ❌ 任何其他任务编排相关的技能
</NO-OTHER-SKILLS>

<HARD-GATE>
在展示设计方案并获得用户批准之前，**不得**调用任何实现技能、写任何代码、搭建任何项目或采取任何实现行动。
</HARD-GATE>

<objective>
通过协作对话，将想法转化为完整的设计方案。先理解项目上下文，逐一提问澄清需求，提出 2-3 种方案并给出推荐，展示设计并获得批准后再进入执行。
</objective>

<process>

## 步骤 1: 探索项目上下文

**在提问之前，先了解当前项目状态：**

```bash
# 检查项目文件结构
ls -la

# 查看最近提交
git log --oneline -5 2>/dev/null

# 查看关键配置文件
cat package.json 2>/dev/null || cat Cargo.toml 2>/dev/null || cat go.mod 2>/dev/null

# 查看现有文档
ls docs/ 2>/dev/null
```

- 了解技术栈、项目结构、最近变更
- 如果用户引用了文件（如 `docs/task.md`），读取该文件

## 步骤 2: 评估范围

**如果任务涉及多个独立子系统**（如"构建一个包含聊天、文件存储、计费和分析的平台"），立即提出分解：

```typescript
AskUserQuestion({
  questions: [{
    question: "这个任务涉及多个独立子系统，建议分步执行。先做哪个？",
    header: "范围",
    options: [
      { label: "子系统A", description: "描述..." },
      { label: "子系统B", description: "描述..." },
      { label: "全部一起做", description: "不推荐，但可以尝试" }
    ],
    multiSelect: false
  }]
})
```

## 步骤 3: 逐一澄清需求

**核心原则：一次只问一个问题。每条消息只有一个问题。**

**问题不是预定义的，而是根据具体任务动态生成。** 先检查项目上下文，再针对性地提问。

**问题应聚焦三个方面：**

### 3.1 目的（Purpose）— 为什么做这个？
```typescript
// 好的问题：深入理解动机
AskUserQuestion({
  questions: [{
    question: "这个功能解决的核心痛点是什么？",
    header: "目的",
    options: [
      { label: "提升效率", description: "自动化现有手动流程" },
      { label: "新增能力", description: "目前完全不具备的功能" },
      { label: "替代方案", description: "替换现有的第三方服务" }
    ],
    multiSelect: false
  }]
})
```

### 3.2 约束（Constraints）— 有什么限制？
```typescript
// 好的问题：理解边界条件
AskUserQuestion({
  questions: [{
    question: "客户管理的数据需要关联哪些实体？",
    header: "数据模型",
    options: [
      { label: "仅客户信息", description: "独立的客户 CRUD" },
      { label: "客户 + 邀请人", description: "需要追踪推荐关系" },
      { label: "客户 + 合作历史", description: "需要记录历史合作者" }
    ],
    multiSelect: true
  }]
})
```

### 3.3 成功标准（Success Criteria）— 怎样算完成？
```typescript
// 好的问题：明确验收条件
AskUserQuestion({
  questions: [{
    question: "这个功能的 MVP 最小可用版本包含什么？",
    header: "MVP",
    options: [
      { label: "基础 CRUD", description: "增删改查 + 列表" },
      { label: "CRUD + 搜索", description: "支持按名称/邮箱搜索" },
      { label: "完整功能", description: "包含关联、分组、导出等" }
    ],
    multiSelect: false
  }]
})
```

**提问策略：**
- **优先选择题** — 比开放式更容易回答
- **根据上下文定制** — 不是固定问题列表，而是基于项目状态和任务类型动态调整
- **每个问题只关注一个方面** — 需要深入就拆成多个问题
- **YAGNI** — 主动建议去掉不必要的功能
- **深入追问** — 如果用户选"其他"，用开放式问题跟进

## 步骤 4: 提出 2-3 种方案

理解需求后，提出不同实现方案：

```typescript
AskUserQuestion({
  questions: [{
    question: `基于需求分析，有以下实现方案：

**方案 A（推荐）: 组件化架构**
- 每个模块独立，通过接口通信
- 优点: 可测试性强、易维护
- 缺点: 初始代码量较多

**方案 B: 单体架构**
- 所有功能在一个模块内
- 优点: 开发快
- 缺点: 难以扩展

**方案 C: 微服务架构**
- 每个功能独立服务
- 优点: 高度解耦
- 缺点: 复杂度高，当前规模不需要

推荐方案 A，因为...`,
    header: "技术方案",
    options: [
      { label: "方案 A (推荐)", description: "组件化架构" },
      { label: "方案 B", description: "单体架构" },
      { label: "方案 C", description: "微服务架构" }
    ],
    multiSelect: false
  }]
})
```

## 步骤 5: 分步展示设计

**逐节展示设计方案，每节确认一次：**

每次展示一个设计方面：

```
📐 设计方案 - 第 1 部分: 架构

┌─────────┐     ┌─────────┐     ┌─────────┐
│  输入层  │ ──→ │  业务层  │ ──→ │  数据层  │
└─────────┘     └─────────┘     └─────────┘

- 输入层: REST API + WebSocket
- 业务层: 核心逻辑处理
- 数据层: PostgreSQL + Redis 缓存

这部分设计是否合理？
```

**设计覆盖：**
1. 架构设计
2. 数据模型 / 核心实体
3. 关键接口 / API
4. 错误处理策略
5. 测试策略

**每个部分都使用 AskUserQuestion 确认：**
```typescript
AskUserQuestion({
  questions: [{
    question: "架构设计是否合理？",
    header: "确认",
    options: [
      { label: "继续", description: "设计合理，继续下一部分" },
      { label: "修改", description: "我有调整建议" }
    ],
    multiSelect: false
  }]
})
```

## 步骤 6: 总结确认

所有设计部分确认后，展示完整总结：

```
🧠 头脑风暴总结

📋 任务: 实现客户管理系统

🎯 核心目标
   - 客户信息管理（姓名、邮箱、邀请人）
   - 历史合作记录追踪

📐 架构
   - 组件化设计，每个模块独立可测

🔧 技术方案
   - 数据库: PostgreSQL
   - 缓存: Redis
   - API: RESTful

⚠️ 风险
   - 数据迁移: 需要兼容旧格式

✅ 验收标准
   - CRUD 接口完整
   - 测试覆盖率 > 80%
```

```typescript
AskUserQuestion({
  questions: [{
    question: "头脑风暴完成，是否开始执行任务？",
    header: "下一步",
    options: [
      { label: "开始执行 (推荐)", description: "写入 tasks-input.json 并调用 /om:start" },
      { label: "继续探索", description: "还有问题需要进一步讨论" },
      { label: "仅生成计划", description: "生成详细计划但不执行" }
    ],
    multiSelect: false
  }]
})
```

## 步骤 7: 写入 tasks-input.json 并调用 /om:start

用户选择"开始执行"后：

1. **检测状态:**
```bash
ls .openmatrix/state.json 2>/dev/null
```

2. **初始化（如需要）:**
```bash
openmatrix start --init-only
```

3. **写入 `.openmatrix/tasks-input.json`:**
```json
{
  "title": "任务标题",
  "description": "基于头脑风暴的整体描述",
  "goals": ["目标1: 独立功能模块", "目标2: 独立功能模块"],
  "constraints": ["约束"],
  "deliverables": ["交付物"],
  "plan": "## 技术方案\n..."
}
```

> **注意**: `quality`、`mode`、`e2eTests` 不在此写入，由 `/om:start` 的必选问题决定。

4. **⚠️ 必须执行（不可跳过）：使用 Skill 工具调用 `/om:start`**

```
Skill 工具: skill = "om:start"
```

这不是可选的 — 如果不调用 `/om:start`，任务不会开始执行。
`/om:start` 会检测到已存在的 `tasks-input.json`，然后询问必选问题（质量等级、E2E、执行模式）。

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
## 关键原则

- **一次只问一个问题** — 不要一次问多个
- **优先选择题** — 比开放式更容易回答
- **YAGNI** — 主动建议去掉不必要的设计
- **提出 2-3 种方案** — 带权衡和推荐
- **分步确认** — 每部分设计确认后再继续
- **为隔离而设计** — 每个模块应有清晰的边界和接口
- **问题要贴合任务** — 不问泛泛的问题，而是针对具体任务深入
- **理解目的 > 理解实现** — 先搞清楚为什么做，再讨论怎么做

## 在已有代码库中工作

- 提出变更前，先探索现有结构，遵循现有模式
- 如果现有代码有问题（文件太大、边界不清、职责混乱），在设计中有针对性地改进
- 不要提出无关的重构建议，聚焦当前目标

## 问题深度示例

**不好的问题（太泛）：**
- "你的技术栈是什么？"
- "你需要测试吗？"

**好的问题（贴合具体任务）：**
- "客户管理的邀请人字段，是只记录最近一个邀请人，还是需要完整的邀请链？"
- "站内信需要支持已读/未读状态吗？还是只需要通知推送？"
- "物流追踪是实时推送还是定时轮询？这影响 API 设计。"

## 流程图

```
┌─────────────────┐
│  探索项目上下文  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  评估范围       │
│ (是否需要分解)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  逐一澄清需求   │◀─────┐
│ (一次一个问题)  │      │
│ 深入理解目的/   │      │
│ 约束/成功标准   │      │
└────────┬────────┘      │
         │               │
    还有问题?  ───── YES ─┘
         │ NO
         ▼
┌─────────────────┐
│  提出 2-3 种方案 │
│  (附权衡和推荐)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  分步展示设计   │◀─────┐
│  (每步确认)     │      │
└────────┬────────┘      │
         │               │
    需要修改?  ───── YES ─┘
         │ NO
         ▼
┌─────────────────┐
│  总结 + 确认    │
└────────┬────────┘
         │
    开始执行
         │
         ▼
┌─────────────────┐
│  写入 JSON      │
│  调用 /om:start │
└─────────────────┘
```
</notes>
