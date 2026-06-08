---
name: om:review-do
description: "Review实现与Plan对比的循环执行指令。对比当前实现内容与计划文档，检查遗漏项，自动修复，循环最多10次，完成后调用om:start。"
priority: high
---

<NO-OTHER-SKILLS>
本 skill 用于实现与计划的对比验证循环，完成后自动调用 `/om:start`。
</NO-OTHER-SKILLS>

<objective>
对比实现内容与 plan.md，发现遗漏项自动修复，循环执行直到完整或达到上限，最后调用 om:start。
</objective>

<process>

## 执行流程

### Step 1: 读取计划文档

```bash
# 读取 plan.md
cat .openmatrix/plan.md || cat .openmatrix/{runId}/plan.md
```

### Step 2: 收集当前实现状态

```bash
# 收集已完成的任务列表
openmatrix status --json
```

### Step 3: AI 对比分析

调用 Agent 进行对比分析：

```typescript
Agent({
  prompt: `你是实现验证专家。对比计划文档和当前实现状态。

## 计划文档内容
${planContent}

## 当前实现状态
${implementationStatus}

## 对比检查清单
1. 计划中的每个功能点是否都已实现？
2. 计划中的技术方案是否按预期执行？
3. 计划中的质量要求是否满足？
4. 是否有计划中未提及的额外实现（可能是偏离）？
5. 是否有实现遗漏了计划中的关键步骤？

## 输出格式
\`\`\`json
{
  "matchScore": 85,  // 匹配度 0-100
  "missingItems": [
    { "item": "缺少单元测试", "severity": "high", "suggestion": "添加 vitest 测试" },
    { "item": "缺少错误处理", "severity": "medium", "suggestion": "添加 try-catch" }
  ],
  "extraItems": [
    { "item": "额外的日志输出", "severity": "low", "note": "可保留" }
  ],
  "recommendation": "继续修复遗漏项" | "实现完整，调用 om:start"
}
\`\`\`

## 判断标准
- matchScore >= 90 且无 high severity 遗漏 → 实现完整
- matchScore < 90 或有 high severity 遗漏 → 需要修复
`
})
```

### Step 4: 根据结果执行

| Agent 推荐 | 执行动作 |
|-----------|---------|
| `继续修复遗漏项` | 执行 Step 5 修复循环 |
| `实现完整` | 调用 `/om:start` 结束 |

### Step 5: 修复循环（最多 10 次）

```typescript
let loopCount = 0;
const MAX_LOOPS = 10;

while (loopCount < MAX_LOOPS && hasMissingItems) {
  loopCount++;
  
  // 修复遗漏项
  for (const item of missingItems) {
    await Agent({
      prompt: `修复以下遗漏项：
      
## 遗漏项
- 项目：${item.item}
- 严重程度：${item.severity}
- 建议：${item.suggestion}

## 修复要求
1. 只修复当前遗漏项，不做额外改动
2. 保持代码风格一致
3. 完成后验证修复效果
`
    });
  }
  
  // 重新对比
  const newResult = await comparePlanWithImplementation();
  
  if (newResult.recommendation === "实现完整") {
    break;
  }
}

// 循环结束
if (loopCount >= MAX_LOOPS) {
  console.warn(`⚠️ 达到最大循环次数 ${MAX_LOOPS}，仍有遗漏项`);
}

// 调用 om:start
await Skill("om:start");
```

### Step 6: 最终调用 om:start

```typescript
// 无论循环结果如何，最终调用 om:start
Skill("om:start");
```

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:review-do           # 默认读取 .openmatrix/plan.md
/om:review-do --plan custom-plan.md  # 指定计划文件
</examples>

<notes>
## 循环限制

- 最大循环次数：10 次
- 每次循环：对比 → 修复 → 验证
- 达到上限：警告用户，仍调用 om:start

## 遗漏项严重程度

| 级别 | 处理优先级 |
|------|-----------|
| high | 必须修复 |
| medium | 建议修复 |
| low | 可忽略 |

## CLI 命令支持

```bash
openmatrix review-do                  # 执行 review-do 流程
openmatrix review-do --plan <path>    # 指定计划文件
openmatrix review-do --max-loops 5    # 自定义循环上限
openmatrix review-do --json           # JSON 输出
openmatrix review-do --skip-start     # 跳过最后的 om:start
```

</notes>