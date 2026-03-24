# OpenMatrix: Start

启动新的任务执行流程。

## 使用

```
/om:start <task-doc-path>
```

## 流程

1. 读取任务文档内容
2. 调用 TaskParser 解析文档
3. 调用 QuestionGenerator 生成问题
4. 展示问题，收集用户答案
5. 保存答案到状态文件
6. 进入计划阶段

## 输出

- 开始执行任务流程
- 显示收集到的问题列表
- 保存用户的答案到 `.openmatrix/state.json`
- 调用 `/om:plan` 进入计划阶段

## 示例

```
/om:start docs/feature.md

📊 OpenMatrix Task Start

Reading task document: docs/feature.md

...

🔍 Analyzing task...

📋 Clarification Questions (1/4):

1. 技术栈选择
   - TypeScript (推荐)
   - JavaScript
   - Python
   - 其他

2. 优先级确认
   ...

3. ...
```

