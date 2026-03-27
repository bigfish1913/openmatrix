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

Everything else → smart selection between `/om:brainstorm` and `/om:start`.
</EXTREMELY-IMPORTANT>

<objective>
Automatically detect when user wants to accomplish a development task and intelligently choose between brainstorm (for complex tasks) or start (for simple tasks).
</objective>

<process>
1. **询问是否启用智能选择**

   使用 AskUserQuestion 询问用户:
   ```
   问题: 是否启用智能模式？
   选项:
   - 🧠 智能选择 (推荐) - 自动判断任务复杂度，选择 brainstorm 或 start
   - 🚀 直接执行 - 跳过头脑风暴，直接开始任务
   - 🧐 先探索需求 - 强制使用头脑风暴模式
   ```

2. **根据选择执行不同流程**

   **选择"智能选择"**:
   - 分析任务复杂度
   - 展示推断结果，让用户确认或修改
   - 执行选择的命令

   **选择"直接执行"**:
   - 直接调用 /om:start

   **选择"先探索需求"**:
   - 直接调用 /om:brainstorm

3. **智能分析（如果启用）**

   **复杂任务** (满足任一条件):
   - 新功能开发: "实现用户登录" / "添加支付功能"
   - 多模块改动: "重构用户系统" / "优化整体性能"
   - 架构相关: "搭建框架" / "从零开始"
   - 关键词: "系统" / "架构" / "模块" / "集成" / "完整"

   **简单任务** (满足任一条件):
   - Bug 修复: "修复登录bug" / "解决样式问题"
   - 小改动: "修改文案" / "改变量名"
   - 单一功能: "添加一个按钮" / "写个工具函数"
   - 关键词: "修复" / "解决" / "改" / "调整" / "简单"

4. **展示推断结果并确认**

   使用 AskUserQuestion 展示推断结果:
   ```
   问题: 检测到这是一个【复杂/简单】任务，将使用【brainstorm/start】模式
   选项:
   - ✅ 确认执行 - 使用推荐的模式
   - 🧠 改用头脑风暴 - 先探索需求再执行
   - 🚀 改用直接执行 - 跳过探索直接开始
   - ✏️ 自定义输入 - 输入其他指令
   ```

5. **执行选择的命令**
</process>

<trigger-conditions>
## AUTO-INVOKE RULES (Mandatory)

**Invoke IMMEDIATELY when user input contains ANY of these patterns:**

### Action Verbs (触发词)
| Chinese | English | Action |
|---------|---------|--------|
| 实现/开发/做/写 | implement/build/create/make/write | → Smart Select |
| 添加/增加/加 | add/append | → Smart Select |
| 修复/解决/改 | fix/resolve/repair | → Smart Select |
| 重构/优化/改进 | refactor/optimize/improve | → Smart Select |
| 更新/修改/改 | update/modify/change | → Smart Select |

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
Smart Select                    直接回答
```
</trigger-conditions>

<smart-selection>
## 智能选择：Brainstorm vs Start

**根据任务复杂度自动选择执行路径：**

### 🧠 复杂任务 → `/om:brainstorm`
**触发条件 (满足任一):**
- 新功能开发: "实现用户登录" / "添加支付功能" / "开发 API"
- 多模块改动: "重构用户系统" / "优化整体性能"
- 架构相关: "搭建框架" / "从零开始" / "设计架构"
- 不确定因素: 需要技术选型、涉及多种方案选择
- 关键词: "系统" / "架构" / "模块" / "集成" / "完整" / "从零"

### 🚀 简单任务 → `/om:start`
**触发条件 (满足任一):**
- Bug 修复: "修复登录bug" / "解决样式问题" / "改个报错"
- 小改动: "修改文案" / "改变量名" / "调整配置"
- 单一功能: "添加一个按钮" / "写个工具函数"
- 明确需求: 需求清晰，无需额外探索
- 关键词: "修复" / "解决" / "改" / "调整" / "小" / "简单"

### 选择流程
```
用户输入任务描述
       │
       ▼
┌─────────────────────┐
│ 分析任务复杂度        │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
  复杂任务     简单任务
     │           │
     ▼           ▼
/om:brainstorm  /om:start
```

### 判断示例
| 用户输入 | 复杂度 | 执行路径 |
|---------|--------|---------|
| "实现用户登录功能" | 复杂 | `/om:brainstorm` |
| "做一个完整的支付系统" | 复杂 | `/om:brainstorm` |
| "从零搭建后台管理" | 复杂 | `/om:brainstorm` |
| "修复登录页面的样式问题" | 简单 | `/om:start` |
| "改一下这个变量名" | 简单 | `/om:start` |
| "添加一个测试用例" | 简单 | `/om:start` |
| "重构这个模块" | 中等 | `/om:brainstorm` (保守选择) |
| "优化性能" | 中等 | `/om:brainstorm` (保守选择) |

**不确定时的默认选择: `/om:brainstorm`** (宁可多问，不可漏问)
</smart-selection>

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
  ↓ Yes → Smart Select (brainstorm/start)
  ↓ No  → 直接回答
```

**When in doubt → INVOKE. It handles both simple and complex tasks.**
</exclusions>

<examples>
| User Input | Complexity | Action |
|------------|------------|--------|
| `实现用户登录功能` | 复杂 | → `/om:brainstorm` |
| `做一个完整的订单系统` | 复杂 | → `/om:brainstorm` |
| `修复登录页面的样式问题` | 简单 | → `/om:start` |
| `改一下这个变量名` | 简单 | → `/om:start` |
| `重构用户模块` | 中等 | → `/om:brainstorm` |
| `怎么实现登录?` | - | ❌ Question, not task |