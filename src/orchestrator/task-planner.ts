// src/orchestrator/task-planner.ts
import type { ParsedTask, QualityConfig } from '../types/index.js';
import type { Task } from '../types/index.js';
import { translateBrainstormAnswers } from './answer-mapper.js';

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
  additionalContext?: Record<string, string | string[]>;
  /** 是否启用 E2E 测试 */
  e2eTests?: boolean;
  /** E2E 测试类型 (web/mobile/gui) */
  e2eType?: 'web' | 'mobile' | 'gui';
  /** 质量级别 */
  qualityLevel?: 'fast' | 'balanced' | 'strict';
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
 * 6. 并行执行 (独立任务互不依赖)
 * 7. 质量级别感知 (根据配置调整测试覆盖率)
 */
export class TaskPlanner {
  private userAnswers: UserAnswers;
  private taskCounter = 0;

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
   */
  breakdown(
    parsedTask: ParsedTask,
    answers: Record<string, string>,
    qualityConfig?: QualityConfig,
    plan?: string
  ): TaskBreakdown[] {
    const breakdowns: TaskBreakdown[] = [];
    const seenTitles = new Set<string>();
    const userContext = this.extractUserContext(answers);

    // qualityConfig 中的 e2eTests 优先级高于 answers 中的推断
    if (qualityConfig?.e2eTests) {
      userContext.e2eTests = true;
      // 如果 e2eType 未指定，从质量配置推断
      if (!userContext.e2eType) {
        userContext.e2eType = 'web';
      }
    }

    // 确定测试覆盖率
    const coverageTarget = this.getCoverageTarget(qualityConfig, userContext);

    // 构建全局上下文块（注入到每个子任务描述中，供 agent 参考）
    const globalContext = this.buildGlobalContext(parsedTask, userContext, plan);

    // 0. 设计阶段任务 (根据复杂度判断)
    let designTaskId: string | undefined;
    if (this.needsDesignPhase(parsedTask)) {
      designTaskId = this.generateTaskId();
      breakdowns.push({
        taskId: designTaskId,
        title: '架构设计和任务规划',
        description: `分析需求，设计整体架构，规划实现方案

${globalContext}

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

    // 1. 为每个目标创建任务（根据目标类型决定拆分策略）
    const devTaskIds: string[] = [];

    for (let i = 0; i < parsedTask.goals.length; i++) {
      const goal = parsedTask.goals[i];

      // 跳过重复项
      if (seenTitles.has(goal)) {
        continue;
      }
      seenTitles.add(goal);

      const goalType = this.classifyGoal(goal);
      const deps = designTaskId ? [designTaskId] : [];

      if (goalType === 'development') {
        // 开发类目标: 拆分为实现 + 测试 对
        const devTaskId = this.generateTaskId();
        devTaskIds.push(devTaskId);

        const acceptanceCriteria = this.generateAcceptanceCriteria(goal, userContext);

        breakdowns.push({
          taskId: devTaskId,
          title: `实现: ${goal}`,
          description: this.buildTaskDescription(goal, globalContext),
          priority: this.determinePriority(i),
          dependencies: deps,
          estimatedComplexity: this.estimateComplexity(goal),
          assignedAgent: 'coder',
          phase: 'develop',
          acceptanceCriteria,
          testTaskId: undefined
        });

        // 配对的测试任务
        const testTaskId = this.generateTaskId();
        breakdowns.push({
          taskId: testTaskId,
          title: `测试: ${goal}`,
          description: this.buildTestDescription(goal, devTaskId, coverageTarget, globalContext),
          priority: this.determinePriority(i),
          dependencies: [devTaskId],
          estimatedComplexity: 'medium',
          assignedAgent: 'tester',
          phase: 'verify',
          acceptanceCriteria: [
            `单元测试覆盖率 >= ${coverageTarget}%`,
            '边界情况已测试',
            '异常处理已验证',
            '所有测试通过'
          ]
        });

        breakdowns[breakdowns.length - 2].testTaskId = testTaskId;
      } else if (goalType === 'testing') {
        // 测试类目标: 直接创建单个测试任务
        const taskId = this.generateTaskId();
        breakdowns.push({
          taskId,
          title: goal,
          description: `## 测试目标\n${goal}\n\n${globalContext}\n\n## 测试要求\n- 单元测试覆盖率 >= ${coverageTarget}%\n- 测试正常流程\n- 测试边界情况\n- 测试异常处理\n\n## 输出\n- 测试文件\n- 测试报告\n- 覆盖率报告`,
          priority: this.determinePriority(i),
          dependencies: deps,
          estimatedComplexity: 'medium',
          assignedAgent: 'tester',
          phase: 'verify',
          acceptanceCriteria: [
            `测试覆盖率 >= ${coverageTarget}%`,
            '边界情况已测试',
            '所有测试通过',
            '测试报告已生成'
          ]
        });
      } else if (goalType === 'documentation') {
        // 文档类目标: 直接创建单个文档任务
        const taskId = this.generateTaskId();
        breakdowns.push({
          taskId,
          title: goal,
          description: `## 文档目标\n${goal}\n\n${globalContext}\n\n## 输出要求\n- 文档内容完整\n- 格式清晰\n- 示例代码可运行`,
          priority: this.determinePriority(i),
          dependencies: deps,
          estimatedComplexity: 'low',
          assignedAgent: 'executor',
          phase: 'accept',
          acceptanceCriteria: [
            '文档内容完整',
            '格式规范',
            '示例可运行'
          ]
        });
      } else {
        // 其他类型（配置、优化等）: 单个任务
        const taskId = this.generateTaskId();
        breakdowns.push({
          taskId,
          title: goal,
          description: `## 目标\n${goal}\n\n${globalContext}\n\n## 输出要求\n- 完成目标\n- 验证结果正确`,
          priority: this.determinePriority(i),
          dependencies: deps,
          estimatedComplexity: this.estimateComplexity(goal),
          assignedAgent: 'coder',
          phase: 'develop',
          acceptanceCriteria: [
            `目标 "${goal}" 已完成`,
            '结果已验证'
          ]
        });
      }
    }

    // 2. 系统集成任务 (将所有模块组装到入口文件)
    let integrationTaskId: string | undefined;
    if (devTaskIds.length > 1) {
      integrationTaskId = this.generateTaskId();
      breakdowns.push({
        taskId: integrationTaskId,
        title: '系统集成: 将所有模块组装到主入口，确保可运行',
        description: `将前面所有模块连接到主入口文件(main.ts/index.ts)，使应用可以完整运行

${globalContext}

## 集成要求
- 在主入口文件中实例化所有核心模块
- 将子系统连接到主循环(Game/App/Main)
- 确保模块间事件/数据流通
- 确保应用可以启动并正常运行（无运行时错误）

## 已完成的模块
${devTaskIds.map(id => `- ${id}: ${breakdowns.find(b => b.taskId === id)?.title || ''}`).join('\n')}

## 输出
- 更新后的主入口文件
- 模块连接正确，应用可运行
- 启动后无运行时错误`,
        priority: 'P0',
        dependencies: devTaskIds, // 依赖所有开发任务完成
        estimatedComplexity: 'high',
        assignedAgent: 'coder',
        phase: 'develop',
        acceptanceCriteria: [
          '主入口文件已更新',
          '所有核心模块已实例化并连接',
          '应用可以正常启动',
          '无运行时错误',
          '模块间通信正常'
        ]
      });
    }

    // 3. 代码审查任务 (仅在有开发任务时创建)
    if (devTaskIds.length > 0) {
      // 审查依赖所有开发任务 + 系统集成任务（如果有）
      const reviewDeps = integrationTaskId
        ? [...devTaskIds, integrationTaskId]
        : [...devTaskIds];
      breakdowns.push({
        taskId: this.generateTaskId(),
        title: '代码审查',
        description: `对所有开发任务进行代码审查

${globalContext}

## 审查范围
${devTaskIds.map(id => `- ${id}`).join('\n')}

## 审查要点
- 代码质量
- 安全性
- 性能
- 最佳实践`,
        priority: 'P1',
        dependencies: reviewDeps,
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
      const integrationTestDeps = integrationTaskId
        ? [...devTaskIds, integrationTaskId]
        : [...devTaskIds];
      breakdowns.push({
        taskId: this.generateTaskId(),
        title: '集成测试',
        description: `验证所有交付物正确集成

${globalContext}

## 测试范围
- 模块间接口
- 端到端流程
- 数据流验证`,
        priority: 'P1',
        dependencies: integrationTestDeps,
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

    // 4. E2E 测试任务 (如果启用)
    if (userContext.e2eTests) {
      const e2eTaskId = this.generateTaskId();
      const e2eType = userContext.e2eType || 'web';

      const allTestDependencies = [...devTaskIds];
      breakdowns.forEach(b => {
        if (b.phase === 'verify' && b.title.startsWith('测试:')) {
          allTestDependencies.push(b.taskId);
        }
      });

      breakdowns.push({
        taskId: e2eTaskId,
        title: '端到端(E2E)测试',
        description: this.buildE2ETestDescription(e2eType, parsedTask, userContext),
        priority: 'P0',
        dependencies: allTestDependencies,
        estimatedComplexity: 'high',
        assignedAgent: 'tester',
        phase: 'verify',
        acceptanceCriteria: [
          '所有 E2E 测试用例通过',
          '关键用户流程验证完成',
          '跨浏览器/设备兼容性验证',
          'E2E 测试报告已生成',
          '无阻塞级别的缺陷'
        ]
      });
    }

    // 5. 文档任务 (如果需要)
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
   * 判断是否需要设计阶段
   *
   * 条件: 多个 goal，或 goal 包含复杂关键词
   */
  private needsDesignPhase(parsedTask: ParsedTask): boolean {
    if (parsedTask.goals.length > 1) return true;

    // 单 goal 但包含复杂关键词
    const complexKeywords = [
      '系统', '架构', '模块', '集成', '完整', '平台',
      '体系', '框架', '全栈', '端到端', '多个', '一系列',
      'system', 'architecture', 'framework', 'fullstack', 'integration'
    ];

    const allText = `${parsedTask.title} ${parsedTask.goals.join(' ')} ${parsedTask.description}`.toLowerCase();
    return complexKeywords.some(kw => allText.includes(kw.toLowerCase()));
  }

  /**
   * 获取测试覆盖率目标
   */
  private getCoverageTarget(qualityConfig?: QualityConfig, userContext?: UserAnswers): number {
    // 优先使用 qualityConfig
    if (qualityConfig) {
      return qualityConfig.minCoverage;
    }
    // 其次使用用户回答
    if (userContext?.testCoverage) {
      const match = userContext.testCoverage.match(/(\d+)/);
      if (match) return parseInt(match[1], 10);
    }
    // 默认
    return 60;
  }

  /**
   * 提取用户上下文
   */
  private extractUserContext(answers: Record<string, string>): UserAnswers {
    // 先翻译 brainstorm 规范键为 planner 期望的键
    const translated = translateBrainstormAnswers(answers);
    const merged = { ...answers, ...translated };

    // 辅助函数：提取字符串值（处理 string[] 情况）
    const str = (v: string | string[] | undefined): string | undefined =>
      Array.isArray(v) ? v.join(', ') : v;

    const e2eAnswer = str(merged['E2E测试'] || merged['e2eTests'] || merged['e2e']);
    const e2eTypeAnswer = str(merged['E2E类型'] || merged['e2eType']);

    return {
      objective: str(merged['目标'] || merged['objective']),
      techStack: this.parseArrayAnswer(str(merged['技术栈'] || merged['techStack']) || ''),
      testCoverage: str(merged['测试'] || merged['testCoverage']),
      documentationLevel: str(merged['文档'] || merged['documentationLevel']),
      e2eTests: e2eAnswer === 'true' || e2eAnswer === '✅ 启用 E2E 测试' || e2eAnswer === '是',
      e2eType: (e2eTypeAnswer as 'web' | 'mobile' | 'gui') || 'web',
      additionalContext: merged
    };
  }

  private parseArrayAnswer(answer: string | undefined): string[] {
    if (!answer) return [];
    return answer.split(/[,，\n]/).map(s => s.trim()).filter(Boolean);
  }

  /**
   * 构建全局上下文块（注入到每个子任务描述中）
   */
  private buildGlobalContext(
    parsedTask: ParsedTask,
    userContext: UserAnswers,
    plan?: string
  ): string {
    const parts: string[] = [];

    if (parsedTask.title) {
      parts.push(`## 整体任务\n${parsedTask.title}`);
    }

    if (parsedTask.description) {
      parts.push(`## 任务描述\n${parsedTask.description}`);
    }

    if (plan) {
      parts.push(`## 执行计划\n${plan}`);
    }

    if (parsedTask.goals.length > 0) {
      parts.push(`## 所有目标\n${parsedTask.goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}`);
    }

    if (parsedTask.constraints.length > 0) {
      parts.push(`## 约束条件\n${parsedTask.constraints.map(c => `- ${c}`).join('\n')}`);
    }

    if (parsedTask.deliverables.length > 0) {
      parts.push(`## 交付物\n${parsedTask.deliverables.map(d => `- ${d}`).join('\n')}`);
    }

    if (userContext.techStack && userContext.techStack.length > 0) {
      parts.push(`## 技术栈\n${userContext.techStack.map(t => `- ${t}`).join('\n')}`);
    }

    if (userContext.additionalContext) {
      const relevantAnswers = Object.entries(userContext.additionalContext).filter(
        ([key]) => !['目标', '技术栈', '测试', '文档', 'objective', 'techStack', 'testCoverage', 'documentationLevel'].includes(key)
      );
      if (relevantAnswers.length > 0) {
        parts.push(`## 其他要求\n${relevantAnswers.map(([k, v]) => `- ${k}: ${v}`).join('\n')}`);
      }
    }

    return parts.join('\n');
  }

  private buildTaskDescription(
    goal: string,
    globalContext: string
  ): string {
    return `## 当前子任务目标\n${goal}\n\n${globalContext}\n\n## 输出要求
- 完成功能实现
- 代码可编译
- 遵循项目规范
- 添加必要注释`;
  }

  private buildTestDescription(
    goal: string,
    devTaskId: string,
    coverageTarget: number,
    globalContext: string
  ): string {
    return `## 测试目标
为 "${goal}" 编写测试用例

${globalContext}

## 关联开发任务
${devTaskId}

## 测试要求
- 单元测试覆盖率 >= ${coverageTarget}%
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

  private buildE2ETestDescription(
    e2eType: 'web' | 'mobile' | 'gui',
    parsedTask: ParsedTask,
    userContext: UserAnswers
  ): string {
    const typeConfig = this.getE2ETypeConfig(e2eType);

    return `## E2E 测试目标
执行完整的端到端测试，验证关键用户流程

## 应用类型
${typeConfig.description}

## 测试框架
${typeConfig.frameworks.map(f => `- ${f}`).join('\n')}

## 测试范围
${parsedTask.goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

## 关键用户流程
根据应用功能，测试以下流程:
${this.generateUserFlows(parsedTask, e2eType)}

## 测试环境
${typeConfig.environments.map(e => `- ${e}`).join('\n')}

## 测试要求
1. **关键路径覆盖**: 所有核心用户流程必须有 E2E 测试
2. **断言完整**: 每个测试步骤必须有明确的断言
3. **等待策略**: 使用合理的等待机制，避免硬编码延迟
4. **数据隔离**: 测试数据独立，不影响其他测试
5. **清理机制**: 测试后清理创建的数据

## 输出要求
- E2E 测试文件 (tests/e2e/*.spec.ts)
- 测试执行报告
- 截图/录像 (失败时)
- 测试覆盖率报告 (如有)

## 运行命令
\`\`\`bash
${typeConfig.runCommand}
\`\`\`

## 验收标准
- [ ] 所有 E2E 测试用例通过
- [ ] 关键用户流程验证完成
- [ ] 跨浏览器/设备兼容性验证
- [ ] E2E 测试报告已生成
- [ ] 无阻塞级别的缺陷`;
  }

  private getE2ETypeConfig(type: 'web' | 'mobile' | 'gui'): {
    description: string;
    frameworks: string[];
    environments: string[];
    runCommand: string;
  } {
    const configs = {
      web: {
        description: 'Web 应用 (浏览器)',
        frameworks: ['Playwright (推荐)', 'Cypress', 'Selenium WebDriver', 'Puppeteer'],
        environments: ['Chrome', 'Firefox', 'Safari', 'Edge', 'Mobile Viewports'],
        runCommand: 'npx playwright test --reporter=html'
      },
      mobile: {
        description: '移动应用 (iOS/Android)',
        frameworks: ['Appium', 'Detox (React Native)', 'XCUITest (iOS)', 'Espresso (Android)'],
        environments: ['iOS Simulator', 'Android Emulator', 'Real Devices'],
        runCommand: 'npx appium --base-path /wd/hub && npm run test:e2e'
      },
      gui: {
        description: 'GUI 桌面应用 (Electron/Native)',
        frameworks: ['Playwright for Electron', 'Spectron (Electron)', 'Robot Framework', 'PyAutoGUI'],
        environments: ['Windows', 'macOS', 'Linux'],
        runCommand: 'npm run test:e2e'
      }
    };
    return configs[type];
  }

  private generateUserFlows(parsedTask: ParsedTask, type: 'web' | 'mobile' | 'gui'): string {
    const flows: string[] = [];
    const goals = parsedTask.goals;

    goals.forEach((goal, i) => {
      flows.push(`\n### 流程 ${i + 1}: ${goal}`);
      flows.push('```gherkin');
      flows.push(`Feature: ${goal}`);
      flows.push('');
      flows.push('  Scenario: 正常流程');
      flows.push(`    Given 用户已启动应用`);
      flows.push(`    When 用户执行 "${goal}" 操作`);
      flows.push(`    Then 操作成功完成`);
      flows.push('```');
    });

    return flows.join('\n');
  }

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
    this.taskCounter++;
    return `TASK-${String(this.taskCounter).padStart(3, '0')}`;
  }

  private determinePriority(goalIndex: number): 'P0' | 'P1' | 'P2' | 'P3' {
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

  /**
   * 分类目标类型
   * - development: 需要编写代码的功能实现 → 拆分为实现+测试对
   * - testing: 已明确是测试任务 → 单个测试任务
   * - documentation: 文档编写 → 单个文档任务
   * - other: 其他类型（配置、优化、部署等） → 单个任务
   */
  private classifyGoal(goal: string): 'development' | 'testing' | 'documentation' | 'other' {
    const g = goal.toLowerCase();

    // 测试类关键词
    const testKeywords = [
      '测试', 'test', 'testing', 'tdd', 'e2e', 'e2e测试',
      '单元测试', '集成测试', '端到端', '覆盖率', 'coverage',
      'vitest', 'jest', 'mocha', 'playwright', 'cypress',
    ];
    if (testKeywords.some(kw => g.includes(kw))) {
      return 'testing';
    }

    // 文档类关键词
    const docKeywords = [
      '文档', 'document', 'documentation', 'readme', '说明',
      '指南', 'guide', 'tutorial', 'api文档',
    ];
    if (docKeywords.some(kw => g.includes(kw))) {
      return 'documentation';
    }

    // 非开发类关键词（配置、部署等）
    const nonDevKeywords = [
      '配置', 'config', 'deploy', '部署', 'ci/cd', '发布',
      'release', '优化', '监控', 'monitor', '日志',
    ];

    // 如果只包含非开发关键词而不包含开发关键词，归为 other
    const devKeywords = [
      '实现', '开发', '编写', '创建', '构建', '添加', '修复',
      'implement', 'develop', 'build', 'create', 'add', 'fix',
      '功能', 'feature', '模块', '组件', 'component', '系统',
    ];
    if (nonDevKeywords.some(kw => g.includes(kw)) && !devKeywords.some(kw => g.includes(kw))) {
      return 'other';
    }

    // 默认为开发类
    return 'development';
  }
}
