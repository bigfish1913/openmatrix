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
  /** E2E 测试类型 (web/mobile/gui/visual) */
  e2eType?: 'web' | 'mobile' | 'gui' | 'visual';
  /** 质量级别 */
  qualityLevel?: 'fast' | 'balanced' | 'strict';
}

/**
 * TaskPlanner - 任务拆解器
 *
 * Plan 原文作为原始上下文透传给 AI Agent，由 AI 自行理解和提取
 * 技术栈、数据模型、依赖关系等信息。CLI 层不做语义解析。
 */
export class TaskPlanner {
  private userAnswers: UserAnswers;
  /** 静态计数器，避免多实例生成重复 ID */
  private static taskCounter = 0;

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
   * 任务拆解 — 唯一路径：按目标拆分，plan 作为原始上下文透传
   */
  breakdown(
    parsedTask: ParsedTask,
    answers: Record<string, string>,
    qualityConfig?: QualityConfig,
    plan?: string
  ): TaskBreakdown[] {
    return this.breakdownByGoals(parsedTask, answers, qualityConfig, plan);
  }

  /**
   * 按目标拆分子任务
   */
  private breakdownByGoals(
    parsedTask: ParsedTask,
    answers: Record<string, string>,
    qualityConfig: QualityConfig | undefined,
    plan: string | undefined
  ): TaskBreakdown[] {
    const breakdowns: TaskBreakdown[] = [];
    const seenTitles = new Set<string>();
    const userContext = this.extractUserContext(answers);

    // qualityConfig 中的 e2eTests 优先级高于 answers 中的推断
    if (qualityConfig?.e2eTests) {
      userContext.e2eTests = true;
      if (!userContext.e2eType) {
        userContext.e2eType = 'web';
      }
    }

    // 确定测试覆盖率
    const coverageTarget = this.getCoverageTarget(qualityConfig, userContext);

    // 构建全局上下文块（注入到每个子任务描述中，供 agent 参考）
    const globalContext = this.buildGlobalContext(parsedTask, userContext, plan);

    // 0. 设计阶段任务 (根据复杂度判断)
    // 如果 AI 已提供 plan，跳过设计阶段（plan 中已包含架构设计）
    let designTaskId: string | undefined;
    if (!plan && this.needsDesignPhase(parsedTask)) {
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

      if (seenTitles.has(goal)) continue;
      seenTitles.add(goal);

      // goalTypes 由 AI 在 tasks-input.json 中必填
      const goalType: 'development' | 'testing' | 'documentation' | 'other' =
        parsedTask.goalTypes?.[i] ?? 'development';
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
          estimatedComplexity: this.estimateComplexity(goal, i, parsedTask),
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
          description: `## 测试目标
${goal}

${globalContext}

## 测试要求
- 单元测试覆盖率 >= ${coverageTarget}%
- 测试正常流程
- 测试边界情况
- 测试异常处理

## 输出
- 测试文件
- 测试报告
- 覆盖率报告`,
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
          description: `## 文档目标
${goal}

${globalContext}

## 输出要求
- 文档内容完整
- 格式清晰
- 示例代码可运行`,
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
          description: `## 目标
${goal}

${globalContext}

## 输出要求
- 完成目标
- 验证结果正确`,
          priority: this.determinePriority(i),
          dependencies: deps,
          estimatedComplexity: this.estimateComplexity(goal, i, parsedTask),
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
        description: `将前面所有模块连接在一起，使应用可以完整运行

${globalContext}

## 集成要求
- 确定项目的主入口文件（如 main.ts, index.ts, App.tsx 等）
- 实例化所有核心模块并建立模块间通信
- 确保数据流和事件流通正确
- 确保应用可以启动并正常运行

## 已完成的模块
${devTaskIds.map(id => `- ${id}: ${breakdowns.find(b => b.taskId === id)?.title || ''}`).join('\n')}

## 输出
- 更新后的主入口文件
- 模块连接正确，应用可运行
- 无运行时错误`,
        priority: 'P0',
        dependencies: devTaskIds,
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

    // 4. 集成测试任务 (如果有多个交付物)
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

    // 5. E2E 测试任务 (如果启用)
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

    // 6. 文档任务 (如果需要)
    if (userContext.documentationLevel && userContext.documentationLevel !== '无需') {
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

    // 7. 检测顺序阶段并建立跨阶段依赖（Phase 1 → Phase 2 → Phase 3 → ...）
    this.enforcePhaseDependencies(breakdowns, parsedTask);

    return breakdowns;
  }

  private needsDesignPhase(parsedTask: ParsedTask): boolean {
    return parsedTask.goals.length > 1;
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
   * 提取用户上下文 — 使用 translateBrainstormAnswers 映射后的规范化键
   */
  private extractUserContext(answers: Record<string, string>): UserAnswers {
    const translated = translateBrainstormAnswers(answers);
    const merged = { ...answers, ...translated };

    const str = (v: string | string[] | undefined): string | undefined =>
      Array.isArray(v) ? v.join(', ') : v;

    const e2eAnswer = str(merged['e2e_tests'] || merged['e2eTests']);
    const e2eTypeAnswer = str(merged['e2e_type'] || merged['e2eType']);

    const isE2EEnabled = e2eAnswer === 'functional' || e2eAnswer === 'visual' || e2eAnswer === 'true';
    const e2eTypeValue: 'web' | 'mobile' | 'gui' | 'visual' =
      e2eAnswer === 'visual' ? 'visual' :
      e2eTypeAnswer === 'visual' ? 'visual' :
      e2eTypeAnswer === 'mobile' ? 'mobile' :
      e2eTypeAnswer === 'gui' ? 'gui' : 'web';

    return {
      objective: str(merged['objective']),
      techStack: this.parseArrayAnswer(str(merged['tech_stack'] || merged['techStack'])),
      testCoverage: str(merged['test_coverage'] || merged['testCoverage']),
      documentationLevel: str(merged['documentation_level'] || merged['documentationLevel']),
      e2eTests: isE2EEnabled,
      e2eType: e2eTypeValue,
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
      parts.push(`## 整体任务
${parsedTask.title}`);
    }

    if (parsedTask.description) {
      parts.push(`## 任务描述
${parsedTask.description}`);
    }

    // Plan 原文完整透传，由 AI Agent 自行理解提取
    if (plan) {
      parts.push(`## 执行计划
${plan}`);
    }

    if (parsedTask.goals.length > 0) {
      parts.push(`## 所有目标
${parsedTask.goals.map((g, i) => `${i + 1}. ${g}`).join('\n')}`);
    }

    if (parsedTask.constraints.length > 0) {
      parts.push(`## 约束条件
${parsedTask.constraints.map(c => `- ${c}`).join('\n')}`);
    }

    if (parsedTask.deliverables.length > 0) {
      parts.push(`## 交付物
${parsedTask.deliverables.map(d => `- ${d}`).join('\n')}`);
    }

    if (userContext.techStack && userContext.techStack.length > 0) {
      parts.push(`## 技术栈
${userContext.techStack.map(t => `- ${t}`).join('\n')}`);
    }

    if (userContext.additionalContext) {
      const skipKeys = new Set(['objective', 'tech_stack', 'test_coverage', 'documentation_level', 'e2e_tests', 'e2e_type', 'quality_level', 'execution_mode']);
      const relevantAnswers = Object.entries(userContext.additionalContext).filter(
        ([key]) => !skipKeys.has(key)
      );
      if (relevantAnswers.length > 0) {
        parts.push(`## 其他要求
${relevantAnswers.map(([k, v]) => `- ${k}: ${v}`).join('\n')}`);
      }
    }

    return parts.join('\n');
  }

  private buildTaskDescription(
    goal: string,
    globalContext: string,
  ): string {
    return `## 当前子任务目标
${goal}

${globalContext}

## 输出要求
- 完成功能实现
- 代码可编译
- 遵循项目规范
- 添加必要注释`;
  }

  private buildTestDescription(
    goal: string,
    devTaskId: string,
    coverageTarget: number,
    globalContext: string,
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
    e2eType: 'web' | 'mobile' | 'gui' | 'visual',
    parsedTask: ParsedTask,
    userContext: UserAnswers
  ): string {
    const typeConfig = this.getE2ETypeConfig(e2eType);

    const visualSection = e2eType === 'visual' ? `
## 视觉验证要求
1. **可视化运行**: 使用有头模式 (headed mode) 运行浏览器，可查看页面渲染
2. **样式检查**: 验证页面布局、颜色、字体、间距等视觉元素
3. **响应式测试**: 在不同视口下验证页面布局适配
4. **交互验证**: 确保动画、过渡效果、hover 状态等交互正常
5. **截图对比**: 关键页面应生成截图，便于人工审核
` : '';

    return `## E2E 测试目标
执行完整的端到端测试，验证完整用户流程
${e2eType === 'visual' ? '（需可视化验证，检查页面样式和布局）' : ''}

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
${visualSection}
## 输出要求
- E2E 测试文件 (tests/e2e/*.spec.ts)
- 测试执行报告
- 截图/录像 (失败时)
${e2eType === 'visual' ? '- 关键页面截图 (用于视觉审核)\n' : ''}- 测试覆盖率报告 (如有)

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

  private getE2ETypeConfig(type: 'web' | 'mobile' | 'gui' | 'visual'): {
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
      },
      visual: {
        description: 'Web 应用 (需可视化验证，检查页面样式和布局)',
        frameworks: ['Playwright (headed mode，推荐)', 'Cypress (headed)', 'Playwright + Percy (视觉回归)', 'Playwright + Chromatic'],
        environments: ['Chrome (headed)', '不同视口 (desktop/tablet/mobile)', '不同分辨率设备'],
        runCommand: 'npx playwright test --headed --reporter=html,list'
      }
    };
    return configs[type];
  }

  private generateUserFlows(parsedTask: ParsedTask, type: 'web' | 'mobile' | 'gui' | 'visual'): string {
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
    TaskPlanner.taskCounter++;
    return `TASK-${String(TaskPlanner.taskCounter).padStart(3, '0')}`;
  }

  private determinePriority(goalIndex: number): 'P0' | 'P1' | 'P2' | 'P3' {
    if (goalIndex === 0) return 'P1';
    return 'P2';
  }

  private estimateComplexity(_goal: string, goalIndex: number, task: ParsedTask): 'low' | 'medium' | 'high' {
    // 优先使用 AI 标注的复杂度
    if (task.goalComplexity?.[goalIndex]) return task.goalComplexity[goalIndex];
    return 'medium';
  }


  /**
   * 检测顺序阶段目标（如 "Phase 1 基础架构"、"Phase 2 AI创作核心"）
   * 返回按阶段排序的索引列表
   */
  private detectSequentialPhases(goals: string[]): number[] {
    // 匹配 "Phase N" 或 "阶段 N" 或 "第 N 阶段" 等模式
    const phasePattern = /(?:phase|阶段|第\s*)(\d+)/i;
    const indexed: Array<{ index: number; phase: number }> = [];

    for (let i = 0; i < goals.length; i++) {
      const match = goals[i].match(phasePattern);
      if (match) {
        indexed.push({ index: i, phase: parseInt(match[1], 10) });
      }
    }

    // 按阶段号排序
    indexed.sort((a, b) => a.phase - b.phase);
    return indexed.map(x => x.index);
  }

  /**
   * 对顺序阶段建立跨阶段依赖
   *
   * 当 goals 包含 "Phase 1", "Phase 2", "Phase 3" 等顺序阶段时，
   * 后续阶段的所有开发任务必须依赖前一阶段的集成任务（或最后一个开发任务）。
   *
   * 这防止多个阶段同时执行导致文件冲突。
   */
  private enforcePhaseDependencies(breakdowns: TaskBreakdown[], parsedTask: ParsedTask): void {
    const phaseIndices = this.detectSequentialPhases(parsedTask.goals);
    if (phaseIndices.length < 2) return; // 少于 2 个阶段，不需要建立依赖

    // 收集每个阶段的开发任务 ID 和集成任务 ID
    const phaseTaskMap = new Map<number, { devTaskIds: string[]; integrationTaskId?: string }>();

    for (let pi = 0; pi < phaseIndices.length; pi++) {
      const goalIndex = phaseIndices[pi];
      const goal = parsedTask.goals[goalIndex];

      // 找出属于这个 goal 的开发任务和集成任务
      const devTaskIds: string[] = [];
      let integrationTaskId: string | undefined;

      for (const b of breakdowns) {
        // 开发任务标题包含 goal 内容
        if (b.title.startsWith('实现: ') && b.description.includes(goal)) {
          devTaskIds.push(b.taskId);
        }
        // 集成任务标题包含 "系统集成"
        if (b.title.startsWith('系统集成:') && devTaskIds.length > 0) {
          const currentDeps = b.dependencies;
          if (currentDeps.length === 0 || currentDeps.some(d => devTaskIds.includes(d))) {
            integrationTaskId = b.taskId;
          }
        }
      }

      phaseTaskMap.set(goalIndex, { devTaskIds, integrationTaskId });
    }

    // 建立跨阶段依赖：Phase N 的所有任务依赖 Phase N-1 的集成任务（或最后开发任务）
    for (let pi = 1; pi < phaseIndices.length; pi++) {
      const currentGoalIndex = phaseIndices[pi];
      const prevGoalIndex = phaseIndices[pi - 1];
      const prevPhase = phaseTaskMap.get(prevGoalIndex);

      if (!prevPhase || prevPhase.devTaskIds.length === 0) continue;

      const prevAnchor = prevPhase.integrationTaskId || prevPhase.devTaskIds[prevPhase.devTaskIds.length - 1];

      for (const b of breakdowns) {
        const isCurrentPhaseDev = b.title.startsWith('实现: ') &&
          parsedTask.goals[currentGoalIndex] &&
          b.description.includes(parsedTask.goals[currentGoalIndex]);
        const isCurrentPhaseIntegration = b.title.startsWith('系统集成:');
        const isCurrentPhaseTest = b.title.startsWith('测试: ') &&
          b.dependencies.some(dep => {
            const depTask = breakdowns.find(x => x.taskId === dep);
            return depTask && depTask.title.startsWith('实现: ') &&
              parsedTask.goals[currentGoalIndex] &&
              depTask.description.includes(parsedTask.goals[currentGoalIndex]);
          });

        if ((isCurrentPhaseDev || isCurrentPhaseIntegration || isCurrentPhaseTest) && !b.dependencies.includes(prevAnchor)) {
          b.dependencies.push(prevAnchor);
        }
      }
    }
  }
}
