---
name: om:review
description: "代码审查指令：检查逻辑错误、测试覆盖率、链路通畅性，对比plan.md检查遗漏项。发现问题自动修复，循环最多10次。由om:start或om:feature完成后调用。"
priority: high
---

<NO-OTHER-SKILLS>
本 skill 用于代码质量审查和实现完整性审查，由 `/om:start` 或 `/om:feature` 完成后自动调用。
</NO-OTHER-SKILLS>

<objective>
审查代码质量（逻辑错误、测试覆盖率、链路通畅性）和实现完整性（对比plan.md），发现问题自动修复，循环执行直到通过或达到上限。
</objective>

<process>

## 执行流程

### Step 1: 收集当前状态

```bash
# 获取 git diff 信息
git diff --stat

# 获取最近修改的文件
git log --oneline -5 --name-only

# 运行现有测试
npm test -- --run 2>&1 || true

# 运行 lint
npm run lint 2>&1 || true

# 获取覆盖率
npm run test:coverage 2>&1 | tail -20 || true

# 读取 plan.md（如果存在）
cat .openmatrix/plan.md || cat .openmatrix/{runId}/plan.md || echo "NO_PLAN"
```

### Step 2: AI 综合审查分析

调用 Agent 进行代码审查：

```typescript
Agent({
  prompt: `你是代码审查专家。对当前实现进行全面审查。

## 审查维度

### 1. 逻辑正确性 (logic)
- 类型错误（TypeScript 类型不匹配）
- 空值处理（null/undefined 未处理）
- 边界条件（数组越界、空数组处理）
- 异步处理（Promise 未处理、async/await 错误）
- 错误处理（缺少 try-catch、异常未捕获）

### 2. 测试覆盖率 (coverage)
- 关键函数是否有测试
- 边界条件是否覆盖
- 异常路径是否测试
- 覆盖率是否达标（>60%）

### 3. 链路通畅性 (flow)
- 函数调用链是否完整
- 参数传递是否正确
- 返回值是否被正确使用
- 模块导出是否正确

### 4. 实现完整性 (completeness)
- plan.md 中的功能点是否都已实现
- plan.md 中的技术方案是否按预期执行
- 是否有计划中未提及的额外实现
- 是否有遗漏的关键步骤

## 当前代码状态
${codeStatus}

## Plan.md 内容
${planContent}

## 测试输出
${testOutput}

## Lint 输出
${lintOutput}

## 输出格式
\`\`\`json
{
  "overallScore": 75,
  "issues": [
    {
      "type": "logic" | "coverage" | "flow" | "completeness" | "lint" | "security",
      "severity": "critical" | "high" | "medium" | "low",
      "file": "src/cli/commands/review.ts",
      "line": 42,
      "description": "缺少 null 检查",
      "suggestion": "添加 if (!value) return",
      "category": "quality" | "completeness"
    }
  ],
  "recommendation": "需要修复" | "审查通过"
}
\`\`\`

## 判断标准
- overallScore >= 90 且无 critical/high issues → 审查通过
- overallScore < 90 或有 critical/high issues → 需要修复
`
})
```

### Step 3: 根据结果执行

| Agent 推荐 | 执行动作 |
|-----------|---------|
| `需要修复` | 执行 Step 4 修复循环 |
| `审查通过` | 审查完成，返回结果 |

### Step 4: 修复循环（最多 10 次）

```typescript
let loopCount = 0;
const MAX_LOOPS = 10;

while (loopCount < MAX_LOOPS && hasIssues) {
  loopCount++;

  // 按严重程度排序，优先修复 critical/high
  const criticalIssues = issues.filter(i => 
    i.severity === 'critical' || i.severity === 'high'
  );

  // 修复每个问题
  for (const issue of criticalIssues) {
    await Agent({
      prompt: `修复以下代码问题：

## 问题详情
- 类型：${issue.type}
- 类别：${issue.category}
- 严重程度：${issue.severity}
- 文件：${issue.file}
- 行号：${issue.line}
- 描述：${issue.description}
- 建议：${issue.suggestion}

## 修复要求
1. 只修复当前问题，不做额外改动
2. 保持代码风格一致
3. 添加必要的测试（如果是 coverage 问题）
4. 完成后验证修复效果
`
    });
  }

  // 重新审查
  const newResult = await reviewCode();

  if (newResult.recommendation === "审查通过") {
    break;
  }
}

// 循环结束
if (loopCount >= MAX_LOOPS) {
  console.warn(\`⚠️ 达到最大循环次数 ${MAX_LOOPS}，仍有问题未修复\`);
}

// 输出审查结果
console.log(\`✅ Review 完成，整体评分: ${finalScore}\`);
```

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:review           # 默认审查当前代码
/om:review --json    # JSON 输出
</examples>

<notes>

## 审查维度详解

| 维度 | 类型 | 说明 |
|------|------|------|
| 逻辑正确性 | quality | TypeScript 类型、空值、边界、异步、错误处理 |
| 测试覆盖率 | quality | 关键路径、异常路径、边界条件覆盖 |
| 链路通畅性 | quality | 函数调用链、参数传递、返回值、模块导出 |
| 实现完整性 | completeness | plan.md 功能点、技术方案、遗漏项 |

## 问题严重程度

| 级别 | 处理优先级 |
|------|-----------|
| critical | 必须立即修复 |
| high | 必须修复 |
| medium | 建议修复 |
| low | 可忽略 |

## CLI 命令支持

```bash
openmatrix review                  # 执行 review 流程
openmatrix review --json           # JSON 输出
openmatrix review --max-loops 5    # 自定义循环上限
openmatrix review --skip-plan      # 跳过 plan.md 对比
openmatrix review --skip-tests     # 跳过测试覆盖率检查
```

## 调用时机

`om:review` 由 `om:start` 或 `om:feature` 完成后自动调用：

```
om:start/om:feature 完成 → om:review → 结束
```

</notes>