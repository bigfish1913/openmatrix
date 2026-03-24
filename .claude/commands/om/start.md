---
name: om:start
description: 启动新的任务执行周期
---
<objective>
解析任务文档并启动 OpenMatrix 执行流程。
</objective>

<arguments>
$ARGUMENTS
</arguments>

<process>
1. 如果提供了参数，解析为任务文件路径或任务描述
2. 如果无参数，询问用户要执行的任务
3. 创建新的运行 ID
4. 初始化 `.openmatrix/` 目录结构
5. 解析任务并拆分为子任务
6. 开始执行第一个子任务
</process>
