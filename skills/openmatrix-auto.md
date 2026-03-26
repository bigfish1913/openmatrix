---
name: openmatrix-auto
description: "Use this for ANY development task - especially complex multi-step tasks, implementing features, adding functionality, fixing bugs, building components, creating systems, modifying code, writing tests, reviewing code, or planning work. Auto-invokes /om:start to orchestrate the work."
---

<objective>
Automatically detect when user wants to accomplish a development task and invoke /om:start without requiring explicit command.
</objective>

<trigger-conditions>
## When to Auto-Invoke /om:start

Invoke `/om:start` when the user's input indicates **intent to build, create, add, fix, test, review, or plan** something, OR when the task is **complex with multiple steps/requirements**.

### Complexity Triggers (Multi-task Scenarios)

**Invoke when user describes:**

| User Says | Why Trigger | Action |
|-----------|-------------|--------|
| "做个完整的用户系统" | Multi-component task | `/om:start 做个完整的用户系统` |
| "重构整个项目结构" | Complex refactoring | `/om:start 重构整个项目结构` |
| "从零搭建一个后台" | Multi-step project | `/om:start 从零搭建一个后台` |
| "实现完整的 CRUD" | Multiple features | `/om:start 实现完整的 CRUD` |
| "支持多种登录方式" | Multiple integrations | `/om:start 支持多种登录方式` |
| "前端+后端+数据库" | Full-stack work | `/om:start 前端+后端+数据库` |
| "A/B/C/D 都要实现" | Multiple requirements | `/om:start A/B/C/D 都要实现` |
| "先把 A 做了，再做 B" | Sequential tasks | `/om:start 先把 A 做了，再做 B` |

**Complexity indicators:**
- Contains multiple features/components (`登录+注册+权限`)
- Contains sequential steps (`先...再...然后...`)
- Contains multiple requirements (`需要 A 和 B 和 C`)
- Contains comprehensive scope (`完整...` / `整个...` / `全套...`)
- Contains multiple technologies (`前端+后端` / `React+Node+Mongo`)

### Semantic Triggers (Intent-based)

**Feature Development:**

| User Says | Intent | Action |
|-----------|--------|--------|
| "项目支持 Python/Go/Java" | Add language support | `/om:start 项目支持 Python/Go/Java` |
| "需要登录功能" | Need a feature | `/om:start 需要登录功能` |
| "想做一个后台管理" | Want to build something | `/om:start 想做一个后台管理` |
| "加个导出功能" | Add functionality | `/om:start 加个导出功能` |
| "用户能上传文件" | Enable capability | `/om:start 用户能上传文件` |
| "集成第三方支付" | Integrate something | `/om:start 集成第三方支付` |
| "支持多语言" | Add support | `/om:start 支持多语言` |
| "要有 API 文档" | Need documentation | `/om:start 要有 API 文档` |

**Bug Fixes:**

| User Says | Intent | Action |
|-----------|--------|--------|
| "有个 bug 需要修" | Fix bug | `/om:start 有个 bug 需要修` |
| "登录报错了" | Fix error | `/om:start 登录报错了` |
| "数据保存失败" | Fix issue | `/om:start 数据保存失败` |
| "修复 XX 问题" | Fix problem | `/om:start 修复 XX 问题` |

**Improvements:**

| User Says | Intent | Action |
|-----------|--------|--------|
| "性能太慢了" | Improve performance | `/om:start 性能太慢了` |
| "代码结构不好" | Refactor code | `/om:start 代码结构不好` |
| "优化查询速度" | Optimize | `/om:start 优化查询速度` |
| "重构 XX 模块" | Refactor | `/om:start 重构 XX 模块` |

**Testing:**

| User Says | Intent | Action |
|-----------|--------|--------|
| "写个测试用例" | Write tests | `/om:start 写个测试用例` |
| "测试覆盖率不够" | Add tests | `/om:start 测试覆盖率不够` |
| "需要单元测试" | Add unit tests | `/om:start 需要单元测试` |

**Code Review:**

| User Says | Intent | Action |
|-----------|--------|--------|
| "帮我 review 代码" | Review code | `/om:start 帮我 review 代码` |
| "检查下代码质量" | Quality check | `/om:start 检查下代码质量` |
| "代码规范检查" | Lint check | `/om:start 代码规范检查` |

**Planning:**

| User Says | Intent | Action |
|-----------|--------|--------|
| "设计一个系统架构" | Design architecture | `/om:start 设计一个系统架构` |
| "规划下开发计划" | Plan development | `/om:start 规划下开发计划` |
| "分析下技术方案" | Analyze solution | `/om:start 分析下技术方案` |

### Keyword Triggers (Pattern-based)

**Chinese - Development:**
- `实现...` / `添加...` / `新增...` / `创建...`
- `开发...` / `构建...` / `编写...` / `设计...`
- `集成...` / `部署...` / `发布...`

**Chinese - Fixes:**
- `修复...` / `解决...` / `处理...bug`
- `报错...` / `出错...` / `失败...`

**Chinese - Improvements:**
- `优化...` / `重构...` / `改进...` / `提升...`
- `加速...` / `简化...` / `清理...`

**Chinese - Testing:**
- `测试...` / `写测试...` / `单元测试...`
- `覆盖率...` / `集成测试...`

**Chinese - Intent Markers:**
- `支持...` / `需要...` / `想要...` / `要做...`
- `有...` / `缺少...` / `没有...`

**English:**
- `implement...` / `add...` / `create...` / `build...`
- `fix...` / `bug...` / `issue...` / `error...`
- `refactor...` / `optimize...` / `improve...`
- `develop...` / `integrate...` / `support...` / `need...`
- `test...` / `write test...` / `coverage...`
- `want to...` / `would like...` / `should have...`

### File Path Triggers
- Input ends with `.md` (treated as task document)
- Input is a path to a code file with context (e.g., "review src/auth.ts")
</trigger-conditions>

<exclusions>
## When NOT to Auto-Invoke

Do NOT invoke when the user is:

- **Asking questions**: "如何..." / "怎么..." / "什么是..." / "为什么..."
- **Requesting info**: "显示..." / "列出..." / "查看..." / "读取..."
- **Navigating**: "打开..." / "进入..." / "跳转..."
- **Chatting**: "你好" / "谢谢" / "好的" / "明白了"
- **Using explicit commands**: `/om:*`, `/gsd:*`, `/superpowers:*`
- **Simple file operations**: "读取文件 X", "打开文件夹"

**Key distinction:**

| Input | Type | Action |
|-------|------|--------|
| "项目支持 Python" | Intent to ADD | ✅ Invoke |
| "这个项目支持 Python 吗?" | Question | ❌ Don't invoke |
| "写个测试" | Intent to CREATE | ✅ Invoke |
| "测试怎么写?" | Question | ❌ Don't invoke |
| "优化这个函数" | Intent to IMPROVE | ✅ Invoke |
| "这个函数是做什么的?" | Question | ❌ Don't invoke |
</exclusions>

<examples>
## Examples

**Simple Tasks (Invoke):**

| User Input | Action |
|------------|--------|
| `实现用户登录功能` | → `/om:start 实现用户登录功能` |
| `需要加个导出功能` | → `/om:start 需要加个导出功能` |
| `登录页面报错了` | → `/om:start 登录页面报错了` |
| `写个单元测试` | → `/om:start 写个单元测试` |

**Complex Tasks (Invoke - High Priority):**

| User Input | Why |
|------------|-----|
| `做个完整的用户系统，包含注册登录权限管理` | Multi-component |
| `从零搭建一个管理后台` | Multi-step project |
| `重构整个项目结构` | Complex refactoring |
| `前端用 React，后端用 Node，数据库用 MongoDB` | Full-stack work |
| `先做登录，再做权限，最后做日志` | Sequential tasks |
| `支持微信、支付宝、银行卡三种支付` | Multiple integrations |

**Questions (Don't Invoke):**

| User Input | Why |
|------------|-----|
| `这个项目支持 Python 吗?` | Question |
| `怎么实现登录?` | Question |
| `show me the config` | Info request |
| `如何配置数据库?` | Question |

**Simple Operations (Don't Invoke):**

| User Input | Why |
|------------|-----|
| `读取 package.json` | Simple file read |
| `列出所有文件` | Simple operation |
| `打开 src 目录` | Navigation |
</examples>

<process>
1. Detect user intent from input
2. If intent matches trigger conditions → invoke `/om:start` with full user input
3. If unclear or is a question → do NOT invoke, respond normally
</process>