import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import { ProgressReporter } from '../../utils/progress-reporter.js';
import chalk from 'chalk';
import * as chokidar from 'chokidar';
import * as readline from 'readline';
import * as path from 'path';

export const statusCommand = new Command('status')
  .description('显示当前执行状态')
  .option('--json', '输出 JSON 格式')
  .option('--graph', '显示依赖关系图')
  .option('--detailed', '显示详细任务信息')
  .option('--watch', '实时监控状态变化')
  .action(async (options) => {
    const basePath = process.cwd();
    const omPath = path.join(basePath, '.openmatrix');
    const manager = new StateManager(omPath);
    const reporter = new ProgressReporter({ width: 30 });

    if (options.watch) {
      await runWatchMode(manager, reporter, options);
    } else {
      await showStatus(manager, reporter, options);
    }
  });

interface StatusOptions {
  json?: boolean;
  graph?: boolean;
  detailed?: boolean;
  watch?: boolean;
}

/**
 * 显示当前状态
 */
async function showStatus(
  manager: StateManager,
  reporter: ProgressReporter,
  options: StatusOptions
): Promise<void> {
  try {
    await manager.initialize();
    const state = await manager.getState();
    const tasks = await manager.listTasks();

    if (options.json) {
      // 添加文件状态字段
      const hasPlan = await manager.hasPlan();
      const hasTasksInput = await manager.hasTasksInput();
      const hasResearchContext = await manager.hasResearchContext();

      console.log(JSON.stringify({
        state,
        tasks,
        files: {
          hasPlan,
          hasTasksInput,
          hasResearchContext
        }
      }, null, 2));
      return;
    }

    // Header
    console.log(chalk.bold('\n📊 OpenMatrix 状态'));
    console.log('━'.repeat(42));
    console.log(`\n  Run ID: ${chalk.cyan(state.runId)}`);
    console.log(`  状态: ${formatStatus(state.status)}`);
    console.log(`  阶段:  ${chalk.yellow(state.currentPhase)}`);
    console.log(`  开始时间: ${state.startedAt}\n`);

    // Progress visualization
    if (state.statistics.totalTasks > 0) {
      console.log(reporter.renderStatistics({
        total: state.statistics.totalTasks,
        completed: state.statistics.completed,
        inProgress: state.statistics.inProgress,
        pending: state.statistics.pending,
        failed: state.statistics.failed
      }));
    }

    // Dependency graph
    if (options.graph && tasks.length > 0) {
      console.log('\n📊 任务依赖关系图');
      console.log('━'.repeat(42));
      console.log(reporter.renderDependencyGraph(tasks));
      console.log();
    }

    // Detailed task list
    if (options.detailed && tasks.length > 0) {
      console.log('\n📋 任务详情');
      console.log('━'.repeat(42));
      for (const task of tasks) {
        console.log(reporter.renderTaskCard(task));
        console.log();
      }
    } else if (tasks.length > 0) {
      // Simple task list
      console.log(chalk.bold('\n📋 任务列表'));
      for (const task of tasks) {
        const icon = reporter.getStatusIcon(task.status);
        console.log(`  ${icon} ${task.id}: ${task.title}`);
      }
      console.log();
    }

    // Quick tips
    console.log(chalk.gray('💡 提示:'));
    console.log(chalk.gray('   --watch    实时状态更新'));
    console.log(chalk.gray('   --graph    显示依赖关系图'));
    console.log(chalk.gray('   --detailed 显示详细任务信息'));
    console.log(chalk.gray('   --json     输出 JSON 格式'));
    console.log();
  } catch (error) {
    console.error(chalk.red('错误:'), error);
  }
}

/**
 * Watch 模式 - 实时更新状态
 */
async function runWatchMode(
  manager: StateManager,
  reporter: ProgressReporter,
  options: StatusOptions
): Promise<void> {
  await manager.initialize();

  // 清屏函数
  const clearScreen = () => {
    console.clear();
  };

  // 渲染状态
  const renderStatus = async () => {
    clearScreen();
    console.log(chalk.bold.cyan('📊 OpenMatrix 实时监控'));
    console.log(chalk.gray('━'.repeat(42)));
    console.log(chalk.gray('按 Ctrl+C 退出\n'));

    try {
      const state = await manager.getState();
      const tasks = await manager.listTasks();

      // 状态概览
      console.log(`Run ID: ${chalk.cyan(state.runId)}`);
      console.log(`状态: ${formatStatus(state.status)}`);
      console.log(`阶段:  ${chalk.yellow(state.currentPhase)}`);
      console.log(`更新时间: ${chalk.gray(new Date().toLocaleTimeString())}\n`);

      // 进度条
      if (state.statistics.totalTasks > 0) {
        console.log(reporter.renderProgressBar(
          state.statistics.completed,
          state.statistics.totalTasks,
          '总体进度'
        ));
      }

      // 任务列表 (带动画图标)
      if (tasks.length > 0) {
        console.log(chalk.bold('\n📋 任务列表:'));
        for (const task of tasks) {
          const icon = reporter.getStatusIcon(task.status);
          const statusColor = getStatusColor(task.status);
          console.log(`  ${icon} ${statusColor(task.id)}: ${task.title}`);
        }
      }

      // 底部提示
      console.log(chalk.gray('\n━'.repeat(42)));
      console.log(chalk.gray('正在监听状态变化...'));
    } catch (error) {
      console.error(chalk.red('错误:'), error);
    }
  };

  // 初始渲染
  await renderStatus();

  // 监听文件变化
  const watcher = chokidar.watch('.openmatrix', {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true
  });

  watcher.on('all', async (event, path) => {
    await renderStatus();
  });

  // 处理退出
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on('close', () => {
    watcher.close();
    console.log(chalk.gray('\n👋 监控模式已结束'));
    process.exit(0);
  });

  // 保持进程运行
  await new Promise(() => {});
}

/**
 * 格式化状态显示
 */
export function formatStatus(status: string): string {
  const colorMap: Record<string, (text: string) => string> = {
    initialized: chalk.gray,
    running: chalk.green,
    paused: chalk.yellow,
    completed: chalk.green,
    failed: chalk.red
  };
  const colorFn = colorMap[status] || chalk.white;
  return colorFn(status);
}

/**
 * 获取状态颜色函数
 */
export function getStatusColor(status: string): (text: string) => string {
  const colorMap: Record<string, (text: string) => string> = {
    completed: chalk.green,
    in_progress: chalk.blue,
    failed: chalk.red,
    blocked: chalk.red,
    pending: chalk.gray,
    verify: chalk.yellow,
    accept: chalk.cyan
  };
  return colorMap[status] || chalk.white;
}
