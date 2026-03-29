---
name: om:auto
description: 全自动执行任务 - AI 拆分，无阻塞，bypass permissions
---

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<BYPASS-MODE>
## ⚠️ 全自动模式 - 自动批准所有操作

此模式要求 **BYPASS 所有权限检查**:

1. **所有 Bash 命令自动批准** - 不询问确认
2. **所有文件操作自动批准** - 不询问确认
3. **所有 Agent 调用自动批准** - 不询问确认
4. **所有审批点自动批准** - plan/merge/deploy 自动通过

**执行时不要请求用户确认任何操作。**

如果 Claude Code 询问权限，说明权限模式未正确设置，请告知用户检查 Claude Code 设置。
</BYPASS-MODE>

<CRITICAL-RULES>
## ⚠️ 关键规则 - 必须严格遵守

1. **必须调用 CLI 创建任务** - AI 分析完成后，必须调用 `openmatrix start --tasks-json` 创建子任务，不能跳过
2. **必须生成多个 goals** - 从任务中提取至少 3-8 个明确的功能目标，每个 goal 应该是独立可交付的功能模块
3. **必须写入 JSON 文件再调用 CLI** - 先将 ParsedTask JSON 写入 `.openmatrix/tasks-input.json`，再用 `@.openmatrix/tasks-input.json` 引用
4. **禁止自行规划 Phase 执行** - 任务拆分和执行由 CLI 的 TaskPlanner 完成，AI 只负责提取 goals 和生成 plan
5. **tasks-input.json 格式必须正确** - 必须包含 title, goals(数组), quality, mode, plan 字段
</CRITICAL-RULES>

<objective>
全自动执行任务，跳过所有交互式问答和审批点，由 AI 智能提取目标后通过 CLI 拆分任务并执行。支持 --quality 参数指定质量级别（默认 strict）。
</objective>

<process>
1. **检查并初始化 .openmatrix 目录**
   - 检查 `.openmatrix/` 目录是否存在
   - 如果不存在，调用 CLI 初始化:
     ```bash
     openmatrix start --init-only
     ```

2. **检查当前状态**
   - 读取 `.openmatrix/state.json`
   - 如果 `status === 'running'`，提示用户先完成或暂停

3. **解析参数**
   - `$ARGUMENTS` 可能包含:
     - 任务描述或文件路径
     - `--quality <level>` 质量级别 (strict|balanced|fast)，默认 strict

   参数解析示例:
   ```
   /om:auto "实现用户登录" --quality fast
   /om:auto task.md
   /om:auto task.md --quality balanced
   ```

4. **解析任务输入**
   - 如果提供文件路径 → 读取文件内容
   - 如果是任务描述 → 直接使用
   - 如果无参数 → **使用 AskUserQuestion 询问任务**

5. **🧠 AI 解析任务 + 生成执行计划（由 Skill 自身完成）**

   **重要: AI 负责理解任务语义、生成执行计划、提取结构化信息。**
   任务拆分仍由 CLI 的 TaskPlanner 完成，但 AI 生成的计划会注入到每个子任务中供 agent 参考。

   **解析原则:**
   - 从任务描述中提取明确的功能目标 (goals)，**至少 3-8 个**
   - 每个 goal 应该是独立可交付的功能模块（例如: "实现武器系统"、"实现敌人AI"）
   - 识别隐含的约束条件 (constraints)，如技术栈、兼容性要求
   - 推断合理的交付物 (deliverables)
   - **生成执行计划 (plan)**：技术方案、模块划分、接口设计、关键决策点

   **生成 ParsedTask JSON（含执行计划）:**

   ```json
   {
     "title": "任务标题",
     "description": "整体描述",
     "goals": ["目标1", "目标2", "目标3"],
     "constraints": ["约束1", "约束2"],
     "deliverables": ["src/xxx.ts", "tests/xxx.test.ts"],
     "answers": {
       "技术栈": "TypeScript, Vue.js"
     },
     "quality": "strict|balanced|fast",
     "mode": "auto",
     "plan": "## 技术方案\n\n1. 技术选型: ...\n2. 模块划分: ...\n3. 接口设计: ...\n4. 关键决策: ..."
   }
   ```

   **注意:**
   - `goals` 是最核心的字段，TaskPlanner 会为每个 goal 生成 开发+测试 任务对
   - `plan` 是 AI 生成的执行计划，会被保存到 `.openmatrix/plan.md` 并注入每个子任务描述
   - plan 内容越详细，agent 执行效果越好（技术选型、接口定义、数据模型等）
   - 多个 goals 会自动并行执行（仅依赖设计任务）

6. **⚠️ 调用 CLI 创建任务（必须执行，不可跳过）**

   **将第 5 步生成的 ParsedTask JSON 写入文件，然后调用 CLI:**

   ```bash
   # 第一步: 写入任务 JSON 文件
   cat > .openmatrix/tasks-input.json << 'EOF'
   {第5步生成的完整JSON}
   EOF

   # 第二步: 调用 CLI 创建任务（必须执行）
   openmatrix start --tasks-json @.openmatrix/tasks-input.json --json
   ```

   **如果 JSON 较大，使用 Write 工具写入文件:**
   ```
   Write 工具: .openmatrix/tasks-input.json
   内容: 第5步生成的ParsedTask JSON
   ```

   **然后调用:**
   ```bash
   openmatrix start --tasks-json @.openmatrix/tasks-input.json --json
   ```

   **CLI 返回 JSON 包含 subagentTasks 列表，每个 task 包含:**
   - `taskId`: 任务 ID
   - `subagent_type`: Agent 类型
   - `description`: 简短描述
   - `prompt`: 完整执行提示词
   - `isolation`: 是否隔离
   - `timeout`: 超时时间

7. **执行循环 (全自动)**

   从 CLI 返回的 subagentTasks 列表开始执行:

   ```
   while (有待执行任务) {
     1. 读取状态文件获取下一个待执行任务
     2. 调用 Agent 工具执行 Subagent:
        Agent({
          subagent_type: task.subagent_type,
          description: task.description,
          prompt: task.prompt,
          isolation: task.isolation
        })
     3. Subagent 完成后，根据执行结果更新任务状态:
        - 成功: 任务通过 develop → verify → accept 阶段自动流转
        - 失败: 任务标记为 failed
     4. **Git 自动提交** (每个子任务完成后):
        ```bash
        git add -A
        git commit -m "feat(task-id): 任务标题

        - 修改内容1
        - 修改内容2

        任务ID: TASK-XXX
        RunID: run-XXX"
        ```
     5. Phase 验收测试
     6. **自动批准所有审批点**:
        - plan/merge/deploy → 自动批准 ✓
        - meeting → 记录并跳过，继续执行
     7. 继续下一个任务
   }
   ```

   **⚠️ 重要**: 在 auto 模式下，**不得**询问用户任何确认问题：
   - 不得询问"是否继续执行"
   - 不得询问"是否执行下一 Phase"
   - **plan/merge/deploy 自动批准，meeting 记录但不批准，最后统一展示**

8. **执行完成 - 最终 Git 提交**

   所有任务完成后，执行最终提交:
   ```bash
   git add -A
   git commit -m "feat: 完成所有任务 (auto mode)

   RunID: run-XXX
   任务数: N
   完成时间: YYYY-MM-DD HH:mm:ss"
   ```

9. **展示 Meeting (如果有)**
   如果有 pending 的 Meeting，列出供用户后续处理:
   ```
   执行完成!
   📋 有待处理的 Meeting (2个):
     - APPR-001: 数据库连接失败 (TASK-B)
     - APPR-002: API设计决策 (TASK-D)

   请使用 /om:meeting 查看并处理
   ```

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:auto                              # 交互式输入任务
/om:auto "实现用户登录功能"             # 直接执行，strict 质量
/om:auto task.md --quality fast       # 快速模式，无质量门禁
/om:auto task.md --quality balanced   # 平衡模式
/om:auto task.md --quality strict     # 严格模式 (默认)
</examples>

<notes>
## 质量级别

| 级别 | TDD | 覆盖率 | Lint | 安全扫描 | 适用场景 |
|------|:---:|:------:|:----:|:--------:|---------|
| **strict** | ✅ | >80% | ✅ 严格 | ✅ | 生产代码 (默认) |
| **balanced** | ❌ | >60% | ✅ | ✅ | 日常开发 |
| **fast** | ❌ | 无要求 | ❌ | ❌ | 快速原型 |

## 与 /om:start 的区别

| 特性 | /om:start | /om:auto |
|------|-----------|----------|
| 交互式问答 | ✅ 必须 | ❌ 跳过 |
| 任务拆分 | AI 拆分 | AI 拆分 |
| 质量级别选择 | 交互选择 | 参数指定，默认 strict |
| 执行模式选择 | 交互选择 | 固定 auto |
| 审批点 | 可配置 | 无 (bypass) |
| Meeting 处理 | 执行中交互 | 记录并跳过 |

## CLI 命令

```bash
# 全自动执行，strict 质量
openmatrix auto task.md

# 全自动执行，fast 质量
openmatrix auto task.md --quality fast

# JSON 输出 (供 Skill 解析)
openmatrix auto task.md --json
```

## 状态配置

auto 模式下的状态配置:
```json
{
  "status": "running",
  "config": {
    "approvalPoints": [],
    "quality": {
      "level": "strict",
      "tdd": true,
      "minCoverage": 80,
      "strictLint": true,
      "securityScan": true
    }
  }
}
```

## 执行流程图

```
┌─────────────────┐
│   /om:auto      │
│   解析参数       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  读取任务内容    │
│  (文件或描述)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AI 智能分析    │
│  提取 goals     │
│  生成 plan      │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│  写入 JSON 文件      │
│  调用 CLI start     │
│  --tasks-json       │  ← 必须执行，不可跳过
└────────┬────────────┘
         │
         ▼
┌─────────────────┐
│  CLI TaskPlanner│
│  拆分为子任务    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   执行循环       │◀────────────┐
│  (无阻塞)        │             │
└────────┬────────┘             │
         │                      │
         ▼                      │
   ┌───────────┐                │
   │ Agent执行 │                │
   └─────┬─────┘                │
         │                      │
         ▼                      │
   ┌───────────┐                │
   │ 自动批准  │                │
   │ (无阻塞)  │                │
   └─────┬─────┘                │
         │                      │
         ▼                      │
   ┌───────────┐     否         │
   │ 还有任务? │────────────────┘
   └─────┬─────┘
         │ 是
         ▼
┌─────────────────┐
│  展示 Meeting   │
│  (如果有)       │
└─────────────────┘
```
</notes>
