// src/cli/commands/complete.ts
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import { GitCommitManager } from '../../orchestrator/git-commit-manager.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export const completeCommand = new Command('complete')
  .description('标记任务完成并更新全局统计')
  .argument('<taskId>', '任务ID (如 TASK-001)')
  .option('--success', '标记为成功完成 (默认)', true)
  .option('--failed', '标记为失败')
  .option('--output <text>', '执行结果摘要')
  .option('--summary <text>', 'Agent 执行摘要 (写入 context.md)')
  .option('--error <text>', '错误信息 (失败时)')
  .option('--json', '输出 JSON 格式')
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
      pending: allTasks.filter(t => t.status === 'pending').length,
      scheduled: allTasks.filter(t => t.status === 'scheduled').length,
      blocked: allTasks.filter(t => t.status === 'blocked').length,
      waiting: allTasks.filter(t => t.status === 'waiting').length,
      verify: allTasks.filter(t => t.status === 'verify').length,
      accept: allTasks.filter(t => t.status === 'accept').length,
      retry_queue: allTasks.filter(t => t.status === 'retry_queue').length
    };

    // 4. 更新全局状态
    const allDone = stats.completed + stats.failed === stats.totalTasks;
    await stateManager.updateState({
      statistics: stats,
      status: allDone ? 'completed' : 'running',
      currentPhase: allDone ? 'completed' : 'execution',
      ...(allDone ? { completedAt: now } : {})
    });

    // 5. 追加写入全局 context.md (Agent Memory)
    if (isSuccess) {
      const contextFile = path.join(omPath, 'context.md');
      const timestamp = new Date().toISOString();

      // 构建上下文内容
      const summary = options.summary || '任务已完成';
      const contextEntry = `## ${taskId} ${task.title}
- 时间: ${timestamp}
- 摘要: ${summary}

`;

      try {
        // 追加写入全局 context.md
        let existingContent = '';
        try {
          existingContent = await fs.readFile(contextFile, 'utf-8');
        } catch {
          // 文件不存在，创建新文件
        }
        await fs.writeFile(contextFile, existingContent + contextEntry, 'utf-8');
      } catch {
        // 忽略写入错误
      }
    }

    // 6. Git 自动提交
    if (isSuccess) {
      const state = await stateManager.getState();
      const gitManager = new GitCommitManager(basePath);

      try {
        const commitResult = await gitManager.commit({
          taskId,
          taskTitle: task.title,
          runId: state.runId,
          phase: 'develop',
          changes: [],
          impactScope: []
        });

        if (commitResult.success) {
          console.error(`✅ Git 提交成功: ${commitResult.commitHash}`);
        } else {
          const reason = commitResult.message || commitResult.error || 'Unknown reason';
          console.error(`⚠️ Git 提交跳过: ${reason}`);
        }
      } catch (error) {
        console.error(`⚠️ Git 提交失败: ${error}`);
      }
    }

    // 6. 输出结果
    const result = {
      taskId,
      status: isSuccess ? 'completed' : 'failed',
      statistics: stats,
      allDone,
      message: isSuccess
        ? `${taskId} 完成 (${stats.completed}/${stats.totalTasks})`
        : `${taskId} 失败: ${options.error || 'Unknown error'}`
    };

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`✅ ${result.message}`);
      if (allDone) {
        console.log('🎉 所有任务已完成!');
      }
    }
  });
