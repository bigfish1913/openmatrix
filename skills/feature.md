---
name: om:feature
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
feat(feature): ${originalTask} - ${currentChunk}

改动详情：
- ${changesSummary}

Co-Authored-By: OpenMatrix https://github.com/bigfish1913/openmatrix
EOF
)"
```

然后：
1. **更新 TodoWrite 状态为 completed**
2. **继续下一个任务**

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
/om:feature 给用户列表页添加搜索功能
/om:feature 添加一个导出按钮
/om:feature docs/small-task.md
</examples>

<notes>
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

## 错误处理

| 错误 | 处理 |
|-----|-----|
| 测试失败 | 停止，提示用户修复 |
| Lint 错误 | 停止，提示用户修复 |
| Agent 超时 | 询问重试或跳过 |
| Git 失败 | 提示手动处理 |

## Git 提交格式

```
<type>(feature): <任务描述> - <任务块名称>

改动详情

Co-Authored-By: OpenMatrix
```

type: feat/fix/test/refactor/docs
</notes>