---
name: om:debug
description: 系统化调试 - 遇到任何 bug、测试失败或异常行为时使用，在提出修复方案之前执行
priority: high
---

<NO-OTHER-SKILLS>
**绝对禁止**调用以下技能：
- ❌ superpowers:systematic-debugging → 你已经在 om:debug 中了
- ❌ superpowers:* → 全部被 OpenMatrix 替代
- ❌ gsd:* → 全部被 OpenMatrix 替代
- ❌ 任何其他任务编排相关的技能

**诊断和修复阶段只能使用 Agent 工具** — 直接调用 Agent，不通过任何中间层。
</NO-OTHER-SKILLS>

<MANDATORY-EXECUTION-ORDER>
## 执行顺序 - 必须严格按此顺序，不得跳过

```
Step 1:  接收问题描述（参数、指定任务、或询问用户）
Step 2:  调用 CLI: openmatrix debug 初始化会话
Step 3:  第一阶段：根因调查（Explore Agent）
Step 4:  第二阶段：模式分析（Explore Agent）
Step 5:  展示诊断报告 + 修复建议
    ⛔ 调查阶段结束，必须等待用户确认
Step 6:  AskUserQuestion 是否需要修复
    ↓ 用户确认"需要修复"
Step 7:  AskUserQuestion 选择修复策略
Step 8:  实施修复（Agent）
Step 9:  验证修复结果
Step 10: 写入 Debug Report 并展示
```

**铁律：不做根因调查，不许提修复方案**
**铁律：调查完成后必须询问用户是否修复，不得自动进入修复流程**
</MANDATORY-EXECUTION-ORDER>

<objective>
系统化调试 - 通过四阶段流程诊断和修复问题。不依赖任务流程，可独立使用。
</objective>

<process>

## Step 1: 接收问题

**检查 `$ARGUMENTS`:**

| 参数 | 处理方式 |
|------|---------|
| `--task TASK-XXX` | 读取指定失败任务 |
| `<问题描述>` | 直接使用描述 |
| 空 | 询问用户问题描述 |

**如果是空参数，询问：**

AskUserQuestion: `header: "问题描述"`, `multiSelect: false`
**question:** 请描述你遇到的问题

| label | description |
|-------|-------------|
| 描述问题 | 输入自由文本描述 |
| 选择失败任务 | 从当前失败任务中选择 |
| 取消 | 退出调试模式 |

**如果有失败任务（检查 .openmatrix/state.json）：**
```bash
cat .openmatrix/state.json 2>/dev/null | grep -o '"failed":[0-9]*'
```
如果 `statistics.failed > 0`，读取 `.openmatrix/tasks/` 目录找到 failed 任务并展示。

## Step 2: 调用 CLI 初始化

**带任务 ID：**
```bash
openmatrix debug --task TASK-XXX --json
```

**带描述：**
```bash
openmatrix debug "问题描述" --json
```

CLI 返回：
```json
{
  "sessionId": "DEBUG-xxx",
  "status": "diagnosing",
  "problemType": "task_failure",
  "report": {
    "description": "...",
    "relatedTaskId": "TASK-003",
    "relatedFiles": ["src/xxx.ts"]
  }
}
```

从返回结果中读取 `sessionId`，后续步骤使用此 ID。

## Step 3: 第一阶段 - 根因调查

**调用 Explore Agent：**

```typescript
Agent({
  subagent_type: "Explore",
  description: "根因调查 - 第一阶段",
  prompt: `你是调试专家。正在进行系统化调试的第一阶段：根因调查。

**铁律：在找到根因之前，不要提出任何修复方案。**

## 问题信息
- 问题类型: ${problemType}
- 问题描述: ${description}
${relatedTaskId ? `- 关联任务: ${relatedTaskId}` : ''}

## 调查步骤（必须按顺序执行）

### 1. 仔细阅读错误信息
- 不要跳过任何警告或错误
- 错误信息往往包含解决方案
- 完整阅读堆栈跟踪
- 记录行号、文件路径、错误代码

### 2. 稳定复现
- 能否可靠触发？
- 精确步骤是什么？
- 每次都会发生吗？
- 不能复现 → 收集更多数据，不要猜测

### 3. 检查近期变更
- git diff、最近提交
- 新依赖、配置变更
- 环境差异

### 4. 多组件系统诊断（如有多个组件）
**当系统有多个组件（CI → build → signing, API → service → database）：**

**在提出修复之前，添加诊断日志：**
\`\`\`
对每个组件边界：
  - 记录什么数据进入组件
  - 记录什么数据退出组件
  - 验证环境/配置传递
  - 检查每层状态

运行一次收集证据，显示哪里断裂
然后分析证据识别失败组件
然后深入调查该组件
\`\`\`

**示例（多层系统）：**
\`\`\`bash
# Layer 1: Workflow
echo "=== Secrets in workflow: ==="
echo "IDENTITY: ${IDENTITY:+SET}${IDENTITY:-UNSET}"

# Layer 2: Build script
echo "=== Env vars in build: ==="
env | grep IDENTITY || echo "IDENTITY not in env"

# Layer 3: Signing script
echo "=== Keychain state: ==="
security list-keychains

# Layer 4: Actual signing
codesign --sign "$IDENTITY" --verbose=4 "$APP"
\`\`\`

这揭示：哪层失败（secrets → workflow ✓, workflow → build ✗）

### 5. 追踪数据流
**当错误在调用栈深处：**
- 错误值从哪里产生？
- 谁传入的这个错误值？
- 继续向上追踪直到源头
- 在源头修复，不是症状处

## 输出格式
请按以下格式输出：

### 错误信息
- 错误类型: ...
- 错误位置: 文件:行号
- 错误详情: ...

### 复现步骤
1. ...

### 近期变更
- 提交1: 描述
- 提交2: 描述

### 多组件诊断结果（如适用）
- Layer N 状态: ...
- 断裂点: ...

### 根因分析
[详细描述问题根源]

### 影响范围
- 文件1
- 文件2

## 禁止行为
❌ 提出修复方案
❌ 修改任何文件
❌ 做出未经证实的假设`,
  run_in_background: false
})
```

## Step 4: 第二阶段 - 模式分析

**调用 Explore Agent：**

```typescript
Agent({
  subagent_type: "Explore",
  description: "模式分析 - 第二阶段",
  prompt: `继续进行系统化调试的第二阶段：模式分析。

## 第一阶段发现

${第一阶段根因调查的完整输出}

## 任务
1. 在代码库中找到类似的、正常工作的代码
2. 对比正常代码和异常代码的差异
3. 列出所有差异点（无论多小）
4. 理解功能依赖关系和隐含假设

## 输出格式

### 正常示例
- 文件: path:line
- 说明: 为什么这段代码能正常工作

### 差异点
1. 差异1: 正常代码 vs 异常代码
2. 差异2: ...

### 依赖关系
- 需要哪些前置条件
- 有哪些隐含假设`,
  run_in_background: false
})
```

## Step 5: 展示诊断报告

**第一阶段和第二阶段完成后，展示诊断报告：**

```
🔍 诊断报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

问题类型: xxx

根因分析
  [来自第一阶段调查的根因描述]

正常示例
  文件: path:line
  说明: ...

差异点
  1. ...
  2. ...

影响范围
  - 文件1
  - 文件2

修复建议
  [基于差异分析的具体修复建议]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Step 6: 确认是否修复

**⛔ 调查阶段结束，必须在此暂停等待用户确认。不得跳过此步骤自动进入修复。**

AskUserQuestion: `header: "是否修复"`, `multiSelect: false`
**question:** 调查已完成，是否需要修复？

| label | description |
|-------|-------------|
| 需要修复 | 选择修复策略并执行 |
| 仅查看报告 | 不修复，仅输出诊断报告后结束 |
| 继续深入调查 | 根因不够清晰，继续调查 |

**用户选择 "继续深入调查"** → 回到 Step 3，带着新信息重新调查。
**用户选择 "仅查看报告"** → 跳到 Step 10，输出诊断报告后结束。

## Step 7: 选择修复策略

**仅在用户选择"需要修复"后执行此步骤。**

AskUserQuestion: `header: "修复策略"`, `multiSelect: false`
**question:** 选择修复策略？

| label | description |
|-------|-------------|
| 自动修复 (推荐) | 调用 Agent 执行修复 |
| 手动修复 | 仅展示具体修复建议，用户自行修改 |

## Step 8: 实施修复

**如果用户选择自动修复：**

**修复前安全检查（必须执行）：**
```bash
git status --porcelain
git log --oneline -5
```

```typescript
Agent({
  subagent_type: "general-purpose",
  description: "实施 bug 修复",
  prompt: `根据诊断报告执行修复。

## 铁律
1. 只实施单一修复（不要做额外改动）
2. 每次只改一个变量
3. 不在诊断不清的情况下盲目尝试
4. 不做"顺便"的重构

## 诊断报告
${诊断报告全文}

## 修复建议
${suggestedFix}

## 任务
1. 根据修复建议实施修改
2. 确保修改范围最小化
3. 完成后输出修改了哪些文件和具体改动

## 禁止行为
❌ 修改与修复无关的文件
❌ 进行额外的重构
❌ 同时修复多个问题`,
  run_in_background: false
})
```

**Agent 完成后：**
1. 检查 Git 状态
2. 提交修复（如果文件有变更）
3. 进入 Step 9 验证

## Step 9: 验证修复

**根据问题类型选择验证方式：**

| 问题类型 | 验证方式 |
|---------|---------|
| task_failure | 重新运行失败任务或相关测试 |
| project_bug | 运行相关测试或构建 |
| system_bug | 验证 CLI 功能 |
| environment | 检查依赖安装状态 |

**任务失败：**
```bash
# 运行相关测试
npm test -- --run 2>&1 | tail -20
```

**项目 bug：**
```bash
npm run build 2>&1 | tail -10
```

**环境：**
```bash
npm ls --depth=0 2>&1 | tail -20
```

**验证结果判断：**
- 测试全通过 / 构建成功 → 验证通过
- 仍有失败 / 构建失败 → 验证未通过

AskUserQuestion: `header: "验证结果"`, `multiSelect: false`
**question:** 修复验证通过了吗？

| label | description |
|-------|-------------|
| 通过 | 修复成功，记录报告 |
| 未通过 | 修复未生效，重新分析 |
| 部分通过 | 部分修复，继续诊断 |

**如果验证未通过：**
- 重试计数 +1
- **< 3 次** → 回到 Step 3（带着新信息重新分析）
- **>= 3 次** → 输出"已尝试 3 次以上修复，建议暂停并质疑架构"，进入 Step 10

## Step 10: 写入 Debug Report

完成调试会话：
```bash
openmatrix debug --list
```

**生成诊断报告文件（在界面输出）：**

```markdown
# Debug Report

**会话 ID**: ${sessionId}
**日期**: ${timestamp}
**状态**: ${status}

## 问题描述
${description}

## 问题类型
${problemType}

## 诊断结果
### 根因
${rootCause}

### 影响范围
${impactScope}

## 修复操作
${operations}

## 验证结果
${verifyResult}

## 经验教训
${lessons}
```

**Git 提交修复（如果有文件变更）：**
```bash
git status --porcelain
# 如果有未提交文件：
git add -A && git commit -m "$(cat <<'EOF'
fix: 修复 bug - 问题描述

根因: ...
修复: ...

影响范围: ...
文件改动: ...

Co-Authored-By: OpenMatrix https://github.com/bigfish1913/openmatrix
EOF
)"
```

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:debug                          # 交互式调试
/om:debug --task TASK-003          # 调试指定失败任务
/om:debug "API 返回 500 错误"      # 带问题描述调试
</examples>

<notes>
## 四阶段流程

```
Step 1: 接收问题
    ↓
Step 2: CLI 初始化会话
    ↓
Step 3: 第一阶段 - 根因调查（只读）
    ↓
Step 4: 第二阶段 - 模式分析（只读）
    ↓
Step 5: 展示诊断报告 + 修复建议
    ↓
    ⛔ 调查阶段结束 — 必须等待用户确认
    ↓
Step 6: AskUserQuestion 是否需要修复
    ├─ "仅查看报告" → Step 10 输出报告
    ├─ "继续深入调查" → 回到 Step 3
    └─ "需要修复" ↓
Step 7: AskUserQuestion 选择修复策略
    ↓
Step 8: 实施修复
    ↓
Step 9: 验证修复结果
    ├─ 未通过 (< 3次) → 回到 Step 3
    ├─ 未通过 (>= 3次) → Step 10
    └─ 通过 ↓
Step 10: 写入 Debug Report
```

## 铁律

**不做根因调查，不许提修复方案**

## 红线

- 3 次修复失败 → 暂停，质疑架构
- 不修改未关联的文件
- 单一修复原则
- 修复前必须有验证方法

## 红旗警告 - 停止并回归流程

**如果发现自己在想：**
- "先快速修复，之后再调查"
- "试试改 X 看看能不能工作"
- "一次改多处，跑测试"
- "跳过测试，手动验证就行"
- "大概是 X 问题，直接修吧"
- "不太懂但这可能有用"
- "模式说 X 但我要改动一下"
- "这里列出主要问题：[未经调查直接列修复]"
- 提出解决方案前没有追踪数据流
- **"再试一次修复"（已经试过 2+ 次）**
- 每次修复揭示新地方的问题

**所有这些意味着：停止。回到 Step 3。**

## 常见借口 vs 真实情况

| 借口 | 真实情况 |
|------|---------|
| "问题简单，不需要流程" | 简单问题也有根因。流程处理简单 bug 很快。 |
| "紧急情况，没时间走流程" | 系统化调试比瞎猜乱试更快。 |
| "先试试这个，再调查" | 第一次修复定基调。从一开始就做对。 |
| "确认修复有效后再写测试" | 没测试的修复不牢靠。先写测试证明它。 |
| "一次改多处节省时间" | 无法隔离哪个有效。还会引入新 bug。 |
| "参考文档太长，我按模式改改" | 一知半解必然有 bug。完整阅读。 |
| "我看到问题了，直接修吧" | 看到症状 ≠ 理解根因。 |
| "再试一次修复"（失败 2+ 次后） | 3+ 次失败 = 架构问题。质疑模式，不要继续修。 |

## 3+ 次修复失败：质疑架构

**指示架构问题的模式：**
- 每次修复揭示新共享状态/耦合/其他地方的问题
- 修复需要"大规模重构"才能实现
- 每次修复在其他地方产生新症状

**停止并质疑根本问题：**
- 这个模式根本上是否合理？
- 我们是否"靠惯性硬撑"？
- 应该重构架构还是继续修补症状？

**在尝试更多修复之前与用户讨论。**

这不是假设失败 — 这是架构错误。

## 无根因的情况

如果系统化调查揭示问题确实是环境、时序依赖或外部因素：

1. 你已完成流程
2. 记录调查了什么
3. 实现适当处理（重试、超时、错误消息）
4. 添加监控/日志以便未来调查

**但：** 95% 的"无根因"情况是调查不完整。

## 实际影响

来自调试实践：
- 系统化方法：15-30 分钟修复
- 随机修复方法：2-3 小时折腾
- 首次修复率：95% vs 40%
- 引入新 bug：接近零 vs 常见
</notes>
