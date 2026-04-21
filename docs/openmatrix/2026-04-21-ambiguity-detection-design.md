# 设计方案: 任务执行歧义检测和处理机制

日期: 2026-04-21

## 核心目标

1. 执行前 + 执行中双重歧义检测
2. 检测 5 种歧义类型：需求、技术、依赖、验收、测试结果
3. 四级严重程度：Critical、High、Medium、Low
4. 动态处理策略：start 模式 → Meeting；其他模式 → Critical/High 提问，Medium/Low Meeting

## 架构设计

```
Step → Agent Prompt (含歧义检测指令) → Agent 执行 → 输出歧义报告│├─→ 无歧义 → 正常 Complete
                                            │
                                            ├─→ 有歧义 → Skill 层处理
                                            │              │
                                            │              ├─→ start: Meeting + 继续
                                            │              │
                                            │              └─→ 其他: Critical/High → AskUser
                                            │                          Medium/Low → Meeting
```

##歧义类型定义

| 类型 | 定义 | Critical 触发条件 | High 触发条件 |
|------|------|------------------|--------------|
| 需求歧义 (requirement) | 任务描述模糊 | 完全无法理解 | 关键信息缺失 |
| 技术歧义 (technical) | 技术选型不明确 | 完全未确定 | 方案有歧义 |
| 依赖歧义 (dependency) | 依赖状态不明 | 状态 unknown | 代码未找到 |
| 验收歧义 (acceptance) | 验收标准模糊 | 无验收标准 | 标准模糊 |
| 测试结果歧义 (test_result) | 测试结果存疑 | 原因完全不明 | 通过但存疑 |

## 严重程度分级

| 级别 | 定义 | 处理策略 (非 start) | 处理策略 (start) |
|------|------|-------------------|-----------------|
| Critical | 阻塞执行 | AskUserQuestion | Meeting + 继续 |
| High | 可能导致错误 | AskUserQuestion | Meeting + 继续 |
| Medium | 可能偏差 | Meeting + 继续 | Meeting + 继续 |
| Low | 建议性 | Meeting + 继续 | Meeting + 继续 |

## 关键接口 / API

```typescript
// 新增类型
export type AmbiguityType = 'requirement' | 'technical' | 'dependency' | 'acceptance' | 'test_result';
export type AmbiguitySeverity = 'critical' | 'high' | 'medium' | 'low';

export interface AmbiguityReport {
  taskId: string;
  phase: 'pre_execution' | 'during_execution' | 'post_execution';
  ambiguities: AmbiguityItem[];
  overallSeverity: AmbiguitySeverity;
  recommendedAction: 'ask_user' | 'meeting' | 'continue';
  createdAt: string;
}

export interface AmbiguityItem {
  type: AmbiguityType;
  severity: AmbiguitySeverity;
  description: string;
  context?: string;
  suggestedQuestions?: string[];
  affectedFiles?: string[];
}

// 扩展类型
export type MeetingType = 'blocking' | 'decision' | 'review' | 'planning' | 'ambiguity';

// 新增方法
MeetingManager.createAmbiguityMeeting(taskId, ambiguityReport): Promise<{ meeting, approval }>
```

## 技术方案

**方案 A**: 增强型 Agent Prompt + Meeting 扩展

- 在 `AgentRunner.buildExecutionPrompt()` 注入歧义检测指令
- Agent 自主判断歧义并输出 JSON 报告
- 扩展 Meeting 类型支持 `ambiguity`
- Skill 层根据严重程度和执行模式动态处理

## 文件改动清单

| 文件 | 改动类型 | 改动内容 |
|------|---------|---------|
| `src/types/index.ts` | 扩展 | 新增歧义相关类型，扩展 MeetingType |
| `src/agents/agent-runner.ts` | 增强 | buildExecutionPrompt() 注入歧义检测指令 |
| `src/orchestrator/meeting-manager.ts` | 增强 | 新增 createAmbiguityMeeting() 方法 |
| `src/orchestrator/executor.ts` | 增强 | 解析 Agent 输出中的歧义报告 |
| `skills/start.md` | 增强 | 处理歧义报告的流程描述 |
| `skills/auto.md` | 增强 |歧义处理策略（写入 Meeting+继续） |
| `skills/feature.md` | 增强 |歧义处理流程 |

## 错误处理策略

1. Agent 输出无法解析的歧义报告 → 视为无歧义，继续执行
2.歧义检测失败 → 视为无歧义，继续执行（保守策略）
3. Meeting 创建失败 → 记录错误日志，继续执行

## 测试策略

1. 单元测试：歧义报告解析、严重程度判断
2. 集成测试：Agent 输出歧义报告 → Skill 层处理流程
3. E2E 测试：完整任务执行流程中的歧义检测

## 约束与风险

- **约束**: Agent 判断能力依赖模型能力，可能漏检
- **风险**:歧义检测可能拖长执行流程
- **应对**: start 模式优先继续执行，用 Meeting 记录

## 验收标准

1. Agent prompt 包含歧义检测指令
2. Agent 能输出 JSON 格式的歧义报告
3. Meeting 类型支持 ambiguity
4. Skill 层能正确解析和处理歧义报告
5. start 模式歧义写入 Meeting 继续执行
6. 其他模式 Critical/High 立即提问