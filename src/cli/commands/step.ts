// src/cli/commands/step.ts
// 循环状态持久化 - 防止上下文压缩导致循环丢失
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import { Scheduler } from '../../orchestrator/scheduler.js';
import { AgentRunner } from '../../agents/agent-runner.js';
import { ApprovalManager } from '../../orchestrator/approval-manager.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export const stepCommand = new Command('step')
  .description('获取下一个待执行任务（自动转换状态并准备 Subagent 配置）')
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

    // 使用 Scheduler 获取下一个可执行任务（处理依赖、并发等）
    const scheduler = new Scheduler(stateManager, {
      maxConcurrentTasks: state.config.maxConcurrentAgents || 3
    });

    const nextTask = await scheduler.getNextTask();

    if (!nextTask) {
      // 所有任务都完成了或被阻塞 — 刷新统计后返回
      const stats = await refreshStatistics(stateManager);

      const allDone = stats.completed + stats.failed === stats.totalTasks;
      await stateManager.updateState({
        statistics: stats,
        status: allDone ? 'completed' : 'running',
        currentPhase: allDone ? 'completed' : 'execution'
      });

      console.log(JSON.stringify({
        status: allDone ? 'done' : 'blocked',
        statistics: stats,
        message: allDone
          ? `所有任务已完成 (${stats.completed}/${stats.totalTasks})`
          : `没有可执行任务 (${stats.completed}/${stats.totalTasks} 完成, ${stats.failed} 失败, ${stats.pending} 等待)`
      }));
      return;
    }

    // 转换任务状态为 in_progress（通过 Scheduler）
    await scheduler.markTaskStarted(nextTask.id);

    // 准备 Subagent 任务配置（包含完整的 prompt）
    const approvalManager = new ApprovalManager(stateManager);
    const agentRunner = new AgentRunner(stateManager, approvalManager, {
      maxConcurrent: state.config.maxConcurrentAgents || 3,
      taskTimeout: state.config.timeout * 1000 || 120000
    });

    const subagentTask = await agentRunner.prepareSubagentTask(nextTask);

    // 重新读取统计信息
    const stats = await refreshStatistics(stateManager);

    const result = {
      status: 'next',
      task: {
        id: nextTask.id,
        title: nextTask.title,
        description: nextTask.description,
        status: 'in_progress',
        assignedAgent: nextTask.assignedAgent,
        dependencies: nextTask.dependencies,
        acceptanceCriteria: nextTask.acceptanceCriteria
      },
      // 完整的 Subagent 配置（可直接用于 Agent 工具调用）
      subagent: {
        subagent_type: subagentTask.subagent_type,
        description: subagentTask.description,
        prompt: subagentTask.prompt,
        isolation: subagentTask.isolation,
        timeout: subagentTask.timeout
      },
      statistics: {
        total: stats.totalTasks,
        completed: stats.completed,
        remaining: stats.pending + stats.inProgress + stats.scheduled + stats.verify + stats.accept,
        failed: stats.failed
      }
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`📌 下一个任务: ${nextTask.id} - ${nextTask.title}`);
      console.log(`   状态已转换为 in_progress`);
      console.log(`   Agent 类型: ${nextTask.assignedAgent}`);
      console.log(`   进度: ${stats.completed}/${stats.totalTasks} 完成, ${result.statistics.remaining} 剩余`);
    }
  });

/**
 * 从当前任务状态重新计算统计信息（保证准确性）
 */
async function refreshStatistics(stateManager: StateManager) {
  const tasks = await stateManager.listTasks();
  const stats = {
    totalTasks: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    scheduled: tasks.filter(t => t.status === 'scheduled').length,
    blocked: tasks.filter(t => t.status === 'blocked').length,
    waiting: tasks.filter(t => t.status === 'waiting').length,
    verify: tasks.filter(t => t.status === 'verify').length,
    accept: tasks.filter(t => t.status === 'accept').length,
    retry_queue: tasks.filter(t => t.status === 'retry_queue').length
  };

  await stateManager.updateState({ statistics: stats });
  return stats;
}
