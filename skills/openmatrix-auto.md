---
name: openmatrix-auto
description: "Invoke /om:start for any implementation task - adding features, fixing bugs, refactoring, creating commands, writing code, building systems. Use this when user describes work to be done, not for questions or information requests."
---

<objective>
Automatically detect when user wants to accomplish a development task and invoke /om:start without requiring explicit command.
</objective>

<trigger-conditions>
## When to Auto-Invoke /om:start

**Invoke `/om:start` when user wants to:**
- Add/create/implement new features or functionality
- Fix bugs or resolve issues
- Refactor or optimize existing code
- Write tests
- Build components or systems
- Integrate third-party services

**This includes:**
- Direct requests: "实现登录功能" / "增加一个命令" / "修复bug"
- Complex tasks: "做个完整的用户系统" / "从零搭建后台"
- Multi-step work: "先做A再做B" / "前端+后端+数据库"
</trigger-conditions>

<exclusions>
## When NOT to Auto-Invoke

**Do NOT invoke when:**
- User is asking a question: "怎么实现?" / "如何配置?" / "what is..."
- User is requesting information: "显示配置" / "列出文件" / "show me..."
- User is navigating: "打开目录" / "进入文件夹"
- User is just chatting: "你好" / "谢谢"

**Key test: Is the user asking you to BUILD/CREATE/FIX something?**
- Yes → Invoke `/om:start`
- No (asking for info) → Do NOT invoke
</exclusions>

<examples>
| User Input | Action |
|------------|--------|
| `增加一个 om:upgrade 命令` | → `/om:start 增加一个 om:upgrade 命令` |
| `实现用户登录功能` | → `/om:start 实现用户登录功能` |
| `登录页面报错了` | → `/om:start 登录页面报错了` |
| `怎么实现登录?` | → No invoke (question) |
</examples>