---
name: om:test
description: "Use when user wants to GENERATE or IMPROVE tests. Triggers on TEST-CREATION intent: user wants new test files, better coverage, or test infrastructure setup. DO NOT trigger on: test execution (running tests), test debugging (why test fails), or test questions (how to write tests). Intent signals: user asks to generate/add/write tests, mentions coverage gaps, wants test setup."
priority: high
---

<INTENT-JUDGMENT>
## 意图判断指南

**AI 应根据用户语义判断意图：**

### 触发信号（测试创建意图）

- 用户想生成测试文件
- 用户想改进测试覆盖
- 用户想设置测试框架
- 用户提到"没测试"、"需要测试"

### 不触发信号

| 用户意图 | 应调用 |
|---------|--------|
| 运行测试 | 直接执行 npm test |
| 测试失败想修复 | /om:debug |
| 询问测试写法 | 直接回答 |

### 示例判断

| 用户消息 | 判断 | 结果 |
|---------|------|------|
| "给这个文件补测试" | 创建测试意图 | 触发 ✓ |
| "生成单元测试" | 创建意图明确 | 触发 ✓ |
| "测试覆盖率太低" | 改进覆盖意图 | 触发 ✓ |
| "运行测试看看" | 执行意图 | 直接运行 |
| "测试失败了为什么" | 排查意图 | /om:debug |
</INTENT-JUDGMENT>

<NO-OTHER-SKILLS>
**绝对禁止**调用以下技能：
- ❌ superpowers:test-driven-development → 你已经在 om:test 中了
- ❌ superpowers:* → 全部被 OpenMatrix 替代
- ❌ gsd:* → 全部被 OpenMatrix 替代
- ❌ 任何其他任务编排相关的技能

**测试生成阶段只能使用 Agent 工具** — 直接调用 Agent，不通过任何中间层。
</NO-OTHER-SKILLS>

<MANDATORY-EXECUTION-ORDER>
## 执行顺序 - 必须严格按此顺序，不得跳过

```
Step 1:  调用 CLI 扫描项目 (openmatrix test --json)
Step 2:  AI 分析项目上下文和业务逻辑
Step 3:  发现测试缺失，输出分析报告
Step 4:  UI 测试决策（如果 isFrontend=true）
            ⛔ 分析阶段结束，必须等待用户确认
Step 5:  AskUserQuestion 确认测试范围
Step 6:  生成测试代码（Agent）
Step 7:  自动验证测试（循环最多 3 次）
            ├─ 通过 → 进入 Step 8
            └─ 失败 → 自动重新生成（带失败信息）
Step 8:  输出测试报告
```

**铁律：不做项目分析，不许生成测试**
**铁律：前端项目必须询问 UI 测试需求，不得跳过**
**铁律：验证失败自动循环，最多 3 次，超过必须暂停**
</MANDATORY-EXECUTION-ORDER>

<objective>
智能测试生成 - 从业务角度分析代码逻辑，发现测试缺失，自动生成并验证测试。遵循 OpenMatrix 分层原则：CLI 收集原始数据，AI 分析并生成测试。
</objective>

<process>

## Step 1: 调用 CLI 扫描项目

**检查 `$ARGUMENTS`:**

| 参数 | 处理方式 |
|------|---------|
| 空 | 扫描整个项目 |
| `src/auth/` | 扫描指定目录 |
| `--target src/utils.ts` | 扫描指定文件 |

**调用 CLI 扫描：**

```bash
openmatrix test --json
```

或指定目标：

```bash
openmatrix test --target src/auth/ --json
```

**CLI 返回 TestScanResult JSON：**

```json
{
  "timestamp": "2026-04-23T10:00:00Z",
  "projectRoot": "/path/to/project",
  "target": "src/",
  "frameworks": [
    {
      "framework": "vitest",
      "version": "1.2.3",
      "configFile": "vitest.config.ts",
      "isPrimary": true,
      "supportedTypes": ["unit", "integration"],
      "commands": {
        "test": "npm test",
        "testCoverage": "npm test -- --coverage"
      }
    }
  ],
  "existingTests": [
    { "path": "tests/example.test.ts", "type": "unit", "testCount": 5 }
  ],
  "uncoveredSources": [
    {
      "path": "src/auth/login.ts",
      "fileType": "service",
      "exports": ["login", "validateToken"],
      "hasTest": false,
      "suggestedTestTypes": ["unit", "integration"],
      "complexity": { "lines": 150, "functions": 5 }
    }
  ],
  "projectType": "typescript",
  "isFrontend": false,
  "hasUIComponents": false,
  "coverageReport": { "total": 45 },
  "testStyle": {
    "namingConvention": "describe-it",
    "assertionLibrary": "expect",
    "usesTypeScript": true,
    "fileSuffix": ".test.ts",
    "fileLocation": "separate"
  },
  "summary": {
    "frameworkCount": 1,
    "existingTestCount": 5,
    "uncoveredSourceCount": 20,
    "hasTestConfig": true,
    "hasCoverageConfig": true
  }
}
```

**从返回结果读取关键数据：**
- `frameworks`: 检测到的测试框架
- `existingTests`: 现有测试文件
- `uncoveredSources`: 未覆盖的源文件
- `isFrontend`: 是否为前端项目
- `hasUIComponents`: 是否有 UI 组件
- `testStyle`: 现有测试风格（用于保持一致性）

## Step 2: AI 分析项目上下文

**AI 分析任务（读取原始数据后）：**

1. **识别测试框架**
   - 读取 `frameworks` 数组
   - 确定主要测试框架 `isPrimary: true`
   - 了解支持的测试类型

2. **分析项目结构**
   - 读取 `projectType` 确定语言
   - 读取 `uncoveredSources` 了解需要测试的模块
   - 每个源文件的 `exports` 表示需要测试的目标

3. **分析现有测试风格**
   - 读取 `testStyle.namingConvention` 保持命名一致
   - 读取 `testStyle.assertionLibrary` 使用相同断言库
   - 读取 `testStyle.fileSuffix` 保持文件后缀一致
   - 读取 `testStyle.fileLocation` 确定测试文件位置

4. **评估覆盖率现状**
   - 如果 `coverageReport` 存在，了解当前覆盖率
   - 识别关键业务模块的覆盖缺口

## Step 3: 发现测试缺失

**AI 分析每个未覆盖源文件：**

```
对于每个 uncoveredSources[i]:
  1. 分析 exports 中的每个函数/类/组件
  2. 理解业务逻辑（不是语法，而是"做什么"）
  3. 识别关键业务场景
  4. 确定测试优先级（基于复杂度、重要性）
  5. 生成测试用例清单
```

**输出分析报告：**

```
📊 测试缺失分析报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

项目类型: TypeScript
测试框架: Vitest (v1.2.3)
当前覆盖率: 45%

未覆盖源文件 (20 个):
┌────────────────────────────────────────┐
│ src/auth/login.ts                      │
│ 类型: service | 导出: login, validateToken │
│ 行数: 150 | 函数: 5                     │
│ 建议测试类型: unit, integration         │
│ 关键业务场景:                           │
│   - 用户登录成功                        │
│   - 密码错误拒绝                        │
│   - Token 验证过期                      │
│   - 并发登录处理                        │
├────────────────────────────────────────┤
│ src/utils/format.ts                    │
│ 类型: util | 导出: formatDate, parseJSON │
│ ...                                     │
└────────────────────────────────────────┘

测试优先级建议:
  P0: src/auth/login.ts (认证核心)
  P0: src/api/handler.ts (API 入口)
  P1: src/utils/format.ts (通用工具)
  P2: src/config/index.ts (配置加载)

现有测试风格:
  - 命名约定: describe/it
  - 断言库: expect
  - 文件后缀: .test.ts
  - 文件位置: tests/ 目录

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Step 4: UI 测试决策

**如果 `isFrontend=true` 或 `hasUIComponents=true`:**

**⛔ 必须在此询问用户 UI 测试需求，不得跳过。**

AskUserQuestion: `header: "UI 测试"`, `multiSelect: false`
**question:** 检测到前端/UI 组件，是否需要生成 UI/E2E 测试？

| label | description |
|-------|-------------|
| 需要 UI 测试 | 生成 Playwright/Cypress E2E 测试 |
| 仅单元测试 | 只生成单元测试，不生成 E2E |
| 自定义配置 | 指定 UI 测试框架和范围 |

**如果用户选择"自定义配置"：**

AskUserQuestion: `header: "UI 测试框架"`, `multiSelect: false`
**question:** 选择 UI 测试框架？

| label | description |
|-------|-------------|
| Playwright (推荐) | 跨浏览器支持，现代 API |
| Cypress | 开发体验好，调试方便 |
| Puppeteer | 轻量级，Chrome 优先 |

**如果用户选择"需要 UI 测试"：**
- AI 根据 `frameworks` 中是否有 E2E 框架推荐合适的选择
- 如果无 E2E 框架，推荐 Playwright

## Step 5: 确认测试范围

**展示分析报告后，询问用户确认：**

AskUserQuestion: `header: "测试范围"`, `multiSelect: true`
**question:** 选择需要生成测试的源文件？

| label | description |
|-------|-------------|
| 全部生成 (推荐) | 为所有未覆盖文件生成测试 |
| P0 优先级 | 只生成 P0 优先级测试 |
| 自定义选择 | 指定具体文件列表 |

**如果用户选择"自定义选择"：**

展示文件列表，让用户选择具体文件。

**确认测试配置：**

AskUserQuestion: `header: "测试配置"`, `multiSelect: false`
**question:** 确认测试生成配置？

| label | description |
|-------|-------------|
| 自动生成 (推荐) | AI 自动分析业务逻辑生成测试 |
| 交互式生成 | 每个文件询问测试场景 |
| 快速生成 | 只生成基础测试，跳过复杂场景 |

## Step 6: 生成测试代码

**调用 Agent 生成测试：**

```typescript
Agent({
  subagent_type: "general-purpose",
  description: "生成测试代码",
  prompt: `你是测试工程师。根据分析结果生成测试代码。

## 铁律
1. 从业务角度理解代码，不是语法角度
2. 测试业务场景，不是函数调用
3. 保持与现有测试风格一致
4. 每个测试用例必须有明确的业务意义

## 项目信息
- 语言: ${projectType}
- 测试框架: ${primaryFramework}
- 测试目录: ${testDirectory}
- 文件后缀: ${fileSuffix}

## 现有测试风格
- 命名约定: ${namingConvention}
- 断言库: ${assertionLibrary}
- 文件位置: ${fileLocation}

## 需要测试的源文件
${selectedFiles.map(f => `
文件: ${f.path}
类型: ${f.fileType}
导出: ${f.exports.join(', ')}
复杂度: ${f.complexity?.lines || 'unknown'} 行
`).join('\n')}

## 任务
1. 分析每个源文件的业务逻辑
2. 识别关键业务场景（成功路径、边界条件、错误处理）
3. 为每个场景编写测试用例
4. 测试文件写入正确位置
5. 保持命名和风格一致

## 测试用例要求
- describe 描述业务场景（不是函数名）
- it 描述具体行为（"should..."）
- 断言验证业务结果
- Mock 外部依赖（API、数据库等）

## 禁止行为
❌ 测试语法而不是行为
❌ 使用与项目不一致的风格
❌ 跳过边界条件和错误处理
❌ 生成无意义的测试（如 "should exist")`,
  run_in_background: false
})
```

**UI 测试生成（如果需要）：**

```typescript
Agent({
  subagent_type: "general-purpose",
  description: "生成 E2E/UI 测试",
  prompt: `你是 E2E 测试工程师。为前端组件生成 UI 测试。

## UI 测试框架
- 框架: ${uiFramework}
- 配置文件: ${uiConfigFile || '需要创建'}

## 需要测试的 UI 组件
${uiComponents.map(c => `
组件: ${c.path}
导出: ${c.exports.join(', ')}
功能: ${c.description || '需要分析'}
`).join('\n')}

## 任务
1. 创建 E2E 测试配置（如果不存在）
2. 为每个关键用户流程生成测试
3. 测试用例覆盖：页面渲染、用户交互、数据展示
4. 截图放置在 tests/e2e/screenshots/

## E2E 测试用例要求
- 测试完整用户流程
- 验证页面状态变化
- 检查关键元素可见性
- 处理异步加载等待

## 禁止行为
❌ 测试单个元素样式
❌ 跳过用户等待时间
❌ 硬编码测试数据`,
  run_in_background: false
})
```

## Step 7: 自动验证测试（循环机制）

<LOOP_ENFORCEMENT>
**此步骤是验证循环，必须执行直到验证通过或达到最大重试次数。**

❌ **禁止在验证失败时停止** — 即使 Agent 返回了大段输出，也必须继续循环
❌ **禁止询问"是否继续验证"** — 自动执行验证，无需用户确认
❌ **禁止输出"让我知道是否..."后停止** — 继续执行验证循环
❌ **禁止因为上下文压缩而忘记重试次数** — 使用 TodoWrite 持久化 retryCount

**retryCount 持久化机制（防止上下文压缩丢失状态）:**

验证循环开始时，使用 TodoWrite 记录状态：
```
TodoWrite([
  { content: "验证测试（第 N 次）", activeForm: "正在验证测试（第 N 次）", status: "in_progress" }
])
```

每次验证失败后：
1. 更新 TodoWrite 的 retryCount（N → N+1）
2. 检查是否达到最大次数（>= 3）
3. 未达到 → 自动回到 Step 6 重新生成
4. 已达到 → 暂停并报告问题

**循环铁律：**
- retryCount 从 TodoWrite 读取，不依赖上下文记忆
- 验证失败必须自动循环，不得跳过
- 最大重试 3 次，超过必须暂停
</LOOP_ENFORCEMENT>

**⛔ 自动验证流程 - 无需用户手动确认**

### 7.1 执行验证命令（自动判断结果）

```bash
# 执行测试验证
VERIFY_RESULT=0
npm test -- --run > /tmp/test-verify-output.txt 2>&1 || VERIFY_RESULT=1

if [ $VERIFY_RESULT -eq 0 ]; then
  echo "✅ 测试验证通过"
else
  echo "❌ 测试验证失败"
  cat /tmp/test-verify-output.txt | tail -50  # 展示失败详情
fi
```

### 7.2 验证失败自动循环（无需用户确认）

**验证失败时自动处理：**

```
验证失败 → TodoWrite 更新 retryCount → 检查重试次数 →
  ├─ < 3 次 → 自动回到 Step 6 重新生成（带失败信息）
  └─ >= 3 次 → 暂停，报告问题，可能是测试框架配置问题
```

**重试计数器持久化：**
- 使用 TodoWrite 记录 retryCount
- 每次验证失败后更新 TodoWrite（retryCount + 1）
- 验证通过后更新 TodoWrite 为 completed

### 7.3 自动循环回生成步骤

**< 3 次验证失败 → 自动调用 Agent 重新生成：**

```typescript
Agent({
  subagent_type: "general-purpose",
  description: `修复测试 (第 ${retryCount + 1} 次)`,
  prompt: `根据测试验证失败结果修复测试代码。

## 铁律
1. 只修复失败的测试，不修改通过的测试
2. 分析失败原因，不要盲目修改
3. 保持测试风格一致

## 验证失败详情
${verifyFailureOutput}

## 失败分析
- 哪些测试失败了？
- 失败原因是什么？
- 是测试代码问题还是源代码问题？

## 修复策略
1. 如果是测试语法错误 → 修正测试代码
2. 如果是断言失败 → 分析预期值是否正确
3. 如果是 Mock 问题 → 调整 Mock 实现

## 禁止行为
❌ 修改通过的测试
❌ 删除失败的测试用例
❌ 跳过 Mock 外部依赖`,
  run_in_background: false
})
```

### 7.4 达到最大重试次数（>= 3 次）

**输出警告并暂停：**

```
⚠️ 已尝试 3 次以上生成，测试仍未通过

可能的问题：
- 测试框架配置不正确
- 源代码有 bug 导致测试无法通过
- Mock 设置不完整

建议：检查测试框架配置，或手动修复测试代码。
```

AskUserQuestion: `header: "验证问题"`, `multiSelect: false`
**question:** 已尝试 3 次生成仍未通过，可能存在配置问题。下一步？

| label | description |
|-------|-------------|
| 检查配置 | 检查测试框架配置文件 |
| 手动修复 | 输出测试文件路径，用户手动修改 |
| 结束流程 | 保存当前测试文件，结束流程 |

### 7.5 验证通过

**验证通过 → 自动进入 Step 8**

```
✅ 测试验证通过

所有生成的测试正常运行，自动进入报告阶段。
```

## Step 8: 输出测试报告

**展示测试生成报告：**

```markdown
# 测试生成报告

**生成时间**: ${timestamp}
**项目**: ${projectName}
**测试框架**: ${primaryFramework}

## 生成的测试文件

| 文件 | 类型 | 测试用例 | 源文件 |
|------|------|---------|--------|
| tests/auth/login.test.ts | unit | 12 | src/auth/login.ts |
| tests/api/handler.test.ts | integration | 8 | src/api/handler.ts |
| tests/e2e/user-flow.spec.ts | e2e | 5 | 多个组件 |

## 测试覆盖统计

- 单元测试: 20 个
- 集成测试: 8 个
- E2E 测试: 5 个
- 总计: 33 个测试用例

## 验证结果

✅ 所有测试通过 (33 passed, 0 failed)

## 覆盖率预估

当前覆盖率: 45%
预估覆盖率: 72% (+27%)

## 后续建议

1. 运行 `npm test -- --coverage` 查看详细覆盖率
2. 检查 Mock 文件是否需要补充测试数据
3. E2E 测试截图已放置在 tests/e2e/screenshots/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Git 提交提示（可选）：**

AskUserQuestion: `header: "Git 提交"`, `multiSelect: false`
**question:** 是否提交生成的测试文件？

| label | description |
|-------|-------------|
| 提交测试文件 | git add tests/ && git commit |
| 仅保存文件 | 不提交，用户稍后处理 |
| 查看生成的文件 | 展示文件内容后再决定 |

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:test                    # 扫描整个项目，发现测试缺失
/om:test src/auth/          # 只为 src/auth/ 目录生成测试
/om:test --target src/utils.ts  # 为指定文件生成测试
</examples>

<notes>
## 完整流程图

```
Step 1: CLI 扫描 (openmatrix test --json)
    │   收集原始数据：框架、源文件、覆盖率
    ▼
Step 2: AI 分析项目上下文
    │   • 识别测试框架
    │   • 分析项目结构
    │   • 理解测试风格
    ▼
Step 3: 发现测试缺失
    │   • 对比源文件与测试文件
    │   • 分析业务逻辑复杂度
    │   • 识别关键业务场景
    │   • 输出分析报告
    ▼
Step 4: UI 测试决策 (如果 isFrontend=true)
    │   ⛔ 必须询问用户
    │   AskUserQuestion: 是否需要 UI 测试？
    ▼
Step 5: 确认测试范围
    │   AskUserQuestion: 选择源文件
    │   AskUserQuestion: 确认配置
    ▼
Step 6: 生成测试代码
    │   Agent(general-purpose) 分析业务逻辑生成测试
    │   如果需要 UI 测试，Agent 生成 E2E 测试
    ▼
Step 7: ⛔ 自动验证测试（无需用户确认）
    │   ├─ 执行 npm test → 自动判断结果
    │   ├─ 通过 → 自动进入 Step 8 ✅
    │   └─ 失败 → 自动循环处理
    │       ├─ < 3 次 → 自动回到 Step 6 重新生成
    │       └─ >= 3 次 → 暂停，可能是配置问题 ⚠️
    ▼
Step 8: 输出测试报告
    │   展示生成的文件列表
    │   展示覆盖率统计
    │   Git 提交询问（可选）
```

## 自动验证循环流程（Step 7 详细）

```
┌─────────────────────────────────────────┐
│         Step 6: 生成测试代码              │
└─────────────────────┬───────────────────┘
                      ↓
┌─────────────────────────────────────────┐
│     Step 7: 执行测试验证                  │
│   (npm test / npm test -- --run)       │
└─────────────────────┬───────────────────┘
                      ↓
              ┌───────┴───────┐
              │ 自动判断结果   │
              └───────┬───────┘
        ┌─────────────┴─────────────┐
        │                           │
    退出码=0                    退出码≠0
    (测试通过)                  (测试失败)
        │                           │
        ↓                           ↓
┌───────────────┐          ┌───────────────────┐
│ ✅ 进入 Step 8│          │ retryCount + 1    │
└───────────────┘          └───────┬───────────┘
                                    ↓
                           ┌────────┴────────┐
                           │ 检查重试次数     │
                           └───────┬─────────┘
                     ┌─────────────┴─────────────┐
                     │                           │
                 < 3 次                       >= 3 次
                     │                           │
                     ↓                           ↓
           ┌─────────────────┐       ┌───────────────────┐
           │ ⚡ 自动回到 Step 6 │       │ ⚠️ 暂停，检查配置 │
           │ (带失败信息)      │       │ 用户手动处理       │
           └─────────────────┘       └───────────────────┘
```

## 铁律

**不做项目分析，不许生成测试**

**前端项目必须询问 UI 测试需求**

**验证失败自动循环，无需用户手动确认**

**最大重试 3 次，超过必须暂停检查配置**

## 红线

- 3 次生成失败 → 暂停，检查测试框架配置
- 不生成与现有风格不一致的测试
- 不跳过 UI 测试询问（前端项目）
- 不删除现有的通过的测试
- **验证必须自动判断，不得依赖用户手动确认**
- **验证失败自动循环，不得跳过或手动绕过**
- **达到 3 次重试必须暂停，不得继续生成**

## 红旗警告 - 停止并回归流程

**如果发现自己在想：**
- "直接生成测试，不用分析"
- "跳过 UI 测试询问"
- "测试看起来很简单，不用验证"
- "验证失败了，让用户手动修"
- "重试超过 3 次继续生成"
- "跳过自动验证"
- 只测试函数调用而不是业务场景
- 生成的测试与项目风格不一致

**所有这些意味着：停止。回到 Step 2 或执行自动验证循环。**

## 测试生成原则

### 业务角度测试

```
// ❌ 错误：测试语法
describe('login function', () => {
  it('should exist', () => {
    expect(login).toBeDefined();
  });
});

// ✅ 正确：测试业务场景
describe('用户登录', () => {
  it('正确密码应该成功登录', async () => {
    const result = await login('user', 'correct-password');
    expect(result.success).toBe(true);
    expect(result.token).toBeDefined();
  });

  it('错误密码应该拒绝登录', async () => {
    const result = await login('user', 'wrong-password');
    expect(result.success).toBe(false);
    expect(result.error).toBe('密码错误');
  });
});
```

### 保持风格一致

- 使用项目的命名约定 (describe-it 或 test)
- 使用相同的断言库 (expect/assert/should)
- 保持文件后缀一致 (.test.ts/.spec.ts)
- 保持文件位置风格 (同目录或独立目录)

## 分层原则

**CLI 只负责：**
- 扫描项目结构
- 检测测试框架
- 运行测试验证
- 输出结构化 JSON 数据

**Skill AI 负责：**
- 分析业务逻辑
- 发现测试缺失
- 推荐测试类型
- 生成测试代码
- 处理验证失败

**反模式（禁止）：**
```typescript
// ❌ 错误：CLI 硬编码推荐逻辑
function recommendTestFramework(projectType) {
  if (projectType === 'typescript') return 'vitest';
  // ...更多 if/else
}

// ✅ 正确：CLI 只输出原始数据，AI 自己判断
// AI 看到 frameworks 数组，自己决定使用哪个
```

## 实际影响

来自测试生成实践：
- 业务角度测试：更易维护，更有价值
- 自动验证循环：减少手动调试时间
- 风格一致性：团队协作更顺畅
- 首次生成成功率：85%+
- 3 次循环成功率：95%+
</notes>