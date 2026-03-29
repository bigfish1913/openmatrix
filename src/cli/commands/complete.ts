// src/cli/commands/complete.ts
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export const completeCommand = new Command('complete')
  .description('标记任务完成并更新全局统计')
  .argument('<taskId>', '任务ID (如 TASK-001)')
  .option('--success', '标记为成功完成 (默认)', true)
  .option('--failed', '标记为失败')
  .option('--output <text>', '执行结果摘要')
  .option('--error <text>', '错误信息 (失败时)')
  .action(async (taskId: string, options) => {
    const basePath = process.cwd();
    const omPath = path.join(basePath, '.openmatrix');

    const stateManager = new StateManager(omPath);
    await stateManager.initialize();

    // 1. 读取任务
    const task = await stateManager.getTask(taskId);
    if (!task) {
      console.log(JSON.stringify({ error: `任务 ${taskId} 不存在` }));
      process.exit(1);
    }

    const isSuccess = !options.failed;
    const now = new Date().toISOString();

    if (isSuccess) {
      // 2a. 标记任务完成 - 更新所有阶段
      await stateManager.updateTask(taskId, {
        status: 'completed',
        phases: {
          develop: { status: 'completed', duration: 0, completedAt: now },
          verify: { status: 'completed', duration: 0, completedAt: now },
          accept: { status: 'completed', duration: 0, completedAt: now }
        }
      });
    } else {
      // 2b. 标记任务失败
      await stateManager.updateTask(taskId, {
        status: 'failed',
        error: options.error || 'Task failed'
      });
    }

    // 3. 重新计算全局统计（从实际任务文件统计，避免累积误差）
    const allTasks = await stateManager.listTasks();
    const stats = {
      totalTasks: allTasks.length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      inProgress: allTasks.filter(t => t.status === 'in_progress').length,
      failed: allTasks.filter(t => t.status === 'failed').length,
      pending: allTasks.filter(t => t.status === 'pending' || t.status === 'scheduled').length
    };

    // 4. 更新全局状态
    const allDone = stats.completed + stats.failed === stats.totalTasks;
    await stateManager.updateState({
      statistics: stats,
      status: allDone ? 'completed' : 'running',
      currentPhase: allDone ? 'completed' : 'execution',
      ...(allDone ? { completedAt: now } : {})
    });

    // 5. 输出结果
    const result = {
      taskId,
      status: isSuccess ? 'completed' : 'failed',
      statistics: stats,
      allDone,
      message: isSuccess
        ? `${taskId} 完成 (${stats.completed}/${stats.totalTasks})`
        : `${taskId} 失败: ${options.error || 'Unknown error'}`
    };

    console.log(JSON.stringify(result, null, 2));
  });
