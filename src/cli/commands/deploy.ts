// src/cli/commands/deploy.ts
import { Command } from 'commander';
import { EnvironmentDetector } from '../../orchestrator/environment-detector.js';
import * as readline from 'readline';
import chalk from 'chalk';
import type {
  EnvironmentInfo,
  DeployOption,
  DeployMethod,
  DevCommands,
  BuildTool,
  ProjectType
} from '../../types/index.js';

export const deployCommand = new Command('deploy')
  .description('智能部署助手：检测环境 → 推荐部署方式 → 生成一键脚本')
  .argument('[env-type]', '部署环境类型 (local, test, prod)', undefined)
  .option('--json', '输出 JSON 格式 (供 Skill 解析)')
  .option('--interactive', '交互式选择部署方式', false)
  .option('--auto', '自动执行推荐的部署命令', false)
  .option('--deploy-method <method>', '指定部署方式 (docker, docker-compose, kubernetes, helm, npm, make, taskfile)', undefined)
  .option('--env-type <type>', '指定环境类型 (local, test, prod)', undefined)
  .option('--generate-script <tool>', '生成一键部署脚本 (taskfile, make, npm)', undefined)
  .option('--dry-run', '仅生成命令不执行', false)
  .option('--show-dev', '显示开发环境命令', false)
  .option('--recommend', '显示 AI 推荐的部署方案', false)
  .action(async (envType: string | undefined, options) => {
    const projectRoot = process.cwd();

    if (!options.json) {
      console.log(chalk.bold.cyan('\n🚀 OpenMatrix 部署检测器'));
      console.log('━'.repeat(42));
      console.log(`📁 项目路径: ${projectRoot}`);
      console.log('\n⏳ 正在分析项目环境...\n');
    }

    try {
      // 创建检测器并执行检测
      const detector = new EnvironmentDetector(projectRoot);
      const envInfo = await detector.detect();

      // JSON 输出模式
      if (options.json) {
        const output = formatJsonOutput(envInfo, options);
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      // 显示环境信息
      displayEnvironmentInfo(envInfo);

      // 显示部署选项
      displayDeployOptions(envInfo.deployOptions);

      // 显示开发命令（可选）
      if (options.showDev) {
        displayDevCommands(envInfo.devCommands);
      }

      // 处理部署方式选择
      if (envInfo.deployOptions.length === 0) {
        console.log(chalk.yellow('\n⚠️ 未检测到可用的部署选项。'));
        console.log(chalk.gray('   建议添加 Dockerfile 或部署脚本。'));
        return;
      }

      // dry-run 模式：仅显示命令
      if (options.dryRun) {
        const commands = generateDeployCommands(envInfo, options.deployMethod, true);
        console.log(chalk.bold.cyan('\n📋 部署命令预览 (dry-run)'));
        console.log('━'.repeat(42));
        for (const cmd of commands) {
          console.log(chalk.green(`\n  [${getDeployMethodLabel(cmd.method)}]`));
          console.log(chalk.white(`    ${cmd.command}`));
          if (cmd.dryRun) {
            console.log(chalk.gray('    (仅预览，不执行)'));
          }
        }
        return;
      }

      // 指定部署方式
      if (options.deployMethod) {
        const selected = selectDeployOption(envInfo.deployOptions, options.deployMethod as DeployMethod);
        if (!selected) {
          console.log(chalk.red(`\n❌ 未找到部署方式: ${options.deployMethod}`));
          console.log(chalk.gray('   可用的部署方式:'));
          envInfo.deployOptions.forEach(o => {
            console.log(chalk.gray(`     - ${o.method}`));
          });
          return;
        }

        if (options.auto) {
          await executeDeployCommand(selected);
        } else {
          displaySelectedOption(selected);
        }
        return;
      }

      // 交互式选择
      if (options.interactive) {
        const selected = await interactiveSelect(envInfo.deployOptions);
        if (selected) {
          await executeDeployCommand(selected);
        }
        return;
      }

      // 自动模式：执行推荐的部署方式
      if (options.auto) {
        const recommended = selectDeployOption(envInfo.deployOptions);
        if (recommended) {
          await executeDeployCommand(recommended);
        }
        return;
      }

      // 默认：显示提示
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
 * 格式化 JSON 输出
 */
function formatJsonOutput(envInfo: EnvironmentInfo, options: Record<string, unknown>): Record<string, unknown> {
  const deployCommands = generateDeployCommands(envInfo, options.deployMethod as DeployMethod | undefined, options.dryRun as boolean);

  // 生成 AI 推荐信息
  const recommendations = generateRecommendations(envInfo);

  return {
    action: 'deploy_info',
    projectName: envInfo.projectName,
    projectType: envInfo.projectType,
    projectRoot: envInfo.projectRoot,
    timestamp: envInfo.timestamp,
    summary: envInfo.summary,
    recommendations,
    deployCommands,
    devCommands: options.showDev ? envInfo.devCommands : undefined,
    deployOptions: envInfo.deployOptions.map(o => ({
      method: o.method,
      command: o.command,
      configFile: o.configFile,
      recommended: o.recommended,
      description: o.description
    })),
    envType: options.envType || undefined,
    generateScript: options.generateScript || undefined
  };
}

/**
 * 生成 AI 推荐信息
 */
function generateRecommendations(envInfo: EnvironmentInfo): {
  envType: { recommended: 'local' | 'test' | 'prod'; reason: string };
  deployMethod: { recommended: DeployMethod; reason: string };
  scriptTool: { recommended: 'taskfile' | 'make' | 'npm'; reason: string };
} {
  const hasDockerfile = envInfo.deployOptions.some(o => o.method === 'docker' || o.method === 'docker-compose');
  const hasMakefile = envInfo.deployOptions.some(o => o.method === 'make');
  const hasCIConfig = envInfo.summary.hasCIConfig;
  const buildToolCount = envInfo.summary.buildToolCount;

  // 环境类型推荐
  let envTypeRecommend: 'local' | 'test' | 'prod' = 'local';
  let envTypeReason = '无特殊配置，本地开发最简单';

  if (hasDockerfile && !hasCIConfig) {
    envTypeRecommend = 'local';
    envTypeReason = '检测到 Dockerfile，适合容器化本地开发';
  } else if (hasCIConfig) {
    envTypeRecommend = 'test';
    envTypeReason = '有 CI 配置，适合自动化测试部署';
  } else if (hasDockerfile && hasCIConfig) {
    envTypeRecommend = 'prod';
    envTypeReason = '有完整的生产配置（容器+CI），可部署生产';
  }

  // 部署工具推荐
  let deployMethodRecommend: DeployMethod = 'docker';
  let deployMethodReason = '容器化是最佳实践';

  if (hasDockerfile) {
    deployMethodRecommend = 'docker';
    deployMethodReason = '已检测到 Dockerfile，直接使用容器部署';
  } else if (envInfo.deployOptions.some(o => o.method === 'docker-compose')) {
    deployMethodRecommend = 'docker-compose';
    deployMethodReason = '检测到 docker-compose.yml，多服务编排';
  } else if (envInfo.deployOptions.some(o => o.method === 'kubernetes')) {
    deployMethodRecommend = 'kubernetes';
    deployMethodReason = '检测到 k8s 配置，生产级部署';
  } else if (hasMakefile) {
    deployMethodRecommend = 'make';
    deployMethodReason = '检测到 Makefile，使用 make deploy';
  } else if (buildToolCount > 0) {
    deployMethodRecommend = 'npm';
    deployMethodReason = '使用 package.json scripts 部署';
  }

  // 脚本工具推荐
  let scriptToolRecommend: 'taskfile' | 'make' | 'npm' = 'taskfile';
  let scriptToolReason = 'Taskfile 是现代化任务工具，跨平台支持好';

  if (hasMakefile) {
    scriptToolRecommend = 'make';
    scriptToolReason = '已有 Makefile，保持一致性';
  } else if (envInfo.projectType === 'typescript' || envInfo.projectType === 'nodejs') {
    scriptToolRecommend = 'npm';
    scriptToolReason = 'Node.js 项目，无需额外依赖';
  } else if (envInfo.projectType === 'go' || envInfo.projectType === 'rust') {
    scriptToolRecommend = 'taskfile';
    scriptToolReason = 'Go/Rust 项目，Taskfile 更现代';
  }

  return {
    envType: { recommended: envTypeRecommend, reason: envTypeReason },
    deployMethod: { recommended: deployMethodRecommend, reason: deployMethodReason },
    scriptTool: { recommended: scriptToolRecommend, reason: scriptToolReason }
  };
}

/**
 * 显示环境信息
 */
export function displayEnvironmentInfo(info: EnvironmentInfo): void {
  console.log(chalk.bold(`📦 项目: ${info.projectName}`));
  console.log(`   类型: ${formatProjectType(info.projectType)}`);
  console.log(`   路径: ${info.projectRoot}`);
  console.log(`   检测时间: ${new Date(info.timestamp).toLocaleString()}\n`);

  console.log(chalk.bold('📊 环境摘要'));
  console.log('━'.repeat(42));
  console.log(`   构建工具: ${chalk.yellow(info.summary.buildToolCount)} 个`);
  console.log(`   部署选项: ${chalk.yellow(info.summary.deployOptionCount)} 个`);
  if (info.summary.hasCIConfig) {
    console.log(`   CI 配置: ${chalk.green('已配置')}`);
  } else {
    console.log(`   CI 配置: ${chalk.gray('未检测到')}`);
  }
  console.log();
}

/**
 * 显示部署选项
 */
export function displayDeployOptions(options: DeployOption[]): void {
  console.log(chalk.bold('🚀 部署选项'));
  console.log('━'.repeat(42));

  if (options.length === 0) {
    console.log(chalk.gray('   未检测到可用的部署选项\n'));
    return;
  }

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const recommended = opt.recommended ? chalk.green(' [推荐]') : '';
    const command = formatDeployCommand(opt);

    console.log(`\n  ${chalk.cyan(`[${i + 1}]`)} ${getDeployMethodLabel(opt.method)}${recommended}`);
    console.log(`      命令: ${chalk.white(command)}`);
    if (opt.configFile) {
      console.log(`      配置: ${chalk.gray(opt.configFile)}`);
    }
    if (opt.description) {
      console.log(`      说明: ${chalk.gray(opt.description)}`);
    }
  }
  console.log();
}

/**
 * 显示开发命令
 */
export function displayDevCommands(commands: DevCommands): void {
  console.log(chalk.bold('🔧 开发命令'));
  console.log('━'.repeat(42));

  const sections: Array<{ key: string; label: string; cmds: string[] | undefined }> = [
    { key: 'setup', label: '安装/设置', cmds: commands.setup },
    { key: 'build', label: '构建', cmds: commands.build },
    { key: 'test', label: '测试', cmds: commands.test },
    { key: 'dev', label: '开发/调试', cmds: commands.dev },
    { key: 'start', label: '启动', cmds: commands.start },
    { key: 'lint', label: 'Lint', cmds: commands.lint },
    { key: 'format', label: '格式化', cmds: commands.format },
    { key: 'clean', label: '清理', cmds: commands.clean },
  ];

  for (const section of sections) {
    if (section.cmds && section.cmds.length > 0) {
      console.log(`\n  ${chalk.yellow(section.label)}:`);
      for (const cmd of section.cmds) {
        console.log(`    ${chalk.white(cmd)}`);
      }
    }
  }
  console.log();
}

/**
 * 获取部署方式标签
 */
export function getDeployMethodLabel(method: DeployMethod): string {
  const labels: Record<DeployMethod, string> = {
    'docker': '🐳 Docker',
    'docker-compose': '🐳 Docker Compose',
    'kubernetes': '☸️ Kubernetes',
    'helm': '☸️ Helm',
    'npm': '📦 npm',
    'make': '⚙️ Makefile',
    'script': '📜 自定义脚本',
    'github-pages': '📄 GitHub Pages',
    'vercel': '▲ Vercel',
    'netlify': '🌐 Netlify',
    'aws': '☁️ AWS',
    'gcp': '☁️ Google Cloud',
    'azure': '☁️ Azure',
    'heroku': '☁️ Heroku',
    'unknown': '❓ 未知'
  };
  return labels[method];
}

/**
 * 格式化部署命令
 */
export function formatDeployCommand(option: DeployOption): string {
  if (option.command) {
    return option.command;
  }

  // 根据方法生成默认命令
  const placeholders: Partial<Record<DeployMethod, string>> = {
    'docker': 'docker build -t <image-name> . && docker run <image-name>',
    'docker-compose': 'docker-compose up -d',
    'kubernetes': 'kubectl apply -f k8s/',
    'helm': 'helm install <release-name> helm/',
    'npm': 'npm run deploy',
    'make': 'make deploy',
    'script': './deploy.sh',
  };

  return placeholders[option.method] || '<待配置>';
}

/**
 * 生成部署命令列表
 */
export function generateDeployCommands(
  info: EnvironmentInfo,
  method?: DeployMethod,
  dryRun?: boolean
): Array<{
  method: DeployMethod;
  command: string;
  configFile?: string;
  description?: string;
  dryRun: boolean;
}> {
  let options = info.deployOptions;

  // 按方法过滤
  if (method) {
    options = options.filter(o => o.method === method);
  }

  return options.map(o => ({
    method: o.method,
    command: formatDeployCommand(o),
    configFile: o.configFile,
    description: o.description,
    dryRun: dryRun ?? false
  }));
}

/**
 * 选择部署选项
 */
export function selectDeployOption(options: DeployOption[], method?: DeployMethod): DeployOption | undefined {
  if (options.length === 0) {
    return undefined;
  }

  // 按方法选择
  if (method) {
    return options.find(o => o.method === method);
  }

  // 选择推荐的
  const recommended = options.find(o => o.recommended);
  if (recommended) {
    return recommended;
  }

  // 返回第一个
  return options[0];
}

/**
 * 显示选中的选项
 */
function displaySelectedOption(option: DeployOption): void {
  console.log(chalk.bold.cyan('\n✅ 选中部署方式'));
  console.log('━'.repeat(42));
  console.log(`   方式: ${getDeployMethodLabel(option.method)}`);
  console.log(`   命令: ${chalk.white(formatDeployCommand(option))}`);
  if (option.configFile) {
    console.log(`   配置: ${chalk.gray(option.configFile)}`);
  }
  console.log(chalk.gray('\n   使用 --auto 执行部署命令'));
  console.log();
}

/**
 * 执行部署命令
 */
async function executeDeployCommand(option: DeployOption): Promise<void> {
  const command = formatDeployCommand(option);

  console.log(chalk.bold.cyan('\n🚀 执行部署'));
  console.log('━'.repeat(42));
  console.log(`   方式: ${getDeployMethodLabel(option.method)}`);
  console.log(`   命令: ${chalk.white(command)}\n`);

  // 输出 JSON 供 Skill 处理实际执行
  console.log(JSON.stringify({
    action: 'execute_deploy',
    method: option.method,
    command,
    configFile: option.configFile
  }, null, 2));
}

/**
 * 交互式选择
 */
async function interactiveSelect(options: DeployOption[]): Promise<DeployOption | undefined> {
  console.log(chalk.bold.cyan('\n🎯 交互式选择'));
  console.log('━'.repeat(42));
  console.log('选择部署方式 (输入序号):\n');

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const recommended = opt.recommended ? chalk.green(' [推荐]') : '';
    console.log(`  [${i + 1}] ${getDeployMethodLabel(opt.method)}${recommended}`);
  }

  console.log('\n输入序号 (1-' + options.length + '):');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('> ', (answer) => {
      rl.close();

      const index = parseInt(answer.trim()) - 1;
      if (index >= 0 && index < options.length) {
        resolve(options[index]);
      } else {
        console.log(chalk.red('无效选择'));
        resolve(undefined);
      }
    });
  });
}

/**
 * 显示操作提示
 */
function displayHints(): void {
  console.log(chalk.gray('━'.repeat(42)));
  console.log(chalk.gray('💡 提示:'));
  console.log(chalk.gray('   --deploy-method <method>  指定部署方式'));
  console.log(chalk.gray('   --dry-run                 仅显示命令不执行'));
  console.log(chalk.gray('   --interactive             交互式选择'));
  console.log(chalk.gray('   --auto                    自动执行推荐方式'));
  console.log(chalk.gray('   --show-dev                显示开发命令'));
  console.log(chalk.gray('   --json                    JSON 输出供 Skill 解析'));
  console.log();
}

/**
 * 格式化项目类型
 */
function formatProjectType(type: ProjectType): string {
  const labels: Partial<Record<ProjectType, string>> = {
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
    flutter: '📱 Flutter',
    react: '⚛️ React',
    vue: '💚 Vue',
    angular: '🅰️ Angular',
    nextjs: '▲ Next.js',
    nuxt: '💚 Nuxt.js',
    svelte: '🔥 Svelte',
    ruby: '💎 Ruby',
    swift: '🍎 Swift',
    kotlin: '🤖 Kotlin',
    scala: '🔴 Scala',
    unknown: '❓ 未知'
  };
  return labels[type] || type;
}