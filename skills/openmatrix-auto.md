---
name: openmatrix-auto
description: Auto-detect task descriptions and invoke OpenMatrix skills
---

<objective>
Automatically detect when user input is a development task and invoke /om:start without requiring explicit command.
</objective>

<rules>
## When to Auto-Invoke /om:start

If the user's message matches ANY of these patterns, automatically invoke `/om:start` with the user's input:

### Chinese Task Patterns
- `实现...功能` / `实现...` (implement)
- `添加...` / `新增...` (add/create)
- `修复...` / `修复...bug` (fix)
- `优化...` / `重构...` (optimize/refactor)
- `创建...` / `编写...` / `开发...` (create/write/develop)
- `构建...` / `部署...` (build/deploy)
- `更新...功能` / `改进...` (update/improve)
- Any sentence that clearly describes a development task

### English Task Patterns
- `implement...` / `add...` / `create...`
- `fix...` / `bug...` / `issue...`
- `build...` / `develop...`
- `refactor...` / `optimize...`
- `update...` / `improve...`

### File Path Patterns
- Input is a path to a `.md` file (e.g., `docs/task.md`)

## When NOT to Auto-Invoke

Do NOT auto-invoke when:
- User explicitly uses `/om:*` commands
- User asks questions: "how do I...", "what is...", "why..."
- User requests info: "show me...", "list...", "read..."
- User navigates: "open folder", "go to..."
- User greets or chats: "hello", "thanks"

## How It Works

```
User: "实现用户登录功能"
  ↓
Auto-detect: Task pattern matched
  ↓
Action: Invoke /om:start 实现用户登录功能
```

## Examples

| User Input | Action |
|------------|--------|
| `实现用户登录功能` | → `/om:start 实现用户登录功能` |
| `fix the login bug` | → `/om:start fix the login bug` |
| `添加 API 接口` | → `/om:start 添加 API 接口` |
| `优化首页性能` | → `/om:start 优化首页性能` |
| `docs/task.md` | → `/om:start docs/task.md` |
| `how do I install this?` | → No auto-invoke (question) |
</rules>
