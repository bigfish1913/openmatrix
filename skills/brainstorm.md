---
name: om:brainstorm
description: "Use when the user wants to explore requirements, design alternatives, or validate ideas before implementation. Triggers on CLARIFICATION/DESIGN intent: user needs to clarify unclear requirements, explore multiple approaches, or design architecture before coding. DO NOT trigger on: simple implementation requests (clear path), status checks, or pure information queries. Intent signals: user says 'how should I', mentions multiple options/uncertainties, describes complex system from scratch, or task scope is ambiguous."
---

<INTENT-JUDGMENT>
## 意图判断指南

**AI 应根据用户语义判断意图：**

### 触发信号（澄清/设计意图）

- 用户想探索多种实现方案
- 需求不明确，需要澄清
- 涉及多模块协同，需要设计
- 从零开始搭建，需要架构规划
- 用户表达"怎么设计"、"什么方案"

### 不触发信号

| 用户意图 | 应调用 |
|---------|--------|
| 明确的实现任务 | /om:start 或 /om:feature |
| 状态检查 | /om:status |
| 简单问题咨询 | 直接回答 |

### 示例判断

| 用户消息 | 判断 | 结果 |
|---------|------|------|
| "登录功能怎么设计？" | 设计意图 | 触发 ✓ |
| "从零搭建后台系统" | 架构规划意图 | 触发 ✓ |
| "OAuth 选哪个方案？" | 方案探索意图 | 触发 ✓ |
| "给按钮加点击事件" | 明确实现 | /om:feature |
| "查看当前任务状态" | 状态检查 | /om:status |
</INTENT-JUDGMENT>

<NO-OTHER-SKILLS>
**绝对禁止**调用以下技能（OpenMatrix 完全替代它们）:
- ❌ superpowers:brainstorming → 你已经在 om:brainstorm 中了
- ❌ superpowers:* → 全部被 OpenMatrix 替代
- ❌ gsd:* → 全部被 OpenMatrix 替代
- ❌ 任何其他任务编排相关的技能

**相关技能**: `/om:research` (领域调研) | `/om:plan` (方案生成) | `/om:start` (任务执行) | `/om:auto` (全自动)
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

## 步骤 2: 评估范围与领域检测

**2.1 评估范围**

**如果任务涉及多个独立子系统**（如"构建一个包含聊天、文件存储、计费和分析的平台"），立即提出分解：

AskUserQuestion: `header: "范围"`, `multiSelect: false`
**question:** 这个任务涉及多个独立子系统，建议分步执行。先做哪个？

| label | description |
|-------|-------------|
| 子系统A | 描述... |
| 子系统B | 描述... |
| 全部一起做 | 不推荐，但可以尝试 |

**2.2 领域检测与 Research 集成**

**如果任务涉及不熟悉的垂直领域**（如游戏开发、支付系统、区块链、AI 应用等），主动建议调用研究：

AskUserQuestion: `header: "领域调研"`, `multiSelect: false`
**question:** 这个任务涉及新领域，建议先进行领域调研。研究可以帮助了解行业标准、识别关键技术选型、发现常见陷阱。

| label | description |
|-------|-------------|
| 先调研 (推荐) | 调用 /om:research 深入了解领域 |
| 直接头脑风暴 | 我对这个领域比较熟悉 |

用户选择「先调研」后，调用 `Skill: skill = "om:research", args = "任务描述"`。研究完成后，研究结论会作为头脑风暴的输入上下文。

## 步骤 3: 逐一澄清需求

**核心原则：一次只问一个问题。每条消息只有一个问题。**

**问题不是预定义的，而是根据具体任务动态生成。** 先检查项目上下文，再针对性地提问。

**问题应聚焦三个方面：**

### 3.1 目的（Purpose）— 为什么做这个？

根据任务动态生成选择题，示例：

AskUserQuestion: `header: "目的"`, `multiSelect: false`
**question:** 这个功能解决的核心痛点是什么？

| label | description |
|-------|-------------|
| 提升效率 | 自动化现有手动流程 |
| 新增能力 | 目前完全不具备的功能 |
| 替代方案 | 替换现有的第三方服务 |

### 3.2 约束（Constraints）— 有什么限制？

根据任务动态生成选择题，示例：

AskUserQuestion: `header: "数据模型"`, `multiSelect: true`
**question:** 客户管理的数据需要关联哪些实体？

| label | description |
|-------|-------------|
| 仅客户信息 | 独立的客户 CRUD |
| 客户 + 邀请人 | 需要追踪推荐关系 |
| 客户 + 合作历史 | 需要记录历史合作者 |

### 3.3 成功标准（Success Criteria）— 怎样算完成？

根据任务动态生成选择题，示例：

AskUserQuestion: `header: "MVP"`, `multiSelect: false`
**question:** 这个功能的 MVP 最小可用版本包含什么？

| label | description |
|-------|-------------|
| 基础 CRUD | 增删改查 + 列表 |
| CRUD + 搜索 | 支持按名称/邮箱搜索 |
| 完整功能 | 包含关联、分组、导出等 |

**提问策略：**
- **优先选择题** — 比开放式更容易回答
- **根据上下文定制** — 不是固定问题列表，而是基于项目状态和任务类型动态调整
- **每个问题只关注一个方面** — 需要深入就拆成多个问题
- **YAGNI** — 主动建议去掉不必要的功能
- **深入追问** — 如果用户选"其他"，用开放式问题跟进

## 步骤 4: 提出 2-3 种方案

理解需求后，**先在界面输出方案详情**（不放在 AskUserQuestion 里），再让用户选择。

**输出方案到界面（普通文本）：**

```
基于需求分析，有以下实现方案：

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
```

**然后用简短的 AskUserQuestion 让用户选择：**

AskUserQuestion: `header: "技术方案"`, `multiSelect: false`

**question:** 推荐方案 A，因为...。选择哪个方案？

| label | description |
|-------|-------------|
| 方案 A (推荐) | 组件化架构 |
| 方案 B | 单体架构 |
| 方案 C | 微服务架构 |

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

**每个部分先在界面展示设计内容，再用简短 AskUserQuestion 确认：**

AskUserQuestion: `header: "确认"`, `multiSelect: false`
**question:** 这部分设计是否合理？

| label | description |
|-------|-------------|
| 继续 | 设计合理，继续下一部分 |
| 修改 | 我有调整建议 |

## 步骤 6: 总结确认 + 自动路由判断

所有设计部分确认后，**先在界面展示完整总结和路由判断**，再让用户确认：

**输出总结到界面（普通文本）：**

```
头脑风暴总结

任务: 实现客户管理系统

核心目标
   - 客户信息管理（姓名、邮箱、邀请人）
   - 历史合作记录追踪

架构
   - 组件化设计，每个模块独立可测

技术方案
   - 数据库: PostgreSQL / 缓存: Redis / API: RESTful

风险
   - 数据迁移: 需要兼容旧格式

验收标准
   - CRUD 接口完整 / 测试覆盖率 > 80%

---
路由判断: 标准流程 (start)
理由: 澄清后任务明确，需完整追踪和质量门禁
```

**AI 根据澄清结果自动判断路由：**

| 判断条件 | 路由 |
|---------|------|
| 单一改动点 + 实现路径清晰 | feature |
| 任务明确 + 需完整追踪 | start |
| 仍有多方案/需进一步设计 | 继续 brainstorm |

**然后让用户确认：**

AskUserQuestion: `header: "下一步"`, `multiSelect: false`
**question:** 头脑风暴完成。AI 判断路由：${route}（${reason}）。确认后自动进入对应流程。

| label | description |
|-------|-------------|
| 确认并执行 (推荐) | 自动调用 /om:${route} |
| 继续探索 | 还有问题需要进一步讨论 |
| 仅生成文档 | 生成设计文档但不执行 |

## 步骤 7: 输出设计文档

总结确认后，将设计写入文档，便于后续执行时参考：

```bash
# 确保目录存在
mkdir -p docs/openmatrix
```

**写入设计文档到 `docs/openmatrix/YYYY-MM-DD-<topic>-design.md`：**

```markdown
# 设计方案: 任务标题

日期: YYYY-MM-DD

## 核心目标
- 目标 1
- 目标 2

## 架构设计
(从步骤 5 确认的内容)

## 数据模型 / 核心实体
(从步骤 5 确认的内容)

## 关键接口 / API
(从步骤 5 确认的内容)

## 技术方案
- 方案选择: 方案 X
- 理由: ...

## 错误处理策略
(从步骤 5 确认的内容)

## 测试策略
(从步骤 5 确认的内容)

## 约束与风险
- 约束 1
- 风险 1 及应对

## 验收标准
- 标准 1
- 标准 2
```

**先在界面告知文档已写入，再让用户选择：**

（输出到界面：设计文档已写入 `docs/openmatrix/YYYY-MM-DD-<topic>-design.md`）

AskUserQuestion: `header: "下一步"`, `multiSelect: false`
**question:** 设计文档已写入，下一步？

| label | description |
|-------|-------------|
| 开始执行 (推荐) | 调用 /om:plan 生成技术方案后执行 |
| 修改设计 | 需要调整设计方案 |

## 步骤 8: 路由到 plan 或直接执行

用户选择"确认并执行"后，根据路由判断结果进入不同流程：

**路由为 feature 时**（小任务，不需要 plan）：

1. **检测状态:**
```bash
ls .openmatrix/state.json 2>/dev/null
```

2. **初始化（如需要）:**
```bash
openmatrix start --init-only
```

3. **写入 feature-session.json 并直接调用 feature：**

写入 `.openmatrix/feature-session.json`：
```json
{
  "taskDescription": "任务描述",
  "designNotes": "关键设计要点（可选）",
  "startedAt": "ISO时间戳"
}
```

4. **调用 Skill：**
```
Skill 工具: skill = "om:feature"
```

**路由为 start 时**（标准任务，需要先生成 plan）：

1. **调用 /om:plan 生成技术方案和任务元数据：**
```
Skill 工具: skill = "om:plan", args = "基于头脑风暴的设计文档生成方案"
```

`/om:plan` 会：
- 读取 brainstorm 设计文档
- 生成 `.openmatrix/plan.md`
- 提取 goals/goalTypes/goalComplexity 写入 `.openmatrix/tasks-input.json`
- 自动路由到 `/om:start`

> **注意**: brainstorm 不再直接写入 tasks-input.json，而是通过 /om:plan 生成。这确保 plan 和 tasks-input.json 的质量。

> **路由为 start 时不直接调用 /om:start** — 先经过 /om:plan 生成方案，plan 完成后自动路由到 start。

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

## 路由判断（澄清完成后自动判断）

brainstorm 澄清完成后，自动判断下一步路由：
- **feature**: 单一改动点 + 实现路径清晰 → 写入 feature-session.json，直接调用 /om:feature
- **start**: 任务明确但需完整追踪 → 调用 /om:plan 生成方案，plan 完成后自动路由到 /om:start

不再让用户二次选择流程，根据澄清结果直接进入对应执行流程。

## 领域调研集成

- 检测到垂直领域（游戏、支付、区块链等）时，主动建议 `/om:research`
- 研究完成后，研究结论作为后续提问和设计的输入上下文
- 如果用户对领域熟悉，可以跳过研究直接进入头脑风暴
- 研究产出的文档可引用在设计文档中

## 设计文档

- 每次头脑风暴都会输出设计文档到 `docs/openmatrix/YYYY-MM-DD-<topic>-design.md`
- 文档包含：核心目标、架构、数据模型、接口、技术方案、错误处理、测试策略、风险、验收标准
- 设计文档是 `/om:plan` 生成技术方案时的重要参考
- 文档内容来自步骤 5 逐节确认的设计

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
│  领域检测       │     YES → /om:research → 研究结论作为上下文
│ (是否需要调研)  │──────────────────────────────────────────────┐
└────────┬────────┘                                              │
         │ NO / 研究完成                                          │
         ▼ ◀────────────────────────────────────────────────────┘
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
│  总结 + 路由判断 │
│  (自动判断      │
│   feature/start)│
└────────┬────────┘
         │
    确认执行?
         │ YES
         ▼
┌─────────────────┐
│  写入设计文档   │
│  (docs/openmatrix/) │
└────────┬────────┘
         │
         ├──────┬──────────┐
         │      │          │
    feature    start    仅文档
         │      │          │
         ▼      ▼          ▼
┌─────────┐ ┌─────────┐   完成
│/om:feature│ │/om:plan  │──→ /om:start
└─────────┘ └─────────┘
```
</notes>
