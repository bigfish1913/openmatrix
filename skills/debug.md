---
name: om:debug
description: "Use when user encounters ANY technical problem and needs systematic diagnosis. Triggers on PROBLEM-EXPLORATION intent: user wants to understand WHY something failed, investigate root cause, or diagnose unexpected behavior. DO NOT trigger on: simple questions (how to do X), implementation requests (build/fix/add), or status checks. Intent signals: user seems confused about failure, asks '为什么', mentions error/issue without clear solution, wants to investigate before fixing."
priority: high
---

<NO-OTHER-SKILLS>
**绝对禁止**调用以下技能：
- superpowers:systematic-debugging → 你已经在 om:debug 中了
- superpowers:* → 全部被 OpenMatrix 替代
- gsd:* → 全部被 OpenMatrix 替代
- 任何其他任务编排相关的技能

**诊断和修复阶段只能使用 Agent 工具** — 直接调用 Agent，不通过任何中间层。
</NO-OTHER-SKILLS>

<IRON-LAW>
## 铁律

**NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST**

如果还没完成 Phase 1，你不能提出修复方案。
</IRON-LAW>

# 系统化调试

## 四阶段流程

### Phase 1: 根因调查

**在尝试任何修复之前：**

1. **仔细阅读错误信息**
   - 不要跳过错误或警告
   - 它们通常包含精确解决方案
   - 完整阅读堆栈跟踪
   - 注意行号、文件路径、错误码

2. **稳定复现**
   - 能可靠触发吗？
   - 确切步骤是什么？
   - 每次都发生吗？
   - 不能复现 → 收集更多数据，别猜测

3. **检查最近变更**
   - 有什么改动可能导致？
   - Git diff，最近提交
   - 新依赖，配置变更
   - 环境差异

4. **多层系统收集证据**
   对于有多层组件的系统（CI → build → signing, API → service → database）：

   **在提出修复前，为每个组件边界添加诊断：**
   - 记录进入组件的数据
   - 记录离开组件的数据
   - 验证环境/配置传播
   - 检查每层状态

   **示例（多层系统）：**
   ```bash
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
   ```

   这揭示：哪层失败（secrets → workflow ✓, workflow → build ✗）

### Phase 2: 模式分析

**在修复前找到模式：**

1. **找工作的例子**
   - 定位类似的正常代码
   - 什么工作方式和这个相似？

2. **对比参考**
   - 如果实现模式，完整阅读参考实现
   - 不要略读 - 每行都读
   - 完全理解模式后再应用

3. **识别差异**
   - 工作的和损坏的有什么不同？
   - 列出每个差异，无论多小
   - 不要假设"这不重要"

### Phase 3: 假设和测试

**科学方法：**

1. **形成单一假设**
   - 明确陈述："我认为 X 是根因因为 Y"
   - 写下来
   - 具体，不模糊

2. **最小测试**
   - 用最小改动测试假设
   - 一次一个变量
   - 不要同时修复多个

3. **验证后继续**
   - 工作了？→ Phase 4
   - 没工作？→ 形成新假设
   - 不要在失败的假设上叠加修复

### Phase 4: 实现

**修复根因，不是症状：**

1. **创建失败测试**
   - 最简单的复现
   - 自动测试优先
   - 必须在修复前有

2. **实施单一修复**
   - 解决识别的根因
   - 一次一个改动
   - 不要"顺手"改进
   - 不要打包重构

3. **验证修复**
   - 测试现在通过？
   - 其他测试没坏？
   - 问题真的解决？

4. **如果修复不工作**
   停止。计数：试了几个修复？
   - < 3 次 → 回到 Phase 1，用新信息重新分析
   - ≥ 3 次 → **停止。质疑架构**

5. **3+次修复失败：质疑架构**

   模式表明架构问题：
   - 每次修复揭示新的共享状态/耦合
   - 修复需要"大规模重构"
   - 每次修复在其他地方产生新症状

   停止并质疑基础：
   - 这个模式本质上正确吗？
   - 是惯性驱动我们在坚持？
   - 应该重构架构还是继续修症状？

   **和你的用户讨论后再尝试更多修复**

   这不是失败的假设 - 这是错误的架构。

<RED-FLAGS>
## 红旗警告

如果你在想：
- "快速修复，稍后调查"
- "试试改 X 看是否工作"
- "添加多个改动，跑测试"
- "跳过测试，我手动验证"
- "可能是 X，让我修它"
- "我不完全理解但可能工作"
- "模式说 X 但我要改动一下"
- 提出解决方案前没有追踪数据流
- "再试一次修复"（已经试过 2+ 次）
- 每次修复揭示新地方的问题

**这些都意味着：停止。回到 Phase 1。**

**如果3+次修复失败：质疑架构（见 Phase 4.5）**
</RED-FLAGS>

## 常见借口

| 借口 | 真相 |
|-----|------|
| "问题很简单，不需要流程" | 简单问题也有根因。流程对简单 bug 很快。 |
| "紧急情况，没时间流程" | 系统调试比猜测快。 |
| "先试试这个，再调查" | 第一次修复定模式。从一开始就正确做。 |
| "确认修复工作后写测试" | 无测试的修复不持久。测试优先证明它。 |
| "多个修复一起省时间" | 无法隔离什么工作。产生新 bug。 |
| "参考太长，我适应模式" | 部分理解保证 bug。完整阅读。 |
| "我看到问题了，直接修" | 看到症状 ≠ 理解根因。 |
| "再试一次修复"（失败 2+ 次后） | 3+ 次失败 = 架构问题。质疑模式，不继续修。 |

---

## 执行顺序

```
Step 1:  接收问题描述（参数、指定任务、或询问用户）
Step 2:  调用 CLI: openmatrix debug 初始化会话
Step 3:  Phase 1: 根因调查（Explore Agent）
Step 4:  Phase 2: 模式分析（Explore Agent）
Step 5:  展示诊断报告 + 修复建议
    ⛔ 调查阶段结束，必须等待用户确认
Step 6:  AskUserQuestion 是否需要修复
    ↓ 用户确认"需要修复"
Step 7:  AskUserQuestion 选择修复策略
Step 8:  Phase 3 & 4: 假设测试 + 实施修复（Agent）
Step 9:  自动验证修复结果
Step 10: 写入 Debug Report 并展示
```

**铁律：不做根因调查，不许提修复方案**
**铁律：调查完成后必须询问用户是否修复，不得自动进入修复流程**

---

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

## Step 3: Phase 1 - 根因调查

**调用 Explore Agent：**

```typescript
Agent({
  subagent_type: "Explore",
  description: "根因调查 - Phase 1",
  prompt: `你是调试专家。正在进行系统化调试的 Phase 1：根因调查。

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

### 5. 追踪数据流
**当错误在调用栈深处：**
- 错误值从哪里产生？
- 谁传入的这个错误值？
- 继续向上追踪直到源头
- 在源头修复，不是症状处

## 输出格式

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

## Step 4: Phase 2 - 模式分析

**调用 Explore Agent：**

```typescript
Agent({
  subagent_type: "Explore",
  description: "模式分析 - Phase 2",
  prompt: `继续进行系统化调试的 Phase 2：模式分析。

## Phase 1 发现

${Phase1根因调查的完整输出}

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

**Phase 1 和 Phase 2 完成后，展示诊断报告：**

```
🔍 诊断报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

问题类型: xxx

根因分析
  [来自 Phase 1 调查的根因描述]

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

## Step 8: Phase 3 & 4 - 假设测试与实施修复

**如果用户选择自动修复：**

**修复前安全检查（必须执行）：**
```bash
git status --porcelain
git log --oneline -5
```

```typescript
Agent({
  subagent_type: "general-purpose",
  description: "假设测试与实施修复 - Phase 3 & 4",
  prompt: `根据诊断报告执行 Phase 3（假设测试）和 Phase 4（实施修复）。

## 铁律
1. 形成单一假设："我认为 X 是根因因为 Y"
2. 用最小改动测试假设
3. 只实施单一修复（不要做额外改动）
4. 每次只改一个变量
5. 不在诊断不清的情况下盲目尝试
6. 不做"顺便"的重构

## 诊断报告
${诊断报告全文}

## Phase 3: 形成假设
明确陈述你的假设：
"我认为 [具体根因] 是根因，因为 [证据]"

## Phase 4: 实施修复

### 1. 创建失败测试（如适用）
- 最简单的复现
- 自动测试优先

### 2. 实施单一修复
- 解决识别的根因
- 修改范围最小化

### 3. 输出修改内容
- 修改了哪些文件
- 具体改动是什么

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

## Step 9: 自动验证修复

**⛔ 自动验证流程 - 无需用户手动确认**

### 9.1 执行验证命令

根据问题类型执行验证：

| 问题类型 | 验证命令 |
|---------|---------|
| task_failure | `npm test -- --run 2>&1` |
| project_bug | `npm run build 2>&1` |
| system_bug | 验证 CLI 功能 |
| environment | `npm ls --depth=0 2>&1` |

**自动判断验证结果：**

```bash
VERIFY_RESULT=0
npm test -- --run > /tmp/verify-output.txt 2>&1 || VERIFY_RESULT=1

if [ $VERIFY_RESULT -eq 0 ]; then
  echo "✅ 验证通过"
else
  echo "❌ 验证未通过"
  cat /tmp/verify-output.txt | tail -30
fi
```

### 9.2 验证失败自动循环

```
验证失败 → 重试计数 +1 → 检查重试次数 →
  ├─ < 3 次 → 自动回到 Step 8 重新修复（带新信息）
  └─ >= 3 次 → 暂停，质疑架构，进入 Step 10
```

### 9.3 达到最大重试次数（>= 3 次）

**输出警告并暂停：**

```
⚠️ 已尝试 3 次以上修复，验证仍未通过

这可能指示架构问题：
- 每次修复在其他地方产生新症状
- 修复需要"大规模重构"
- 根因分析不够深入

建议：暂停并质疑根本问题，与用户讨论是否需要架构重构。
```

**此时进入 Step 10，询问用户下一步。**

AskUserQuestion: `header: "架构问题"`, `multiSelect: false`
**question:** 已尝试 3 次修复仍未通过，可能存在架构问题。下一步？

| label | description |
|-------|-------------|
| 深入重新诊断 | 从 Step 3 重新开始完整诊断 |
| 架构重构讨论 | 讨论是否需要架构层面的改动 |
| 接受当前状态 | 记录修复尝试，结束调试 |

### 9.4 验证通过

**验证通过 → 自动进入 Step 10**

```
✅ 验证通过

修复成功，自动进入报告阶段。
```

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
git add . && git commit -m "$(cat <<'EOF'
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
## 流程概览

```
Phase 1: 根因调查 → Phase 2: 模式分析 → 展示报告 → 用户确认
                                                    ↓
                                          Phase 3: 假设测试
                                                    ↓
                                          Phase 4: 实施修复
                                                    ↓
                                          自动验证 → 通过/重试/质疑架构
```

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