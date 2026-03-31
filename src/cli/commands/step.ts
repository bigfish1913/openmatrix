// src/cli/commands/step.ts
// 循环状态持久化 - 防止上下文压缩导致循环丢失
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export const stepCommand = new Command('step')
  .description('获取下一个待执行任务（持久化循环状态）')
  .option('--json', '输出 JSON 格式')
  .action(async (options) => {
    const basePath = process.cwd();
    const omPath = path.join(basePath, '.openmatrix');

    const stateManager = new StateManager(omPath);
    await stateManager.initialize();

    const state = await stateManager.getState();

    // 检查是否已完成
    if (state.status === 'completed') {
      console.log(JSON.stringify({ status: 'done', message: '所有任务已完成' }));
      return;
    }

    // 获取所有任务
    const allTasks = await stateManager.listTasks();
    const nextTask = allTasks.find(t =>
      t.status === 'pending' ||
      t.status === 'scheduled' ||
      t.status === 'in_progress'
    );

    if (!nextTask) {
      // 所有任务都完成了或被阻塞
      const completed = allTasks.filter(t => t.status === 'completed').length;
      const total = allTasks.length;

      // 自动更新统计
      const stats = {
        totalTasks: total,
        completed: completed,
        inProgress: allTasks.filter(t => t.status === 'in_progress').length,
        failed: allTasks.filter(t => t.status === 'failed').length,
        pending: allTasks.filter(t => t.status === 'pending').length,
        scheduled: allTasks.filter(t => t.status === 'scheduled').length,
        blocked: allTasks.filter(t => t.status === 'blocked').length,
        waiting: allTasks.filter(t => t.status === 'waiting').length,
        verify: allTasks.filter(t => t.status === 'verify').length,
        accept: allTasks.filter(t => t.status === 'accept').length,
        retry_queue: allTasks.filter(t => t.status === 'retry_queue').length
      };

      const allDone = completed + stats.failed === total;
      await stateManager.updateState({
        statistics: stats,
        status: allDone ? 'completed' : 'running',
        currentPhase: allDone ? 'completed' : 'execution'
      });

      console.log(JSON.stringify({
        status: allDone ? 'done' : 'blocked',
        statistics: stats,
        message: allDone
          ? `所有任务已完成 (${completed}/${total})`
          : `没有可执行任务 (${completed}/${total} 完成, ${stats.failed} 失败, ${stats.pending} 等待)`
      }));
      return;
    }

    // 输出下一个任务信息
    const result = {
      status: 'next',
      task: {
        id: nextTask.id,
        title: nextTask.title,
        description: nextTask.description,
        status: nextTask.status,
        assignedAgent: nextTask.assignedAgent,
        dependencies: nextTask.dependencies,
        acceptanceCriteria: nextTask.acceptanceCriteria
      },
      statistics: {
        total: allTasks.length,
        completed: allTasks.filter(t => t.status === 'completed').length,
        remaining: allTasks.filter(t =>
          t.status === 'pending' ||
          t.status === 'scheduled' ||
          t.status === 'in_progress'
        ).length,
        failed: allTasks.filter(t => t.status === 'failed').length
      }
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`📌 下一个任务: ${nextTask.id} - ${nextTask.title}`);
      console.log(`   进度: ${result.statistics.completed}/${result.statistics.total} 完成, ${result.statistics.remaining} 剩余`);
    }
  });
