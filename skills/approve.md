---
name: om:approve
description: "Use when handling pending approvals including plan review, merge confirmation, deploy approval, and blocked task decisions during OpenMatrix execution. Triggers on: 审批, approve, 批准, plan review, merge conflict resolution, deploy confirmation, 阻塞处理, technical decision, pending approval, waiting for approval, 待确认."
---

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
处理所有需要人工决策的待审批项，包括阻塞问题、技术决策、计划审批等。
</objective>

<process>
1. **获取待审批列表**
   ```bash
   openmatrix approve
   ```

2. **如果没有待审批项**
   ```
   ✅ 没有待审批项

   当前执行状态:
   - 运行中任务: X
   - 已完成: Y
   - 总计: Z

   使用 /om:status 查看详情
   ```
   如果有多个，让用户选择要处理的审批

3. **展示审批内容** (根据类型区分)

   **Plan 审批:**
   ```
   🔔 待审批: APPR-001

   📋 类型: 📝 Plan 审批
   🎯 任务: TASK-XXX

   ## 执行计划

   ### Phase 1: 设计阶段
   └─ TASK-001: 架构设计 (15min)

   ### Phase 2: 开发阶段
   ├─ TASK-002: 数据模型 (20min)
   └─ TASK-003: API 接口 (30min)

   📊 统计
   - 总任务: 3
   - 预计耗时: ~1小时

   ## 选项

   [A] ✅ 批准 - 按此计划执行
   [B] ✏️ 修改 - 需要调整计划
   [C] ❌ 拒绝 - 重新规划

   请选择: _
   ```

   **Meeting 审批 (阻塞问题):**
   ```
   🔔 待审批: APPR-002

   📋 类型: 🔴 Meeting (阻塞)
   🎯 任务: TASK-XXX

   ## 阻塞问题描述

   **原因**: [阻塞原因]
   **时间**: [发生时间]

   ## 影响范围

   - TASK-XXX: 下游任务1
   - TASK-YYY: 下游任务2

   ## 可选操作

   [A] 💡 提供信息 - 提供解决阻塞所需的信息
   [B] ⏭️ 跳过任务 - 标记为可选，继续执行
   [C] 🔄 修改方案 - 调整任务方案
   [D] ❌ 取消执行 - 停止整个流程

   请选择: _
   ```

   **Meeting 审批 (技术决策):**
   ```
   🔔 待审批: APPR-003

   📋 类型: 🤔 Meeting (决策)
   🎯 任务: TASK-XXX

   ## 决策点

   **问题**: [需要决策的技术问题]

   ## 可选方案

   1. 方案A - [描述] (推荐)
      - 优点: ...
      - 缺点: ...

   2. 方案B - [描述]
      - 优点: ...
      - 缺点: ...

   ## 选项

   [A] 选择方案1 (推荐)
   [B] 选择方案2
   [C] 自定义方案 - 输入您自己的方案
   [D] 需要更多信息 - 暂不决策，先获取更多信息

   请选择: _
   ```

4. **处理用户选择**

   使用 `AskUserQuestion` 工具进行交互:

   ```typescript
   AskUserQuestion({
     questions: [{
       question: "请选择审批操作:",
       header: "审批",
       options: [
         { label: "批准", description: "批准并继续执行" },
         { label: "修改", description: "需要修改后重新提交" },
         { label: "拒绝", description: "拒绝此请求" }
       ],
       multiSelect: false
     }]
   })
   ```

   如果选择"提供信息"或"自定义方案"，追加问题:

   ```typescript
   AskUserQuestion({
     questions: [{
       question: "请输入详细信息:",
       header: "详情",
       options: [] // 允许自由输入
     }]
   })
   ```

5. **执行审批**
   ```bash
   openmatrix approve <approvalId> -d <approve|reject|modify> [-c "备注"] --json
   ```

   **注意**: approvalId 是位置参数，不要使用 --id。正确格式: `openmatrix approve APPR-001 -d approve --json`

6. **更新状态**

   - 写入审批结果到 `approvals/{id}.json`
   - 更新状态: approved / rejected
   - 记录决策时间、决策人、决策理由

7. **后续处理**

   **如果批准:**
   - 更新关联任务状态
   - 如果是 Meeting，解决 Meeting 并记录解决方案
   - 自动继续执行

   **如果拒绝/修改:**
   - 任务进入相应状态
   - 显示后续操作建议

</process>

<arguments>
$ARGUMENTS

如果提供审批ID，直接处理指定审批。
如果无参数，列出所有待审批项供选择。
</arguments>

<examples>
/om:approve              # 列出所有待审批
/om:approve APPR-001     # 直接处理指定审批
</examples>

<notes>
## 审批类型说明

| 类型 | 图标 | 触发条件 | 处理方式 |
|------|------|---------|---------|
| plan | 📝 | 任务拆解完成 | 批准/修改/拒绝 |
| merge | 🔀 | 开发完成 | 批准/拒绝 |
| deploy | 🚀 | 部署前确认 | 批准/拒绝 |
| meeting | 🔴/🤔 | 阻塞/决策 | 交互式解决 |

## Meeting 审批特殊处理

Meeting 审批需要更细致的交互:

1. **阻塞问题**
   - 提供信息 → 记录到任务，恢复执行
   - 跳过任务 → 标记可选，继续下游
   - 修改方案 → 调整参数，重新执行
   - 取消执行 → 停止流程

2. **技术决策**
   - 选择方案 → 记录决策，继续执行
   - 自定义方案 → 记录新方案，继续执行
   - 需要更多信息 → 暂停，等待调研

## CLI 命令

```bash
# 列出待审批 (不传 ID)
openmatrix approve --json

# 处理审批 (ID 是位置参数，不要用 --id)
openmatrix approve APPR-001 -d approve -c "同意此方案" --json
openmatrix approve APPR-001 -d reject -c "需要重新设计" --json
openmatrix approve APPR-001 -d modify -c "增加测试覆盖率要求" --json
```

## 与执行循环的集成

```
执行循环检测到 pending approval
       │
       ▼
  调用 /om:approve
       │
       ▼
  用户审批决策
       │
       ▼
  更新审批状态
       │
       ▼
  如果是 Meeting:
    ├─ 解决 Meeting
    └─ 恢复任务状态
       │
       ▼
  继续执行循环
```
</notes>
