// src/cli/commands/deploy.ts
import { Command } from 'commander';
import { EnvironmentDetector } from '../../orchestrator/environment-detector.js';
import chalk from 'chalk';
import { execSync } from 'child_process';
import type {
  EnvironmentInfo,
  DeployOption,
  DeployMethod,
  DevCommands,
  ProjectType
} from '../../types/index.js';

export const deployCommand = new Command('deploy')
  .description('输出项目环境原始数据供 Skill 分析，或执行指定部署命令')
  .option('--json', '输出 JSON 格式原始数据（供 Skill 层 AI 分析）')
  .option('--show-dev', '包含开发命令', false)
  .option('--run <command>', '执行指定部署命令')
  .option('--dry-run <command>', '预览命令但不执行')
  .action(async (options) => {
    const projectRoot = process.cwd();

    // dry-run：仅显示命令
    if (options.dryRun) {
      console.log(chalk.bold.cyan('\n📋 命令预览 (dry-run)'));
      console.log('━'.repeat(42));
      console.log(chalk.white(`  ${options.dryRun}`));
      console.log(chalk.gray('  (仅预览，不执行)'));
      return;
    }

    // run：执行指定命令
    if (options.run) {
      console.log(chalk.bold.cyan('\n🚀 执行部署命令'));
      console.log('━'.repeat(42));
      console.log(chalk.white(`  ${options.run}\n`));
      try {
        execSync(options.run, { stdio: 'inherit', cwd: projectRoot });
        console.log(chalk.green('\n✅ 命令执行完成'));
      } catch (error) {
        console.error(chalk.red('\n❌ 命令执行失败'));
        process.exit(1);
      }
      return;
    }

    // 默认：输出原始环境数据
    try {
      const detector = new EnvironmentDetector(projectRoot);
      const envInfo = await detector.detect();

      if (options.json) {
        console.log(JSON.stringify(buildRawOutput(envInfo, options.showDev), null, 2));
        return;
      }

      // 非 JSON 模式：简单展示
      displayEnvironmentInfo(envInfo);
      displayDeployOptions(envInfo.deployOptions);
      if (options.showDev) displayDevCommands(envInfo.devCommands);
      displayHints();

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
 * 构建原始数据输出（不含任何推荐逻辑，交给 Skill 层 AI 分析）
 */
function buildRawOutput(envInfo: EnvironmentInfo, showDev: boolean): Record<string, unknown> {
  return {
    projectName: envInfo.projectName,
    projectType: envInfo.projectType,
    projectRoot: envInfo.projectRoot,
    timestamp: envInfo.timestamp,
    buildTools: envInfo.buildTools,
    deployOptions: envInfo.deployOptions,
    ciConfig: envInfo.ciConfig,
    summary: envInfo.summary,
    devCommands: showDev ? envInfo.devCommands : undefined
  };
}

export function displayEnvironmentInfo(info: EnvironmentInfo): void {
  console.log(chalk.bold(`\n📦 项目: ${info.projectName}`));
  console.log(`   类型: ${formatProjectType(info.projectType)}`);
  console.log(`   路径: ${info.projectRoot}\n`);
  console.log(chalk.bold('📊 环境摘要'));
  console.log('━'.repeat(42));
  console.log(`   构建工具: ${chalk.yellow(info.summary.buildToolCount)} 个`);
  console.log(`   部署选项: ${chalk.yellow(info.summary.deployOptionCount)} 个`);
  console.log(`   CI 配置: ${info.summary.hasCIConfig ? chalk.green('已配置') : chalk.gray('未检测到')}`);
  console.log();
}

export function displayDeployOptions(options: DeployOption[]): void {
  console.log(chalk.bold('🚀 检测到的部署配置'));
  console.log('━'.repeat(42));
  if (options.length === 0) {
    console.log(chalk.gray('   未检测到部署配置\n'));
    return;
  }
  for (const opt of options) {
    console.log(`  ${chalk.cyan(getDeployMethodLabel(opt.method))}`);
    if (opt.configFile) console.log(`    配置: ${chalk.gray(opt.configFile)}`);
    if (opt.command) console.log(`    命令: ${chalk.white(opt.command)}`);
    console.log();
  }
}

export function displayDevCommands(commands: DevCommands): void {
  console.log(chalk.bold('🔧 开发命令'));
  console.log('━'.repeat(42));
  const sections: Array<{ label: string; cmds: string[] | undefined }> = [
    { label: '安装', cmds: commands.setup },
    { label: '构建', cmds: commands.build },
    { label: '测试', cmds: commands.test },
    { label: '开发', cmds: commands.dev },
    { label: '启动', cmds: commands.start },
    { label: 'Lint', cmds: commands.lint },
  ];
  for (const s of sections) {
    if (s.cmds && s.cmds.length > 0) {
      console.log(`  ${chalk.yellow(s.label)}: ${chalk.white(s.cmds.join(', '))}`);
    }
  }
  console.log();
}

export function getDeployMethodLabel(method: DeployMethod): string {
  const labels: Record<DeployMethod, string> = {
    'docker': '🐳 Docker',
    'docker-compose': '🐳 Docker Compose',
    'kubernetes': '☸️  Kubernetes',
    'helm': '☸️  Helm',
    'npm': '📦 npm',
    'make': '⚙️  Makefile',
    'script': '📜 自定义脚本',
    'github-pages': '📄 GitHub Pages',
    'vercel': '▲ Vercel',
    'netlify': '🌐 Netlify',
    'aws': '☁️  AWS',
    'gcp': '☁️  Google Cloud',
    'azure': '☁️  Azure',
    'heroku': '☁️  Heroku',
    'unknown': '❓ 未知'
  };
  return labels[method] ?? method;
}

export function formatDeployCommand(option: DeployOption): string {
  if (option.command) return option.command;
  const placeholders: Partial<Record<DeployMethod, string>> = {
    'docker': 'docker build -t <image> . && docker run <image>',
    'docker-compose': 'docker-compose up -d',
    'kubernetes': 'kubectl apply -f k8s/',
    'helm': 'helm install <release> helm/',
    'npm': 'npm run deploy',
    'make': 'make deploy',
    'script': './deploy.sh',
  };
  return placeholders[option.method] ?? '<待配置>';
}

export function generateDeployCommands(
  info: EnvironmentInfo,
  method?: DeployMethod,
  dryRun?: boolean
): Array<{ method: DeployMethod; command: string; configFile?: string; description?: string; dryRun: boolean }> {
  const options = method ? info.deployOptions.filter(o => o.method === method) : info.deployOptions;
  return options.map(o => ({
    method: o.method,
    command: formatDeployCommand(o),
    configFile: o.configFile,
    description: o.description,
    dryRun: dryRun ?? false
  }));
}

export function selectDeployOption(options: DeployOption[], method?: DeployMethod): DeployOption | undefined {
  if (options.length === 0) return undefined;
  if (method) return options.find(o => o.method === method);
  return options.find(o => o.recommended) ?? options[0];
}

function displayHints(): void {
  console.log(chalk.gray('━'.repeat(42)));
  console.log(chalk.gray('💡 提示:'));
  console.log(chalk.gray('   --run "<command>"      执行部署命令'));
  console.log(chalk.gray('   --dry-run "<command>"  预览命令'));
  console.log(chalk.gray('   --json                 输出原始数据供 /om:deploy 分析'));
  console.log(chalk.gray('   --show-dev             显示开发命令'));
  console.log();
}

function formatProjectType(type: ProjectType): string {
  const labels: Partial<Record<ProjectType, string>> = {
    openmatrix: '🤖 OpenMatrix', 'ai-project': '🧠 AI 项目',
    nodejs: '📦 Node.js', typescript: '📘 TypeScript',
    python: '🐍 Python', go: '🔷 Go', rust: '🦀 Rust',
    java: '☕ Java', csharp: '💜 C#', cpp: '⚙️  C/C++',
    php: '🐘 PHP', dart: '🎯 Dart',
  };
  return labels[type] ?? type;
}
