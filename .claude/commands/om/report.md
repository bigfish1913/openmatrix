---
name: om:report
description: 生成任务执行报告
---
<objective>
生成当前运行周期的完整执行报告。
</objective>

<arguments>
$ARGUMENTS
</arguments>

<process>
1. 收集所有任务执行数据
2. 生成报告包含：
   - 执行概览
   - 任务详情
   - 时间统计
   - 失败分析（如有）
   - 建议和下一步
3. 输出到 `.openmatrix/report.md` 或指定路径
</process>
