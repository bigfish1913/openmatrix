---
name: om
description: "DEFAULT entry for OpenMatrix. Use for ANY task user wants done. Triggers on: 实现/添加/修复/重构/优化/写/做/开发. Example: '实现登录' → /om:start 实现登录. When in doubt, use this."
priority: critical
always_load: true
---

<EXTREMELY-IMPORTANT>
This is the DEFAULT action for ANY development task.

**Trigger immediately when user wants to:**
- Build/create/implement something
- Add new features or functionality
- Fix bugs or resolve issues
- Refactor or optimize code
- Make changes to the codebase

**If you're unsure → USE `/om` anyway. It gracefully handles all task types.**
</EXTREMELY-IMPORTANT>

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
OpenMatrix 的默认入口 - 自动启动任务编排。

**核心价值：**
- 用户无需记忆命令，直接描述任务即可
- 自动识别任务类型并启动相应流程
- 支持中英文混合输入

**触发优先级：最高**
- 任何"要做事情"的输入都应触发此技能
- 系统会自动判断是执行任务还是回答问题
</objective>

<process>
1. **解析用户输入**

   用户输入 `$ARGUMENTS` 可能是：
   - 任务描述 (如 "实现用户登录功能")
   - 文件路径 (如 "docs/task.md")
   - 空输入

2. **判断输入类型**

   **如果是任务描述或文件路径**:
   → 直接调用 `/om:start` 并传递参数

   **如果是空输入**:
   → 显示帮助信息

3. **自动启动 /om:start**

   无论用户输入什么，都自动转换为 `/om:start` 调用：

   ```
   用户输入: "实现用户登录"
   系统执行: /om:start 实现用户登录

   用户输入: "docs/task.md"
   系统执行: /om:start docs/task.md

   用户输入: (空)
   系统显示: 帮助信息
   ```

4. **帮助信息**

   如果用户输入为空或输入 `--help`，显示：

   ```
   📦 OpenMatrix - AI 任务编排系统

   用法:
     /om <任务描述>        直接启动任务
     /om:start <任务>      交互式启动 (可选质量级别)
     /om:auto <任务>       全自动执行

   示例:
     /om 实现用户登录功能
     /om 修复登录页面的样式问题
     /om 添加 API 接口

   质量级别:
     🚀 strict   - TDD + 80%覆盖率 (生产代码)
     ⚖️ balanced - 60%覆盖率 (日常开发)
     ⚡ fast     - 无质量门禁 (快速原型)

   其他命令:
     /om:status  - 查看状态
     /om:meeting - 处理阻塞
     /om:report  - 生成报告
   ```

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om 实现用户登录功能              # 自动启动任务编排
/om 修复登录页面的样式问题        # 直接描述任务
/om docs/task.md                 # 从文件读取任务
/om                              # 显示帮助
</examples>

<notes>
## 工作原理

```
用户输入: /om 实现登录
     │
     ▼
┌─────────────────┐
│ 检测到任务描述   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 自动调用        │
│ /om:start       │
│ 实现登录        │
└─────────────────┘
```

## 与 /om:start 的关系

`/om` 是 `/om:start` 的快捷方式：
- `/om <任务>` ≡ `/om:start <任务>`
- 用户体验更简洁
- 功能完全相同

## 推荐用法

```bash
# 快速启动 (推荐)
/om 实现用户登录

# 等价于
/om:start 实现用户登录

# 全自动模式
/om:auto 实现用户登录
```
</notes>
