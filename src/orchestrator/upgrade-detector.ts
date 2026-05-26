// src/orchestrator/upgrade-detector.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import type { QualityConfig } from '../types/index.js';

/**
 * 升级建议类型
 */
export type UpgradeCategory =
  | 'bug'           // 代码缺陷 (TODO, FIXME, 潜在bug)
  | 'quality'       // 代码质量 (性能、结构、可维护性)
  | 'capability'    // 缺失能力 (缺少测试、文档、类型)
  | 'ux'            // 用户体验 (交互、提示、错误处理)
  | 'style'         // 代码风格 (命名、格式、一致性)
  | 'security'      // 安全问题
  | 'common'        // 常见问题 (重复代码、硬编码等)
  | 'prompt'        // Prompt 问题 (AI 项目)
  | 'skill'         // Skill 问题 (AI 项目)
  | 'agent';        // Agent 配置问题 (AI 项目)

/**
 * 升级建议优先级
 */
export type UpgradePriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * 升级建议
 */
export interface UpgradeSuggestion {
  id: string;
  category: UpgradeCategory;
  priority: UpgradePriority;
  title: string;
  description: string;
  location: {
    file: string;
    line?: number;
    column?: number;
  };
  suggestion: string;
  autoFixable: boolean;
  impact: string;
  effort: 'trivial' | 'small' | 'medium' | 'large';
}

/**
 * 检测结果
 */
export interface DetectionResult {
  projectType: ProjectType;
  projectName: string;
  scanPath: string;
  timestamp: string;
  suggestions: UpgradeSuggestion[];
  summary: {
    total: number;
    byCategory: Record<UpgradeCategory, number>;
    byPriority: Record<UpgradePriority, number>;
    autoFixable: number;
  };
}

/**
 * 项目类型
 */
export type ProjectType =
  | 'openmatrix'    // OpenMatrix 自身
  | 'ai-project'    // AI 项目 (包含 prompts/skills/agents)
  | 'nodejs'        // Node.js 项目
  | 'typescript'    // TypeScript 项目
  | 'python'        // Python 项目
  | 'go'            // Go 项目
  | 'rust'          // Rust 项目
  | 'java'          // Java 项目
  | 'csharp'        // C# 项目
  | 'cpp'           // C/C++ 项目
  | 'php'           // PHP 项目
  | 'dart'          // Dart 项目
  | 'unknown';      // 未知类型

/**
 * 检测器配置
 */
export interface DetectorConfig {
  /** 扫描目录 */
  scanDirs: string[];
  /** 排除目录 */
  excludeDirs: string[];
  /** 检测类别 */
  categories: UpgradeCategory[];
  /** 最小优先级 */
  minPriority: UpgradePriority;
  /** 用户提示 (可选) */
  userHint?: string;
  /** 最大建议数量 */
  maxSuggestions?: number;
}

/**
 * 已知的绝对路径前缀模式，用于检测代码中的硬编码路径
 * 涵盖 Windows 盘符 (C:\, D:\ 等)、Unix 家目录 (/home/, /Users/) 和常见系统路径
 */
const HARDCODED_PATH_PATTERNS: readonly RegExp[] = [
  /[A-Za-z]:\\/,                  // Windows 盘符路径 (C:\, D:\ 等)
  /\/home\/[a-zA-Z_]/,            // Linux 家目录
  /\/Users\/[a-zA-Z_]/,           // macOS 家目录
  /\/var\/[a-zA-Z_]/,             // Linux 系统路径
  /\/etc\//,                      // Unix 配置路径
  /\/tmp\//,                      // Unix 临时路径
  /\/opt\//,                      // Unix 可选软件路径
  /\\Users\\[a-zA-Z_]/,           // Windows 风格的 macOS 路径引用
];

/**
 * 默认配置
 */
export const DEFAULT_DETECTOR_CONFIG: DetectorConfig = {
  scanDirs: ['src', 'skills', 'docs', 'prompts', '.claude', '.cursor'],
  excludeDirs: ['node_modules', 'dist', '.git', '.openmatrix', 'tests'],
  categories: ['bug', 'quality', 'capability', 'ux', 'style', 'security', 'common', 'prompt', 'skill', 'agent'],
  minPriority: 'low'
};

/**
 * 升级检测器
 *
 * 自动扫描项目代码，检测可改进点，支持多维度分析。
 */
export class UpgradeDetector {
  private config: DetectorConfig;
  private projectRoot: string;
  private suggestionIdCounter: number = 0;

  constructor(projectRoot: string, config: Partial<DetectorConfig> = {}) {
    this.projectRoot = projectRoot;
    this.config = { ...DEFAULT_DETECTOR_CONFIG, ...config };
  }

  /**
   * 执行完整检测
   */
  async detect(): Promise<DetectionResult> {
    const projectType = await this.detectProjectType();
    const projectName = await this.getProjectName();
    const suggestions: UpgradeSuggestion[] = [];

    // 并行执行所有检测器
    const detectors = [
      this.detectBugs(),
      this.detectQualityIssues(),
      this.detectMissingCapabilities(),
      this.detectUXIssues(),
      this.detectStyleIssues(),
      this.detectSecurityIssues(),
      this.detectCommonIssues(),
      // AI 项目专用检测器
      this.detectPromptIssues(),
      this.detectSkillIssues(),
      this.detectAgentConfigIssues(),
      // 新增检测器
      this.detectUnhandledPromises(),
      this.detectDeadCode(),
      this.detectNullReference(),
      this.detectCyclomaticComplexity(),
      this.detectDuplicateCode(),
      this.detectOutdatedDependencies(),
      this.detectMissingTypes(),
      this.detectMissingCIConfig(),
      this.detectMissingCoverageConfig(),
      this.detectMissingChangelog(),
      this.detectPathTraversal(),
      this.detectReDoS(),
      this.detectCommandInjection(),
      this.detectUnsafeHTTP(),
      // 代码结构和架构检测
      this.detectLongFiles(),
      this.detectLongFunctions(),
      this.detectArchitectureIssues()
    ];

    const results = await Promise.all(detectors);
    for (const result of results) {
      suggestions.push(...result);
    }

    // 根据用户提示过滤/排序
    let filtered = this.applyUserHint(suggestions);

    // 如果有用户提示，保持用户提示优先排序
    // 否则使用类别均衡排序
    if (!this.config.userHint) {
      filtered = this.sortWithCategoryBalance(filtered);
    }

    // 限制数量
    if (this.config.maxSuggestions) {
      filtered = filtered.slice(0, this.config.maxSuggestions);
    }

    return {
      projectType,
      projectName,
      scanPath: this.projectRoot,
      timestamp: new Date().toISOString(),
      suggestions: filtered,
      summary: this.generateSummary(filtered)
    };
  }

  /**
   * 检测项目类型
   */
  private async detectProjectType(): Promise<ProjectType> {
    try {
      // 检查是否是 OpenMatrix 项目
      const omPath = path.join(this.projectRoot, '.openmatrix');
      const packageJsonPath = path.join(this.projectRoot, 'package.json');

      try {
        await fs.access(omPath);
        // 检查是否有 openmatrix 特征
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        if (packageJson.name === 'openmatrix' ||
            packageJson.description?.includes('OpenMatrix')) {
          return 'openmatrix';
        }
      } catch {
        // 不是 OpenMatrix 项目
      }

      // 检查是否是 AI 项目
      const aiIndicators = [
        '.claude',
        '.cursor',
        'skills',
        'prompts',
        '.cursorrules',
        'CLAUDE.md',
        'AGENTS.md',
        'GEMINI.md',
        '.mcp'
      ];

      let aiIndicatorCount = 0;
      for (const indicator of aiIndicators) {
        try {
          await fs.access(path.join(this.projectRoot, indicator));
          aiIndicatorCount++;
        } catch {
          // 不存在
        }
      }

      // 如果有 2 个或以上 AI 指标，认为是 AI 项目
      if (aiIndicatorCount >= 2) {
        return 'ai-project';
      }

      // 检查 package.json
      try {
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

        // 检查是否有 AI 相关依赖
        const aiDeps = [
          'anthropic',
          '@anthropic-ai/sdk',
          'openai',
          '@langchain',
          'llamaindex',
          'claude-agent-sdk'
        ];

        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        };

        for (const dep of aiDeps) {
          if (allDeps[dep]) {
            return 'ai-project';
          }
        }

        // 检查 TypeScript
        if (packageJson.devDependencies?.typescript ||
            packageJson.dependencies?.typescript) {
          return 'typescript';
        }

        return 'nodejs';
      } catch {
        // 没有 package.json
      }

      // 检查 Python
      try {
        await fs.access(path.join(this.projectRoot, 'pyproject.toml'));
        return 'python';
      } catch {
        // 不是 Python
      }

      try {
        await fs.access(path.join(this.projectRoot, 'requirements.txt'));
        return 'python';
      } catch {
        // 不是 Python
      }

      // 检查 Go
      try {
        await fs.access(path.join(this.projectRoot, 'go.mod'));
        return 'go';
      } catch {
        // 不是 Go
      }

      // 检查 Rust
      try {
        await fs.access(path.join(this.projectRoot, 'Cargo.toml'));
        return 'rust';
      } catch {
        // 不是 Rust
      }

      // 检查 Java
      try {
        await fs.access(path.join(this.projectRoot, 'pom.xml'));
        return 'java';
      } catch {
        // 不是 Java (Maven)
      }

      try {
        await fs.access(path.join(this.projectRoot, 'build.gradle'));
        return 'java';
      } catch {
        // 不是 Java (Gradle)
      }

      try {
        await fs.access(path.join(this.projectRoot, 'build.gradle.kts'));
        return 'java';
      } catch {
        // 不是 Java (Gradle Kotlin DSL)
      }

      // 检查 C#
      try {
        const files = await fs.readdir(this.projectRoot);
        if (files.some(f => f.endsWith('.sln') || f.endsWith('.csproj'))) {
          return 'csharp';
        }
      } catch {
        // 不是 C#
      }

      // 检查 C/C++
      try {
        await fs.access(path.join(this.projectRoot, 'CMakeLists.txt'));
        return 'cpp';
      } catch {
        // 不是 CMake 项目
      }

      try {
        await fs.access(path.join(this.projectRoot, 'Makefile'));
        return 'cpp';
      } catch {
        // 不是 Make 项目
      }

      // 检查 PHP
      try {
        await fs.access(path.join(this.projectRoot, 'composer.json'));
        return 'php';
      } catch {
        // 不是 PHP
      }

      // 检查 Dart
      try {
        await fs.access(path.join(this.projectRoot, 'pubspec.yaml'));
        return 'dart';
      } catch {
        // 不是 Dart
      }

      return 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * 获取项目名称
   */
  private async getProjectName(): Promise<string> {
    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      return packageJson.name || path.basename(this.projectRoot);
    } catch {
      return path.basename(this.projectRoot);
    }
  }

  /**
   * 检测代码缺陷
   */
  private async detectBugs(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // 待办标记检测
        const todoMatch = line.match(/\/\/\s*TODO(?:\(([^)]+)\))?:?\s*(.+)/i);
        if (todoMatch) {
          suggestions.push(this.createSuggestion({
            category: 'bug',
            priority: todoMatch[1] === 'critical' ? 'critical' : 'medium',
            title: `待完成: ${todoMatch[2]}`,
            description: `发现 TODO 标记: ${todoMatch[2]}`,
            location: { file: this.getRelativePath(file), line: index + 1 },
            suggestion: `完成或移除 TODO: ${todoMatch[2]}`,
            autoFixable: false,
            impact: '可能影响功能完整性',
            effort: 'small'
          }));
        }

        // 待修复标记检测
        const fixmeMatch = line.match(/\/\/\s*FIXME(?:\(([^)]+)\))?:?\s*(.+)/i);
        if (fixmeMatch) {
          suggestions.push(this.createSuggestion({
            category: 'bug',
            priority: 'high',
            title: `需修复: ${fixmeMatch[2]}`,
            description: `发现 FIXME 标记: ${fixmeMatch[2]}`,
            location: { file: this.getRelativePath(file), line: index + 1 },
            suggestion: `修复已知问题: ${fixmeMatch[2]}`,
            autoFixable: false,
            impact: '可能导致运行时错误',
            effort: 'medium'
          }));
        }

        // 临时方案标记检测
        const hackMatch = line.match(/\/\/\s*HACK(?:\(([^)]+)\))?:?\s*(.+)/i);
        if (hackMatch) {
          const hackPriority: UpgradePriority = hackMatch[1] === 'critical' ? 'critical'
            : hackMatch[1] === 'high' ? 'high'
            : 'medium';
          suggestions.push(this.createSuggestion({
            category: 'bug',
            priority: hackPriority,
            title: `临时方案: ${hackMatch[2]}`,
            description: `发现 HACK 标记，表示使用了临时解决方案: ${hackMatch[2]}`,
            location: { file: this.getRelativePath(file), line: index + 1 },
            suggestion: `将临时方案替换为正式实现: ${hackMatch[2]}`,
            autoFixable: false,
            impact: '技术债务累积，可能影响长期可维护性',
            effort: 'medium'
          }));
        }

        // any 类型检测 (TypeScript)
        if (file.endsWith('.ts') || file.endsWith('.tsx')) {
          const anyMatch = line.match(/:\s*any\b/);
          if (anyMatch && !line.includes('// eslint-disable')) {
            suggestions.push(this.createSuggestion({
              category: 'quality',
              priority: 'low',
              title: '使用 any 类型',
              description: '使用 any 类型会丢失类型安全性',
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '替换为具体类型或使用 unknown',
              autoFixable: false,
              impact: '降低类型安全性',
              effort: 'trivial'
            }));
          }
        }
      });
    }

    return suggestions;
  }

  /**
   * 检测代码质量问题
   */
  private async detectQualityIssues(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // 过长函数检测 (简化版)
        if (line.trim().startsWith('function ') ||
            line.trim().startsWith('const ') && line.includes('=>')) {
          // 检查后续行数
          let depth = 0;
          let lineCount = 0;
          for (let i = index; i < lines.length && lineCount < 100; i++) {
            const currentLine = lines[i];
            if (currentLine.includes('{')) depth++;
            if (currentLine.includes('}')) depth--;
            lineCount++;
            if (depth === 0 && i > index) break;
          }
          if (lineCount > 50) {
            suggestions.push(this.createSuggestion({
              category: 'quality',
              priority: 'medium',
              title: '函数过长',
              description: `函数超过 ${lineCount} 行，建议拆分`,
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '将函数拆分为更小的函数',
              autoFixable: false,
              impact: '降低可读性和可维护性',
              effort: 'medium'
            }));
          }
        }

        // console.log 检测 (生产代码，排除 CLI 命令文件)
        if (line.includes('console.log') && !file.includes('test') && !file.includes('spec') && !file.includes('commands/')) {
          suggestions.push(this.createSuggestion({
            category: 'quality',
            priority: 'low',
            title: '调试日志',
            description: '生产代码中存在 console.log',
            location: { file: this.getRelativePath(file), line: index + 1 },
            suggestion: '移除或替换为正式日志系统',
            autoFixable: true,
            impact: '可能泄露敏感信息',
            effort: 'trivial'
          }));
        }

        // 空 catch 块
        if (line.trim() === 'catch' || line.includes('catch (')) {
          const nextLine = lines[index + 1]?.trim();
          if (nextLine === '{}' || nextLine === '') {
            suggestions.push(this.createSuggestion({
              category: 'quality',
              priority: 'high',
              title: '空 catch 块',
              description: 'catch 块为空，可能隐藏错误',
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '添加错误处理或至少记录日志',
              autoFixable: false,
              impact: '可能隐藏运行时错误',
              effort: 'small'
            }));
          }
        }
      });
    }

    return suggestions;
  }

  /**
   * 检测缺失能力
   */
  private async detectMissingCapabilities(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];

    // 检查测试覆盖率
    const testDir = path.join(this.projectRoot, 'tests');
    const srcDir = path.join(this.projectRoot, 'src');

    try {
      await fs.access(testDir);
    } catch {
      // 没有测试目录
      try {
        await fs.access(srcDir);
        suggestions.push(this.createSuggestion({
          category: 'capability',
          priority: 'high',
          title: '缺少测试目录',
          description: '项目没有测试目录，建议添加测试',
          location: { file: this.getRelativePath(this.projectRoot) },
          suggestion: '创建 tests/ 目录并添加单元测试',
          autoFixable: false,
          impact: '无法验证代码正确性',
          effort: 'large'
        }));
      } catch {
        // 没有 src 目录，跳过
      }
    }

    // 检查 README
    try {
      await fs.access(path.join(this.projectRoot, 'README.md'));
    } catch {
      suggestions.push(this.createSuggestion({
        category: 'capability',
        priority: 'medium',
        title: '缺少 README',
        description: '项目没有 README 文档',
        location: { file: this.getRelativePath(this.projectRoot) },
        suggestion: '添加 README.md 说明项目用途和使用方法',
        autoFixable: false,
        impact: '降低项目可发现性',
        effort: 'small'
      }));
    }

    // 检查 CLAUDE.md (对于 OpenMatrix 相关项目)
    try {
      await fs.access(path.join(this.projectRoot, '.openmatrix'));
      try {
        await fs.access(path.join(this.projectRoot, 'CLAUDE.md'));
      } catch {
        suggestions.push(this.createSuggestion({
          category: 'capability',
          priority: 'medium',
          title: '缺少 CLAUDE.md',
          description: 'OpenMatrix 项目建议添加 CLAUDE.md 提供项目指引',
          location: { file: this.getRelativePath(this.projectRoot) },
          suggestion: '添加 CLAUDE.md 说明项目结构和开发规范',
          autoFixable: false,
          impact: '降低 AI 助手协作效率',
          effort: 'small'
        }));
      }
    } catch {
      // 不是 OpenMatrix 项目
    }

    return suggestions;
  }

  /**
   * 检测用户体验问题
   */
  private async detectUXIssues(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    for (const file of files) {
      // 只检查 CLI 相关文件
      if (!file.includes('cli') && !file.includes('command')) continue;

      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // 检查错误消息是否友好（扩展条件）
        if (line.includes('throw new Error')) {
          const errorMatch = line.match(/Error\(['"`]([^'"`]+)['"`]\)/);
          if (errorMatch) {
            const errorMsg = errorMatch[1];
            // 检查错误消息是否过于简短或不够友好
            if (errorMsg.length < 15 || errorMsg.match(/^[A-Z]+$/) || errorMsg.includes('failed')) {
              suggestions.push(this.createSuggestion({
                category: 'ux',
                priority: 'medium',
                title: '错误消息不够友好',
                description: `错误消息 "${errorMsg}" 不够友好或过于简短`,
                location: { file: this.getRelativePath(file), line: index + 1 },
                suggestion: '提供更详细的错误消息，包含解决建议',
                autoFixable: false,
                impact: '降低用户体验',
                effort: 'trivial'
              }));
            }
          }
        }

        // 检测 console.error 缺少上下文
        if (line.includes('console.error')) {
          const errorMatch = line.match(/console\.error\(['"`]([^'"`]+)['"`]\)/);
          if (errorMatch && errorMatch[1].length < 20) {
            suggestions.push(this.createSuggestion({
              category: 'ux',
              priority: 'low',
              title: '错误输出缺少上下文',
              description: `console.error "${errorMatch[1]}" 缺少详细上下文`,
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '添加更多上下文信息，如错误原因和建议',
              autoFixable: false,
              impact: '用户难以理解错误原因',
              effort: 'trivial'
            }));
          }
        }

        // 检测缺少进度反馈
        if (line.includes('await') && line.includes('exec') || line.includes('await') && line.includes('fetch')) {
          const nextLines = lines.slice(index, index + 5).join('\n');
          if (!nextLines.includes('console.log') && !nextLines.includes('progress') && !nextLines.includes('spinner')) {
            suggestions.push(this.createSuggestion({
              category: 'ux',
              priority: 'low',
              title: '长时间操作缺少进度反馈',
              description: '异步操作可能耗时较长，缺少进度指示',
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '添加进度指示或 spinner',
              autoFixable: false,
              impact: '用户不知道操作是否在进行',
              effort: 'small'
            }));
          }
        }

        // 检测缺少成功反馈
        if (line.includes('await') && !content.substring(content.indexOf(line), content.indexOf(line) + 500).includes('成功') &&
            !content.substring(content.indexOf(line), content.indexOf(line) + 500).includes('success') &&
            !content.substring(content.indexOf(line), content.indexOf(line) + 500).includes('完成')) {
          // 只对关键操作检测
          if (line.includes('write') || line.includes('create') || line.includes('delete')) {
            suggestions.push(this.createSuggestion({
              category: 'ux',
              priority: 'low',
              title: '关键操作缺少成功反馈',
              description: '写入/创建/删除操作缺少成功消息',
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '添加操作成功的确认消息',
              autoFixable: false,
              impact: '用户不确定操作是否成功',
              effort: 'trivial'
            }));
          }
        }
      });
    }

    return suggestions.slice(0, 10); // 限制数量
  }

  /**
   * 检测代码风格问题
   */
  private async detectStyleIssues(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // 检查行长度
        if (line.length > 120) {
          suggestions.push(this.createSuggestion({
            category: 'style',
            priority: 'low',
            title: '行过长',
            description: `行长度 ${line.length} 超过 120 字符`,
            location: { file: this.getRelativePath(file), line: index + 1 },
            suggestion: '将长行拆分为多行',
            autoFixable: true,
            impact: '降低代码可读性',
            effort: 'trivial'
          }));
        }

        // 检查命名规范 (简化版)
        const varMatch = line.match(/(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
        if (varMatch) {
          const varName = varMatch[1];
          // 检查是否使用了不推荐的命名
          if (varName.length === 1 && !['i', 'j', 'k', 'x', 'y', 'z'].includes(varName)) {
            suggestions.push(this.createSuggestion({
              category: 'style',
              priority: 'low',
              title: '变量名过短',
              description: `变量名 "${varName}" 过于简短，建议使用更有意义的名称`,
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '使用描述性的变量名',
              autoFixable: false,
              impact: '降低代码可读性',
              effort: 'trivial'
            }));
          }
        }
      });
    }

    return suggestions;
  }

  /**
   * 检测安全问题
   */
  private async detectSecurityIssues(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // 检查硬编码密钥
        const keyPatterns = [
          /api[_-]?key\s*[:=]\s*['"][^'" ]+['"]/i,
          /secret[_-]?key\s*[:=]\s*['"][^'" ]+['"]/i,
          /password\s*[:=]\s*['"][^'" ]+['"]/i,
          /token\s*[:=]\s*['"][^'" ]+['"]/i
        ];

        for (const pattern of keyPatterns) {
          if (pattern.test(line) && !line.includes('process.env')) {
            suggestions.push(this.createSuggestion({
              category: 'security',
              priority: 'critical',
              title: '硬编码密钥',
              description: '发现硬编码的密钥或敏感信息',
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '使用环境变量存储敏感信息',
              autoFixable: false,
              impact: '可能导致密钥泄露',
              effort: 'small'
            }));
            break;
          }
        }

        // 检查 eval 使用 - 排除字符串字面量和注释中的匹配
        const evalMatch = line.match(/\beval\s*\(/);
        if (evalMatch && !line.includes('// safe') && !line.includes("'eval") && !line.includes('"eval')) {
          suggestions.push(this.createSuggestion({
            category: 'security',
            priority: 'critical',
            title: '使用 eval 函数',
            description: 'eval() 可能导致代码注入漏洞',
            location: { file: this.getRelativePath(file), line: index + 1 },
            suggestion: '避免使用 eval，使用更安全的替代方案',
            autoFixable: false,
            impact: '可能导致代码注入',
            effort: 'medium'
          }));
        }

        // 检查 SQL 注入风险
        if (line.includes('query(') && line.includes('${') && !line.includes('parameterized')) {
          suggestions.push(this.createSuggestion({
            category: 'security',
            priority: 'high',
            title: '潜在 SQL 注入',
            description: 'SQL 查询中使用了字符串插值',
            location: { file: this.getRelativePath(file), line: index + 1 },
            suggestion: '使用参数化查询',
            autoFixable: false,
            impact: '可能导致 SQL 注入攻击',
            effort: 'small'
          }));
        }
      });
    }

    return suggestions;
  }

  /**
   * 检测常见问题
   */
  private async detectCommonIssues(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    // 检测重复代码 (简化版 - 检测相似的代码块)
    const codeBlocks: Map<string, { file: string; line: number }[]> = new Map();

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      // 检测硬编码字符串
      lines.forEach((line, index) => {
        // 硬编码路径
        if (HARDCODED_PATH_PATTERNS.some(pattern => pattern.test(line))) {
          const relPath = this.getRelativePath(file);
          if (relPath.includes('upgrade-detector')) return;
          if (!line.includes('example') && !line.includes('test')) {
            suggestions.push(this.createSuggestion({
              category: 'common',
              priority: 'medium',
              title: '硬编码路径',
              description: '发现硬编码的文件路径',
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '使用相对路径或配置文件',
              autoFixable: false,
              impact: '降低代码可移植性',
              effort: 'trivial'
            }));
          }
        }

        // 魔法数字
        const numberMatch = line.match(/[^a-zA-Z_](\d{3,})[^a-zA-Z_0-9]/);
        if (numberMatch && !line.includes('const') && !line.includes('enum')) {
          const num = parseInt(numberMatch[1]);
          if (num > 100 && num !== 1000 && num !== 1024) {
            suggestions.push(this.createSuggestion({
              category: 'common',
              priority: 'low',
              title: '魔法数字',
              description: `发现魔法数字 ${num}`,
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '使用命名常量替代',
              autoFixable: false,
              impact: '降低代码可读性',
              effort: 'trivial'
            }));
          }
        }
      });
    }

    return suggestions;
  }

  /**
   * 检测 Prompt 问题 (AI 项目)
   */
  private async detectPromptIssues(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];

    // 扫描 prompts 目录和 .md 文件
    const promptFiles = await this.scanFiles(['.md', '.txt']);

    for (const file of promptFiles) {
      // 只处理可能包含 prompt 的文件
      if (!file.includes('prompt') && !file.includes('PROMPT') &&
          !file.includes('.claude') && !file.includes('prompts/')) {
        continue;
      }

      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // 检测过于简短的 prompt
        if (line.trim().length > 0 && line.trim().length < 20 &&
            !line.startsWith('#') && !line.startsWith('<!--')) {
          suggestions.push(this.createSuggestion({
            category: 'prompt',
            priority: 'low',
            title: 'Prompt 过于简短',
            description: `Prompt "${line.trim().substring(0, 30)}..." 过于简短，可能导致模型理解不充分`,
            location: { file: this.getRelativePath(file), line: index + 1 },
            suggestion: '扩展 prompt 内容，添加更多上下文和示例',
            autoFixable: false,
            impact: '可能导致模型输出不符合预期',
            effort: 'small'
          }));
        }

        // 检测缺少输出格式说明
        const promptKeywords = ['请', 'write', 'generate', 'create', '实现', '生成'];
        if (promptKeywords.some(kw => line.toLowerCase().includes(kw))) {
          const nextLines = lines.slice(index, index + 10).join('\n').toLowerCase();
          if (!nextLines.includes('格式') && !nextLines.includes('format') &&
              !nextLines.includes('输出') && !nextLines.includes('output')) {
            suggestions.push(this.createSuggestion({
              category: 'prompt',
              priority: 'medium',
              title: 'Prompt 缺少输出格式说明',
              description: 'Prompt 没有明确指定输出格式',
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '添加输出格式说明，如 JSON、Markdown 或具体结构',
              autoFixable: false,
              impact: '模型输出格式可能不一致',
              effort: 'trivial'
            }));
          }
        }

        // 检测潜在的 Prompt 注入风险
        const injectionPatterns = [
          /\{\{.*user.*\}\}/i,
          /\$\{.*input.*\}/i,
          /user.*input/i,
          /用户.*输入/i
        ];

        for (const pattern of injectionPatterns) {
          if (pattern.test(line)) {
            suggestions.push(this.createSuggestion({
              category: 'prompt',
              priority: 'high',
              title: '潜在 Prompt 注入风险',
              description: 'Prompt 中直接使用用户输入，可能导致注入攻击',
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '对用户输入进行验证和清理，或使用结构化 prompt',
              autoFixable: false,
              impact: '可能导致 Prompt 注入攻击',
              effort: 'medium'
            }));
            break;
          }
        }
      });

      // 检测缺少示例
      if (content.length > 200 && !content.includes('示例') &&
          !content.includes('example') && !content.includes('Example')) {
        suggestions.push(this.createSuggestion({
          category: 'prompt',
          priority: 'medium',
          title: 'Prompt 缺少示例',
          description: 'Prompt 内容较长但没有提供示例',
          location: { file: this.getRelativePath(file) },
          suggestion: '添加输入输出示例，帮助模型更好理解任务',
          autoFixable: false,
          impact: '可能影响模型输出质量',
          effort: 'small'
        }));
      }
    }

    return suggestions;
  }

  /**
   * 检测 Skill 问题 (AI 项目)
   */
  private async detectSkillIssues(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];

    // 扫描 skills 目录
    const skillFiles = await this.scanFiles(['.md']);

    for (const file of skillFiles) {
      if (!file.includes('skills/') && !file.includes('skill')) {
        continue;
      }

      const content = await fs.readFile(file, 'utf-8');
      const fileName = path.basename(file);

      // 检测 Skill 文件结构
      const hasFrontmatter = content.startsWith('---');
      if (!hasFrontmatter) {
        suggestions.push(this.createSuggestion({
          category: 'skill',
          priority: 'high',
          title: 'Skill 缺少 frontmatter',
          description: `Skill 文件 ${fileName} 缺少 YAML frontmatter`,
          location: { file: this.getRelativePath(file) },
          suggestion: '添加 frontmatter，包含 name 和 description 字段',
          autoFixable: false,
          impact: 'Skill 可能无法被正确识别和加载',
          effort: 'trivial'
        }));
      } else {
        // 解析 frontmatter
        const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (frontmatterMatch) {
          const frontmatter = frontmatterMatch[1];

          // 检查必需字段
          if (!frontmatter.includes('name:')) {
            suggestions.push(this.createSuggestion({
              category: 'skill',
              priority: 'high',
              title: 'Skill 缺少 name 字段',
              description: `Skill 文件 ${fileName} 缺少 name 字段`,
              location: { file: this.getRelativePath(file) },
              suggestion: '在 frontmatter 中添加 name 字段',
              autoFixable: false,
              impact: 'Skill 可能无法被正确识别',
              effort: 'trivial'
            }));
          }

          if (!frontmatter.includes('description:')) {
            suggestions.push(this.createSuggestion({
              category: 'skill',
              priority: 'medium',
              title: 'Skill 缺少 description 字段',
              description: `Skill 文件 ${fileName} 缺少 description 字段`,
              location: { file: this.getRelativePath(file) },
              suggestion: '在 frontmatter 中添加 description 字段',
              autoFixable: false,
              impact: '用户难以理解 Skill 用途',
              effort: 'trivial'
            }));
          }
        }
      }

      // 检测缺少 <objective> 标签
      if (!content.includes('<objective>')) {
        suggestions.push(this.createSuggestion({
          category: 'skill',
          priority: 'medium',
          title: 'Skill 缺少 objective 标签',
          description: `Skill 文件 ${fileName} 缺少明确的 objective 标签`,
          location: { file: this.getRelativePath(file) },
          suggestion: '添加 <objective> 标签说明 Skill 的目标',
          autoFixable: false,
          impact: 'AI 可能无法正确理解 Skill 用途',
          effort: 'trivial'
        }));
      }

      // 检测缺少 <process> 标签
      if (!content.includes('<process>')) {
        suggestions.push(this.createSuggestion({
          category: 'skill',
          priority: 'medium',
          title: 'Skill 缺少 process 标签',
          description: `Skill 文件 ${fileName} 缺少 process 标签`,
          location: { file: this.getRelativePath(file) },
          suggestion: '添加 <process> 标签说明执行步骤',
          autoFixable: false,
          impact: 'AI 可能无法正确执行 Skill',
          effort: 'small'
        }));
      }

      // 检测缺少示例
      if (!content.includes('<examples>') && !content.includes('示例')) {
        suggestions.push(this.createSuggestion({
          category: 'skill',
          priority: 'low',
          title: 'Skill 缺少示例',
          description: `Skill 文件 ${fileName} 缺少使用示例`,
          location: { file: this.getRelativePath(file) },
          suggestion: '添加 <examples> 标签展示使用方式',
          autoFixable: false,
          impact: '用户可能不清楚如何使用 Skill',
          effort: 'trivial'
        }));
      }

      // 检测 trigger-conditions (对于自动触发的 Skill)
      if (content.includes('TRIGGER') || content.includes('trigger-conditions')) {
        if (!content.includes('<trigger-conditions>')) {
          suggestions.push(this.createSuggestion({
            category: 'skill',
            priority: 'high',
            title: 'Skill 触发条件格式不规范',
            description: `Skill 文件 ${fileName} 使用了 TRIGGER 但没有 <trigger-conditions> 标签`,
            location: { file: this.getRelativePath(file) },
            suggestion: '使用 <trigger-conditions> 标签规范触发条件',
            autoFixable: false,
            impact: 'Skill 可能无法正确自动触发',
            effort: 'trivial'
          }));
        }
      }
    }

    return suggestions;
  }

  /**
   * 检测 Agent 配置问题 (AI 项目)
   */
  private async detectAgentConfigIssues(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];

    // 检查 CLAUDE.md
    try {
      const claudeMdPath = path.join(this.projectRoot, 'CLAUDE.md');
      const content = await fs.readFile(claudeMdPath, 'utf-8');

      // 检测是否包含必要的项目信息
      if (!content.includes('Build') && !content.includes('构建') &&
          !content.includes('npm run') && !content.includes('构建命令')) {
        suggestions.push(this.createSuggestion({
          category: 'agent',
          priority: 'high',
          title: 'CLAUDE.md 缺少构建命令',
          description: 'CLAUDE.md 没有说明项目的构建命令',
          location: { file: 'CLAUDE.md' },
          suggestion: '添加 Build 部分说明项目的构建和测试命令',
          autoFixable: false,
          impact: 'AI 可能无法正确构建和测试项目',
          effort: 'trivial'
        }));
      }

      // 检测是否包含项目概述
      if (content.length < 200) {
        suggestions.push(this.createSuggestion({
          category: 'agent',
          priority: 'medium',
          title: 'CLAUDE.md 内容过于简短',
          description: 'CLAUDE.md 内容过短，可能缺少重要的项目信息',
          location: { file: 'CLAUDE.md' },
          suggestion: '扩展 CLAUDE.md，添加项目概述、架构说明和开发规范',
          autoFixable: false,
          impact: 'AI 可能无法充分理解项目上下文',
          effort: 'small'
        }));
      }

      // 检测是否包含代码风格指南
      if (!content.includes('style') && !content.includes('风格') &&
          !content.includes('convention') && !content.includes('规范')) {
        suggestions.push(this.createSuggestion({
          category: 'agent',
          priority: 'low',
          title: 'CLAUDE.md 缺少代码风格指南',
          description: 'CLAUDE.md 没有说明代码风格和规范',
          location: { file: 'CLAUDE.md' },
          suggestion: '添加代码风格指南部分',
          autoFixable: false,
          impact: 'AI 生成的代码可能不符合项目风格',
          effort: 'trivial'
        }));
      }
    } catch {
      // 没有 CLAUDE.md，但这在其他地方已经检测
    }

    // 检查 .cursorrules
    try {
      const cursorrulesPath = path.join(this.projectRoot, '.cursorrules');
      const content = await fs.readFile(cursorrulesPath, 'utf-8');

      if (content.length < 50) {
        suggestions.push(this.createSuggestion({
          category: 'agent',
          priority: 'low',
          title: '.cursorrules 内容过于简短',
          description: '.cursorrules 内容过短',
          location: { file: '.cursorrules' },
          suggestion: '扩展 .cursorrules，添加更多项目规则',
          autoFixable: false,
          impact: 'Cursor AI 可能无法充分理解项目规则',
          effort: 'trivial'
        }));
      }
    } catch {
      // 没有 .cursorrules
    }

    // 检查 MCP 配置
    try {
      const mcpPath = path.join(this.projectRoot, '.mcp', 'settings.json');
      const content = await fs.readFile(mcpPath, 'utf-8');
      const mcpConfig = JSON.parse(content);

      // 检测 MCP 服务器配置
      if (!mcpConfig.mcpServers || Object.keys(mcpConfig.mcpServers || {}).length === 0) {
        suggestions.push(this.createSuggestion({
          category: 'agent',
          priority: 'medium',
          title: 'MCP 配置中没有服务器',
          description: '.mcp/settings.json 没有配置任何 MCP 服务器',
          location: { file: '.mcp/settings.json' },
          suggestion: '添加 MCP 服务器配置以扩展 AI 能力',
          autoFixable: false,
          impact: 'AI 能力受限',
          effort: 'small'
        }));
      }
    } catch {
      // 没有 MCP 配置
    }

    // 检查 settings.json (Claude Code)
    try {
      const settingsPath = path.join(this.projectRoot, '.claude', 'settings.json');
      const content = await fs.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(content);

      // 检测权限配置
      if (!settings.permissions || settings.permissions.length === 0) {
        suggestions.push(this.createSuggestion({
          category: 'agent',
          priority: 'low',
          title: 'Claude Code 设置缺少权限配置',
          description: '.claude/settings.json 没有配置权限',
          location: { file: '.claude/settings.json' },
          suggestion: '添加权限配置以优化开发体验',
          autoFixable: false,
          impact: '可能需要频繁手动批准操作',
          effort: 'trivial'
        }));
      }
    } catch {
      // 没有设置文件
    }

    return suggestions;
  }

  /**
   * 检测未处理的 Promise rejection
   */
  private async detectUnhandledPromises(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // 检测 .then() 没有 .catch()
        if (line.includes('.then(') && !line.includes('.catch(')) {
          // 检查后续几行是否有 .catch()
          const nextLines = lines.slice(index, index + 5).join('\n');
          if (!nextLines.includes('.catch(')) {
            suggestions.push(this.createSuggestion({
              category: 'bug',
              priority: 'high',
              title: '未处理的 Promise rejection',
              description: '.then() 调用没有对应的 .catch() 处理',
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '添加 .catch() 处理或使用 async/await + try/catch',
              autoFixable: false,
              impact: '可能导致未捕获的 Promise rejection',
              effort: 'small'
            }));
          }
        }

        // 检测 async 函数没有 try/catch
        if (line.includes('async ') && line.includes('function') || line.match(/async\s+\w+\s*\(/)) {
          const funcBody = this.extractFunctionBody(lines, index);
          if (funcBody && !funcBody.includes('try') && !funcBody.includes('catch')) {
            suggestions.push(this.createSuggestion({
              category: 'bug',
              priority: 'medium',
              title: 'async 函数缺少错误处理',
              description: 'async 函数没有 try/catch 错误处理',
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '添加 try/catch 包裹可能失败的异步操作',
              autoFixable: false,
              impact: '异步错误可能导致进程崩溃',
              effort: 'small'
            }));
          }
        }
      });
    }

    return suggestions;
  }

  /**
   * 检测死代码（未使用的导入和变量）
   */
  private async detectDeadCode(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    // 收集所有导出的名称
    const exportedNames: Set<string> = new Set();
    const importedNames: Map<string, Set<string>> = new Map();

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // 检测未使用的导入
        const importMatch = line.match(/import\s+{([^}]+)}\s+from/);
        if (importMatch) {
          const imports = importMatch[1].split(',').map(s => s.trim().split(' as ')[0].trim());
          for (const imp of imports) {
            if (imp && !content.substring(content.indexOf(line) + line.length).includes(imp)) {
              // 导入项在后续代码中未被使用
              suggestions.push(this.createSuggestion({
                category: 'bug',
                priority: 'medium',
                title: '未使用的导入',
                description: `导入 "${imp}" 在文件中未被使用`,
                location: { file: this.getRelativePath(file), line: index + 1 },
                suggestion: `移除未使用的导入 "${imp}"`,
                autoFixable: true,
                impact: '增加代码体积，降低可读性',
                effort: 'trivial'
              }));
            }
          }
        }

        // 检测声明但未使用的变量
        const varMatch = line.match(/(?:const|let|var)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
        if (varMatch && !line.includes('export')) {
          const varName = varMatch[1];
          // 检查是否是常见的循环变量或特殊变量
          const commonVars = ['i', 'j', 'k', '_', 'err', 'error', 'result', 'data', 'config'];
          if (!commonVars.includes(varName)) {
            // 检查后续代码是否使用了该变量
            const restContent = lines.slice(index + 1).join('\n');
            const usagePattern = new RegExp(`\\b${varName}\\b`);
            if (!usagePattern.test(restContent) && !usagePattern.test(line.substring(line.indexOf(varName) + varName.length))) {
              suggestions.push(this.createSuggestion({
                category: 'bug',
                priority: 'low',
                title: '未使用的变量',
                description: `变量 "${varName}" 声明后未被使用`,
                location: { file: this.getRelativePath(file), line: index + 1 },
                suggestion: `移除未使用的变量 "${varName}" 或确认是否需要`,
                autoFixable: true,
                impact: '增加代码复杂度',
                effort: 'trivial'
              }));
            }
          }
        }
      });
    }

    return suggestions;
  }

  /**
   * 检测 null/undefined 引用风险
   */
  private async detectNullReference(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // 检测可能为 null 的对象属性访问
        if (line.match(/\w+\.\w+\.\w+/) && !line.includes('?.') && !line.includes('!.')) {
          // 三级属性访问，中间可能为 null
          if (!line.includes('null') && !line.includes('undefined') && !line.includes('if') && !line.includes('?.')) {
            suggestions.push(this.createSuggestion({
              category: 'bug',
              priority: 'medium',
              title: '潜在的 null 引用',
              description: '多级属性访问可能遇到 null/undefined',
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '使用可选链操作符 ?. 或添加 null 检查',
              autoFixable: false,
              impact: '可能导致运行时 TypeError',
              effort: 'trivial'
            }));
          }
        }

        // 检测数组访问没有边界检查
        const arrayAccessMatch = line.match(/\w+\[\w+\]/);
        if (arrayAccessMatch && !line.includes('?.[') && !line.includes('if') && !line.includes('length')) {
          suggestions.push(this.createSuggestion({
            category: 'bug',
            priority: 'low',
            title: '数组访问缺少边界检查',
            description: '数组访问没有检查索引是否有效',
            location: { file: this.getRelativePath(file), line: index + 1 },
            suggestion: '添加边界检查或使用可选链 ?.[]',
            autoFixable: false,
            impact: '可能导致 undefined 或越界访问',
            effort: 'trivial'
          }));
        }

        // 检测 JSON.parse 没有错误处理
        if (line.includes('JSON.parse') && !this.hasTryCatchAround(lines, index)) {
          suggestions.push(this.createSuggestion({
            category: 'bug',
            priority: 'high',
            title: 'JSON.parse 缺少错误处理',
            description: 'JSON.parse 可能抛出 SyntaxError',
            location: { file: this.getRelativePath(file), line: index + 1 },
            suggestion: '添加 try/catch 处理无效 JSON',
            autoFixable: false,
            impact: '无效 JSON 可能导致程序崩溃',
            effort: 'small'
          }));
        }
      });
    }

    return suggestions;
  }

  /**
   * 检测循环复杂度过高
   */
  private async detectCyclomaticComplexity(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // 检测嵌套过深（超过 3 层）
        const nestingDepth = this.calculateNestingDepth(lines, index);
        if (nestingDepth > 3) {
          suggestions.push(this.createSuggestion({
            category: 'quality',
            priority: 'medium',
            title: '代码嵌套过深',
            description: `嵌套深度 ${nestingDepth} 层，超过推荐的 3 层`,
            location: { file: this.getRelativePath(file), line: index + 1 },
            suggestion: '使用 early return 或提取函数减少嵌套',
            autoFixable: false,
            impact: '降低代码可读性和可维护性',
            effort: 'medium'
          }));
        }

        // 检测过多的条件分支
        const branchCount = this.countBranchesInFunction(lines, index);
        if (branchCount > 5) {
          suggestions.push(this.createSuggestion({
            category: 'quality',
            priority: 'medium',
            title: '函数分支过多',
            description: `函数包含 ${branchCount} 个分支，建议拆分`,
            location: { file: this.getRelativePath(file), line: index + 1 },
            suggestion: '使用策略模式或提取子函数',
            autoFixable: false,
            impact: '增加代码复杂度和测试难度',
            effort: 'medium'
          }));
        }
      });
    }

    return suggestions;
  }

  /**
   * 检测重复代码块
   */
  private async detectDuplicateCode(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    // 使用简化的重复检测：检测相似的代码模式
    const codePatterns: Map<string, { file: string; line: number; pattern: string }[]> = new Map();

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      // 收集 5 行以上的代码块
      for (let i = 0; i < lines.length - 5; i++) {
        const block = lines.slice(i, i + 5)
          .map(l => l.trim())
          .filter(l => l.length > 10 && !l.startsWith('//') && !l.startsWith('*'))
          .join('\n');

        if (block.length > 50) {
          // 简化模式：移除变量名差异
          const normalized = block
            .replace(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g, 'VAR')
            .replace(/\b\d+\b/g, 'NUM');

          if (!codePatterns.has(normalized)) {
            codePatterns.set(normalized, []);
          }
          codePatterns.get(normalized)!.push({
            file: this.getRelativePath(file),
            line: i + 1,
            pattern: block.substring(0, 50)
          });
        }
      }
    }

    // 检测重复模式
    for (const [normalized, locations] of codePatterns) {
      if (locations.length > 1) {
        suggestions.push(this.createSuggestion({
          category: 'common',
          priority: 'medium',
          title: '重复代码块',
          description: `相似代码出现在 ${locations.length} 个位置`,
          location: { file: locations[0].file, line: locations[0].line },
          suggestion: '提取为公共函数或使用继承',
          autoFixable: false,
          impact: '增加维护成本，容易遗漏同步修改',
          effort: 'medium'
        }));
      }
    }

    // 限制重复代码建议数量，避免过多
    return suggestions.slice(0, 10);
  }

  /**
   * 检测过时依赖
   */
  private async detectOutdatedDependencies(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];

    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      // 检查是否有明显的过时模式
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      for (const [name, version] of Object.entries(deps)) {
        const verStr = String(version);

        // 检测非常老的版本模式
        if (verStr.startsWith('0.') || verStr.match(/^\d+\.\d+\.\d+$/)) {
          // 固定版本可能过时
          suggestions.push(this.createSuggestion({
            category: 'capability',
            priority: 'low',
            title: '依赖可能过时',
            description: `"${name}" 使用固定版本 ${verStr}，建议检查更新`,
            location: { file: 'package.json' },
            suggestion: `运行 npm outdated 检查 "${name}" 是否有更新`,
            autoFixable: false,
            impact: '可能缺少安全修复和新功能',
            effort: 'small'
          }));
        }
      }

      // 检测缺少重要的开发依赖
      const recommendedDevDeps = ['typescript', 'eslint', 'prettier', 'vitest', 'jest'];
      for (const dep of recommendedDevDeps) {
        if (!deps[dep] && Object.keys(deps).length > 5) {
          suggestions.push(this.createSuggestion({
            category: 'capability',
            priority: 'medium',
            title: `缺少推荐的依赖`,
            description: `项目可能需要 "${dep}"`,
            location: { file: 'package.json' },
            suggestion: `考虑添加 ${dep} 以改善开发体验`,
            autoFixable: false,
            impact: '缺少代码质量工具',
            effort: 'small'
          }));
        }
      }
    } catch {
      // 没有 package.json
    }

    return suggestions.slice(0, 5); // 限制数量
  }

  /**
   * 检测缺少类型定义
   */
  private async detectMissingTypes(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.tsx']);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // 检测隐式 any（函数参数没有类型）
        const funcParamMatch = line.match(/function\s+\w+\s*\(([^)]+)\)/);
        if (funcParamMatch) {
          const params = funcParamMatch[1].split(',');
          for (const param of params) {
            if (param.trim() && !param.includes(':') && !param.includes('...')) {
              suggestions.push(this.createSuggestion({
                category: 'capability',
                priority: 'medium',
                title: '函数参数缺少类型',
                description: `参数 "${param.trim()}" 没有类型定义`,
                location: { file: this.getRelativePath(file), line: index + 1 },
                suggestion: '添加参数类型定义',
                autoFixable: false,
                impact: '降低类型安全性',
                effort: 'trivial'
              }));
            }
          }
        }

        // 检测箭头函数参数缺少类型
        const arrowParamMatch = line.match(/\(([^)]+)\)\s*=>/);
        if (arrowParamMatch && !line.includes(':')) {
          const params = arrowParamMatch[1].split(',');
          for (const param of params) {
            if (param.trim() && !param.includes(':')) {
              suggestions.push(this.createSuggestion({
                category: 'capability',
                priority: 'low',
                title: '箭头函数参数缺少类型',
                description: `参数 "${param.trim()}" 没有类型定义`,
                location: { file: this.getRelativePath(file), line: index + 1 },
                suggestion: '添加参数类型定义',
                autoFixable: false,
                impact: '降低类型安全性',
                effort: 'trivial'
              }));
            }
          }
        }

        // 检测对象字面量没有类型定义
        if (line.match(/const\s+\w+\s*=\s*{/)) {
          const nextLines = lines.slice(index, index + 10).join('\n');
          if (!nextLines.includes(': ') && !nextLines.includes('interface') && !nextLines.includes('type')) {
            suggestions.push(this.createSuggestion({
              category: 'capability',
              priority: 'low',
              title: '对象缺少类型定义',
              description: '对象字面量没有明确的类型定义',
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '添加 interface 或 type 定义',
              autoFixable: false,
              impact: '降低类型推断准确性',
              effort: 'small'
            }));
          }
        }
      });
    }

    return suggestions.slice(0, 20); // 限制数量
  }

  /**
   * 检测缺少 CI/CD 配置
   */
  private async detectMissingCIConfig(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];

    const ciIndicators = [
      '.github/workflows',
      '.gitlab-ci.yml',
      ' Jenkinsfile',
      'bitbucket-pipelines.yml',
      '.circleci/config.yml',
      'azure-pipelines.yml'
    ];

    let hasCI = false;
    for (const indicator of ciIndicators) {
      try {
        await fs.access(path.join(this.projectRoot, indicator));
        hasCI = true;
        break;
      } catch {
        // 不存在
      }
    }

    if (!hasCI) {
      // 检查是否有 package.json（Node.js 项目）
      try {
        await fs.access(path.join(this.projectRoot, 'package.json'));
        suggestions.push(this.createSuggestion({
          category: 'capability',
          priority: 'high',
          title: '缺少 CI/CD 配置',
          description: '项目没有 CI/CD 配置文件',
          location: { file: this.getRelativePath(this.projectRoot) },
          suggestion: '添加 GitHub Actions 或其他 CI/CD 配置',
          autoFixable: false,
          impact: '缺少自动化测试和部署',
          effort: 'medium'
        }));
      } catch {
        // 没有 package.json
      }
    }

    // 检测 GitHub Actions 配置是否完整
    try {
      const workflowsDir = path.join(this.projectRoot, '.github', 'workflows');
      const files = await fs.readdir(workflowsDir);

      for (const file of files) {
        if (file.endsWith('.yml') || file.endsWith('.yaml')) {
          const content = await fs.readFile(path.join(workflowsDir, file), 'utf-8');

          // 检测缺少测试步骤
          if (!content.includes('test') && !content.includes('npm test')) {
            suggestions.push(this.createSuggestion({
              category: 'capability',
              priority: 'medium',
              title: 'CI 配置缺少测试步骤',
              description: `GitHub Actions ${file} 没有包含测试步骤`,
              location: { file: `.github/workflows/${file}` },
              suggestion: '添加测试步骤到 CI 配置',
              autoFixable: false,
              impact: 'CI 可能遗漏测试失败',
              effort: 'small'
            }));
          }

          // 检测缺少缓存配置
          if (!content.includes('cache:') && content.includes('npm install')) {
            suggestions.push(this.createSuggestion({
              category: 'capability',
              priority: 'low',
              title: 'CI 缺少依赖缓存',
              description: `GitHub Actions ${file} 没有配置 npm 缓存`,
              location: { file: `.github/workflows/${file}` },
              suggestion: '添加依赖缓存以加速 CI',
              autoFixable: false,
              impact: 'CI 运行时间较长',
              effort: 'trivial'
            }));
          }
        }
      }
    } catch {
      // 没有 GitHub Actions
    }

    return suggestions;
  }

  /**
   * 检测缺少测试覆盖率配置
   */
  private async detectMissingCoverageConfig(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];

    try {
      const packageJsonPath = path.join(this.projectRoot, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);

      // 检测 vitest 配置
      if (packageJson.devDependencies?.vitest || packageJson.dependencies?.vitest) {
        // 检查是否有覆盖率配置
        const scripts = packageJson.scripts || {};
        const hasCoverageScript = Object.values(scripts).some(
          s => typeof s === 'string' && s.includes('coverage')
        );

        if (!hasCoverageScript) {
          suggestions.push(this.createSuggestion({
            category: 'capability',
            priority: 'medium',
            title: '缺少测试覆盖率配置',
            description: '项目使用 vitest 但没有覆盖率脚本',
            location: { file: 'package.json' },
            suggestion: '添加 "test:coverage": "vitest run --coverage" 脚本',
            autoFixable: false,
            impact: '无法追踪测试覆盖率',
            effort: 'trivial'
          }));
        }
      }

      // 检测 jest 配置
      if (packageJson.devDependencies?.jest || packageJson.dependencies?.jest) {
        const scripts = packageJson.scripts || {};
        const hasCoverageScript = Object.values(scripts).some(
          s => typeof s === 'string' && s.includes('coverage')
        );

        if (!hasCoverageScript) {
          suggestions.push(this.createSuggestion({
            category: 'capability',
            priority: 'medium',
            title: '缺少测试覆盖率配置',
            description: '项目使用 jest 但没有覆盖率脚本',
            location: { file: 'package.json' },
            suggestion: '添加 "test:coverage": "jest --coverage" 脚本',
            autoFixable: false,
            impact: '无法追踪测试覆盖率',
            effort: 'trivial'
          }));
        }
      }
    } catch {
      // 没有 package.json
    }

    return suggestions;
  }

  /**
   * 检测缺少 CHANGELOG
   */
  private async detectMissingChangelog(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];

    try {
      await fs.access(path.join(this.projectRoot, 'CHANGELOG.md'));
    } catch {
      // 没有 CHANGELOG
      try {
        await fs.access(path.join(this.projectRoot, 'package.json'));
        const packageJsonPath = path.join(this.projectRoot, 'package.json');
        const content = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(content);

        // 只有发布到 npm 的项目才需要 CHANGELOG
        if (packageJson.name && packageJson.version) {
          suggestions.push(this.createSuggestion({
            category: 'capability',
            priority: 'medium',
            title: '缺少 CHANGELOG',
            description: '项目没有 CHANGELOG.md 文件',
            location: { file: this.getRelativePath(this.projectRoot) },
            suggestion: '添加 CHANGELOG.md 记录版本变更',
            autoFixable: false,
            impact: '用户难以了解版本变化',
            effort: 'small'
          }));
        }
      } catch {
        // 没有 package.json
      }
    }

    return suggestions;
  }

  /**
   * 检测路径遍历风险
   */
  private async detectPathTraversal(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // 检测用户输入拼接路径
        if (line.includes('path.join') || line.includes('path.resolve')) {
          const hasUserInput = line.includes('req.') || line.includes('input') ||
                               line.includes('params') || line.includes('body') ||
                               line.includes('args') || line.includes('${');

          if (hasUserInput) {
            suggestions.push(this.createSuggestion({
              category: 'security',
              priority: 'high',
              title: '路径遍历风险',
              description: '用户输入直接用于路径拼接',
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '验证和清理用户输入，使用白名单',
              autoFixable: false,
              impact: '可能导致任意文件访问',
              effort: 'small'
            }));
          }
        }

        // 检测 readFile/writeFile 用户输入
        if (line.includes('readFile') || line.includes('writeFile') || line.includes('open(')) {
          const hasUserInput = line.includes('req.') || line.includes('input') ||
                               line.includes('params') || line.includes('${');

          if (hasUserInput) {
            suggestions.push(this.createSuggestion({
              category: 'security',
              priority: 'high',
              title: '文件操作路径风险',
              description: '文件操作使用用户输入作为路径',
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '验证路径是否在允许范围内',
              autoFixable: false,
              impact: '可能导致敏感文件泄露或篡改',
              effort: 'small'
            }));
          }
        }
      });
    }

    return suggestions;
  }

  /**
   * 检测正则 DoS (ReDoS) 风险
   */
  private async detectReDoS(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    // ReDoS 危险模式：嵌套量词、重叠匹配
    const dangerousPatterns = [
      /(\+|\*|\{[\d,]+\})\s*(\+|\*|\{[\d,]+\})/,  // 嵌套量词 a++ a** a{1,2}+
      /\.\.\+/,  // ..+ 可能匹配过多
      /\(\.\*\)\.\*/,  // (.*).* 重叠
      /\(\.\*\)\+/,  // (.*)+ 重叠
      /\[.*\]\.\*\[.*\]/,  // 多个 .* 连接
    ];

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // 排除注释行
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('/*')) {
          return;
        }

        // 检测正则定义
        const regexMatch = line.match(/new\s+RegExp\s*\(\s*['"`]([^'"`]+)['"`]/);
        if (regexMatch) {
          const pattern = regexMatch[1];
          for (const dangerous of dangerousPatterns) {
            if (dangerous.test(pattern)) {
              suggestions.push(this.createSuggestion({
                category: 'security',
                priority: 'high',
                title: '正则 DoS 风险 (ReDoS)',
                description: `正则表达式 "${pattern}" 可能导致性能问题`,
                location: { file: this.getRelativePath(file), line: index + 1 },
                suggestion: '简化正则表达式，避免嵌套量词',
                autoFixable: false,
                impact: '可能导致 CPU 拒绝服务',
                effort: 'medium'
              }));
              break;
            }
          }
        }

        // 检测正则字面量 - 更严格的匹配，确保不是注释
        if (!trimmedLine.startsWith('//')) {
          const literalMatch = line.match(/(?<![\/\*])\/([^\/]+)\/[gimsuvy]*/);
          if (literalMatch) {
            const pattern = literalMatch[1];
            // 排除简单的正则（如 /\w+/）和常见安全模式
            if (pattern.length > 5 && !pattern.match(/^[a-zA-Z\s]+$/) && !pattern.match(/^\\[a-zA-Z]+$/)) {
              for (const dangerous of dangerousPatterns) {
                if (dangerous.test(pattern)) {
                  suggestions.push(this.createSuggestion({
                    category: 'security',
                    priority: 'high',
                    title: '正则 DoS 风险 (ReDoS)',
                    description: `正则表达式 /${pattern}/ 可能导致性能问题`,
                    location: { file: this.getRelativePath(file), line: index + 1 },
                    suggestion: '简化正则表达式，避免嵌套量词',
                    autoFixable: false,
                    impact: '可能导致 CPU 拒绝服务',
                    effort: 'medium'
                  }));
                  break;
                }
              }
            }
          }
        }
      });
    }

    return suggestions;
  }

  /**
   * 检测命令注入风险
   */
  private async detectCommandInjection(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    const dangerousCommands = ['exec', 'execSync', 'spawn', 'spawnSync', 'execFile', 'execFileSync'];

    for (const file of files) {
      // 排除 CLI 命令文件、测试文件 - 这些是正常的命令执行场景
      const relPath = this.getRelativePath(file);
      if (relPath.includes('cli/commands/') || relPath.includes('test') || relPath.includes('spec')) {
        continue;
      }

      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // 检测 child_process 使用
        for (const cmd of dangerousCommands) {
          if (line.includes(cmd) && line.includes('(')) {
            // 检测真正的用户输入（来自 HTTP 请求等）
            const hasRealUserInput = line.includes('req.') || line.includes('request.') ||
                                     line.includes('body') || line.includes('query.');

            if (hasRealUserInput) {
              suggestions.push(this.createSuggestion({
                category: 'security',
                priority: 'critical',
                title: '命令注入风险',
                description: `使用 ${cmd} 执行包含用户输入的命令`,
                location: { file: this.getRelativePath(file), line: index + 1 },
                suggestion: '避免拼接用户输入，使用参数数组',
                autoFixable: false,
                impact: '可能导致任意命令执行',
                effort: 'medium'
              }));
            }
          }
        }

        // 检测 eval 直接执行用户输入
        if (line.includes('eval(')) {
          const hasUserInput = line.includes('req.') || line.includes('input') ||
                               line.includes('${') || line.includes('argv');
          if (hasUserInput) {
            suggestions.push(this.createSuggestion({
              category: 'security',
              priority: 'critical',
              title: 'eval 命令注入',
              description: 'eval 直接执行包含用户输入的代码',
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '禁止使用 eval，使用安全替代方案',
              autoFixable: false,
              impact: '可能导致任意代码执行',
              effort: 'large'
            }));
          }
        }
      });
    }

    return suggestions;
  }

  /**
   * 检测不安全的 HTTP 请求
   */
  private async detectUnsafeHTTP(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        // 检测缺少 timeout 的请求
        if (line.includes('fetch(') || line.includes('axios.') || line.includes('http.request')) {
          const nextLines = lines.slice(index, index + 10).join('\n');
          if (!nextLines.includes('timeout') && !nextLines.includes('AbortSignal')) {
            suggestions.push(this.createSuggestion({
              category: 'security',
              priority: 'medium',
              title: 'HTTP 请求缺少 timeout',
              description: 'HTTP 请求没有设置超时时间',
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '添加 timeout 配置，避免请求无限等待',
              autoFixable: false,
              impact: '可能导致服务阻塞',
              effort: 'trivial'
            }));
          }
        }

        // 检测 HTTP（非 HTTPS）请求
        if (line.includes("'http://") || line.includes('"http://') || line.includes('http://')) {
          // 排除 localhost 和测试环境
          if (!line.includes('localhost') && !line.includes('127.0.0.1') && !line.includes('test')) {
            suggestions.push(this.createSuggestion({
              category: 'security',
              priority: 'medium',
              title: '使用不安全的 HTTP',
              description: '使用 HTTP 而非 HTTPS 协议',
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '使用 HTTPS 协议确保数据传输安全',
              autoFixable: false,
              impact: '数据可能被窃听或篡改',
              effort: 'trivial'
            }));
          }
        }

        // 检测缺少错误处理的请求
        if (line.includes('fetch(') && !this.hasTryCatchAround(lines, index)) {
          suggestions.push(this.createSuggestion({
            category: 'bug',
            priority: 'medium',
            title: 'fetch 缺少错误处理',
            description: 'fetch 请求没有错误处理',
            location: { file: this.getRelativePath(file), line: index + 1 },
            suggestion: '添加 .catch() 或 try/catch 处理网络错误',
            autoFixable: false,
            impact: '网络错误可能导致程序异常',
            effort: 'small'
          }));
        }
      });
    }

    return suggestions.slice(0, 10); // 限制数量
  }

  /**
   * 检测文件过长
   */
  private async detectLongFiles(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      // 检测文件行数
      const lineCount = lines.length;
      const MAX_LINES = 500; // 推荐最大行数

      if (lineCount > MAX_LINES) {
        suggestions.push(this.createSuggestion({
          category: 'quality',
          priority: 'high',
          title: '文件过长',
          description: `文件 ${lineCount} 行，超过推荐的 ${MAX_LINES} 行`,
          location: { file: this.getRelativePath(file) },
          suggestion: '拆分文件为多个模块，按职责分离',
          autoFixable: false,
          impact: '降低可维护性，难以定位问题',
          effort: 'large'
        }));
      } else if (lineCount > 300) {
        suggestions.push(this.createSuggestion({
          category: 'quality',
          priority: 'medium',
          title: '文件较长',
          description: `文件 ${lineCount} 行，接近推荐的 ${MAX_LINES} 行上限`,
          location: { file: this.getRelativePath(file) },
          suggestion: '考虑拆分文件，按职责分离',
          autoFixable: false,
          impact: '降低可维护性',
          effort: 'medium'
        }));
      }
    }

    return suggestions.slice(0, 10); // 限制数量
  }

  /**
   * 检测方法/函数过长（增强版）
   */
  private async detectLongFunctions(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    const MAX_FUNCTION_LINES = 50;

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');

      // 检测函数定义
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // 检测各种函数定义形式
        const functionPatterns = [
          /function\s+\w+\s*\(/,           // function name()
          /async\s+function\s+\w+\s*\(/,    // async function name()
          /const\s+\w+\s*=\s*(?:async)?\s*function\s*\(/,  // const name = function()
          /(?:public|private|protected)?\s*(?:async)?\s*\w+\s*\(/,  // class method
          /const\s+\w+\s*=\s*(?:async)?\s*\([^)]*\)\s*=>/,  // arrow function
        ];

        const isFunction = functionPatterns.some(p => p.test(trimmedLine));

        if (isFunction) {
          const funcBody = this.extractFunctionBody(lines, i);
          if (funcBody) {
            const funcLines = funcBody.split('\n').length;

            if (funcLines > MAX_FUNCTION_LINES) {
              // 提取函数名
              const nameMatch = line.match(/(?:function|const|async)\s+(\w+)/) ||
                               line.match(/(\w+)\s*\(/);
              const funcName = nameMatch ? nameMatch[1] : 'anonymous';

              suggestions.push(this.createSuggestion({
                category: 'quality',
                priority: 'high',
                title: '函数过长',
                description: `函数 "${funcName}" ${funcLines} 行，超过推荐的 ${MAX_FUNCTION_LINES} 行`,
                location: { file: this.getRelativePath(file), line: i + 1 },
                suggestion: '拆分函数为多个小函数，每个函数只做一件事',
                autoFixable: false,
                impact: '降低可读性和可维护性，难以测试',
                effort: 'medium'
              }));
            } else if (funcLines > 30) {
              const nameMatch = line.match(/(?:function|const|async)\s+(\w+)/) ||
                               line.match(/(\w+)\s*\(/);
              const funcName = nameMatch ? nameMatch[1] : 'anonymous';

              suggestions.push(this.createSuggestion({
                category: 'quality',
                priority: 'medium',
                title: '函数较长',
                description: `函数 "${funcName}" ${funcLines} 行，接近推荐的 ${MAX_FUNCTION_LINES} 行`,
                location: { file: this.getRelativePath(file), line: i + 1 },
                suggestion: '考虑拆分函数，提高可读性',
                autoFixable: false,
                impact: '降低可读性',
                effort: 'small'
              }));
            }
          }
        }
      }
    }

    return suggestions.slice(0, 20); // 限制数量
  }

  /**
   * 检测架构问题
   */
  private async detectArchitectureIssues(): Promise<UpgradeSuggestion[]> {
    const suggestions: UpgradeSuggestion[] = [];
    const files = await this.scanFiles(['.ts', '.js', '.tsx', '.jsx']);

    // 1. 检测循环依赖风险
    const importsByFile: Map<string, Set<string>> = new Map();

    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');
      const imports: Set<string> = new Set();

      lines.forEach(line => {
        const importMatch = line.match(/from\s+['"`]([^'"`]+)['"`]/);
        if (importMatch) {
          imports.add(importMatch[1]);
        }
      });

      importsByFile.set(this.getRelativePath(file), imports);
    }

    // 检测可能的循环依赖
    for (const [file, imports] of importsByFile) {
      for (const imp of imports) {
        // 简化检测：同目录文件互相导入
        if (imp.startsWith('.') && !imp.includes('index')) {
          const targetFile = Array.from(importsByFile.keys()).find((f: string) =>
            f.includes(imp.replace('./', '').replace('../', ''))
          );
          if (targetFile) {
            const targetImports = importsByFile.get(targetFile);
            if (targetImports && Array.from(targetImports).some((t: string) => file.includes(t.replace('./', '').replace('../', '')))) {
              suggestions.push(this.createSuggestion({
                category: 'quality',
                priority: 'high',
                title: '可能的循环依赖',
                description: `${file} 和 ${targetFile} 可能存在循环依赖`,
                location: { file: file },
                suggestion: '重构依赖关系，使用接口或事件解耦',
                autoFixable: false,
                impact: '可能导致初始化顺序问题',
                effort: 'medium'
              }));
            }
          }
        }
      }
    }

    // 2. 检测违反分层原则
    const layerOrder = ['cli', 'orchestrator', 'agents', 'storage', 'types'];
    for (const [file, imports] of importsByFile) {
      // 确定文件所在层级
      const fileLayer = layerOrder.findIndex(layer => file.includes(layer));

      for (const imp of imports) {
        if (imp.startsWith('.')) {
          // 确定导入所在层级
          const impLayer = layerOrder.findIndex(layer => imp.includes(layer));

          // 如果导入层级高于文件层级，可能违反分层原则
          if (impLayer > fileLayer && fileLayer >= 0) {
            suggestions.push(this.createSuggestion({
              category: 'quality',
              priority: 'medium',
              title: '可能违反分层原则',
              description: `${file} 导入了更高层级的模块`,
              location: { file: file },
              suggestion: '遵循分层架构，避免上层依赖下层',
              autoFixable: false,
              impact: '增加耦合度，降低架构清晰度',
              effort: 'medium'
            }));
          }
        }
      }
    }

    // 3. 检测职责不单一（文件包含过多类/函数）
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');

      // 检测类数量
      const classMatches = content.match(/class\s+\w+/g);
      if (classMatches && classMatches.length > 3) {
        suggestions.push(this.createSuggestion({
          category: 'quality',
          priority: 'medium',
          title: '文件包含多个类',
          description: `文件包含 ${classMatches.length} 个类，违反单一职责原则`,
          location: { file: this.getRelativePath(file) },
          suggestion: '每个类放在独立文件中',
          autoFixable: false,
          impact: '降低可维护性',
          effort: 'small'
        }));
      }

      // 检测导出函数数量
      const exportMatches = content.match(/export\s+(?:function|const|async)/g);
      if (exportMatches && exportMatches.length > 10) {
        suggestions.push(this.createSuggestion({
          category: 'quality',
          priority: 'low',
          title: '文件导出过多函数',
          description: `文件导出 ${exportMatches.length} 个函数，可能职责不单一`,
          location: { file: this.getRelativePath(file) },
          suggestion: '拆分文件，每个文件职责单一',
          autoFixable: false,
          impact: '降低可维护性',
          effort: 'medium'
        }));
      }
    }

    // 4. 检测缺少抽象层
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');

      // 检测重复的配置/常量
      const configPatterns = content.match(/const\s+\w+[_-]?CONFIG\s*=|const\s+config\s*=/gi);
      if (configPatterns && configPatterns.length > 2) {
        suggestions.push(this.createSuggestion({
          category: 'quality',
          priority: 'low',
          title: '分散的配置定义',
          description: '文件中有多处配置定义，建议集中管理',
          location: { file: this.getRelativePath(file) },
          suggestion: '将配置集中到配置文件或模块',
          autoFixable: false,
          impact: '配置分散难以管理',
          effort: 'small'
        }));
      }

      // 检测硬编码的业务逻辑
      const businessKeywords = ['规则', '计算', '策略', 'rule', 'calculate', 'strategy', 'policy'];
      for (const keyword of businessKeywords) {
        if (content.toLowerCase().includes(keyword) && content.includes('if') && content.includes('return')) {
          suggestions.push(this.createSuggestion({
            category: 'quality',
            priority: 'medium',
            title: '硬编码的业务逻辑',
            description: `检测到硬编码的 ${keyword} 逻辑，建议抽象`,
            location: { file: this.getRelativePath(file) },
            suggestion: '将业务逻辑抽象为策略模式或配置',
            autoFixable: false,
            impact: '业务变更时需要修改多处代码',
            effort: 'medium'
          }));
          break;
        }
      }
    }

    return suggestions.slice(0, 15); // 限制数量
  }

  /**
   * 辅助方法：提取函数体
   */
  private extractFunctionBody(lines: string[], startIndex: number): string | null {
    let depth = 0;
    let body = '';
    let foundOpen = false;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];

      for (const char of line) {
        if (char === '{') {
          depth++;
          foundOpen = true;
        } else if (char === '}') {
          depth--;
          if (depth === 0 && foundOpen) {
            return body;
          }
        }
      }

      if (foundOpen) {
        body += line + '\n';
      }

      // 限制函数体长度
      if (body.length > 5000) {
        return body.substring(0, 5000);
      }
    }

    return null;
  }

  /**
   * 辅助方法：检查是否有 try/catch 包裹
   */
  private hasTryCatchAround(lines: string[], lineIndex: number): boolean {
    // 向上查找 try 块
    for (let i = lineIndex; i >= 0; i--) {
      const line = lines[i];
      if (line.includes('try')) {
        // 检查 try 块是否包含当前行
        let depth = 0;
        for (let j = i; j <= lineIndex; j++) {
          if (lines[j].includes('{')) depth++;
          if (lines[j].includes('}')) depth--;
        }
        if (depth > 0) return true;
      }
      // 遇到函数边界停止
      if (line.includes('function') || line.match(/async\s+\w+/)) {
        break;
      }
    }
    return false;
  }

  /**
   * 辅助方法：计算嵌套深度
   */
  private calculateNestingDepth(lines: string[], lineIndex: number): number {
    let depth = 0;
    let maxDepth = 0;

    for (let i = 0; i <= lineIndex; i++) {
      const line = lines[i];

      // 计算花括号深度
      for (const char of line) {
        if (char === '{') depth++;
        if (char === '}') depth--;
      }

      // 也考虑 if/for/while 增加的嵌套
      if (line.includes('if') || line.includes('for') || line.includes('while') || line.includes('switch')) {
        if (line.includes('{') || lines[i + 1]?.trim() === '{') {
          maxDepth = Math.max(maxDepth, depth);
        }
      }
    }

    return maxDepth;
  }

  /**
   * 辅助方法：计算函数内的分支数
   */
  private countBranchesInFunction(lines: string[], startIndex: number): number {
    const body = this.extractFunctionBody(lines, startIndex);
    if (!body) return 0;

    let count = 0;
    // 使用简单计数而非正则匹配
    count += (body.match(/\bif\b/g) || []).length;
    count += (body.match(/\belse\b/g) || []).length;
    count += (body.match(/\bfor\b/g) || []).length;
    count += (body.match(/\bwhile\b/g) || []).length;
    count += (body.match(/\bswitch\b/g) || []).length;
    count += (body.match(/\bcase\b/g) || []).length;
    count += (body.match(/\bcatch\b/g) || []).length;
    count += (body.match(/&&/g) || []).length;
    count += (body.match(/\|\|/g) || []).length;
    // 三元运算符使用特殊匹配
    count += (body.match(/\?[^:]*:/g) || []).length;

    return count;
  }

  /**
   * 扫描文件
   */
  private async scanFiles(extensions: string[]): Promise<string[]> {
    const files: string[] = [];

    const scan = async (dir: string) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            if (!this.config.excludeDirs.includes(entry.name)) {
              await scan(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch {
        // 目录不存在或无权限，跳过
      }
    };

    for (const dir of this.config.scanDirs) {
      await scan(path.join(this.projectRoot, dir));
    }

    return files;
  }

  /**
   * 创建建议
   */
  private createSuggestion(partial: Omit<UpgradeSuggestion, 'id'>): UpgradeSuggestion {
    return {
      id: `UPG-${String(++this.suggestionIdCounter).padStart(3, '0')}`,
      ...partial
    };
  }

  /**
   * 获取相对路径
   */
  private getRelativePath(absolutePath: string): string {
    const relPath = path.relative(this.projectRoot, absolutePath);
    return relPath || '.'; // 当路径就是项目根目录时，返回 '.' 而非空字符串
  }

  /**
   * 应用用户提示过滤
   */
  private applyUserHint(suggestions: UpgradeSuggestion[]): UpgradeSuggestion[] {
    if (!this.config.userHint) {
      return suggestions;
    }

    const hint = this.config.userHint.toLowerCase();

    // 根据用户提示排序相关建议
    return suggestions.sort((a, b) => {
      const aRelevance = this.calculateRelevance(a, hint);
      const bRelevance = this.calculateRelevance(b, hint);
      return bRelevance - aRelevance;
    });
  }

  /**
   * 计算建议与提示的相关性
   */
  private calculateRelevance(suggestion: UpgradeSuggestion, hint: string): number {
    let score = 0;

    const keywords = hint.split(/\s+/);
    const title = suggestion.title.toLowerCase();
    const desc = suggestion.description.toLowerCase();
    const category = suggestion.category.toLowerCase();

    for (const keyword of keywords) {
      // 类别匹配得分最高
      if (category === keyword) score += 10;
      else if (category.includes(keyword)) score += 5;
      // 标题匹配
      if (title.includes(keyword)) score += 3;
      // 描述匹配
      if (desc.includes(keyword)) score += 1;
    }

    return score;
  }

  /**
   * 按优先级排序
   * 确保高优先级问题排在前面
   */
  private sortWithCategoryBalance(suggestions: UpgradeSuggestion[]): UpgradeSuggestion[] {
    const priorityOrder: Record<UpgradePriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3
    };

    // 简化：直接按优先级排序，不做类别均衡
    // 类别均衡可能导致优先级顺序被破坏
    return suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  /**
   * 按优先级排序
   */
  private sortByPriority(suggestions: UpgradeSuggestion[]): UpgradeSuggestion[] {
    const priorityOrder: Record<UpgradePriority, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3
    };

    return suggestions.sort((a, b) => {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * 生成摘要
   */
  private generateSummary(suggestions: UpgradeSuggestion[]): DetectionResult['summary'] {
    const byCategory: Record<UpgradeCategory, number> = {
      bug: 0, quality: 0, capability: 0, ux: 0, style: 0, security: 0, common: 0,
      prompt: 0, skill: 0, agent: 0
    };
    const byPriority: Record<UpgradePriority, number> = {
      critical: 0, high: 0, medium: 0, low: 0
    };
    let autoFixable = 0;

    for (const s of suggestions) {
      byCategory[s.category]++;
      byPriority[s.priority]++;
      if (s.autoFixable) autoFixable++;
    }

    return {
      total: suggestions.length,
      byCategory,
      byPriority,
      autoFixable
    };
  }
}