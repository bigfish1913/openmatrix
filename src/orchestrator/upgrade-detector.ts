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
      this.detectAgentConfigIssues()
    ];

    const results = await Promise.all(detectors);
    for (const result of results) {
      suggestions.push(...result);
    }

    // 根据用户提示过滤/排序
    let filtered = this.applyUserHint(suggestions);

    // 按优先级排序
    filtered = this.sortByPriority(filtered);

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
        // TODO 检测
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

        // FIXME 检测
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

        // HACK 检测
        const hackMatch = line.match(/\/\/\s*HACK:?\s*(.+)/i);
        if (hackMatch) {
          suggestions.push(this.createSuggestion({
            category: 'bug',
            priority: 'medium',
            title: `临时方案: ${hackMatch[1]}`,
            description: `发现 HACK 标记，表示使用了临时解决方案`,
            location: { file: this.getRelativePath(file), line: index + 1 },
            suggestion: `替换为正式实现`,
            autoFixable: false,
            impact: '技术债务累积',
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

        // console.log 检测 (生产代码)
        if (line.includes('console.log') && !file.includes('test') && !file.includes('spec')) {
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
        // 检查错误消息是否友好
        if (line.includes('throw new Error') || line.includes('console.error')) {
          const errorMatch = line.match(/Error\(['"`]([^'"`]+)['"`]\)/);
          if (errorMatch && errorMatch[1].length < 10) {
            suggestions.push(this.createSuggestion({
              category: 'ux',
              priority: 'medium',
              title: '错误消息过于简短',
              description: `错误消息 "${errorMatch[1]}" 过于简短，不利于用户理解`,
              location: { file: this.getRelativePath(file), line: index + 1 },
              suggestion: '提供更详细的错误消息，包含解决建议',
              autoFixable: false,
              impact: '降低用户体验',
              effort: 'trivial'
            }));
          }
        }

        // 检查是否缺少帮助信息
        if (file.includes('command') && line.includes('.description(')) {
          const nextLines = lines.slice(index, index + 10).join('\n');
          if (!nextLines.includes('.option(') && !nextLines.includes('--help')) {
            // 命令可能缺少选项说明
          }
        }
      });
    }

    return suggestions;
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
        if (line.includes('C:\\') || line.includes('/home/') || line.includes('/Users/')) {
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
    return path.relative(this.projectRoot, absolutePath);
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

    for (const keyword of keywords) {
      if (title.includes(keyword)) score += 2;
      if (desc.includes(keyword)) score += 1;
      if (suggestion.category.includes(keyword)) score += 3;
    }

    return score;
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