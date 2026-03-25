// src/cli/commands/report.ts
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export const reportCommand = new Command('report')
  .description('生成任务执行报告')
  .option('-f, --format <format>', '输出格式 (markdown/json)', 'markdown')
  .option('-o, --output <path>', '输出文件路径')
  .action(async (options) => {
    const basePath = process.cwd();
    const omPath = `${basePath}/.openmatrix`;

    const stateManager = new StateManager(omPath);
    await stateManager.initialize();

    const state = await stateManager.getState();
    const tasks = await stateManager.listTasks();
    const approvals = await stateManager.getAllApprovals();

    // 统计数据
    const stats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      blocked: tasks.filter(t => t.status === 'blocked').length
    };

    // 计算总耗时
    const totalDuration = tasks
      .filter(t => t.phases?.accept?.duration)
      .reduce((sum: number, t) => sum + (t.phases?.accept?.duration || 0), 0);

    // 生成报告
    let report: string;

    if (options.format === 'json') {
      report = JSON.stringify({
        runId: state.runId,
        status: state.status,
        startedAt: state.startedAt,
        statistics: stats,
        totalDuration,
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          duration: t.phases?.accept?.duration || 0,
          error: t.error
        })),
        approvals: approvals.map(a => ({
          id: a.id,
          type: a.type,
          status: a.status,
          decision: a.decision
        }))
      }, null, 2);

    } else {
      report = generateMarkdownReport(state, tasks, approvals, stats, totalDuration);
    }

    // 输出
    if (options.output) {
      const outputPath = path.resolve(basePath, options.output);
      await fs.writeFile(outputPath, report, 'utf-8');
      console.log(`\n📄 报告已保存: ${outputPath}`);
    } else {
      console.log('\n' + report);
    }
  });

function generateMarkdownReport(
  state: any,
  tasks: any[],
  approvals: any[],
  stats: any,
  totalDuration: number
): string {
  const duration = Math.round(totalDuration / 1000 / 60); // 转为分钟

  return `
📊 OpenMatrix 执行报告
=====================

🆔 Run ID: ${state.runId}
📅 时间: ${state.startedAt}
⏱️ 总耗时: ${duration} 分钟
📈 状态: ${state.status}

## 📊 任务统计

| 状态 | 数量 | 占比 |
|------|------|------|
| ✅ 完成 | ${stats.completed} | ${stats.total > 0 ? Math.round(stats.completed / stats.total * 100) : 0}% |
| ❌ 失败 | ${stats.failed} | ${stats.total > 0 ? Math.round(stats.failed / stats.total * 100) : 0}% |
| 🔄 进行中 | ${stats.inProgress} | ${stats.total > 0 ? Math.round(stats.inProgress / stats.total * 100) : 0}% |
| 🔴 阻塞 | ${stats.blocked} | ${stats.total > 0 ? Math.round(stats.blocked / stats.total * 100) : 0}% |
| ⏳ 待处理 | ${stats.pending} | ${stats.total > 0 ? Math.round(stats.pending / stats.total * 100) : 0}% |

## 📋 任务详情

### ✅ 已完成
${tasks
  .filter(t => t.status === 'completed')
  .map(t => `- ${t.id}: ${t.title}`)
  .join('\n') || '_无_'}

### ❌ 失败
${tasks
  .filter(t => t.status === 'failed')
  .map(t => `- ${t.id}: ${t.title}\n  原因: ${t.error || '未知'}`)
  .join('\n') || '_无_'}

### 🔴 阻塞
${tasks
  .filter(t => t.status === 'blocked')
  .map(t => `- ${t.id}: ${t.title}\n  原因: ${t.error || '未知'}`)
  .join('\n') || '_无_'}

## 🔔 审批记录

| ID | 类型 | 决策 | 状态 |
|----|------|------|------|
${approvals.length > 0
  ? approvals.map(a => `| ${a.id} | ${a.type} | ${a.decision || '-'} | ${a.status} |`).join('\n')
  : '| _无_ | | | |'}

---
报告生成时间: ${new Date().toISOString()}
`.trim();
}
