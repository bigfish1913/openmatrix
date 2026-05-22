// src/cli/commands/retry.ts
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import chalk from 'chalk';
import type { TaskStatus } from '../../types/index.js';
import * as path from 'path';

export const retryCommand = new Command('retry')
  .description('重试失败的任务')
  .argument('[taskId]', '任务ID (如 TASK-001)')
  .option('--all', '重试所有失败任务', false)
  .option('--reset', '重置重试计数', false)
  .option('--json', '输出 JSON 格式')
  .action(async (taskId: string | undefined, options) => {
    const basePath = process.cwd();
    const omPath = path.join(basePath, '.openmatrix');

    const stateManager = new StateManager(omPath);
    await stateManager.initialize();

    const state = await stateManager.getState();

    // 获取失败任务列表
    const allTasks = await stateManager.listTasks();
    const failedTasks = allTasks.filter(t => t.status === 'failed');

    if (failedTasks.length === 0) {
      if (options.json) {
        console.log(JSON.stringify({ status: 'no_failed_tasks', message: '没有失败任务' }));
      } else {
        console.log(chalk.green('✅ 没有失败任务需要重试'));
      }
      return;
    }

    // 如果指定了 taskId
    if (taskId) {
      const task = failedTasks.find(t => t.id === taskId);
      if (!task) {
        if (options.json) {
          console.log(JSON.stringify({ status: 'error', message: `任务 ${taskId} 不是失败状态` }));
        } else {
          console.log(chalk.red(`❌ 任务 ${taskId} 不是失败状态`));
        }
        return;
      }

      await retryTask(stateManager, task, options.reset);

      if (options.json) {
        console.log(JSON.stringify({ status: 'success', taskId, reset: options.reset }));
      } else {
        console.log(chalk.green(`✅ 任务 ${taskId} 已加入重试队列`));
      }
      return;
    }

    // 如果 --all
    if (options.all) {
      for (const task of failedTasks) {
        await retryTask(stateManager, task, options.reset);
      }

      if (options.json) {
        console.log(JSON.stringify({
          status: 'success',
          retriedCount: failedTasks.length,
          tasks: failedTasks.map(t => t.id)
        }));
      } else {
        console.log(chalk.green(`✅ 已重试 ${failedTasks.length} 个失败任务`));
      }
      return;
    }

    // 没有参数，显示失败任务列表
    if (options.json) {
      console.log(JSON.stringify({
        status: 'failed_tasks',
        tasks: failedTasks.map(t => ({
          id: t.id,
          title: t.title,
          error: t.error,
          retryCount: t.retryCount
        }))
      }));
    } else {
      console.log(chalk.bold.red('\n❌ 失败任务列表\n'));
      for (let i = 0; i < failedTasks.length; i++) {
        const task = failedTasks[i];
        const retryInfo = `重试次数: ${task.retryCount}/${state.config.maxRetries || 3}`;
        console.log(`[${i + 1}] ${chalk.yellow(task.id)}: ${task.title}`);
        console.log(`    失败原因: ${task.error || '未知'}`);
        console.log(`    ${retryInfo}`);
        console.log();
      }
      console.log(chalk.gray('提示: 使用 retry <taskId> 重试指定任务'));
      console.log(chalk.gray('提示: 使用 retry --all 重试所有失败任务'));
      console.log(chalk.gray('提示: 使用 retry --reset 重试并重置计数'));
    }
  });

/**
 * 重试单个任务
 */
async function retryTask(
  stateManager: StateManager,
  task: { id: string; retryCount: number },
  reset: boolean
): Promise<void> {
  const updates: { status: TaskStatus; retryCount?: number } = {
    status: 'pending' as TaskStatus
  };

  if (reset) {
    updates.retryCount = 0;
  }

  await stateManager.updateTask(task.id, updates);

  // 更新全局统计
  const state = await stateManager.getState();
  await stateManager.updateState({
    statistics: {
      ...state.statistics,
      failed: state.statistics.failed - 1,
      pending: state.statistics.pending + 1
    }
  });
}
