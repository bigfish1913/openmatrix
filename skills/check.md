---
name: check
description: 自动检测项目可改进点并提供升级建议，支持交互式确认后自动执行
---

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
自动扫描项目代码，检测可改进点，用户确认后自动调用 /om:start 执行改进。
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

3. **展示检测结果并询问用户**

   如果没有发现问题，提示用户并结束:
   ```
   ✅ 未发现问题，项目状态良好！
   ```

   如果发现问题，使用 AskUserQuestion 展示结果:
   ```typescript
   AskUserQuestion({
     questions: [{
       question: "检测到 X 个改进建议，请选择执行方式:",
       header: "执行方式",
       options: [
         { label: "🔴 全部执行 (推荐)", description: "自动执行所有检测到的改进" },
         { label: "🟡 仅关键+高优先级", description: "只执行 critical 和 high 优先级" },
         { label: "🟢 仅可自动修复", description: "只执行 autoFixable=true 的改进" },
         { label: "📋 查看详情后决定", description: "逐项查看后手动选择" }
       ],
       multiSelect: false
     }]
   })
   ```

4. **用户选择后自动执行**

   **重要**: 用户选择后，**立即自动调用 /om:start 执行**，无需再次确认。

   根据用户选择筛选建议:
   - "全部执行" → 使用所有 suggestions
   - "仅关键+高优先级" → 过滤 priority 为 critical/high
   - "仅可自动修复" → 过滤 autoFixable 为 true
   - "查看详情" → 逐项展示，用户选择后执行

5. **调用 /om:start 执行改进**

   将选中的建议转换为任务描述，调用 /om:start:

   ```typescript
   // 生成任务描述
   const taskDescription = `
## 项目改进任务

根据检测结果，需要修复以下问题:

${selectedSuggestions.map((s, i) => `
### ${i + 1}. ${s.title}
- 类别: ${s.category}
- 优先级: ${s.priority}
- 位置: ${s.location.file}${s.location.line ? `:${s.location.line}` : ''}
- 建议: ${s.suggestion}
`).join('\n')}

请逐一修复这些问题。
   `;

   // 调用 /om:start
   // 使用 Skill 工具调用 /om:start
   Skill({ skill: "om:start", args: taskDescription });
   ```

6. **BYPASS 模式**

   如果用户选择了"全部执行"，进入 BYPASS 模式:
   - 自动批准所有操作
   - 不再请求用户确认
   - 快速完成所有改进

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/check                    # 自动扫描 → 用户确认 → 自动执行
/check 安全               # 聚焦安全问题 → 用户确认 → 自动修复
/check --auto             # 全自动执行 (无确认)
</examples>

<notes>
## 执行流程图

```
/check
    │
    ├── 1. 检测项目 ──→ 生成建议列表
    │
    ├── 2. 展示结果 ──→ 用户选择执行方式
    │
    ├── 3. 用户确认 ──→ 选择"全部执行"
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

## 与 /om:start 的关系

`/check` 检测完成后，**自动**将改进项传递给 `/om:start` 执行:

```
用户: /check
系统: 检测到 5 个问题...
      [展示问题列表]
      请选择执行方式: [全部执行]
系统: 正在调用 /om:start 执行改进...
      → 任务规划中...
      → 执行改进...
      → 完成!
```

**用户只需确认一次，后续全自动执行。**
</notes>