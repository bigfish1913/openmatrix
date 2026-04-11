// src/orchestrator/task-planner.ts
import type { ParsedTask, QualityConfig } from '../types/index.js';
import type { Task } from '../types/index.js';
import { translateBrainstormAnswers } from './answer-mapper.js';

/**
 * 从 plan 中解析出的结构化模块信息
 */
export interface PlanModule {
  /** 模块名称，如 "用户域" */
  name: string;
  /** 模块描述 */
  description: string;
  /** 关联的表，如 ["users", "user_profiles"] */
  tables: string[];
  /** 模块类型 */
  type: 'domain' | 'feature' | 'infra' | 'system';
  /** 依赖的其他模块名称 */
  dependsOn: string[];
  /** 预估复杂度 */
  complexity: 'low' | 'medium' | 'high';
}

/**
 * 从 plan 中解析出的结构化信息
 */
export interface ParsedPlan {
  /** 核心模块列表 */
  modules: PlanModule[];
  /** 技术栈摘要 */
  techStack: string[];
  /** 原始 plan 文本 */
  raw: string;
}

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
   * 解析 plan 文本，提取模块、技术栈、数据模型等结构化信息
   */
  parsePlan(planText: string): ParsedPlan {
    const modules: PlanModule[] = [];
    const techStack: string[] = [];

    // 1. 提取技术栈
    const techStackMatch = planText.match(/(?:技术栈|Technology)[\s\S]*?((?:- .+\n?)+)/i);
    if (techStackMatch) {
      techStackMatch[1].split('\n').forEach(line => {
        const trimmed = line.replace(/^- /, '').trim();
        if (trimmed) techStack.push(trimmed);
      });
    }

    // 2. 提取模块定义
    // 模式1: "N领域模块: A、B、C..." 或 "N个领域模块: A, B, C"
    const moduleListMatch = planText.match(/(\d+)\s*(?:个)?领域模块\s*[:：]\s*(.+)/i);
    if (moduleListMatch) {
      const moduleNames = moduleListMatch[2]
        .split(/[,，、]/)
        .map(s => s.trim().replace(/域$/, ''))
        .filter(s => s.length > 0 && s.length < 30);

      // 从 plan 中的 "数据模型" 部分提取表信息
      // 通用方式：查找以 "- " 开头的表名/实体名列表，不在模块列表中
      const moduleNamesSet = new Set(moduleNames.map(n => n.toLowerCase()));
      const allTables: string[] = [];
      const tableSections = planText.match(/(?:数据模型|database|tables?|schema|实体|模型)[\s\S]*?((?:[-*]\s*.+(?:\n|$))+)/gi);
      if (tableSections) {
        for (const section of tableSections) {
          const tableLines = section.split('\n')
            .map(l => l.replace(/^[-*]\s*/, '').trim())
            .filter(l => l.length > 0 && l.length < 50);
          for (const t of tableLines) {
            // 跳过看起来像模块名的条目
            const tLower = t.toLowerCase();
            if (!moduleNamesSet.has(tLower) && !t.includes(':') && !t.includes('—')) {
              allTables.push(t);
            }
          }
        }
      }

      for (const modName of moduleNames) {
        // 通用方式：从 plan 中查找该模块相关的表（包含模块名的行附近）
        const modLower = modName.toLowerCase();
        const modTables = allTables.filter(t =>
          t.toLowerCase().includes(modLower) ||
          modLower.includes(t.split(/[_\s]/)[0]?.toLowerCase() || '')
        );

        modules.push({
          name: modName,
          description: `${modName}模块`,
          tables: modTables,
          type: 'domain',
          dependsOn: [],
          complexity: this.estimateModuleComplexity(modName, modTables)
        });
      }

      // 分析模块间依赖
      this.analyzeModuleDependencies(modules, planText);
    }

    // 模式2: 架构设计部分的编号列表 "1. 用户域：描述"
    if (modules.length === 0) {
      const archMatch = planText.match(/架构设计[\s\S]*?((?:\d+\.\s*.+(?:\n|$))+)/i);
      if (archMatch) {
        const lines = archMatch[1].split('\n').filter(l => l.trim());
        for (const line of lines) {
          const modMatch = line.match(/\d+\.\s*(.+?)[：:\s](.*)/);
          if (modMatch) {
            const name = modMatch[1].replace(/域$/, '').trim();
            modules.push({
              name,
              description: modMatch[2].trim(),
              tables: [],
              type: 'domain',
              dependsOn: [],
              complexity: this.estimateModuleComplexity(name, [])
            });
          }
        }
        this.analyzeModuleDependencies(modules, planText);
      }
    }

    return { modules, techStack, raw: planText };
  }

  /**
   * 分析模块间依赖关系
   *
   * 策略：从 plan 文本中提取 AI 明确写的依赖信息，不做架构猜测。
   * 如果 plan 中没有指定依赖，模块之间并行执行。
   */
  private analyzeModuleDependencies(modules: PlanModule[], planText: string): void {
    for (let i = 0; i < modules.length; i++) {
      const mod = modules[i];
      if (mod.dependsOn.length > 0) continue; // parsePlan 中已提取的显式依赖，保留

      // 从 plan 文本中查找该模块是否提到依赖其他模块
      // 匹配模式："X 依赖 Y", "X 基于 Y", "X 使用 Y", "after X", "depends on X"
      const modContext = this.extractModuleContext(planText, mod.name);
      if (modContext) {
        for (const other of modules) {
          if (other.name === mod.name) continue;
          // 如果上下文中提到其他模块且暗示依赖关系
          const depPatterns = [
            new RegExp(`${other.name}.*(?:依赖|基于|需要|使用|after|depends)`, 'i'),
            new RegExp(`(?:依赖|基于|需要|使用|after|depends).*${other.name}`, 'i'),
          ];
          for (const pattern of depPatterns) {
            if (pattern.test(modContext)) {
              mod.dependsOn.push(other.name);
              break;
            }
          }
        }
      }

      // 如果 plan 中模块是按顺序编号的，后面编号的模块依赖前面的
      // 这只在模块名称是编号格式时适用（如 "1. 基础架构" → "2. 用户模块"）
      // 不做自动推断，保持模块间独立
    }
  }

  /**
   * 从 plan 文本中提取某个模块相关的上下文段落
   */
  private extractModuleContext(planText: string, moduleName: string): string | null {
    const lines = planText.split('\n');
    const startIdx = lines.findIndex(l => l.includes(moduleName));
    if (startIdx === -1) return null;

    // 从匹配行开始，收集到下一个编号标题或空行为止
    const contextLines: string[] = [];
    for (let i = startIdx; i < lines.length && i < startIdx + 20; i++) {
      const line = lines[i];
      if (contextLines.length > 0 && line.trim() === '') break;
      if (contextLines.length > 0 && /^\d+\./.test(line.trim())) break;
      contextLines.push(line);
    }
    return contextLines.join('\n');
  }

  /**
   * 预估模块复杂度 — 基于通用架构特征，不依赖具体业务领域
   */
  private estimateModuleComplexity(name: string, tables: string[]): 'low' | 'medium' | 'high' {
    // 表数量是最直接的复杂度指标
    if (tables.length >= 5) return 'high';
    if (tables.length >= 3) return 'medium';

    // 通用架构关键词
    const highKws = ['核心', '基础', '架构', '主循环', '引擎', '框架', '平台', '系统', 'orchestrator', 'engine', 'core', 'framework'];
    const mediumKws = ['管理', '服务', 'api', '接口', '控制器', '处理器', '管理器', 'manager', 'service', 'handler', 'processor', 'controller'];
    const lowKws = ['工具', '脚本', '配置', '样式', '工具', 'helper', 'util', 'config', 'style', 'theme'];

    const n = name.toLowerCase();
    if (highKws.some(kw => n.includes(kw))) return 'high';
    if (lowKws.some(kw => n.includes(kw))) return 'low';
    if (mediumKws.some(kw => n.includes(kw))) return 'medium';

    // 默认 medium（比默认 low 更保守，避免并行执行冲突）
    return 'medium';
  }
  breakdown(
    parsedTask: ParsedTask,
    answers: Record<string, string>,
    qualityConfig?: QualityConfig,
    plan?: string
  ): TaskBreakdown[] {
    // 如果提供了 plan 且解析出模块信息，使用细粒度的模块级拆分
    if (plan) {
      const parsed = this.parsePlan(plan);
      if (parsed.modules.length > 0) {
        return this.breakdownByModules(parsedTask, answers, qualityConfig, parsed, plan);
      }
    }

    // fallback: 按目标拆分的传统方式
    return this.breakdownByGoals(parsedTask, answers, qualityConfig, plan);
  }

  /**
   * 基于 plan 解析出的模块做细粒度任务拆分
   */
  private breakdownByModules(
    parsedTask: ParsedTask,
    answers: Record<string, string>,
    qualityConfig: QualityConfig | undefined,
    parsedPlan: ParsedPlan,
    plan: string
  ): TaskBreakdown[] {
    const breakdowns: TaskBreakdown[] = [];
    const userContext = this.extractUserContext(answers);

    if (qualityConfig?.e2eTests) {
      userContext.e2eTests = true;
      if (!userContext.e2eType) {
        userContext.e2eType = 'web';
      }
    }

    const coverageTarget = this.getCoverageTarget(qualityConfig, userContext);
    const globalContext = this.buildGlobalContext(parsedTask, userContext, plan);

    // 1. 为每个模块创建开发 + 测试任务对
    const devTaskIds: string[] = [];
    const moduleIdToTaskIds = new Map<string, string[]>();

    for (const mod of parsedPlan.modules) {
      const modTaskId = this.generateTaskId();
      devTaskIds.push(modTaskId);
      moduleIdToTaskIds.set(mod.name, [modTaskId]);

      // 构建模块描述 — 包含表名、依赖等具体信息
      let modDescription = `## 模块实现: ${mod.name}\n\n${mod.description}\n\n${globalContext}`;

      if (mod.tables.length > 0) {
        modDescription += `\n\n## 数据模型\n需要实现以下数据库表:\n${mod.tables.map(t => `- \`${t}\``).join('\n')}`;
      }

      if (mod.dependsOn.length > 0) {
        modDescription += `\n\n## 模块依赖\n本模块依赖以下模块: ${mod.dependsOn.join(', ')}\n请确保依赖模块的接口已定义并可调用。`;
      }

      modDescription += `\n\n## 输出要求\n- 完成模块实现\n- 代码可编译\n- 遵循项目规范\n- 添加必要注释`;

      // 计算模块任务的实际依赖（转换为 taskId）
      const modDeps: string[] = [];
      for (const depName of mod.dependsOn) {
        const depTaskIds = moduleIdToTaskIds.get(depName);
        if (depTaskIds) {
          modDeps.push(...depTaskIds);
        }
      }
      // 同时保留 phase 级别的依赖
      this.enforcePhaseDependenciesForModule(breakdowns, parsedTask, mod, modDeps);

      const complexity = this.estimateModuleComplexity(mod.name, mod.tables);

      breakdowns.push({
        taskId: modTaskId,
        title: `实现: ${mod.name}`,
        description: modDescription,
        priority: this.determineModulePriority(mod, parsedPlan.modules.indexOf(mod)),
        dependencies: modDeps,
        estimatedComplexity: complexity,
        assignedAgent: 'coder',
        phase: 'develop',
        acceptanceCriteria: this.generateModuleAcceptanceCriteria(mod, coverageTarget, userContext),
        testTaskId: undefined
      });

      // 配对的测试任务
      const testTaskId = this.generateTaskId();
      breakdowns.push({
        taskId: testTaskId,
        title: `测试: ${mod.name}`,
        description: `## 测试目标\n为 "${mod.name}" 模块编写测试用例\n\n${globalContext}\n\n## 关联开发任务\n${modTaskId}\n\n## 测试要求\n- 单元测试覆盖率 >= ${coverageTarget}%\n- 测试正常流程\n- 测试边界情况\n- 测试异常处理\n\n## 输出\n- 测试文件\n- 测试报告\n- 覆盖率报告`,
        priority: this.determineModulePriority(mod, parsedPlan.modules.indexOf(mod)),
        dependencies: [modTaskId],
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
      moduleIdToTaskIds.get(mod.name)!.push(testTaskId);
    }

    // 2. 系统集成任务
    let integrationTaskId: string | undefined;
    if (devTaskIds.length > 1) {
      integrationTaskId = this.generateTaskId();
      breakdowns.push({
        taskId: integrationTaskId,
        title: '系统集成: 将所有模块组装到主入口，确保可运行',
        description: `将前面所有模块连接在一起，使应用可以完整运行

${globalContext}

## 集成要求
- 确定项目的主入口文件并实例化所有核心模块
- 建立模块间通信和数据流
- 确保应用可以启动并正常运行

## 已完成的模块
${parsedPlan.modules.map(m => `- ${m.name} (${m.tables.length > 0 ? '表: ' + m.tables.join(', ') : '无数据模型'})`).join('\n')}

## 输出
- 更新后的主入口文件
- 模块连接正确，应用可运行
- 无运行时错误`,
        priority: 'P0',
        dependencies: [...devTaskIds],
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

    // 3. 代码审查任务
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
${parsedPlan.modules.map(m => `- ${m.name}: ${m.description}`).join('\n')}

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

    // 5. E2E 测试任务
    if (userContext.e2eTests) {
      const e2eTaskId = this.generateTaskId();
      const e2eType = userContext.e2eType || 'web';
      const allTestDeps = [...devTaskIds];
      breakdowns.forEach(b => {
        if (b.phase === 'verify' && b.title.startsWith('测试:')) {
          allTestDeps.push(b.taskId);
        }
      });

      breakdowns.push({
        taskId: e2eTaskId,
        title: '端到端(E2E)测试',
        description: this.buildE2ETestDescription(e2eType, parsedTask, userContext),
        priority: 'P0',
        dependencies: allTestDeps,
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

    // 6. 文档任务
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
   * 为模块任务添加 phase 级别的跨阶段依赖
   */
  private enforcePhaseDependenciesForModule(
    breakdowns: TaskBreakdown[],
    parsedTask: ParsedTask,
    mod: PlanModule,
    modDeps: string[]
  ): void {
    // 检测是否有顺序阶段，如果有则添加跨阶段依赖
    const phaseIndices = this.detectSequentialPhases(parsedTask.goals);
    if (phaseIndices.length < 2) return;

    // 找出当前模块属于哪个 phase goal
    let currentPhaseIndex = -1;
    for (let pi = 0; pi < phaseIndices.length; pi++) {
      const goalIndex = phaseIndices[pi];
      const goal = parsedTask.goals[goalIndex];
      if (mod.name.toLowerCase().includes(goal.toLowerCase().slice(0, 10)) ||
          goal.toLowerCase().includes(mod.name.toLowerCase().slice(0, 6))) {
        currentPhaseIndex = pi;
        break;
      }
    }

    if (currentPhaseIndex <= 0) return;

    // 添加对前一阶段所有模块任务的依赖
    const prevGoalIndex = phaseIndices[currentPhaseIndex - 1];
    for (const b of breakdowns) {
      if (b.phase === 'develop' && b.title.startsWith('实现: ')) {
        // 检查这个任务是否属于前一阶段
        const prevGoal = parsedTask.goals[prevGoalIndex];
        if (b.description.includes(prevGoal)) {
          if (!modDeps.includes(b.taskId)) {
            modDeps.push(b.taskId);
          }
        }
      }
    }
  }

  /**
   * 确定模块任务优先级
   */
  private determineModulePriority(mod: PlanModule, index: number): 'P0' | 'P1' | 'P2' | 'P3' {
    // 基础设施模块优先级更高
    if (mod.type === 'infra') return 'P0';
    // 有依赖的模块通常更核心
    if (mod.dependsOn.length === 0 && index === 0) return 'P0';
    if (mod.complexity === 'high') return 'P1';
    return 'P2';
  }

  /**
   * 为模块生成验收标准
   */
  private generateModuleAcceptanceCriteria(
    mod: PlanModule,
    coverageTarget: number,
    userContext: UserAnswers
  ): string[] {
    const criteria: string[] = [
      `模块 "${mod.name}" 功能已实现`,
      '代码可编译，无错误',
      '代码符合项目规范'
    ];

    if (mod.tables.length > 0) {
      criteria.push(`数据库表 ${mod.tables.join(', ')} 已实现并可访问`);
    }

    criteria.push(`测试覆盖率 >= ${coverageTarget}%`);
    criteria.push('必要的注释已添加');
    criteria.push('无安全隐患');
    criteria.push('边界情况已处理');

    if (userContext.techStack?.length) {
      criteria.push(`使用指定技术栈: ${userContext.techStack.join(', ')}`);
    }

    return criteria;
  }

  /**
   * 按目标拆分的传统方式（fallback）
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

      // 跳过重复项
      if (seenTitles.has(goal)) {
        continue;
      }
      seenTitles.add(goal);

      // 优先使用 AI 标注的类型，fallback 到关键词检测
      const goalType: 'development' | 'testing' | 'documentation' | 'other' =
        parsedTask.goalTypes?.[i] ?? this.classifyGoal(goal);
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

    // 6. 检测顺序阶段并建立跨阶段依赖（Phase 1 → Phase 2 → Phase 3 → ...）
    this.enforcePhaseDependencies(breakdowns, parsedTask);

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

    const isE2EEnabled = e2eAnswer === 'true' || e2eAnswer === 'functional' || e2eAnswer === 'visual' || e2eAnswer === '✅ 启用 E2E 测试' || e2eAnswer === '是';
    let e2eTypeValue: 'web' | 'mobile' | 'gui' | 'visual' = e2eAnswer === 'visual' ? 'visual' : e2eTypeAnswer === 'mobile' ? 'mobile' : e2eTypeAnswer === 'gui' ? 'gui' : 'web';

    return {
      objective: str(merged['目标'] || merged['objective']),
      techStack: this.parseArrayAnswer(str(merged['技术栈'] || merged['techStack']) || ''),
      testCoverage: str(merged['测试'] || merged['testCoverage']),
      documentationLevel: str(merged['文档'] || merged['documentationLevel']),
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
执行完整的端到端测试，验证关键用户流程
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
    // 按阶段索引在 goals 中的原始位置分组
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
          // 集成任务依赖当前阶段的所有开发任务
          const currentDeps = b.dependencies;
          if (currentDeps.every(d => devTaskIds.includes(d) || !devTaskIds.includes(d))) {
            integrationTaskId = b.taskId;
          }
        }
      }

      // 如果没有集成任务，使用最后一个开发任务 ID
      phaseTaskMap.set(goalIndex, { devTaskIds, integrationTaskId });
    }

    // 建立跨阶段依赖：Phase N 的所有任务依赖 Phase N-1 的集成任务（或最后开发任务）
    for (let pi = 1; pi < phaseIndices.length; pi++) {
      const currentGoalIndex = phaseIndices[pi];
      const prevGoalIndex = phaseIndices[pi - 1];
      const prevPhase = phaseTaskMap.get(prevGoalIndex);

      if (!prevPhase || prevPhase.devTaskIds.length === 0) continue;

      // 前一阶段的核心依赖点（优先集成任务，其次最后开发任务）
      const prevAnchor = prevPhase.integrationTaskId || prevPhase.devTaskIds[prevPhase.devTaskIds.length - 1];

      // 找出当前阶段的所有开发任务和集成任务
      for (const b of breakdowns) {
        const isCurrentPhaseDev = b.title.startsWith('实现: ') &&
          parsedTask.goals[currentGoalIndex] &&
          b.description.includes(parsedTask.goals[currentGoalIndex]);
        const isCurrentPhaseIntegration = b.title.startsWith('系统集成:');
        // 简化判断：通过依赖关系推断——集成任务依赖当前阶段开发任务
        const isCurrentPhaseTest = b.title.startsWith('测试: ') &&
          b.dependencies.some(dep => {
            // 测试任务依赖的开发任务属于当前阶段
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
