# OpenMatrix: Approve

处理待确认项。

## 使用

```
/om:approve [approval-id]
```

## 流程

1. 读取 `.openmatrix/approvals/pending/` 下的所有待确认项
2. 展示确认内容
3. 猉用户选择处理
4. 保存决定到 `.openmatrix/approvals/history/`
5. 通知调度器继续执行

## 示例

```
Pending approvals:

APPR-001: Architecture Decision
Type: plan
Task: TASK-001
Status: pending

Options:
1. Approve - 批准
2. Reject - 拒绝
3. Modify - 需要修改

---

> Please select an option: 1) Approve, 2) Reject, 3) Modify

Selection: 1
✅ Approved
```
