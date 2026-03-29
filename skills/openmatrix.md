---
name: openmatrix
description: "Use when starting any conversation where user wants development work done. Establishes how to detect development tasks and route to OpenMatrix workflow. Examples: 'implement X', 'build a game', 'fix bug', 'refactor module', 'add feature'."
priority: critical
always_load: true
---

<EXTREMELY-IMPORTANT>
## How to Detect Development Tasks

When the user's message indicates they want code produced or changed, this is a **development task** and OpenMatrix handles it.

**The Development Task Detection Flow:**
```
User message received
       │
       ▼
Is the user asking me to PRODUCE code changes?
       │
    YES ──→ OpenMatrix handles this
       │     (has its own brainstorm + plan + execute)
       │
    NO ──→ Other skills or direct answer
```

**What counts as "produce code changes":**
| Signal | Example |
|--------|---------|
| User describes a goal to implement | "实现这个游戏", "build a login page" |
| User references a spec/doc and wants it built | "@docs/require.md 实现这个游戏" |
| User reports a bug to fix | "修复登录bug", "fix the crash" |
| User wants code refactored/optimized | "重构用户模块", "optimize performance" |
| User wants a feature added | "添加API接口", "add dark mode" |

**What does NOT count:**
| Signal | Example | Route |
|--------|---------|-------|
| Asking how something works | "怎么实现?" / "how does X work?" | Direct answer |
| Requesting information | "显示配置" / "show me the code" | Direct answer |
| Checking status | "进度" / "status" | Direct answer |

**IMPORTANT:** OpenMatrix includes its own brainstorm mode (`/om:brainstorm`).
When a development task is complex (new feature, multi-module, from-scratch), use `/om:brainstorm`.
When a development task is simple (bug fix, small change, clear requirement), use `/om:start`.
</EXTREMELY-IMPORTANT>

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
Detect development task intent and route to OpenMatrix's internal workflow.
</objective>

<process>
1. **Intent Analysis**

   Determine if user wants to "do work" or "get information":

   | User Intent | Behavioral Signal | Route |
   |---------|---------|------|
   | Build something | Describes goal, cites spec to implement | → OpenMatrix |
   | Fix something | Reports problem, describes error | → OpenMatrix |
   | Change something | Points to code to modify, proposes improvement | → OpenMatrix |
   | Ask something | Question form, seeking explanation | → Direct answer |
   | View something | Status check, info retrieval | → Direct answer |

2. **Complexity Assessment**

   **Complex → `/om:brainstorm`** (explore requirements first):
   - New feature (from scratch)
   - Multi-module changes (architecture involved)
   - Unclear requirements (need to explore first)

   **Simple → `/om:start`** (clear requirements):
   - Bug fix
   - Small change
   - Single feature
   - Clear requirement

3. **Execute directly, no extra confirmation**

   After assessment, invoke the command directly.
</process>

<examples>
| User Input | Intent | Complexity | Action |
|------------|--------|------------|--------|
| `实现这个游戏` (with @file) | Build | Complex | → `/om:brainstorm` |
| `实现用户登录功能` | Build | Complex | → `/om:brainstorm` |
| `修复登录页面的样式问题` | Fix | Simple | → `/om:start` |
| `改一下这个变量名` | Change | Simple | → `/om:start` |
| `添加一个测试用例` | Build | Simple | → `/om:start` |
| `重构用户模块` | Change | Medium | → `/om:brainstorm` |
| `从零搭建后台管理` | Build | Complex | → `/om:brainstorm` |
| `怎么实现登录?` | Ask | - | ❌ Direct answer |
| `这个函数有什么问题?` | Ask | - | ❌ Direct answer |
