---
name: om:start
description: 启动新的任务执行周期
---

<objective>
解析任务文档并启动 OpenMatrix 执行流程。
</objective>

<process>
1. **检查当前状态**
   - 如果已有运行中的任务，提示用户先完成或暂停

2. **解析任务输入**
   - 如果提供文件路径 → 读取文件内容
   - 如果提供任务描述 → 直接使用
   - 如果无参数 → 询问用户要执行的任务

3. **生成澄清问题**
   - 分析任务，识别不确定项
   - 生成问题列表，每个问题提供选项

```
📋 任务分析完成，请确认以下问题：

[1] 使用哪种技术栈？
    A) TypeScript + React
    B) Python + FastAPI
    C) 其他

[2] 数据库选择？
    A) PostgreSQL
    B) MongoDB
    C) SQLite

请选择或输入自定义答案: _
```

4. **任务拆解**
   - 根据用户选择拆解任务
   - 生成子任务列表

5. **展示执行计划**

```
📋 执行计划

Phase 1: 数据模型设计
  └─ TASK-001: 设计数据库 Schema

Phase 2: API 开发
  ├─ TASK-002: 用户认证 API
  ├─ TASK-003: 数据 CRUD API
  └─ TASK-004: 搜索 API (依赖: TASK-003)

Phase 3: 前端开发
  ├─ TASK-005: 登录页面
  └─ TASK-006: 数据管理页面

预计总耗时: ~2小时
审批点: plan, merge

是否开始执行? [Y/n]: _
```

6. **开始执行**
   - 用户确认后，调用 CLI: `openmatrix start`
   - CLI 初始化状态并开始调度

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:start                      # 交互式输入任务
/om:start docs/task.md         # 从文件读取任务
/om:start "实现用户登录功能"    # 直接描述任务
</examples>
