// src/orchestrator/task-planner.ts
import type { ParsedTask } from '../types/index.js';
import type { Task } from '../types/index.js';

export interface TaskBreakdown {
  taskId: string;
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  dependencies: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  assignedAgent: 'planner' | 'coder' | 'tester' | 'reviewer' | 'researcher' | 'executor';
  acceptanceCriteria?: string[];
  testTaskId?: string;
  phase: 'design' | 'develop' | 'verify' | 'accept';
}

export interface UserAnswers {
  objective?: string;
  techStack?: string[];
  testCoverage?: string;
  documentationLevel?: string;
  additionalContext?: Record<string, string>;
}

/**
 * TaskPlanner - 任务拆解器
 *
 * 增强版特性:
 * 1. 更细粒度的任务拆分 (每个目标拆分为设计+实现+测试)
 * 2. 测试任务配对 (每个开发任务自动生成对应测试任务)
 * 3. 验收标准注入 (从用户回答中提取)
 * 4. 用户上下文注入 (将用户回答注入任务描述)
 * 5. 依赖关系分析 (自动分析任务间依赖)
 */
export class TaskPlanner {
  private userAnswers: UserAnswers;

  constructor(userAnswers?: UserAnswers) {
    this.userAnswers = userAnswers || {};
  }

  /**
   * 设置用户回答
   */
  setUserAnswers(answers: UserAnswers): void {
    this.userAnswers = answers;
  }

  /**
   * Break down a parsed task into sub-tasks
   *
   * 增强版: 生成更细粒度的任务，包含设计、开发、测试配对
   */
  breakdown(parsedTask: ParsedTask, answers: Record<string, string>): TaskBreakdown[] {
    const breakdowns: TaskBreakdown[] = [];
    const seenTitles = new Set<string>();
    const userContext = this.extractUserContext(answers);

    // 0. 设计阶段任务
    if (parsedTask.goals.length > 1) {
      breakdowns.push({
        taskId: this.generateTaskId(),
        title: '架构设计和任务规划',
        description: `分析需求，设计整体架构，规划实现方案

## 用户需求
${userContext.objective || '未指定'}

## 技术栈
${userContext.techStack?.join(', ') || '未指定'}

## 输出
- 架构设计文档
- 接口定义
- 任务依赖图`,
        priority: 'P0',
        dependencies: [],
        estimatedComplexity: 'high',
        assignedAgent: 'planner',
        phase: 'design',
        acceptanceCriteria: [
          '架构设计文档完整',
          '所有模块接口已定义',
          '依赖关系明确',
          '技术方案可行'
        ]
      });
    }

    // 1. 为每个目标创建细粒度任务
    const devTaskIds: string[] = [];

    for (let i = 0; i < parsedTask.goals.length; i++) {
      const goal = parsedTask.goals[i];

      // 跳过重复项
      if (seenTitles.has(goal)) {
        continue;
      }
      seenTitles.add(goal);

      // 创建开发任务
      const devTaskId = this.generateTaskId();
      devTaskIds.push(devTaskId);

      const acceptanceCriteria = this.generateAcceptanceCriteria(goal, userContext);

      breakdowns.push({
        taskId: devTaskId,
        title: `实现: ${goal}`,
        description: this.buildTaskDescription(goal, userContext, answers),
        priority: this.determinePriority(i),
        dependencies: i === 0 && parsedTask.goals.length > 1
          ? [breakdowns[0].taskId] // 依赖设计任务
          : (i > 0 ? [devTaskIds[i - 1]] : []), // 依赖前一个开发任务
        estimatedComplexity: this.estimateComplexity(goal),
        assignedAgent: 'coder',
        phase: 'develop',
        acceptanceCriteria,
        testTaskId: undefined // 稍后关联
      });

      // 为每个开发任务创建配对的测试任务
      const testTaskId = this.generateTaskId();
      breakdowns.push({
        taskId: testTaskId,
        title: `测试: ${goal}`,
        description: this.buildTestDescription(goal, devTaskId, userContext),
        priority: this.determinePriority(i),
        dependencies: [devTaskId], // 测试依赖开发任务
        estimatedComplexity: 'medium',
        assignedAgent: 'tester',
        phase: 'verify',
        acceptanceCriteria: [
          `单元测试覆盖率 >= ${userContext.testCoverage || '60%'}`,
          '边界情况已测试',
          '异常处理已验证',
          '所有测试通过'
        ]
      });

      // 关联测试任务 ID
      breakdowns[breakdowns.length - 2].testTaskId = testTaskId;
    }

    // 2. 代码审查任务 (仅在有开发任务时创建)
    if (devTaskIds.length > 0) {
      breakdowns.push({
        taskId: this.generateTaskId(),
        title: '代码审查',
        description: `对所有开发任务进行代码审查

## 审查范围
${devTaskIds.map(id => `- ${id}`).join('\n')}

## 审查要点
- 代码质量
- 安全性
- 性能
- 最佳实践`,
        priority: 'P1',
        dependencies: devTaskIds,
        estimatedComplexity: 'medium',
        assignedAgent: 'reviewer',
        phase: 'verify',
        acceptanceCriteria: [
          '无严重代码问题',
          '无安全隐患',
          '代码符合规范',
          '审查报告已生成'
        ]
      });
    }

    // 3. 集成测试任务 (如果有多个交付物)
    if (parsedTask.deliverables.length > 1) {
      breakdowns.push({
        taskId: this.generateTaskId(),
        title: '集成测试',
        description: `验证所有交付物正确集成

## 交付物
${parsedTask.deliverables.map(d => `- ${d}`).join('\n')}

## 测试范围
- 模块间接口
- 端到端流程
- 数据流验证`,
        priority: 'P1',
        dependencies: devTaskIds,
        estimatedComplexity: 'medium',
        assignedAgent: 'tester',
        phase: 'verify',
        acceptanceCriteria: [
          '所有模块正确集成',
          '端到端流程通过',
          '接口兼容性验证',
          '集成测试报告完整'
        ]
      });
    }

    // 4. 文档任务 (如果需要)
    if (userContext.documentationLevel && userContext.documentationLevel !== '无需文档') {
      breakdowns.push({
        taskId: this.generateTaskId(),
        title: '文档编写',
        description: `编写项目文档

## 文档级别
${userContext.documentationLevel}

## 文档内容
- README 更新
- API 文档
- 使用说明`,
        priority: 'P2',
        dependencies: devTaskIds,
        estimatedComplexity: 'low',
        assignedAgent: 'executor',
        phase: 'accept',
        acceptanceCriteria: [
          'README 已更新',
          'API 文档完整',
          '使用说明清晰'
        ]
      });
    }

    return breakdowns;
  }

  /**
   * 提取用户上下文
   */
  private extractUserContext(answers: Record<string, string>): UserAnswers {
    return {
      objective: answers['目标'] || answers['objective'],
      techStack: this.parseArrayAnswer(answers['技术栈'] || answers['techStack']),
      testCoverage: answers['测试'] || answers['testCoverage'],
      documentationLevel: answers['文档'] || answers['documentationLevel'],
      additionalContext: answers
    };
  }

  /**
   * 解析数组类型的回答
   */
  private parseArrayAnswer(answer: string): string[] {
    if (!answer) return [];
    // 处理逗号分隔或换行分隔的答案
    return answer.split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
  }

  /**
   * 构建任务描述 (注入用户上下文)
   */
  private buildTaskDescription(
    goal: string,
    userContext: UserAnswers,
    answers: Record<string, string>
  ): string {
    const parts: string[] = [];

    parts.push(`## 任务目标\n${goal}\n`);

    if (userContext.objective) {
      parts.push(`## 整体目标\n${userContext.objective}\n`);
    }

    if (userContext.techStack && userContext.techStack.length > 0) {
      parts.push(`## 技术栈要求\n${userContext.techStack.map(t => `- ${t}`).join('\n')}\n`);
    }

    // 注入所有用户回答
    const relevantAnswers = Object.entries(answers).filter(
      ([key]) => !['目标', '技术栈', '测试', '文档', 'objective', 'techStack', 'testCoverage', 'documentationLevel'].includes(key)
    );

    if (relevantAnswers.length > 0) {
      parts.push(`## 其他要求\n${relevantAnswers.map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n`);
    }

    parts.push(`## 输出要求
- 完成功能实现
- 代码可编译
- 遵循项目规范
- 添加必要注释`);

    return parts.join('\n');
  }

  /**
   * 构建测试任务描述
   */
  private buildTestDescription(
    goal: string,
    devTaskId: string,
    userContext: UserAnswers
  ): string {
    const coverage = this.parseCoverage(userContext.testCoverage || '60%');

    return `## 测试目标
为 "${goal}" 编写测试用例

## 关联开发任务
${devTaskId}

## 测试要求
- 单元测试覆盖率 >= ${coverage}%
- 测试正常流程
- 测试边界情况
- 测试异常处理

## 测试文件
- 创建 \`.test.ts\` 或 \`.spec.ts\` 文件
- 放置在与源文件相同目录或 \`tests/\` 目录

## 输出
- 测试文件
- 测试报告
- 覆盖率报告`;
  }

  /**
   * 解析覆盖率数值
   */
  private parseCoverage(coverageStr: string): number {
    const match = coverageStr.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 60;
  }

  /**
   * 生成验收标准
   */
  private generateAcceptanceCriteria(goal: string, userContext: UserAnswers): string[] {
    const criteria: string[] = [
      `功能 "${goal}" 已实现`,
      '代码可编译，无错误',
      '代码符合项目规范',
      '必要的注释已添加'
    ];

    if (userContext.testCoverage) {
      criteria.push(`测试覆盖率 >= ${userContext.testCoverage}`);
    }

    if (userContext.techStack?.length) {
      criteria.push(`使用指定技术栈: ${userContext.techStack.join(', ')}`);
    }

    criteria.push('无安全隐患');
    criteria.push('边界情况已处理');

    return criteria;
  }

  private generateTaskId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 4).toUpperCase();
    return `TASK-${timestamp}${rand}`;
  }

  private determinePriority(goalIndex: number): 'P0' | 'P1' | 'P2' | 'P3' {
    // First goal is highest priority
    if (goalIndex === 0) return 'P1';
    return 'P2';
  }

  private estimateComplexity(goal: string): 'low' | 'medium' | 'high' {
    if (goal.includes('测试')) return 'medium';
    if (goal.includes('实现') || goal.includes('开发')) return 'medium';
    if (goal.includes('设计') || goal.includes('研究')) return 'high';
    if (goal.includes('文档') || goal.includes('说明')) return 'low';
    return 'medium';
  }
}
