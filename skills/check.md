---
name: check
description: 自动检测项目可改进点并提供升级建议，用户确认后自动执行
---

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
自动扫描项目代码，检测可改进点，以文档形式展示结果，用户确认后自动调用 /om:start 执行改进。
</objective>

<trigger-conditions>
## 何时使用

**当用户想要:**
- 改进项目代码质量
- 查找潜在问题
- 升级项目功能
- 优化代码结构
- 检查 AI 项目配置

**用户输入示例:**
- `/check` - 自动扫描当前项目
- `/check 性能优化` - 聚焦性能相关改进
- `/check 安全` - 聚焦安全问题
</trigger-conditions>

<process>
1. **执行检测命令**

   调用 CLI 获取检测结果:
   ```bash
   openmatrix check --json
   ```

   如果用户提供了提示，传入参数:
   ```bash
   openmatrix check "用户提示" --json
   ```

2. **解析检测结果**

   结果格式:
   ```json
   {
     "projectType": "openmatrix|ai-project|nodejs|typescript|python|go|rust|java|csharp|cpp|php|dart",
     "projectName": "项目名称",
     "suggestions": [
       {
         "id": "UPG-001",
         "category": "bug|quality|capability|ux|style|security|common|prompt|skill|agent",
         "priority": "critical|high|medium|low",
         "title": "建议标题",
         "description": "详细描述",
         "location": { "file": "src/example.ts", "line": 42 },
         "suggestion": "改进建议"
       }
     ],
     "summary": { "total": 10, "byCategory": {...}, "autoFixable": 3 }
   }
   ```

3. **以文档形式展示检测结果**

   **不要使用 AskUserQuestion**，直接输出 markdown 格式的检测报告:

   ```markdown
   # 📋 项目检查报告

   **项目**: [projectName]
   **类型**: [projectType]
   **检测时间**: [timestamp]

   ---

   ## 📊 检测摘要

   | 类别 | 数量 |
   |------|------|
   | 🔴 Critical | X |
   | 🟠 High | X |
   | 🟡 Medium | X |
   | 🟢 Low | X |
   | **总计** | **X** |

   ---

   ## 🔍 详细问题列表

   ### 🔴 Critical (critical级别问题)

   1. **[title]**
      - 📁 位置: `file:line`
      - 📝 描述: [description]
      - 💡 建议: [suggestion]

   ### 🟠 High (high级别问题)

   ...

   ### 🟡 Medium (medium级别问题)

   ...

   ---

   **是否继续？**
   ```

   如果没有发现问题:
   ```
   ✅ 未发现问题，项目状态良好！
   ```

4. **等待用户确认**

   展示报告后，等待用户回复。用户回复确认词语（如"是"、"继续"、"好"、"可以"等）即执行下一步。

5. **调用 /om:start 执行改进**

   用户确认后，将建议转换为任务描述，调用 /om:start:

   ```typescript
   // 生成任务描述
   const taskDescription = `
   ## 项目改进任务

   根据检测结果，需要修复以下问题:

   ${suggestions.map((s, i) => `
   ### ${i + 1}. ${s.title}
   - 类别: ${s.category}
   - 优先级: ${s.priority}
   - 位置: ${s.location.file}${s.location.line ? `:${s.location.line}` : ''}
   - 建议: ${s.suggestion}
   `).join('\n')}

   请逐一修复这些问题。
   `;

   // 调用 /om:start
   Skill({ skill: "om:start", args: taskDescription });
   ```

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/check                    # 自动扫描 → 展示报告 → 用户回复"是" → 自动执行
/check 安全               # 聚焦安全问题 → 展示报告 → 用户回复"继续" → 自动修复
</examples>

<notes>
## 执行流程图

```
/check
    │
    ├── 1. 检测项目 ──→ 生成建议列表
    │
    ├── 2. 展示报告 ──→ 输出 Markdown 格式的检测报告
    │                   (不使用交互式对话框，让用户能看到完整文档)
    │
    ├── 3. 等待确认 ──→ 用户回复 "是" 或 "继续"
    │
    └── 4. 自动执行 ──→ 调用 /om:start
                            │
                            ├── 任务规划
                            ├── 代码修改
                            ├── 质量验证
                            └── 完成 ✅
```

## 检测类别说明

| 类别 | 说明 | 示例 |
|------|------|------|
| 🐛 bug | 代码缺陷 | TODO, FIXME, 潜在bug |
| 🔧 quality | 代码质量 | 过长函数, 复杂度 |
| 📦 capability | 缺失能力 | 缺少测试, 文档 |
| 🔒 security | 安全问题 | 硬编码密钥, SQL注入 |
| 🤖 prompt | Prompt 问题 | 注入风险, 缺少格式 |
| ⚡ skill | Skill 问题 | 缺少 frontmatter |
| 🧠 agent | Agent 配置 | CLAUDE.md 缺少构建命令 |

## 为什么不用交互式对话框？

交互式对话框（AskUserQuestion）会遮挡检测报告，用户无法完整查看问题详情。

改为直接输出 Markdown 报告，用户可以:
1. 完整查看所有检测到的问题
2. 仔细阅读每个问题的描述和建议
3. 自由决定是否执行修复
4. 简单回复确认即可开始执行
</notes>