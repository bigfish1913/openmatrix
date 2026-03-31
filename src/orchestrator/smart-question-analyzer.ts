// src/orchestrator/smart-question-analyzer.ts
import type { ParsedTask } from '../types/index.js';
import { InteractiveQuestion, QuestionAnswer, QuestionOption } from './interactive-question-generator.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 问题推断结果
 */
export interface QuestionInference {
  questionId: string;
  inferredAnswer?: string | string[];
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * 项目上下文
 */
export interface ProjectContext {
  projectType: 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'java' | 'unknown';
  frameworks: string[];
  hasFrontend: boolean;
  hasBackend: boolean;
  hasTests: boolean;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'go-mod' | 'cargo' | 'unknown';
  dependencies: Record<string, string>;
}

/**
 * 分析结果
 */
export interface AnalysisResult {
  inferences: QuestionInference[];
  questionsToAsk: string[];
  skippedQuestions: string[];
  projectContext: ProjectContext;
}

/**
 * SmartQuestionAnalyzer - 智能问答分析器
 *
 * 根据任务描述和项目上下文智能推断问题答案，减少不必要的问答
 *
 * 使用方式:
 * 1. 分析项目文件获取上下文
 * 2. 根据任务关键词推断答案
 * 3. 返回需要提问的问题列表
 */
export class SmartQuestionAnalyzer {
  private projectRoot: string;
  private cachedContext: ProjectContext | null = null;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * 分析任务，返回推断结果
   */
  async analyze(
    taskDescription: string,
    parsedTask?: ParsedTask
  ): Promise<AnalysisResult> {
    // 1. 获取项目上下文
    const projectContext = await this.getProjectContext();

    // 2. 执行推断
    const inferences = this.inferAnswers(taskDescription, projectContext);

    // 3. 筛选需要提问的问题
    const questionsToAsk = inferences
      .filter(i => i.confidence === 'low' || !i.inferredAnswer)
      .map(i => i.questionId);

    const skippedQuestions = inferences
      .filter(i => i.confidence !== 'low' && i.inferredAnswer)
      .map(i => i.questionId);

    return {
      inferences,
      questionsToAsk,
      skippedQuestions,
      projectContext
    };
  }

  /**
   * 获取项目上下文
   */
  async getProjectContext(): Promise<ProjectContext> {
    if (this.cachedContext) {
      return this.cachedContext;
    }

    const context: ProjectContext = {
      projectType: 'unknown',
      frameworks: [],
      hasFrontend: false,
      hasBackend: false,
      hasTests: false,
      packageManager: 'unknown',
      dependencies: {}
    };

    // 检测项目类型和依赖
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        context.packageManager = 'npm';
        context.dependencies = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        };

        // 检测 TypeScript
        if (context.dependencies['typescript'] || fs.existsSync(path.join(this.projectRoot, 'tsconfig.json'))) {
          context.projectType = 'typescript';
        } else {
          context.projectType = 'javascript';
        }

        // 检测框架
        const frameworkDeps: Record<string, string> = {
          'react': 'React',
          'vue': 'Vue',
          'svelte': 'Svelte',
          'angular': 'Angular',
          'next': 'Next.js',
          'nuxt': 'Nuxt.js',
          'express': 'Express',
          'fastify': 'Fastify',
          'nestjs': 'NestJS',
          'koa': 'Koa',
          'electron': 'Electron'
        };

        for (const [dep, name] of Object.entries(frameworkDeps)) {
          if (context.dependencies[dep]) {
            context.frameworks.push(name);
          }
        }

        // 检测前端/后端
        context.hasFrontend = ['react', 'vue', 'svelte', 'angular', 'next', 'nuxt', 'electron']
          .some(dep => context.dependencies[dep]);

        context.hasBackend = ['express', 'fastify', 'nestjs', 'koa']
          .some(dep => context.dependencies[dep]);

        // 检测测试
        context.hasTests = ['vitest', 'jest', 'mocha', 'pytest', 'testing']
          .some(dep => context.dependencies[dep]) ||
          fs.existsSync(path.join(this.projectRoot, 'tests')) ||
          fs.existsSync(path.join(this.projectRoot, 'test'));

      } catch {
        // 忽略解析错误
      }
    }

    // 检测 Python 项目
    if (fs.existsSync(path.join(this.projectRoot, 'requirements.txt')) ||
        fs.existsSync(path.join(this.projectRoot, 'pyproject.toml'))) {
      context.projectType = 'python';
      context.packageManager = 'pip';
    }

    // 检测 Go 项目
    if (fs.existsSync(path.join(this.projectRoot, 'go.mod'))) {
      context.projectType = 'go';
      context.packageManager = 'go-mod';
    }

    // 检测 Rust 项目
    if (fs.existsSync(path.join(this.projectRoot, 'Cargo.toml'))) {
      context.projectType = 'rust';
      context.packageManager = 'cargo';
    }

    this.cachedContext = context;
    return context;
  }

  /**
   * 推断问题答案
   */
  private inferAnswers(
    taskDescription: string,
    context: ProjectContext
  ): QuestionInference[] {
    const inferences: QuestionInference[] = [];
    const desc = taskDescription.toLowerCase();

    // 1. 推断质量级别
    inferences.push(this.inferQualityLevel(desc, context));

    // 2. 推断技术栈
    inferences.push(this.inferTechStack(desc, context));

    // 3. 推断文档级别
    inferences.push(this.inferDocLevel(desc, context));

    // 4. 推断 E2E 测试
    inferences.push(this.inferE2ETest(desc, context));

    // 5. 推断执行模式
    inferences.push(this.inferExecutionMode(desc, context));

    // 6. 推断任务目标类型
    inferences.push(this.inferObjective(desc, context));

    // 7. 推断测试覆盖率级别
    inferences.push(this.inferTestCoverage(desc, context));

    return inferences;
  }

  /**
   * 推断质量级别
   */
  private inferQualityLevel(desc: string, context: ProjectContext): QuestionInference {
    const inference: QuestionInference = {
      questionId: 'quality_level',
      confidence: 'low',
      reason: ''
    };

    // Bug 修复 -> balanced
    if (/(fix|bug|修复|hotfix|patch|问题)/i.test(desc)) {
      inference.inferredAnswer = 'balanced';
      inference.confidence = 'high';
      inference.reason = '任务涉及 Bug 修复';
      return inference;
    }

    // 原型/POC -> fast
    if (/(prototype|poc|demo|快速|原型|示例|sample)/i.test(desc)) {
      inference.inferredAnswer = 'fast';
      inference.confidence = 'high';
      inference.reason = '任务涉及原型或演示';
      return inference;
    }

    // 测试相关 -> strict
    if (/(test|测试|单元|unit|coverage|覆盖率)/i.test(desc)) {
      inference.inferredAnswer = 'strict';
      inference.confidence = 'high';
      inference.reason = '任务涉及测试';
      return inference;
    }

    // 新功能/生产代码 -> strict
    if (/(implement|add|新功能|实现|开发|feature|生产)/i.test(desc)) {
      inference.inferredAnswer = 'strict';
      inference.confidence = 'medium';
      inference.reason = '任务涉及新功能开发';
      return inference;
    }

    // 重构 -> balanced
    if (/(refactor|优化|重构|improve)/i.test(desc)) {
      inference.inferredAnswer = 'balanced';
      inference.confidence = 'medium';
      inference.reason = '任务涉及代码重构';
      return inference;
    }

    inference.reason = '无法确定任务类型';
    return inference;
  }

  /**
   * 推断技术栈
   */
  private inferTechStack(desc: string, context: ProjectContext): QuestionInference {
    const inference: QuestionInference = {
      questionId: 'tech_stack',
      confidence: 'low',
      reason: ''
    };

    const detected: string[] = [];

    // 从项目上下文检测
    if (context.projectType === 'typescript') {
      detected.push('typescript');
    } else if (context.projectType === 'python') {
      detected.push('python');
    } else if (context.projectType === 'go') {
      detected.push('go');
    } else if (context.projectType === 'rust') {
      detected.push('rust');
    }

    // 从任务描述检测
    const techKeywords: Record<string, string[]> = {
      'typescript': ['typescript', 'ts', 'tsx'],
      'javascript': ['javascript', 'js', 'jsx'],
      'react': ['react', 'reactjs'],
      'vue': ['vue', 'vuejs', 'vue3'],
      'node': ['node', 'nodejs', 'express', 'koa'],
      'python': ['python', 'py', 'django', 'flask', 'fastapi'],
      'go': ['golang', 'go'],
      'rust': ['rust', 'cargo']
    };

    for (const [tech, keywords] of Object.entries(techKeywords)) {
      if (keywords.some(kw => desc.includes(kw))) {
        if (!detected.includes(tech)) {
          detected.push(tech);
        }
      }
    }

    // 从项目框架检测
    for (const framework of context.frameworks) {
      const normalized = framework.toLowerCase();
      if (!detected.includes(normalized)) {
        detected.push(normalized);
      }
    }

    if (detected.length > 0) {
      inference.inferredAnswer = detected;
      inference.confidence = context.projectType !== 'unknown' ? 'high' : 'medium';
      inference.reason = `检测到技术栈: ${detected.join(', ')}`;
    } else {
      inference.reason = '无法检测技术栈';
    }

    return inference;
  }

  /**
   * 推断文档级别
   */
  private inferDocLevel(desc: string, context: ProjectContext): QuestionInference {
    const inference: QuestionInference = {
      questionId: 'doc_level',
      confidence: 'low',
      reason: ''
    };

    // Bug 修复 -> 无需文档
    if (/(fix|bug|修复|hotfix)/i.test(desc)) {
      inference.inferredAnswer = 'none';
      inference.confidence = 'high';
      inference.reason = 'Bug 修复通常不需要文档';
      return inference;
    }

    // 重构 -> 最小文档
    if (/(refactor|优化|重构)/i.test(desc)) {
      inference.inferredAnswer = 'minimal';
      inference.confidence = 'medium';
      inference.reason = '重构任务通常需要最小文档';
      return inference;
    }

    // API/模块/库 -> 完整文档
    if (/(api|module|library|组件|库|sdk)/i.test(desc)) {
      inference.inferredAnswer = 'full';
      inference.confidence = 'medium';
      inference.reason = 'API/模块开发需要完整文档';
      return inference;
    }

    // 新功能 -> 基础文档
    if (/(implement|add|新功能|实现|开发|feature)/i.test(desc)) {
      inference.inferredAnswer = 'basic';
      inference.confidence = 'medium';
      inference.reason = '新功能开发需要基础文档';
      return inference;
    }

    inference.reason = '无法确定文档需求';
    return inference;
  }

  /**
   * 推断 E2E 测试
   */
  private inferE2ETest(desc: string, context: ProjectContext): QuestionInference {
    const inference: QuestionInference = {
      questionId: 'e2e_test',
      confidence: 'low',
      reason: ''
    };

    // CLI/后端 -> 不需要 E2E
    if (/(cli|api|backend|后端|命令行)/i.test(desc) && !context.hasFrontend) {
      inference.inferredAnswer = 'false';
      inference.confidence = 'high';
      inference.reason = 'CLI/后端任务不需要 E2E 测试';
      return inference;
    }

    // 前端页面 -> 询问
    if (context.hasFrontend || /(page|ui|前端|界面|web)/i.test(desc)) {
      inference.confidence = 'low';
      inference.reason = '前端任务可能需要 E2E 测试，需要用户确认';
      return inference;
    }

    // 默认不需要
    inference.inferredAnswer = 'false';
    inference.confidence = 'medium';
    inference.reason = '默认不需要 E2E 测试';
    return inference;
  }

  /**
   * 推断执行模式
   */
  private inferExecutionMode(desc: string, context: ProjectContext): QuestionInference {
    const inference: QuestionInference = {
      questionId: 'execution_mode',
      confidence: 'low',
      reason: ''
    };

    // 快速原型 -> 全自动
    if (/(prototype|poc|demo|快速|原型)/i.test(desc)) {
      inference.inferredAnswer = 'auto';
      inference.confidence = 'medium';
      inference.reason = '原型任务适合全自动执行';
      return inference;
    }

    // 简单修复 -> 全自动
    if (/(fix|bug|修复|hotfix)/i.test(desc) && desc.length < 100) {
      inference.inferredAnswer = 'auto';
      inference.confidence = 'medium';
      inference.reason = '简单 Bug 修复适合全自动执行';
      return inference;
    }

    // 新功能 -> 每阶段确认
    if (/(implement|add|新功能|实现|开发)/i.test(desc)) {
      inference.inferredAnswer = 'phase';
      inference.confidence = 'medium';
      inference.reason = '新功能开发适合每阶段确认';
      return inference;
    }

    inference.reason = '无法确定执行模式';
    return inference;
  }

  /**
   * 推断任务目标类型
   */
  private inferObjective(desc: string, context: ProjectContext): QuestionInference {
    const inference: QuestionInference = {
      questionId: 'objective',
      confidence: 'low',
      reason: ''
    };

    if (/(fix|bug|修复|hotfix|patch)/i.test(desc)) {
      inference.inferredAnswer = 'bug_fix';
      inference.confidence = 'medium';
      inference.reason = '任务描述包含修复关键词';
    } else if (/(implement|add|新功能|实现|开发|feature|新增)/i.test(desc)) {
      inference.inferredAnswer = 'new_feature';
      inference.confidence = 'medium';
      inference.reason = '任务描述包含新功能关键词';
    } else if (/(refactor|优化|重构|improve|性能)/i.test(desc)) {
      inference.inferredAnswer = 'refactor';
      inference.confidence = 'medium';
      inference.reason = '任务描述包含重构关键词';
    } else if (/(test|测试|coverage|覆盖)/i.test(desc)) {
      inference.inferredAnswer = 'test';
      inference.confidence = 'medium';
      inference.reason = '任务描述包含测试关键词';
    } else {
      inference.reason = '无法确定任务目标类型';
    }

    return inference;
  }

  /**
   * 推断测试覆盖率级别
   */
  private inferTestCoverage(desc: string, context: ProjectContext): QuestionInference {
    const inference: QuestionInference = {
      questionId: 'test_coverage',
      confidence: 'low',
      reason: ''
    };

    if (context.hasTests && /(test|测试)/i.test(desc)) {
      inference.inferredAnswer = 'high';
      inference.confidence = 'medium';
      inference.reason = '项目已有测试，且任务涉及测试';
    } else if (/(implement|add|新功能|实现|feature)/i.test(desc)) {
      inference.inferredAnswer = 'medium';
      inference.confidence = 'low';
      inference.reason = '新功能任务，中等测试覆盖率';
    } else if (/(fix|bug|修复)/i.test(desc)) {
      inference.inferredAnswer = 'low';
      inference.confidence = 'medium';
      inference.reason = 'Bug 修复，需要回归测试但覆盖率要求不高';
    } else if (/(prototype|poc|demo|快速|原型)/i.test(desc)) {
      inference.inferredAnswer = 'none';
      inference.confidence = 'medium';
      inference.reason = '原型任务，不需要测试';
    } else {
      inference.reason = '无法确定测试覆盖率级别';
    }

    return inference;
  }

  /**
   * 生成推断摘要
   */
  generateSummary(result: AnalysisResult): string {
    const lines: string[] = ['📊 AI 推断结果:\n'];

    for (const inference of result.inferences) {
      const icon = inference.confidence === 'high' ? '✅' :
                   inference.confidence === 'medium' ? '🤔' : '❓';
      const answer = Array.isArray(inference.inferredAnswer)
        ? inference.inferredAnswer.join(', ')
        : inference.inferredAnswer || '待确认';

      lines.push(`${icon} ${inference.questionId}: ${answer}`);
      if (inference.reason) {
        lines.push(`   └─ ${inference.reason}`);
      }
    }

    if (result.questionsToAsk.length > 0) {
      lines.push(`\n❓ 需要确认的问题: ${result.questionsToAsk.join(', ')}`);
    } else {
      lines.push('\n✅ 所有问题已推断，无需额外确认');
    }

    return lines.join('\n');
  }
}