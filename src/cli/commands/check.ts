// src/cli/commands/check.ts
import { Command } from 'commander';
import {
  UpgradeDetector,
  type DetectorConfig,
  type UpgradeSuggestion,
  type ProjectType,
  type DetectionResult,
  type UpgradeCategory,
  type UpgradePriority
} from '../../orchestrator/upgrade-detector.js';
import * as readline from 'readline';
import chalk from 'chalk';

export const checkCommand = new Command('check')
  .description('自动检测项目可改进点并提供升级建议')
  .argument('[hint]', '用户提示 (可选，用于聚焦检测方向)')
  .option('--json', '输出 JSON 格式 (供 Skill 解析)')
  .option('--auto', '自动执行所有改进建议 (无需确认)')
  .option('--categories <items>', '指定检测类别 (逗号分隔)', 'bug,quality,capability,ux,style,security,common')
  .option('--min-priority <level>', '最小优先级 (critical|high|medium|low)', 'low')
  .option('--max <number>', '最大建议数量', '50')
  .option('--scan <dirs>', '扫描目录 (逗号分隔)', 'src,skills,docs')
  .option('--interactive', '交互式选择要执行的改进', false)
  .action(async (hint: string | undefined, options) => {
    const projectRoot = process.cwd();

    // 解析配置
    const config: Partial<DetectorConfig> = {
      userHint: hint,
      categories: options.categories.split(',').map((c: string) => c.trim()) as UpgradeCategory[],
      minPriority: options.minPriority as UpgradePriority,
      maxSuggestions: parseInt(options.max),
      scanDirs: options.scan.split(',').map((d: string) => d.trim())
    };

    // 创建检测器
    const detector = new UpgradeDetector(projectRoot, config);

    if (!options.json) {
      console.log(chalk.bold.cyan('\n🔍 OpenMatrix 升级检测器'));
      console.log('━'.repeat(42));
      console.log(`📁 项目路径: ${projectRoot}`);
      if (hint) {
        console.log(`💡 用户提示: ${hint}`);
      }
      console.log('\n⏳ 正在扫描项目...\n');
    }

    try {
      // 执行检测
      const result = await detector.detect();

      // JSON 输出
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // 显示结果
      displayResult(result);

      // 交互式选择
      if (options.interactive && result.suggestions.length > 0) {
        const selected = await interactiveSelect(result.suggestions);
        if (selected.length > 0) {
          await executeSelected(selected, result.projectType);
        }
      } else if (options.auto && result.suggestions.length > 0) {
        // 自动执行所有
        await executeAll(result.suggestions, result.projectType);
      } else if (result.suggestions.length > 0) {
        // 询问用户
        const shouldExecute = await askForExecution();
        if (shouldExecute) {
          await executeAll(result.suggestions, result.projectType);
        }
      }
    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: String(error) }));
      } else {
        console.error(chalk.red('\n❌ 检测失败:'), error);
      }
      process.exit(1);
    }
  });

/**
 * 显示检测结果
 */
function displayResult(result: DetectionResult): void {
  const { projectType, projectName, suggestions, summary } = result;

  console.log(chalk.bold(`📦 项目: ${projectName}`));
  console.log(`   类型: ${formatProjectType(projectType)}`);
  console.log(`   扫描时间: ${new Date(result.timestamp).toLocaleString()}\n`);

  // 摘要
  console.log(chalk.bold('📊 检测摘要'));
  console.log('━'.repeat(42));

  const categoryLabels: Record<UpgradeCategory, string> = {
    bug: '🐛 代码缺陷',
    quality: '🔧 代码质量',
    capability: '📦 缺失能力',
    ux: '👤 用户体验',
    style: '🎨 代码风格',
    security: '🔒 安全问题',
    common: '⚠️ 常见问题',
    prompt: '🤖 Prompt 问题',
    skill: '⚡ Skill 问题',
    agent: '🧠 Agent 配置'
  };

  for (const [cat, count] of Object.entries(summary.byCategory) as [UpgradeCategory, number][]) {
    if (count > 0) {
      console.log(`   ${categoryLabels[cat]}: ${chalk.yellow(count)}`);
    }
  }

  console.log(`\n   总计: ${chalk.bold(summary.total)} 个建议`);
  console.log(`   可自动修复: ${chalk.green(summary.autoFixable)} 个\n`);

  if (suggestions.length === 0) {
    console.log(chalk.green('✅ 未发现问题，项目状态良好！\n'));
    return;
  }

  // 详细建议
  console.log(chalk.bold('📋 改进建议'));
  console.log('━'.repeat(42) + '\n');

  // 按优先级分组
  const critical = suggestions.filter(s => s.priority === 'critical');
  const high = suggestions.filter(s => s.priority === 'high');
  const medium = suggestions.filter(s => s.priority === 'medium');
  const low = suggestions.filter(s => s.priority === 'low');

  if (critical.length > 0) {
    console.log(chalk.red.bold('🚨 关键问题:\n'));
    for (const s of critical) {
      displaySuggestion(s);
    }
  }

  if (high.length > 0) {
    console.log(chalk.yellow.bold('⚠️ 高优先级:\n'));
    for (const s of high) {
      displaySuggestion(s);
    }
  }

  if (medium.length > 0) {
    console.log(chalk.blue.bold('📋 中优先级:\n'));
    for (const s of medium) {
      displaySuggestion(s);
    }
  }

  if (low.length > 0) {
    console.log(chalk.gray.bold('💡 低优先级:\n'));
    for (const s of low.slice(0, 10)) { // 限制显示
      displaySuggestion(s);
    }
    if (low.length > 10) {
      console.log(chalk.gray(`   ... 还有 ${low.length - 10} 个低优先级建议\n`));
    }
  }

  // 提示
  console.log(chalk.gray('━'.repeat(42)));
  console.log(chalk.gray('💡 提示:'));
  console.log(chalk.gray('   --interactive  交互式选择改进项'));
  console.log(chalk.gray('   --auto         自动执行所有改进'));
  console.log();
}

/**
 * 显示单个建议
 */
function displaySuggestion(s: UpgradeSuggestion): void {
  const priorityColors: Record<UpgradePriority, (text: string) => string> = {
    critical: chalk.red,
    high: chalk.yellow,
    medium: chalk.blue,
    low: chalk.gray
  };

  const categoryIcons: Record<UpgradeCategory, string> = {
    bug: '🐛',
    quality: '🔧',
    capability: '📦',
    ux: '👤',
    style: '🎨',
    security: '🔒',
    common: '⚠️',
    prompt: '🤖',
    skill: '⚡',
    agent: '🧠'
  };

  const color = priorityColors[s.priority];
  console.log(`  ${color(`[${s.id}]`)} ${categoryIcons[s.category]} ${s.title}`);
  console.log(`      位置: ${s.location.file}${s.location.line ? `:${s.location.line}` : ''}`);
  console.log(`      建议: ${chalk.gray(s.suggestion)}`);
  if (s.autoFixable) {
    console.log(`      ${chalk.green('✓ 可自动修复')}`);
  }
  console.log();
}

/**
 * 格式化项目类型
 */
function formatProjectType(type: ProjectType): string {
  const labels: Record<ProjectType, string> = {
    openmatrix: '🤖 OpenMatrix',
    'ai-project': '🧠 AI 项目',
    nodejs: '📦 Node.js',
    typescript: '📘 TypeScript',
    python: '🐍 Python',
    go: '🔷 Go',
    rust: '🦀 Rust',
    java: '☕ Java',
    csharp: '💜 C#',
    cpp: '⚙️ C/C++',
    php: '🐘 PHP',
    dart: '🎯 Dart',
    unknown: '❓ 未知'
  };
  return labels[type];
}

/**
 * 交互式选择
 */
async function interactiveSelect(suggestions: UpgradeSuggestion[]): Promise<UpgradeSuggestion[]> {
  console.log(chalk.bold.cyan('\n🎯 交互式选择'));
  console.log('━'.repeat(42));
  console.log('选择要执行的改进项 (空格选择，回车确认):\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // 显示选项
  suggestions.forEach((s, i) => {
    console.log(`  [ ] ${i + 1}. ${s.title} (${s.priority})`);
  });

  console.log('\n输入序号 (用逗号分隔)，或输入 "all" 选择全部:');

  return new Promise((resolve) => {
    rl.question('> ', (answer) => {
      rl.close();

      if (answer.trim().toLowerCase() === 'all') {
        resolve(suggestions);
        return;
      }

      const indices = answer.split(',')
        .map(s => parseInt(s.trim()) - 1)
        .filter(i => i >= 0 && i < suggestions.length);

      resolve(indices.map(i => suggestions[i]));
    });
  });
}

/**
 * 询问是否执行
 */
async function askForExecution(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\n是否执行这些改进? (y/N) ', (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

/**
 * 执行选中的改进
 */
async function executeSelected(suggestions: UpgradeSuggestion[], projectType: ProjectType): Promise<void> {
  console.log(chalk.bold.cyan('\n🚀 执行改进'));
  console.log('━'.repeat(42));
  console.log(`选择了 ${suggestions.length} 个改进项\n`);

  // 这里需要调用 /om:start 来执行实际的改进
  // 输出 JSON 格式供 Skill 解析
  console.log(JSON.stringify({
    action: 'execute_upgrades',
    projectType,
    suggestions: suggestions.map(s => ({
      id: s.id,
      title: s.title,
      category: s.category,
      priority: s.priority,
      location: s.location,
      suggestion: s.suggestion
    }))
  }, null, 2));
}

/**
 * 执行所有改进
 */
async function executeAll(suggestions: UpgradeSuggestion[], projectType: ProjectType): Promise<void> {
  console.log(chalk.bold.cyan('\n🚀 自动执行所有改进'));
  console.log('━'.repeat(42));

  // 输出 JSON 供 Skill 处理
  console.log(JSON.stringify({
    action: 'execute_all_upgrades',
    projectType,
    count: suggestions.length,
    suggestions: suggestions.map(s => ({
      id: s.id,
      title: s.title,
      category: s.category,
      priority: s.priority,
      location: s.location,
      suggestion: s.suggestion
    }))
  }, null, 2));
}