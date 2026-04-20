---
name: om:feature
description: "Use for small feature requests needing quick iteration without full task file management. Triggers on: 小需求, 小功能, 小改动, minor, quick, 快速, 简单, 添加按钮, 加个字段, 轻量. AI evaluates complexity and routes automatically from /om entry point."
priority: high
---

<NO-OTHER-SKILLS>
**绝对禁止**调用以下技能：
- ❌ superpowers:brainstorming → 用 /om:brainstorm 代替
- ❌ superpowers:* → 全部被 OpenMatrix 替代
- ❌ gsd:* → 全部被 OpenMatrix 替代
- ❌ /om:start / /om:auto → 本 skill 是轻量版，不调用完整流程

**任务执行阶段只能使用 Agent 工具** — 直接调用 Agent，不通过任何中间层。

**相关技能**: `/om` (主入口) | `/om:start` (标准任务) | `/om:brainstorm` (复杂任务)
</NO-OTHER-SKILLS>

<MANDATORY-EXECUTION-ORDER>
## 执行顺序 - 必须严格按此顺序，不得跳过

```
Step 1:  接收任务输入（参数、文件、或询问用户）
Step 2:  AI 自动判断任务边界（不符合条件才询问切换）
Step 3:  AI 拆分为 2-5 个小任务块
Step 4:  用 TodoWrite 管理任务状态
Step 5:  问答确认（质量等级、E2E测试、执行计划）
Step 6:  逐个执行小任务
Step 7:  验证（按质量等级）
Step 8:  分步 Git 提交
Step 9:  全部任务完成后整体验证
Step 10: 输出执行摘要并清理
```

**铁律：不验证不得提交，验证失败必须停止**
**铁律：每次只改一个任务块，不得并行修改多个文件**
**铁律：验证通过后立即提交，不得积累多个任务块再提交**
</MANDATORY-EXECUTION-ORDER>

<objective>
轻量级小需求开发流程：拆分为 2-5 个小任务块，内存状态管理，保留质量门禁验证，支持分步 Git 提交。
不产生 `.openmatrix/tasks/` 文件。
</objective>

<process>

## Step 1: 接收任务输入

**检查 `$ARGUMENTS`:**

| 参数 | 处理方式 |
|------|---------|
| `<任务描述>` | 直接使用描述 |
| `<文件路径>` | Read 工具读取内容 |
| 空 | AskUserQuestion 询问 |

**如果是空参数，询问：**

AskUserQuestion: `header: "任务描述"`, `multiSelect: false`
**question:** 请描述你的小需求

| label | description |
|-------|-------------|
| 描述需求 | 输入自由文本描述 |
| 从文件读取 | 指定任务文件路径 |
| 取消 | 退出 |

## Step 2: AI 判断任务边界

**AI 自动判断任务是否适合本 skill：**

检查以下条件（全部满足才继续，否则建议切换）：

| 条件 | 检查方式 |
|------|---------|
| 描述长度 ≤ 100 字 | 字数统计 |
| 单一功能点 | 无"和"、"同时"、"另外"等连接词 |
| 无架构设计 | 无"架构"、"设计"、"从零"、"重构"关键词 |
| 无多子系统 | 无多个独立模块描述 |

**判断结果处理：**

| 结果 | 处理 |
|------|------|
| ✅ 全部满足 | 继续执行 Step 3 |
| ❌ 不满足 | 输出建议并询问是否切换到 `/om:start` |

**如果需要切换，询问：**

AskUserQuestion: `header: "任务复杂度"`, `multiSelect: false`
**question:** 任务可能需要完整追踪，建议使用 `/om:start`。是否切换？

| label | description |
|-------|-------------|
| 切换到 /om:start | 使用完整流程 |
| 继续用 /om:feature | 强制使用轻量流程（可能无法完整追踪） |

## Step 3: AI 拆分为 2-5 个小任务块

**调用 Agent 进行任务拆分：**

```typescript
Agent({
  subagent_type: "general-purpose",
  description: "任务拆分分析",
  prompt: `你是任务拆分专家。将用户需求拆分为 2-5 个小任务块。

## 用户需求
${taskDescription}

## 拆分原则
1. 拆分粒度：每个小块 ≤ 30 分钟工作量
2. 拆分方向：数据层 → API层 → UI层 / 核心逻辑 → 边界处理
3. 依赖关系：确保后续任务可依赖前面的成果
4. 文件预估：每个任务预估涉及的文件

## 输出格式
请按以下格式输出：

\`\`\`
📋 任务拆分计划

原始需求：${taskDescription}

拆分为 N 个小任务：
1. [任务名称]
   描述：[简要描述]
   预估文件：[文件列表]
   预估时间：[分钟]

2. [任务名称]
   ...

📋 依赖关系图
任务1 → 任务2 → 任务3
\`\`\`

## 注意事项
- 如果任务过于复杂无法拆分，明确说明并建议使用完整流程
- 保持任务块独立性，便于验证和提交`,
  run_in_background: false
})
```

## Step 4: 用 TodoWrite 管理任务状态

**将拆分的任务写入 TodoWrite：**

```typescript
TodoWrite({
  todos: [
    { activeForm: "正在实现数据层", content: "数据层：添加搜索参数", status: "pending" },
    { activeForm: "正在实现 API 层", content: "API 层：实现搜索端点", status: "pending" },
    { activeForm: "正在实现 UI 层", content: "UI 层：添加搜索框", status: "pending" }
  ]
})
```

状态仅在当前会话有效，不产生持久化文件。

## Step 5: 问答确认

**⛔ 执行前必须确认所有配置**

**5.1 质量等级（必选）**

AskUserQuestion: `header: "质量等级"`, `multiSelect: false`

**question:** 选择质量等级（决定测试覆盖、Lint、安全扫描等要求）

| label | description |
|-------|-------------|
| `strict` | TDD + >80%覆盖率 + 严格Lint + 安全扫描 — 生产级代码 |
| `balanced (推荐)` | >60%覆盖率 + Lint + 安全扫描 — 日常开发 |
| `fast` | 无质量门禁 — 快速原型/验证 |

**5.2 E2E 测试（仅 strict/balanced）**

AskUserQuestion: `header: "E2E 测试"`, `multiSelect: false`

**question:** 是否需要端到端 (E2E) 测试？（适用于 Web/Mobile/GUI 项目）

| label | description |
|-------|-------------|
| `功能测试` | 验证业务流程正确性，速度快 |
| `视觉验证` | 需要浏览器可视化验证 UI 样式 |
| `不需要 (推荐)` | 仅单元测试和集成测试 |

**5.3 确认拆分计划**

AskUserQuestion: `header: "确认计划"`, `multiSelect: false`

**question:** 任务拆分计划已展示，确认开始执行？

| label | description |
|-------|-------------|
| `开始执行 (推荐)` | 按计划逐个执行 |
| `调整计划` | 重新拆分任务 |

## Step 6: 逐个执行小任务

**对 TodoWrite 中的每个任务（按顺序）：**

**6.1 更新状态为 in_progress**
```typescript
TodoWrite({ todos: [...] }) // 当前任务标记 in_progress
```

**6.2 调用 Agent 执行**

```typescript
Agent({
  subagent_type: "general-purpose",
  description: task.content,
  prompt: `你是实现专家。执行以下任务块。

## 任务信息
- 任务名称：${task.content}
- 预估文件：${task.files}
- 质量等级：${quality}
- 前置任务完成状态：${previousTasksStatus}

## 质量要求
${quality === 'strict' ? `
- 必须使用 TDD：先写测试，再写实现
- 测试覆盖率要求：>80%
- 必须通过严格 Lint
- 必须通过安全扫描
` : quality === 'balanced' ? `
- 测试覆盖率要求：>60%
- 必须通过 Lint
- 必须通过安全扫描
` : `
- 无质量门禁要求
- 快速实现功能
`}

## 实施原则
1. 只修改当前任务相关的文件
2. 不做"顺便"的重构或优化
3. 确保代码风格与项目一致
4. 完成后运行相关测试验证

## 完成后输出
请按以下格式输出（不超过3行）：
1. 关键决策
2. 创建/修改的文件列表
3. 对后续任务的建议

## 禁止行为
❌ 执行 git commit（由主流程处理）
❌ 执行 git checkout — 不要切换分支
❌ 执行 git merge — 不要合并其他分支
❌ 执行 git pull — 不要拉取远程更新
❌ 执行 git push — 不要推送代码
❌ 执行 git rebase — 不要变基
❌ 执行 git branch — 不要创建/删除分支
❌ 修改与当前任务无关的文件
❌ 进行额外的重构

✅ 允许：git status, git diff, git log`,
  run_in_background: true
})
```

**6.3 等待 Agent 完成，接收通知**

## Step 7: 验证（按质量等级）

**⛔ 验证不通过不得提交，必须停止等待修复**

每个任务完成后，根据质量等级执行验证：

**7.1 执行验证命令**

| 质量等级 | 验证命令 |
|---------|---------|
| `strict` | `npm test -- --run && npm run lint && npm run test:coverage` |
| `balanced` | `npm test -- --run && npm run lint` |
| `fast` | 跳过验证 |

**7.2 E2E 验证（如果用户选择）**
- 功能测试：`npm run test:e2e`
- 视觉验证：启动 Playwright 截图对比

**7.3 验证结果自动判断**

验证命令执行后，根据退出码自动判断结果：

```bash
# 执行验证命令并捕获结果
if npm test -- --run && npm run lint; then
  # 验证成功
  echo "✅ 验证通过"
else
  # 验证失败
  echo "❌ 验证失败"
  npm test -- --run 2>&1 | tail -30  # 展示失败详情
  exit 1
fi
```

**验证失败处理：**
- 自动展示验证失败详情（最后 30 行输出）
- 停止执行流程
- 提示用户修复后使用 `/om:resume` 继续

**验证成功处理：**
- 继续执行 Step 8 Git 提交

## Step 8: 分步 Git 提交

**⛔ 验证通过后必须立即提交，不得积累多个任务块**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(feature): ${originalTask} - ${currentChunk}

改动详情：
- ${changesSummary}

Co-Authored-By: OpenMatrix https://github.com/bigfish1913/openmatrix
EOF
)"
```

提交成功后：
1. **更新 TodoWrite 状态为 completed**
2. **继续下一个任务**

## Step 9: 全部任务完成后

**检查 TodoWrite 所有任务状态为 `completed`：**

**9.1 运行最终整体验证**
```bash
npm test -- --run
```

**9.2 收集所有任务的执行摘要**

## Step 10: 输出执行摘要并清理

**展示执行摘要：**

```
✅ 任务完成：${originalTask}

📊 执行统计：
- 任务块数：${chunkCount}
- 质量等级：${quality}
- 总耗时：约 ${totalTime} 分钟
- Git 提交：${commitCount} 次

📝 创建/修改的文件：
${fileList}

🔧 关键决策：
${decisions}

📈 测试覆盖率：${coverageResult}

✨ 所有任务已完成，会话状态已清理
```

**清理操作：**
- TodoWrite 所有任务保持 completed 状态
- 不产生任何 `.openmatrix/` 持久化文件
- 会话结束后状态自动消失

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:feature 给用户列表页添加搜索功能
/om:feature 添加一个导出按钮
/om:feature docs/small-task.md
</examples>

<notes>
## 铁律

**不验证不得提交，验证失败必须停止**
**每次只改一个任务块，不得并行修改多个文件**
**验证通过后立即提交，不得积累多个任务块再提交**

## 红线

- 验证失败不得继续执行，必须停止等待修复
- 不得跳过质量等级确认
- 不得跳过任务边界确认
- 不得在 Agent 内部执行任何 Git 操作（commit/checkout/merge/pull/push/rebase/branch）

## 红旗警告 - 停止并回归流程

**如果发现自己在想：**
- "验证麻烦，先提交再说"
- "任务块小，一次改两个吧"
- "顺便重构下这个代码"
- "跳过质量确认，直接开始"
- "测试失败没关系，手动验证就行"
- "这个小改动不会影响其他"

**所有这些意味着：停止。回到流程执行。**

## 常见借口 vs 真实情况

| 借口 | 真实情况 |
|------|---------|
| "验证太慢，先提交" | 未验证的提交会污染仓库，回头排查更慢。 |
| "一次改两个任务块效率高" | 无法隔离哪个改动有问题。引入新 bug。 |
| "顺便重构没问题" | "顺便"是 bug 的温床。任务聚焦。 |
| "质量确认麻烦" | 3 秒的选择防止后续数小时排查。 |
| "手动验证就行" | 手动验证不可重复。自动化测试才可靠。 |
| "小改动不会出错" | 小改动也有根因。系统性验证。 |

## 与其他指令的区别

| 指令 | 适用场景 | 任务文件 | 问答 | 验证 |
|-----|---------|:-------:|:----:|:----:|
| `/om:feature` | 小需求（≤100字，单一功能） | ❌ | 质量+E2E | 按等级 |
| `/om:start` | 标准任务 | ✅ | 质量+E2E+模式 | 按等级 |
| `/om:brainstorm` | 复杂任务 | ✅ | 设计问答 | 按等级 |
| `/om:auto` | 全自动执行 | ✅ | 无 | 按等级 |

## 路由触发条件

从 `/om` 主入口自动路由到此 skill 的条件：
- 任务描述 ≤ 100 字
- 单一功能点（无多个独立子系统）
- 不涉及架构设计/技术选型
- 关键词匹配：小需求、小功能、小改动、minor、quick、快速、添加按钮

## 错误处理流程

```
验证失败 → 停止执行 → 展示错误详情 → 提示用户修复 → 建议使用 /om:resume 继续
```

| 错误 | 处理 |
|-----|-----|
| 测试失败 | 停止，提示用户修复 |
| Lint 错误 | 停止，提示用户修复 |
| Agent 超时 | 询问重试或跳过 |
| Git 失败 | 提示手动处理 |

## 3+ 次验证失败：质疑任务拆分

**如果同一任务块验证失败 3 次以上：**

**指示拆分问题的模式：**
- 每次修复产生新的测试失败
- 任务块范围模糊，边界不清
- 修改影响多个不相关文件

**停止并质疑拆分方案：**
- 任务块是否过于复杂？
- 是否需要重新拆分？
- 是否应该切换到 `/om:start` 使用完整流程？

**在继续执行之前与用户讨论拆分方案。**

这不是执行失败 — 这是拆分策略问题。

## Git 提交格式

```
<type>(feature): <任务描述> - <任务块名称>

改动详情

Co-Authored-By: OpenMatrix
```

type: feat/fix/test/refactor/docs

## 恢复执行

如果验证失败需要修复，使用 `/om:resume` 继续执行：
```bash
/om:resume
```
</notes>