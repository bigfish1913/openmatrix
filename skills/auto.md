---
name: om:auto
description: 全自动执行任务 - 无阻塞，bypass permissions
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

<objective>
全自动执行任务，跳过所有交互式问答和审批点，直接完成。支持 --quality 参数指定质量级别（默认 strict）。
</objective>

<process>
1. **检查并初始化 .openmatrix 目录**
   - 检查 `.openmatrix/` 目录是否存在
   - 如果不存在，CLI 会自动创建

2. **检查当前状态**
   - 读取 `.openmatrix/state.json`
   - 如果 `status === 'running'`，提示用户先完成或暂停

3. **解析参数**
   - `$ARGUMENTS` 可能包含:
     - 任务描述或文件路径
     - `--quality <level>` 质量级别 (strict|balanced|fast)，默认 strict
     - `--bypass` 是否 bypass permissions (默认 true)

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

5. **直接执行 (无交互式问答)**
   - 跳过所有澄清问题
   - 使用默认质量配置 (strict 除非指定)
   - 设置 `approvalPoints: []` (bypass permissions)

6. **调用 CLI**
   ```bash
   openmatrix auto --quality <level> --json
   ```

7. **执行循环 (全自动)**

   ```
   while (有待执行任务) {
     1. 读取状态文件获取 SubagentTask
     2. 调用 Agent 工具执行 Subagent
     3. Subagent 完成后，更新状态文件:
        ```bash
        openmatrix complete <taskId> --success/--failed
        ```
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
| **fast** | ❌ | >20% | ❌ | ❌ | 快速原型 |

## 与 /om:start 的区别

| 特性 | /om:start | /om:auto |
|------|-----------|----------|
| 交互式问答 | ✅ 必须 | ❌ 跳过 |
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
│  CLI: auto      │
│  --quality=X    │
│  approvalPoints │
│  = []           │
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
