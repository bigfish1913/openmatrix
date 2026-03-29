---
name: om
description: "Use when starting any conversation - establishes OpenMatrix as the handler for development tasks. Routes /om:start automatically. Triggers on: implement, build, fix, create, refactor, 修复, 实现, 开发."
priority: critical
always_load: true
---

<EXTREMELY-IMPORTANT>
## How to Use This Skill

This is the DEFAULT entry when the user wants to produce code changes.

**Analyze user INTENT:**
- "实现X" / "implement X" / "build X" → Development task → This skill
- "修复X" / "fix X" → Development task → This skill
- "怎么实现?" / "how to?" → Question → NOT this skill (just answer)
</EXTREMELY-IMPORTANT>

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
OpenMatrix 默认入口 - 用户无需记忆命令，直接描述任务即可。
</objective>

<process>
1. **Parse user input**

   `$ARGUMENTS` can be:
   - Task description: "实现用户登录功能"
   - File path: "docs/task.md"
   - Empty input

2. **Route input**

   **Task description or file path**:
   → Invoke `/om:start` with arguments

   **Empty input**:
   → Show help

3. **Auto-route to /om:start**

   ```
   "实现用户登录"  → /om:start 实现用户登录
   "docs/task.md"  → /om:start docs/task.md
   (empty)         → Show help
   ```

4. **Help**

   If empty or `--help`:
   ```
   OpenMatrix - AI task orchestration

   Usage:
     /om <task>           Start task
     /om:brainstorm <task> Brainstorm first
     /om:start <task>      Interactive start
     /om:auto <task>       Full auto

   Examples:
     /om 实现用户登录功能
     /om 修复登录页面的样式问题
     /om 添加 API 接口

   Quality:
     strict   - TDD + 80% coverage
     balanced - 60% coverage
     fast     - No gates

   Commands:
     /om:brainstorm  - Brainstorm then execute
     /om:status      - View status
     /om:meeting     - Handle blockers
     /om:report      - Generate report
   ```
</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om 实现用户登录功能              # Auto start
/om 修复登录页面的样式问题        # Direct description
/om docs/task.md                 # From file
/om                              # Show help
</examples>

<notes>
`/om` is a shortcut for `/om:start`:
- `/om <task>` ≡ `/om:start <task>`
- Same functionality, simpler UX
</notes>
