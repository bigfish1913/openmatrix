---
name: om:meeting
description: "Use when handling blocked tasks, technical decisions, or workflow interruptions during OpenMatrix execution. Triggers on BLOCKED/DECISION intent: user reports task is stuck, needs to make a blocking choice, or something prevents progress. DO NOT trigger on: starting tasks, debugging root causes, or status checks. Intent signals: user says 'blocked', 'stuck', 'waiting', 'cannot proceed', or describes a blocker/dependency issue."
---

<INTENT-JUDGMENT>
## 意图判断指南

**AI 应根据用户语义判断意图：**

### 触发信号（阻塞处理意图）

- 任务被阻塞无法继续
- 需要做技术决策
- 等待外部信息
- 执行中断

### 不触发信号

| 用户意图 | 应调用 |
|---------|--------|
| 开始新任务 | /om:start |
| 调查失败原因 | /om:debug |
| 查看进度 | /om:status |

### 示例判断

| 用户消息 | 判断 | 结果 |
|---------|------|------|
| "任务卡住了" | 阻塞意图 | 触发 ✓ |
| "缺少 API key" | 阻塞问题 | 触发 ✓ |
| "需要做技术决策" | 决策意图 | 触发 ✓ |
| "为什么卡住" | 调查意图 | /om:debug |
| "开始新功能" | 开发意图 | /om:start |
</INTENT-JUDGMENT>

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。

**相关技能**: `/om:start` (任务执行) | `/om:approve` (审批处理) | `/om:status` (状态查看)
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

   **先在界面展示 Meeting 列表详情，再用简短 AskUserQuestion 让用户选择：**

   AskUserQuestion: `header: "选择 Meeting"`, `multiSelect: false`
   **question:** 请选择要处理的 Meeting（详情已展示在上方）

   | label | description |
   |-------|-------------|
   | [1] TASK-001 - 数据库连接失败 | 阻塞 - 需要信息 |
   | [2] TASK-003 - API设计决策 | 决策 - 技术选型 |
   | 全部跳过 | 标记所有 Meeting 为跳过 |
   | 返回 | 暂不处理 |

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

   **使用 AskUserQuestion（阻塞详情已展示在上方）：**

   AskUserQuestion: `header: "处理阻塞"`, `multiSelect: false`
   **question:** 请选择操作

   | label | description |
   |-------|-------------|
   | 提供信息 | 提供解决问题所需的信息 |
   | 跳过任务 | 标记为可选，继续执行下游任务 |
   | 重试 | 使用新信息重试此任务 |
   | 修改方案 | 调整任务执行方案 |
   | 返回列表 | 暂不处理 |

6. **处理具体选择**

   **如果选择"提供信息":**

   AskUserQuestion: `header: "详细信息"`, `multiSelect: false`
   **question:** 请提供解决此阻塞所需的信息

   然后执行：
   ```bash
   openmatrix meeting APPR-001 --action provide-info \
     --info "数据库连接字符串是: postgresql://user:pass@host/db"
   ```

   **如果选择"跳过任务":**

   AskUserQuestion: `header: "确认"`, `multiSelect: false`
   **question:** 确定要跳过此任务吗？

   | label | description |
   |-------|-------------|
   | 确认跳过 | 标记为可选，继续下游 |
   | 取消 | 返回 |

   然后执行：
   ```bash
   openmatrix meeting APPR-001 --action skip --message "任务可选，跳过执行"
   ```

   **如果选择"重试":**
   ```bash
   openmatrix meeting APPR-001 --action retry
   ```

   **如果选择"修改方案":**

   AskUserQuestion: `header: "新方案"`, `multiSelect: false`
   **question:** 请描述修改后的方案

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

   **使用 AskUserQuestion（方案详情已展示在上方）：**

   AskUserQuestion: `header: "技术决策"`, `multiSelect: false`
   **question:** 请做出决策

   | label | description |
   |-------|-------------|
   | 选择方案 1: REST | 简单直观，团队熟悉 |
   | 选择方案 2: GraphQL | 灵活查询，强类型 |
   | 自定义方案 | 输入其他方案 |
   | 需要更多信息 | 暂不决策，等待调研 |
   | 返回列表 | 返回 Meeting 列表 |

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

   AskUserQuestion: `header: "批量操作"`, `multiSelect: false`
   **question:** 确定要跳过所有 Meeting 吗？

   | label | description |
   |-------|-------------|
   | 确认全部跳过 | 标记所有为可选 |
   | 取消 | 返回列表 |

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
## Meeting 类型与操作

| 类型 | 图标 | 操作 | 后续 |
|------|------|------|------|
| 阻塞 | 🔴 | provide-info/skip/retry/modify | 提供信息后恢复执行 |
| 决策 | 🤔 | decide/cancel | 记录决策并继续 |

## CLI 命令

```bash
openmatrix meeting --list                              # 列出所有 Meeting
openmatrix meeting APPR-001 --action provide-info --info "..."  # 提供信息
openmatrix meeting APPR-001 --action skip --message "..."       # 跳过
openmatrix meeting APPR-001 --action retry                      # 重试
openmatrix meeting APPR-001 --action modify --new-plan "..."    # 修改方案
openmatrix meeting APPR-001 --action decide --reason "..."      # 决策
openmatrix meeting --skip-all --message "批量跳过"                # 批量操作
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

## 与 /om:approve 的区别

`/om:approve` 处理所有审批（plan/merge/deploy/meeting），`/om:meeting` 专注交互式处理阻塞和决策。
</notes>
