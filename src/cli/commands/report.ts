// src/cli/commands/report.ts
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import { ProgressReporter } from '../../utils/progress-reporter.js';
import type { GlobalState, Task, Approval } from '../../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export const reportCommand = new Command('report')
  .description('生成任务执行报告')
  .option('-f, --format <format>', '输出格式 (markdown/json/console)', 'console')
  .option('-o, --output <path>', '输出文件路径')
  .option('--efficiency', '包含效率分析')
  .option('--graph', '包含依赖图')
  .action(async (options) => {
    const basePath = process.cwd();
    const omPath = `${basePath}/.openmatrix`;

    const stateManager = new StateManager(omPath);
    await stateManager.initialize();

    const state = await stateManager.getState();
    const tasks = await stateManager.listTasks();
    const approvals = await stateManager.getAllApprovals();

    const reporter = new ProgressReporter({ width: 30 });

    // 统计数据
    const stats = {
      total: tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      blocked: tasks.filter(t => t.status === 'blocked').length
    };

    // 计算效率数据
    const efficiency = {
      totalDuration: tasks
        .filter(t => t.phases?.accept?.duration)
        .reduce((sum: number, t) => sum + (t.phases?.accept?.duration || 0), 0),
      agentCalls: tasks.length,
      retryCount: tasks.reduce((sum: number, t) => sum + t.retryCount, 0),
      parallelism: stats.inProgress > 0 ? Math.min(stats.inProgress, 4) : 1,
      targetParallelism: 4
    };

    // 生成报告
    let report: string;

    if (options.format === 'json') {
      report = JSON.stringify({
        runId: state.runId,
        status: state.status,
        startedAt: state.startedAt,
        statistics: stats,
        efficiency,
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

    } else if (options.format === 'console') {
      // 使用 ProgressReporter 生成控制台报告
      report = reporter.renderFullReport({
        tasks,
        statistics: {
          total: stats.total,
          completed: stats.completed,
          inProgress: stats.inProgress,
          pending: stats.pending,
          failed: stats.failed
        },
        efficiency
      });

      // 可选: 添加依赖图
      if (options.graph && tasks.length > 0) {
        report += '\n\n📊 任务依赖图\n';
        report += '━'.repeat(42) + '\n';
        report += reporter.renderDependencyGraph(tasks);
      }

    } else {
      // markdown 格式
      report = generateMarkdownReport(state, tasks, approvals, stats, efficiency, options);
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

export interface TaskStats {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  pending: number;
  blocked: number;
}

export interface EfficiencyData {
  totalDuration: number;
  agentCalls: number;
  retryCount: number;
  parallelism: number;
  targetParallelism: number;
}

export interface ReportOptions {
  format: string;
  output?: string;
  efficiency?: boolean;
  graph?: boolean;
}

export function generateMarkdownReport(
  state: GlobalState,
  tasks: Task[],
  approvals: Approval[],
  stats: TaskStats,
  efficiency: EfficiencyData,
  options: ReportOptions
): string {
  const duration = Math.round(efficiency.totalDuration / 1000 / 60); // 转为分钟

  let report = `
# 📊 OpenMatrix 执行报告

**Run ID:** ${state.runId}
**时间:** ${state.startedAt}
**状态:** ${state.status}

## 统计概览

| 状态 | 数量 | 占比 |
|------|------|------|
| ✅ 完成 | ${stats.completed} | ${stats.total > 0 ? Math.round(stats.completed / stats.total * 100) : 0}% |
| ❌ 失败 | ${stats.failed} | ${stats.total > 0 ? Math.round(stats.failed / stats.total * 100) : 0}% |
| 🔄 进行中 | ${stats.inProgress} | ${stats.total > 0 ? Math.round(stats.inProgress / stats.total * 100) : 0}% |
| 🔴 阻塞 | ${stats.blocked} | ${stats.total > 0 ? Math.round(stats.blocked / stats.total * 100) : 0}% |
| ⏳ 待处理 | ${stats.pending} | ${stats.total > 0 ? Math.round(stats.pending / stats.total * 100) : 0}% |

## 任务详情

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
`;

  // 效率分析
  if (options.efficiency) {
    report += `
## 🏆 效率分析

| 指标 | 值 |
|------|-----|
| 总耗时 | ${duration} 分钟 |
| Agent 调用 | ${efficiency.agentCalls} 次 |
| 重试次数 | ${efficiency.retryCount} 次 |
| 并行度 | ${efficiency.parallelism} / ${efficiency.targetParallelism} |
`;
  }

  // 审批记录
  report += `
## 🔔 审批记录

| ID | 类型 | 决策 | 状态 |
|----|------|------|------|
${approvals.length > 0
  ? approvals.map(a => `| ${a.id} | ${a.type} | ${a.decision || '-'} | ${a.status} |`).join('\n')
  : '| _无_ | | | |'}

---
*报告生成时间: ${new Date().toISOString()}*
`;

  return report.trim();
}
