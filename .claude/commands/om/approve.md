---
name: om:approve
description: 审批待处理项（包括计划、合并、部署、Meeting）
---

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
处理所有需要人工决策的待审批项。
</objective>

<process>
1. 读取 `.openmatrix/approvals/` 下 status=pending 的审批
2. 如果有多个，让用户选择要处理的审批
3. 展示审批内容：

```
🔔 待审批: APPR-001

📋 类型: plan | merge | deploy | meeting
📝 标题: 审批标题
🎯 任务: TASK-XXX

## 内容

[审批详细内容]

## 选项

[A] ✅ 批准 - 批准并继续执行
[B] ✏️ 修改 - 需要修改后重新提交
[C] ❌ 拒绝 - 拒绝此请求

请选择: _
```

4. 用户选择后：
   - 写入审批结果到 `approvals/{id}.json`
   - 更新状态: approved / rejected
   - 记录决策时间和决策人

5. 如果批准：
   - 更新关联任务状态
   - 自动继续执行（CLI 会自动恢复）

6. 如果拒绝/修改：
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
