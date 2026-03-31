---
name: om:meeting
description: 查看和处理所有待确认的 Meeting（阻塞问题和决策点）
---

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
查看所有执行过程中记录的 Meeting，以交互式方式让用户确认或提供解决方案。
</objective>

<process>
1. **获取 Meeting 列表**
   ```bash
   openmatrix meeting --list
   ```

2. **如果没有待处理 Meeting**
   ```
   ✅ 没有待处理的 Meeting

   当前状态:
   - 已解决: X
   - 总计: Y
   ```

3. **展示 Meeting 列表**
   ```
   📋 待处理 Meeting (X个)

   ┌─────────────────────────────────────────┐
   │ [1] 🔴 TASK-001 - 数据库连接失败          │
   │     阻塞原因: 无法连接到远程数据库         │
   │     影响: 2个下游任务                     │
   │                                         │
   │ [2] 🤔 TASK-003 - API设计决策             │
   │     问题: 选择 REST 还是 GraphQL         │
   │     方案: 待决策                          │
   │                                         │
   │ [3] 🔴 TASK-005 - 第三方API密钥缺失        │
   │     阻塞原因: 需要申请 API Key           │
   │     影响: 1个下游任务                     │
   └─────────────────────────────────────────┘
   ```

4. **使用 AskUserQuestion 选择处理哪个 Meeting**

   ```typescript
   AskUserQuestion({
     questions: [{
       question: "请选择要处理的 Meeting:",
       header: "选择 Meeting",
       options: [
         { label: "[1] TASK-001 - 数据库连接失败", description: "阻塞 - 需要信息" },
         { label: "[2] TASK-003 - API设计决策", description: "决策 - 技术选型" },
         { label: "[3] TASK-005 - API密钥缺失", description: "阻塞 - 需要信息" },
         { label: "全部跳过", description: "标记所有 Meeting 为跳过" },
         { label: "返回", description: "暂不处理" }
       ],
       multiSelect: false
     }]
   })
   ```

5. **处理单个 Meeting**

   根据 Meeting 类型展示不同的选项：

   **🔴 阻塞问题 Meeting:**
   ```
   📋 Meeting: APPR-001
   🎯 任务: TASK-001 - 数据库连接失败

   ## 阻塞详情

   **原因**: 无法连接到远程数据库
   **尝试**: 已检查网络连通性，防火墙已放行
   **时间**: 2024-03-25 10:30:00

   ## 影响范围

   - TASK-002: 用户数据同步 (依赖 TASK-001)
   - TASK-004: 数据备份任务 (依赖 TASK-001)

   ## 可用操作

   [A] 💡 提供信息 - 提供解决问题所需的信息
   [B] ⏭️ 跳过任务 - 标记此任务为可选，继续下游
   [C] 🔄 重试 - 使用新信息重试此任务
   [D] ✏️ 修改方案 - 调整任务执行方案
   ```

   **使用 AskUserQuestion:**
   ```typescript
   AskUserQuestion({
     questions: [{
       question: "请选择操作:",
       header: "处理阻塞",
       options: [
         { label: "💡 提供信息", description: "提供解决问题所需的信息" },
         { label: "⏭️ 跳过任务", description: "标记为可选，继续执行下游任务" },
         { label: "🔄 重试", description: "使用新信息重试此任务" },
         { label: "✏️ 修改方案", description: "调整任务执行方案" },
         { label: "返回列表", description: "暂不处理" }
       ],
       multiSelect: false
     }]
   })
   ```

6. **处理具体选择**

   **如果选择"提供信息":**
   ```typescript
   AskUserQuestion({
     questions: [{
       question: "请提供解决此阻塞所需的信息:",
       header: "详细信息",
       options: [], // 允许自由输入
       multiSelect: false
     }]
   })
   ```

   然后执行：
   ```bash
   openmatrix meeting APPR-001 --action provide-info \
     --info "数据库连接字符串是: postgresql://user:pass@host/db"
   ```

   **如果选择"跳过任务":**
   ```typescript
   AskUserQuestion({
     questions: [{
       question: "确定要跳过此任务吗？",
       header: "确认",
       options: [
         { label: "确认跳过", description: "标记为可选，继续下游" },
         { label: "取消", description: "返回" }
       ],
       multiSelect: false
     }]
   })
   ```

   然后执行：
   ```bash
   openmatrix meeting APPR-001 --action skip --message "任务可选，跳过执行"
   ```

   **如果选择"重试":**
   ```bash
   openmatrix meeting APPR-001 --action retry
   ```

   **如果选择"修改方案":**
   ```typescript
   AskUserQuestion({
     questions: [{
       question: "请描述修改后的方案:",
       header: "新方案",
       options: [], // 允许自由输入
       multiSelect: false
     }]
   })
   ```

   然后执行：
   ```bash
   openmatrix meeting APPR-001 --action modify \
     --new-plan "使用本地 SQLite 替代 PostgreSQL"
   ```

7. **处理决策型 Meeting**

   **🤔 技术决策 Meeting:**
   ```
   📋 Meeting: APPR-002
   🎯 任务: TASK-003 - API 设计决策

   ## 决策问题

   **问题**: 选择 REST 还是 GraphQL?

   ## 可选方案

   **方案 1: REST API** (推荐)
   - ✅ 简单直观，团队熟悉
   - ✅ 调试方便
   - ❌ 可能需要多次请求

   **方案 2: GraphQL**
   - ✅ 灵活查询，一次请求
   - ✅ 强类型
   - ❌ 学习成本较高
   - ❌ 需要额外工具

   ## 操作

   [A] 选择方案 1 - REST (推荐)
   [B] 选择方案 2 - GraphQL
   [C] 自定义方案
   ```

   **使用 AskUserQuestion:**
   ```typescript
   AskUserQuestion({
     questions: [{
       question: "请做出决策:",
       header: "技术决策",
       options: [
         { label: "选择方案 1: REST", description: "简单直观，团队熟悉" },
         { label: "选择方案 2: GraphQL", description: "灵活查询，强类型" },
         { label: "自定义方案", description: "输入其他方案" },
         { label: "需要更多信息", description: "暂不决策，等待调研" },
         { label: "返回列表", description: "返回 Meeting 列表" }
       ],
       multiSelect: false
     }]
   })
   ```

   执行决策：
   ```bash
   openmatrix meeting APPR-002 --action decide \
     --reason "选择 REST，团队熟悉，快速开发"
   ```

8. **处理完成**

   处理一个 Meeting 后：
   ```
   ✅ Meeting APPR-001 已解决

   操作: 提供信息
   状态: 任务已恢复执行

   📋 剩余 Meeting (2个):
   - APPR-002: API设计决策
   - APPR-003: API密钥缺失

   是否继续处理? [Y/n]: _
   ```

   如果是 "跳过" 或 "取消"：
   ```
   ⏭️ Meeting APPR-001 已跳过

   任务 TASK-001 标记为可选
   下游任务可继续执行

   📋 剩余 Meeting (2个): ...
   ```

9. **批量处理**

   如果选择"全部跳过":
   ```typescript
   AskUserQuestion({
     questions: [{
       question: "确定要跳过所有 Meeting 吗？",
       header: "批量操作",
       options: [
         { label: "确认全部跳过", description: "标记所有为可选" },
         { label: "取消", description: "返回列表" }
       ],
       multiSelect: false
     }]
   })
   ```

   ```bash
   openmatrix meeting --skip-all --message "批量跳过"
   ```

</process>

<arguments>
$ARGUMENTS

- 无参数: 列出所有待处理 Meeting
- Meeting ID: 直接处理指定 Meeting
</arguments>

<examples>
/om:meeting              # 查看所有待处理 Meeting
/om:meeting APPR-001     # 直接处理指定 Meeting
</examples>

<notes>
## Meeting 类型

| 类型 | 图标 | 说明 |
|------|------|------|
| 阻塞 | 🔴 | 任务执行遇到阻塞，需要信息或决策 |
| 决策 | 🤔 | 技术选型或设计方案决策 |

## 操作类型

| 操作 | 说明 | 后续 |
|------|------|------|
| provide-info | 提供解决信息 | 任务恢复执行 |
| skip | 跳过任务 | 标记可选，下游继续 |
| retry | 重试任务 | 重新执行当前任务 |
| modify | 修改方案 | 更新任务后重试 |
| decide | 做出决策 | 记录决策并继续 |
| cancel | 取消任务 | 停止相关下游任务 |

## CLI 命令

```bash
# 列出所有 Meeting
openmatrix meeting --list

# 处理指定 Meeting
openmatrix meeting APPR-001 --action provide-info --info "..."
openmatrix meeting APPR-001 --action skip --message "..."
openmatrix meeting APPR-001 --action retry
openmatrix meeting APPR-001 --action modify --new-plan "..."
openmatrix meeting APPR-001 --action decide --reason "选择方案A，因为..."
openmatrix meeting APPR-001 --action cancel --message "取消执行"

# 批量操作
openmatrix meeting --skip-all --message "批量跳过"
```

## 与执行循环的关系

```
执行任务中...
├── 任务A 完成 ✓
├── 任务B 阻塞 → 创建Meeting → 跳过，继续
└── 任务C 完成 ✓

执行完成!
📋 有待处理的 Meeting (1个)
        ↓
用户执行 /om:meeting
        ↓
交互式处理 Meeting
├── 提供信息 / 跳过 / 重试
└── 解决阻塞
        ↓
恢复执行或标记完成
```

## 与 start 的集成

执行 `/om:start` 时：
1. 阻塞任务自动跳过，创建 Meeting 记录
2. 非阻塞任务继续执行，最大化并行度
3. 所有非阻塞任务完成后，自动提示有待处理的 Meeting
4. 用户使用 `/om:meeting` 统一处理阻塞问题

**全自动执行模式下的 Meeting 流程:**
```
/om:start → 执行任务 → 遇到阻塞 → 创建 Meeting → 跳过阻塞 → 继续执行其他任务
          ↓
所有非阻塞任务完成 → 提示 Meeting → /om:meeting → 用户处理 → 完成
```
</notes>
