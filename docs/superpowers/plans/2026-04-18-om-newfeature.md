# om:newfeature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight feature request workflow (`/om:newfeature`) that splits small tasks into 2-5 chunks without creating task files, with quality gates and stepwise git commits.

**Architecture:** Pure skill-layer implementation. AI evaluates task complexity and routes to `/om:newfeature` for small requests. TodoWrite manages in-memory task state. Agent executes each chunk with verification per quality level.

**Tech Stack:** Markdown skills, TodoWrite tool, Agent tool, Bash for verification/git

---

## File Structure

```
skills/
├── newfeature.md       # NEW: lightweight feature skill
├── om.md               # MODIFY: add routing logic (lines 33-56)
└── openmatrix.md       # MODIFY: add newfeature routing (lines 92-101)
```

---

### Task 1: Create skills/newfeature.md

**Files:**
- Create: `skills/newfeature.md`

- [ ] **Step 1: Write skill file with frontmatter and core structure**

```markdown
---
name: om:newfeature
description: "Use for small feature requests needing quick iteration without full task file management. Triggers on: 小需求, 小功能, 小改动, minor, quick, 快速, 简单, 添加按钮, 加个字段. AI evaluates complexity and routes automatically from /om entry point."
priority: high
---

<NO-OTHER-SKILLS>
**绝对禁止**调用以下技能：
- ❌ superpowers:brainstorming → 用 /om:brainstorm 代替
- ❌ superpowers:* → 全部被 OpenMatrix 替代
- ❌ gsd:* → 全部被 OpenMatrix 替代
- ❌ /om:start / /om:auto → 本 skill 是轻量版，不调用完整流程

**相关技能**: `/om` (主入口) | `/om:start` (标准任务) | `/om:brainstorm` (复杂任务)
</NO-OTHER-SKILLS>

<objective>
轻量级小需求开发流程：拆分为 2-5 个小任务块，内存状态管理，保留质量门禁验证，支持分步 Git 提交。
不产生 `.openmatrix/tasks/` 文件。
</objective>

<process>
```

- [ ] **Step 2: Add Step 1-2 (parse input and split tasks)**

Append to the `<process>` section:

```markdown
## === 准备阶段 ===

### Step 1: 解析任务输入

检查 `$ARGUMENTS`：
- 任务描述 → 直接使用
- 文件路径 → Read 工具读取内容
- 无参数 → AskUserQuestion 询问任务内容

**任务边界确认：**
确认是单一功能点（无多个独立子系统），否则建议用户使用 `/om:start`。

### Step 2: AI 拆分为 2-5 个小任务块

分析任务，按逻辑边界拆分：
- 拆分粒度：每个小块 ≤ 30 分钟工作量
- 拆分原则：数据层 → API层 → UI层 / 核心逻辑 → 边界处理
- 输出格式：任务名称 + 简要描述 + 预估文件列表

**示例拆分输出：**
```
📋 任务拆分计划

原始需求：给用户列表页添加搜索功能

拆分为 3 个小任务：
1. 数据层：添加搜索参数到 UserQuery 接口
   预估文件：src/types/user.ts
2. API 层：实现搜索 API 端点
   预估文件：src/api/users.ts
3. UI 层：添加搜索框组件和交互
   预估文件：src/components/SearchBox.tsx, src/pages/Users.tsx
```
```

- [ ] **Step 3: Add Step 3-4 (TodoWrite and Q&A)**

Append to the `<process>` section:

```markdown
### Step 3: 用 TodoWrite 管理任务状态

将拆分的任务写入 TodoWrite：

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

### Step 4: 问答确认

**4.1 质量等级（必选）**

AskUserQuestion: `header: "质量等级"`, `multiSelect: false`

**question:** 选择质量等级（决定测试覆盖、Lint、安全扫描等要求）

| label | description |
|-------|-------------|
| `strict` | TDD + >80%覆盖率 + 严格Lint + 安全扫描 — 生产级代码 |
| `balanced (推荐)` | >60%覆盖率 + Lint + 安全扫描 — 日常开发 |
| `fast` | 无质量门禁 — 快速原型/验证 |

**4.2 E2E 测试（仅 strict/balanced）**

AskUserQuestion: `header: "E2E 测试"`, `multiSelect: false`

**question:** 是否需要端到端 (E2E) 测试？（适用于 Web/Mobile/GUI 项目）

| label | description |
|-------|-------------|
| `功能测试` | 验证业务流程正确性，速度快 |
| `视觉验证` | 需要浏览器可视化验证 UI 样式 |
| `不需要 (推荐)` | 仅单元测试和集成测试 |

**4.3 确认拆分计划**

AskUserQuestion: `header: "确认计划"`, `multiSelect: false`

**question:** 任务拆分计划已展示，确认开始执行？

| label | description |
|-------|-------------|
| `开始执行 (推荐)` | 按计划逐个执行 |
| `调整计划` | 修改拆分方案 |
```

- [ ] **Step 4: Add Step 5-7 (execution, verification, git commit)**

Append to the `<process>` section:

```markdown
## === 执行阶段 ===

### Step 5: 逐个执行小任务

对 TodoWrite 中的每个任务（按顺序）：

1. **更新状态为 in_progress**
   ```typescript
   TodoWrite({ todos: [...] }) // 当前任务标记 in_progress
   ```

2. **调用 Agent 执行**
   ```typescript
   Agent({
     subagent_type: "general-purpose",
     description: task.content,
     prompt: `
   任务：${task.content}
   
   预估文件：${task.files}
   
   质量要求：
   - 质量等级：${quality}
   - 测试覆盖率：${coverageThreshold}
   - Lint：${lintRequired}
   
   完成后输出简短摘要（不超过3行）：
   1. 关键决策
   2. 创建/修改的文件
   3. 对后续任务的建议
   
   🚫 禁止执行 git commit
     `,
     run_in_background: true
   })
   ```

3. **等待 Agent 完成，接收通知**

### Step 6: 验证（按质量等级）

每个任务完成后，根据质量等级执行验证：

| 质量等级 | 验证命令 |
|---------|---------|
| `strict` | `npm test && npm run lint && npm run test:coverage` |
| `balanced` | `npm test && npm run lint` |
| `fast` | 无验证 |

**验证失败处理：**
- 停止执行
- 提示用户修复
- 不自动重试

**E2E 验证（如果用户选择）：**
- 功能测试：`npm run test:e2e`
- 视觉验证：启动 Playwright 截图对比

### Step 7: 分步 Git 提交

验证通过后立即提交：

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(newfeature): ${originalTask} - ${currentChunk}

改动详情：
- ${changesSummary}

Co-Authored-By: OpenMatrix https://github.com/bigfish1913/openmatrix
EOF
)"
```

然后：
1. **更新 TodoWrite 状态为 completed**
2. **继续下一个任务**
```

- [ ] **Step 5: Add Step 8-10 (completion, summary, cleanup) and closing sections**

Append to the `<process>` section:

```markdown
## === 完成阶段 ===

### Step 8: 全部任务完成后

检查 TodoWrite 所有任务状态为 `completed`：
- 运行最终整体验证
- 收集所有任务的执行摘要

### Step 9: 输出执行摘要

```
✅ 任务完成：${originalTask}

📊 执行统计：
- 任务块数：${chunkCount}
- 质量等级：${quality}
- 总耗时：约 ${totalTime} 分钟

📝 创建/修改的文件：
${fileList}

🔧 关键决策：
${decisions}

📈 测试覆盖率：${coverageResult}
```

### Step 10: 清理

- TodoWrite 清空（所有任务保持 completed 状态）
- 不产生任何持久化文件
- 会话结束状态自动消失
</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:newfeature 给用户列表页添加搜索功能
/om:newfeature 添加一个导出按钮
/om:newfeature docs/small-task.md
</examples>

<notes>
## 与其他指令的区别

| 指令 | 适用场景 | 任务文件 | 问答 | 验证 |
|-----|---------|:-------:|:----:|:----:|
| `/om:newfeature` | 小需求（≤100字，单一功能） | ❌ | 质量+E2E | 按等级 |
| `/om:start` | 标准任务 | ✅ | 质量+E2E+模式 | 按等级 |
| `/om:brainstorm` | 复杂任务 | ✅ | 设计问答 | 按等级 |
| `/om:auto` | 全自动执行 | ✅ | 无 | 按等级 |

## 路由触发条件

从 `/om` 主入口自动路由到此 skill 的条件：
- 任务描述 ≤ 100 字
- 单一功能点（无多个独立子系统）
- 不涉及架构设计/技术选型
- 关键词匹配：小需求、小功能、小改动、minor、quick、快速、添加按钮

## 错误处理

| 错误 | 处理 |
|-----|-----|
| 测试失败 | 停止，提示用户修复 |
| Lint 错误 | 停止，提示用户修复 |
| Agent 超时 | 询问重试或跳过 |
| Git 失败 | 提示手动处理 |

## Git 提交格式

```
<type>(newfeature): <任务描述> - <任务块名称>

改动详情

Co-Authored-By: OpenMatrix
```

type: feat/fix/test/refactor/docs
</notes>
```

- [ ] **Step 6: Commit new skill file**

```bash
git add skills/newfeature.md
git commit -m "$(cat <<'EOF'
feat(skills): add /om:newfeature skill for lightweight feature requests

New skill provides:
- 2-5 task chunk splitting (TodoWrite managed)
- No task file generation
- Quality gate verification per level
- Stepwise git commits
- AI routing from /om entry point

Co-Authored-By: OpenMatrix https://github.com/bigfish1913/openmatrix
EOF
)"
```

---

### Task 2: Modify skills/om.md - Add Routing Logic

**Files:**
- Modify: `skills/om.md:33-56` (process section)

- [ ] **Step 1: Add complexity assessment section to process**

Modify the `<process>` section, add complexity assessment after step 1:

Locate lines 33-44 (the "Route input" section) and replace with:

```markdown
2. **复杂度评估与路由**

   **AI 评估任务复杂度（< 3 秒）：**

   | 条件 | 路由 |
   |-----|-----|
   | 描述 ≤ 100 字 + 单一功能 + 无架构设计 + 小需求关键词 | → `/om:newfeature` |
   | 多个独立子系统 + 需要架构设计 + 从零搭建/重构/迁移 | → `/om:brainstorm` |
   | 中等复杂度 + 需要完整追踪 + 实现/修复关键词 | → `/om:start` |

   **小需求关键词：**
   小需求、小功能、小改动、minor、quick、快速、简单、添加按钮、加个字段、轻量

   **复杂任务关键词：**
   从零搭建、重构、迁移、架构、设计、多模块、系统

   **标准任务关键词：**
   实现、修复、添加功能、开发（非小改动）

3. **Auto-route examples**

   ```
   "给列表页添加搜索按钮"  → /om:newfeature (小需求)
   "实现用户登录功能"      → /om:start (标准)
   "从零搭建后台系统"      → /om:brainstorm (复杂)
   "修复登录页面的样式"    → /om:start (标准)
   "小改动：调整按钮颜色"  → /om:newfeature (小需求关键词)
   "docs/task.md"         → /om:start (从文件)
   ```
```

- [ ] **Step 2: Update examples section**

Modify the `<examples>` section (lines 93-99), add newfeature examples:

```markdown
<examples>
/om 给用户列表页添加搜索功能              → /om:newfeature (小需求)
/om 小改动：调整按钮颜色                  → /om:newfeature (小需求关键词)
/om 实现用户登录功能                      → /om:start (标准)
/om 从零搭建后台系统                       → /om:brainstorm (复杂)
/om 修复登录页面的样式问题                → /om:start (标准)
/om docs/task.md                         → /om:start (从文件)
/om                                      → Show help
</examples>
```

- [ ] **Step 3: Update notes section**

Modify the `<notes>` section (lines 101-104), add newfeature to available commands:

```markdown
<notes>
`/om` is shorthand for the OpenMatrix workflow. Same skill set as `openmatrix`, shorter invocation.
Available commands: `/om:brainstorm`, `/om:start`, `/om:newfeature`, `/om:auto`, `/om:status`, `/om:meeting`, `/om:report`, `/om:resume`, `/om:retry`, `/om:research`, `/om:approve`, `/om:check`, `/om:debug`
</notes>
```

- [ ] **Step 4: Update description frontmatter**

Modify the frontmatter `description` field (line 3):

```markdown
description: "Default entry point for all development tasks. Routes to /om:newfeature (small), /om:start (standard), or /om:brainstorm (complex) automatically. Triggers on: implement, build, fix, create, refactor, 修复, 实现, 开发, 添加功能, new feature, 小需求, 小功能. Use for ANY task that produces code changes — don't answer directly, route to OpenMatrix workflow."
```

- [ ] **Step 5: Commit changes**

```bash
git add skills/om.md
git commit -m "$(cat <<'EOF'
feat(skills): add complexity routing to /om for /om:newfeature

- Add AI complexity assessment (<3s)
- Route small requests to /om:newfeature
- Update examples with routing cases
- Add newfeature to available commands list

Co-Authored-By: OpenMatrix https://github.com/bigfish1913/openmatrix
EOF
)"
```

---

### Task 3: Modify skills/openmatrix.md - Sync Routing Description

**Files:**
- Modify: `skills/openmatrix.md:92-101` (examples section)

- [ ] **Step 1: Add newfeature routing to examples table**

Modify the examples section, add newfeature row after the table header:

```markdown
| User Input | Intent | Complexity | Action |
|------------|--------|------------|--------|
| `给列表页添加搜索按钮` | Build | Small | → `/om:newfeature` |
| `小改动：调整按钮颜色` | Change | Small | → `/om:newfeature` |
| `实现这个游戏` (with @file) | Build | Complex | → `/om:brainstorm` |
| `实现用户登录功能` | Build | Standard | → `/om:start` |
| `修复登录页面的样式问题` | Fix | Simple | → `/om:start` |
| `改一下这个变量名` | Change | Simple | → `/om:start` |
| `添加一个测试用例` | Build | Simple | → `/om:start` |
| `重构用户模块` | Change | Medium | → `/om:brainstorm` |
| `从零搭建后台管理` | Build | Complex | → `/om:brainstorm` |
| `怎么实现登录?` | Ask | - | ❌ Direct answer |
| `这个函数有什么问题?` | Ask | - | ❌ Direct answer |
```

- [ ] **Step 2: Add newfeature to related skills list**

Modify the related skills section (line 53-57), add newfeature:

```markdown
**Related skills:**
- `/om:newfeature` — 轻量级小需求，无任务文件
- `/om:auto` — 全自动执行，无需审批
- `/om:status` — 查看执行进度
- `/om:meeting` — 处理阻塞问题
- `/om:report` — 生成执行报告
- `/om:resume` / `/om:retry` — 恢复/重试
```

- [ ] **Step 3: Update complexity assessment section**

Modify the complexity assessment section (lines 92-106), add small category:

```markdown
2. **Complexity Assessment**

   **Small → `/om:newfeature`** (lightweight, no task files):
   - Description ≤ 100 chars
   - Single feature point
   - Keywords: 小需求、小功能、小改动、minor、quick、快速

   **Complex → `/om:brainstorm`** (explore requirements first):
   - New feature (from scratch)
   - Multi-module changes (architecture involved)
   - Unclear requirements (need to explore first)

   **Simple → `/om:start`** (clear requirements):
   - Bug fix
   - Small change
   - Single feature
   - Clear requirement
```

- [ ] **Step 4: Update frontmatter description**

Modify the frontmatter `description` field (line 3):

```markdown
description: "Use when starting any conversation where user wants development work done. Establishes how to detect development tasks and route to OpenMatrix workflow (newfeature/start/brainstorm). Examples: 'implement X', 'build a game', 'fix bug', 'refactor module', 'add feature', '小需求', '小功能'."
```

- [ ] **Step 5: Commit changes**

```bash
git add skills/openmatrix.md
git commit -m "$(cat <<'EOF'
feat(skills): sync openmatrix.md routing with om:newfeature

- Add small complexity category → /om:newfeature
- Update examples table with routing cases
- Add newfeature to related skills list

Co-Authored-By: OpenMatrix https://github.com/bigfish1913/openmatrix
EOF
)"
```

---

### Task 4: Manual Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Verify skill files syntax**

Check all skill files have valid frontmatter and structure:

```bash
# Check frontmatter format
head -6 skills/newfeature.md
head -6 skills/om.md
head -6 skills/openmatrix.md

# Verify no unclosed sections
grep -c "<process>" skills/newfeature.md
grep -c "</process>" skills/newfeature.md
# Should both return 1
```

- [ ] **Step 2: Verify routing logic consistency**

Compare routing descriptions across files:

```bash
# Check newfeature routing in all three files
grep "newfeature" skills/om.md
grep "newfeature" skills/openmatrix.md
grep "newfeature" skills/newfeature.md
# All should mention newfeature
```

- [ ] **Step 3: Verify TodoWrite usage in newfeature**

Check TodoWrite is correctly used for task management:

```bash
grep "TodoWrite" skills/newfeature.md
# Should find multiple occurrences for task state management
```

- [ ] **Step 4: Verify git commit format**

Check git commit format is defined:

```bash
grep -A5 "Git 提交格式" skills/newfeature.md
# Should show the commit format template
```

- [ ] **Step 5: Final commit for verification**

```bash
git status
# If any verification fixes needed, commit them

git add docs/superpowers/plans/2026-04-18-om-newfeature.md
git commit -m "$(cat <<'EOF'
docs: add implementation plan for om:newfeature

Plan covers:
- Task 1: Create skills/newfeature.md
- Task 2: Modify skills/om.md routing
- Task 3: Modify skills/openmatrix.md routing
- Task 4: Manual verification

Co-Authored-By: OpenMatrix https://github.com/bigfish1913/openmatrix
EOF
)"
```

---

## Self-Review Checklist

| Spec Requirement | Covered by Task |
|-----------------|-----------------|
| `/om:newfeature` skill file created | Task 1 |
| `/om` routing logic added | Task 2 |
| Small requests route to newfeature | Task 2 Step 1 |
| Tasks split 2-5 chunks, TodoWrite managed | Task 1 Step 3 |
| Quality level verification | Task 1 Step 6 |
| Stepwise Git commits | Task 1 Step 7 |
| No `.openmatrix/tasks/` files | Task 1 (TodoWrite only) |
| E2E options passed | Task 1 Step 4.2 |

**Placeholder scan:**
- ✅ No TBD/TODO
- ✅ All code blocks have actual content
- ✅ All file paths are exact
- ✅ All bash commands are complete

**Type consistency:**
- ✅ TodoWrite todos array structure consistent throughout
- ✅ Git commit format consistent
- ✅ Quality levels (strict/balanced/fast) consistent