// src/agents/impl/researcher-agent.ts
import type { Task, AgentType, AgentResult } from '../../types/index.js';

/**
 * Researcher Agent - 调研分析
 *
 * 职责：
 * - 搜索相关资料
 * - 分析技术方案
 * - 总结最佳实践
 * - 提供决策建议
 */
export class ResearcherAgent {
  readonly type: AgentType = 'researcher';
  readonly capabilities = ['search', 'analyze', 'summarize', 'recommend'];

  async execute(task: Task): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      const prompt = this.buildResearchPrompt(task);

      return {
        runId: this.generateRunId(),
        taskId: task.id,
        agentType: 'researcher',
        status: 'completed',
        output: prompt,
        artifacts: [],
        needsApproval: false,
        duration: Date.now() - startTime,
        completedAt: new Date().toISOString()
      };

    } catch (error) {
      return {
        runId: this.generateRunId(),
        taskId: task.id,
        agentType: 'researcher',
        status: 'failed',
        output: '',
        artifacts: [],
        needsApproval: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        completedAt: new Date().toISOString()
      };
    }
  }

  private buildResearchPrompt(task: Task): string {
    return `
# 调研任务

## 调研问题

${task.description}

## 调研步骤

1. **搜索资料**
   - 官方文档
   - 技术博客
   - GitHub 仓库
   - Stack Overflow

2. **分析方案**
   - 功能对比
   - 性能对比
   - 社区支持
   - 学习曲线

3. **总结发现**
   - 关键信息
   - 优缺点
   - 适用场景

## 输出格式

\`\`\`markdown
# 调研报告

## 问题
[调研的核心问题]

## 调研方法
- 搜索关键词: ...
- 参考来源: ...

## 发现

### 方案 A: [名称]
- 描述: ...
- 优点:
  - ...
- 缺点:
  - ...
- 适用场景: ...

### 方案 B: [名称]
- 描述: ...
- 优点:
  - ...
- 缺点:
  - ...
- 适用场景: ...

## 方案对比

| 维度 | 方案 A | 方案 B |
|-----|--------|--------|
| 性能 | ⭐⭐⭐ | ⭐⭐ |
| 易用性 | ⭐⭐ | ⭐⭐⭐ |
| 社区 | ⭐⭐⭐ | ⭐ |

## 建议

**推荐方案**: [方案 X]

**理由**:
1. ...
2. ...

## 参考资料
1. [标题](链接)
\`\`\`

## 开始调研

请使用 WebSearch 和 WebFetch 工具搜索相关信息。
`;
  }

  private generateRunId(): string {
    return `researcher-${Date.now().toString(36)}`;
  }
}
