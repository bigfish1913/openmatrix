---
name: openmatrix-auto
description: "Use this for ANY development task - implementing features, adding functionality, fixing bugs, building components, creating systems, or modifying code. Auto-invokes /om:start to orchestrate the work."
---

<objective>
Automatically detect when user wants to accomplish a development task and invoke /om:start without requiring explicit command.
</objective>

<trigger-conditions>
## When to Auto-Invoke /om:start

Invoke `/om:start` when the user's input indicates **intent to build, create, add, fix, or modify** something in code.

### Semantic Triggers (Intent-based)

**These patterns indicate development intent:**

| User Says | Intent | Action |
|-----------|--------|--------|
| "项目支持 Python/Go/Java" | Add language support | `/om:start 项目支持 Python/Go/Java` |
| "需要登录功能" | Need a feature | `/om:start 需要登录功能` |
| "想做一个后台管理" | Want to build something | `/om:start 想做一个后台管理` |
| "加个导出功能" | Add functionality | `/om:start 加个导出功能` |
| "用户能上传文件" | Enable capability | `/om:start 用户能上传文件` |
| "集成第三方支付" | Integrate something | `/om:start 集成第三方支付` |
| "支持多语言" | Add support for something | `/om:start 支持多语言` |
| "要有 API 文档" | Need documentation | `/om:start 要有 API 文档` |

### Keyword Triggers (Pattern-based)

**Chinese:**
- `实现...` / `添加...` / `新增...` / `创建...`
- `修复...` / `优化...` / `重构...` / `改进...`
- `开发...` / `构建...` / `编写...` / `集成...`
- `支持...` / `需要...` / `想要...` / `要做...`

**English:**
- `implement...` / `add...` / `create...` / `build...`
- `fix...` / `bug...` / `issue...` / `refactor...`
- `develop...` / `integrate...` / `support...` / `need...`
- `want to...` / `would like...` / `should have...`

### File Path Triggers
- Input ends with `.md` (treated as task document)
</trigger-conditions>

<exclusions>
## When NOT to Auto-Invoke

Do NOT invoke when the user is:
- **Asking questions**: "how do I...", "what is...", "why..."
- **Requesting info**: "show me...", "list...", "read...", "check..."
- **Navigating**: "open folder", "go to...", "cd..."
- **Chatting**: "hello", "thanks", "好的"
- **Using explicit commands**: `/om:*`, `/gsd:*`, `/superpowers:*`

**Key distinction:**
- ✅ "项目支持 Python" → Intent to ADD support → INVOKE
- ❌ "这个项目支持 Python 吗" → Asking a question → DO NOT invoke
</exclusions>

<examples>
## Examples

| User Input | Action |
|------------|--------|
| `当前项目支持下 Python/Go/Java` | → `/om:start 当前项目支持下 Python/Go/Java` |
| `实现用户登录功能` | → `/om:start 实现用户登录功能` |
| `需要加个导出功能` | → `/om:start 需要加个导出功能` |
| `想做一个管理后台` | → `/om:start 想做一个管理后台` |
| `fix the login bug` | → `/om:start fix the login bug` |
| `集成微信支付` | → `/om:start 集成微信支付` |
| `这个项目支持 Python 吗?` | → No invoke (question) |
| `show me the config` | → No invoke (info request) |
</examples>

<process>
1. Detect user intent from input
2. If intent matches trigger conditions → invoke `/om:start` with full user input
3. If unclear → do NOT invoke, let user be explicit
</process>