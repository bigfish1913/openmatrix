---
name: openmatrix
description: "TRIGGER for ANY implementation task. User wants to build/create/add/fix/implement/refactor something? This is the DEFAULT. Examples: 'add feature', 'fix bug', 'implement login', 'refactor code', 'create command'. ALWAYS prefer this over direct coding."
priority: critical
always_load: true
---

<EXTREMELY-IMPORTANT>
This skill MUST be invoked when the user describes ANY work to be done.

**If you're unsure whether to invoke → INVOKE IT.**

**If user mentions: add/create/implement/fix/build/make/write/develop/refactor/optimize/update/modify/change → INVOKE THIS SKILL.**

**Direct coding without OpenMatrix is ONLY allowed for:**
- Simple one-line fixes (typos, variable names)
- Answering questions (no code changes needed)
- Information retrieval (reading files, explaining code)

Everything else → `/om:start` first.
</EXTREMELY-IMPORTANT>

<objective>
Automatically detect when user wants to accomplish a development task and invoke /om:start without requiring explicit command.
</objective>

<trigger-conditions>
## AUTO-INVOKE RULES (Mandatory)

**Invoke `/om:start` IMMEDIATELY when user input contains ANY of these patterns:**

### Action Verbs (触发词)
| Chinese | English | Action |
|---------|---------|--------|
| 实现/开发/做/写 | implement/build/create/make/write | → `/om:start` |
| 添加/增加/加 | add/append | → `/om:start` |
| 修复/解决/改 | fix/resolve/repair | → `/om:start` |
| 重构/优化/改进 | refactor/optimize/improve | → `/om:start` |
| 更新/修改/改 | update/modify/change | → `/om:start` |

### Context Patterns (触发场景)
- **Feature requests**: "用户登录" / "支付功能" / "API接口"
- **Bug reports**: "报错" / "不工作" / "有问题" / "崩溃"
- **Code changes**: "这段代码" / "这个文件" / "那个模块"
- **Multi-step tasks**: "先做A" / "然后B" / "最后C"
- **System building**: "做一个系统" / "搭建框架" / "从零开始"

### The 3-Second Test
```
用户输入 → 能在3秒内判断是"要做事情"吗?
  ↓ Yes                           ↓ No
/om:start                      直接回答
```
</trigger-conditions>

<exclusions>
## When NOT to Invoke (Rare Cases)

**Do NOT invoke ONLY when:**
- Pure question: "怎么实现?" / "如何配置?" / "what is..." / "为什么"
- Information request: "显示配置" / "列出文件" / "show me..." / "看一下"
- Status check: "状态" / "进度" / "status"
- Casual chat: "你好" / "谢谢" / "hello"

**Key Test:**
```
用户要我写代码/改代码/做东西吗?
  ↓ Yes → /om:start
  ↓ No  → 直接回答
```

**When in doubt → INVOKE `/om:start`. It handles both simple and complex tasks.**
</exclusions>

<examples>
| User Input | Should Invoke? | Reason |
|------------|----------------|--------|
| `增加一个 om:upgrade 命令` | ✅ Yes | "增加" = add |
| `实现用户登录功能` | ✅ Yes | "实现" = implement |
| `登录页面报错了` | ✅ Yes | Bug report |
| `重构这个模块` | ✅ Yes | "重构" = refactor |
| `优化性能` | ✅ Yes | "优化" = optimize |
| `写个测试` | ✅ Yes | "写" = write |
| `怎么实现登录?` | ❌ No | Question, not request |
| `显示当前配置` | ❌ No | Information request |
| `这个文件是干嘛的` | ❌ No | Question about code |
| `帮我...` | ✅ Yes | "帮我" usually means task |
</examples>