---
name: om:upgrade
description: 自动检测项目可改进点并提供升级建议，支持交互式确认
---

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
自动扫描项目代码，检测可改进点，生成升级建议列表供用户确认后执行。支持用户提示聚焦检测方向。
</objective>

<trigger-conditions>
## 何时使用

**当用户想要:**
- 改进项目代码质量
- 查找潜在问题
- 升级项目功能
- 优化代码结构

**用户输入示例:**
- `/om:upgrade` - 自动扫描当前项目
- `/om:upgrade 性能优化` - 聚焦性能相关改进
- `/om:upgrade 安全` - 聚焦安全问题
</trigger-conditions>

<process>
1. **执行检测命令**

   调用 CLI 获取检测结果:
   ```bash
   openmatrix upgrade --json
   ```

   如果用户提供了提示，传入参数:
   ```bash
   openmatrix upgrade "用户提示" --json
   ```

2. **解析检测结果**

   结果格式:
   ```json
   {
     "projectType": "openmatrix|nodejs|typescript|...",
     "projectName": "项目名称",
     "scanPath": "/path/to/project",
     "timestamp": "2025-01-01T00:00:00.000Z",
     "suggestions": [
       {
         "id": "UPG-001",
         "category": "bug|quality|capability|ux|style|security|common",
         "priority": "critical|high|medium|low",
         "title": "建议标题",
         "description": "详细描述",
         "location": {
           "file": "src/example.ts",
           "line": 42
         },
         "suggestion": "改进建议",
         "autoFixable": true|false,
         "impact": "影响说明",
         "effort": "trivial|small|medium|large"
       }
     ],
     "summary": {
       "total": 10,
       "byCategory": { ... },
       "byPriority": { ... },
       "autoFixable": 3
     }
   }
   ```

3. **展示检测结果**

   使用 AskUserQuestion 展示结果并询问用户选择:

   ```
   📋 检测到 X 个改进建议

   🚨 关键问题 (Y 个)
   ─────────────────────
   [UPG-001] 🔒 硬编码密钥
       位置: src/config.ts:15
       建议: 使用环境变量存储敏感信息

   ⚠️ 高优先级 (Z 个)
   ─────────────────────
   ...

   💡 请选择要执行的改进:
   ```

4. **用户选择** (使用 AskUserQuestion)

   **选择模式:**
   ```typescript
   AskUserQuestion({
     questions: [{
       question: "请选择要执行的改进:",
       header: "改进选择",
       options: [
         { label: "🔴 全部执行", description: "执行所有检测到的改进" },
         { label: "🟡 仅关键+高优先级", description: "执行 critical 和 high 优先级" },
         { label: "🟢 仅可自动修复", description: "只执行 autoFixable=true 的改进" },
         { label: "📋 逐项确认", description: "每个改进单独确认" }
       ],
       multiSelect: false
     }]
   })
   ```

5. **执行改进**

   根据用户选择，生成任务并调用 `/om:start` 执行:

   **方式一: 批量执行**
   - 将选中的改进转换为任务列表
   - 调用 `/om:start` 并传递任务

   **方式二: 逐项确认**
   - 使用 AskUserQuestion 逐个询问
   - 用户确认后执行

6. **BYASS 模式支持**

   如果用户选择了"全部执行"，进入 BYPASS 模式:
   - 不再请求用户确认
   - 自动批准所有操作
   - 快速完成所有改进

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:upgrade                    # 自动扫描当前项目
/om:upgrade 性能优化           # 聚焦性能相关改进
/om:upgrade 安全问题           # 聚焦安全相关改进
/om:upgrade --auto             # 全自动执行 (无需确认)
</examples>

<notes>
## 检测类别说明

| 类别 | 说明 | 示例 |
|------|------|------|
| bug | 代码缺陷 | TODO, FIXME, 潜在bug |
| quality | 代码质量 | 过长函数, 复杂度, 重复代码 |
| capability | 缺失能力 | 缺少测试, 文档, 类型定义 |
| ux | 用户体验 | 错误提示, 帮助信息 |
| style | 代码风格 | 命名, 格式, 一致性 |
| security | 安全问题 | 硬编码密钥, SQL注入 |
| common | 常见问题 | 魔法数字, 硬编码路径 |

## 优先级说明

| 优先级 | 说明 | 处理建议 |
|--------|------|----------|
| critical | 严重问题 | 立即处理 |
| high | 重要问题 | 优先处理 |
| medium | 一般问题 | 计划处理 |
| low | 轻微问题 | 有空再处理 |

## 项目类型识别

系统自动识别以下项目类型:
- **openmatrix**: OpenMatrix 项目自身
- **nodejs**: Node.js 项目
- **typescript**: TypeScript 项目
- **python**: Python 项目
- **go**: Go 项目
- **unknown**: 未知类型

根据项目类型，检测器会调整检测策略和建议。

## 与 /om:start 的关系

`/om:upgrade` 检测完成后，可以选择将改进项传递给 `/om:start` 执行:

```
/om:upgrade
    │
    ├── 检测项目 ──→ 生成建议列表
    │
    ├── 用户选择 ──→ 筛选建议
    │
    └── 执行改进 ──→ 调用 /om:start
                        │
                        └── 正常的任务执行流程
```

## 使用场景

### 场景 1: 日常维护
```
用户: /om:upgrade
系统: 扫描项目...
      发现 15 个改进建议
      用户选择: 仅关键+高优先级
系统: 开始执行 5 个改进...
```

### 场景 2: 安全审计
```
用户: /om:upgrade 安全
系统: 扫描安全问题...
      发现 3 个安全隐患
      用户选择: 全部执行
系统: 自动修复安全问题...
```

### 场景 3: 代码重构
```
用户: /om:upgrade 重构
系统: 扫描重构机会...
      发现 10 个可优化点
      用户选择: 逐项确认
系统: 逐个展示改进建议...
```
</notes>