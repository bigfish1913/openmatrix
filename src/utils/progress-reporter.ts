// src/utils/progress-reporter.ts
import type { Task, TaskStatus } from '../types/index.js';

export interface ProgressOptions {
  width?: number;
  showEta?: boolean;
  showCount?: boolean;
}

export interface TaskNode {
  id: string;
  title: string;
  status: TaskStatus;
  dependencies: string[];
  level: number;
}

/**
 * ProgressReporter - 进度可视化工具
 *
 * 提供:
 * 1. 进度条渲染
 * 2. 依赖图 ASCII 渲染
 * 3. 状态图标
 * 4. ETA 计算
 */
export class ProgressReporter {
  private width: number;
  private showEta: boolean;
  private showCount: boolean;

  constructor(options: ProgressOptions = {}) {
    this.width = options.width || 40;
    this.showEta = options.showEta ?? true;
    this.showCount = options.showCount ?? true;
  }

  /**
   * 渲染进度条
   */
  renderProgressBar(completed: number, total: number, label?: string): string {
    if (total === 0) {
      return this.renderEmptyProgress(label);
    }

    const percentage = Math.round((completed / total) * 100);
    const filledWidth = Math.round((completed / total) * this.width);
    const emptyWidth = this.width - filledWidth;

    const filled = '━'.repeat(filledWidth);
    const empty = '─'.repeat(emptyWidth);

    const lines: string[] = [];

    if (label) {
      lines.push(`\n📋 ${label}`);
    }

    lines.push(`${filled}${empty} ${percentage}%`);

    if (this.showCount) {
      lines.push(`${completed}/${total} 完成`);
    }

    return lines.join('\n');
  }

  /**
   * 渲染空进度
   */
  private renderEmptyProgress(label?: string): string {
    const lines: string[] = [];
    if (label) {
      lines.push(`\n📋 ${label}`);
    }
    lines.push('─'.repeat(this.width) + ' 0%');
    lines.push('无任务');
    return lines.join('\n');
  }

  /**
   * 获取状态图标
   */
  getStatusIcon(status: TaskStatus): string {
    const icons: Record<TaskStatus, string> = {
      pending: '⏳',
      scheduled: '📅',
      in_progress: '🔄',
      blocked: '🔴',
      waiting: '⏸️',
      verify: '🔍',
      accept: '✅',
      completed: '✅',
      failed: '❌',
      retry_queue: '🔁'
    };
    return icons[status] || '❓';
  }

  /**
   * 渲染任务依赖图
   */
  renderDependencyGraph(tasks: Task[]): string {
    if (tasks.length === 0) {
      return '无任务';
    }

    // 构建任务树
    const nodes = this.buildTaskNodes(tasks);
    const lines: string[] = [];

    // 找出根节点 (无依赖的任务)
    const rootNodes = nodes.filter(n => n.dependencies.length === 0);

    // 递归渲染
    for (const rootNode of rootNodes) {
      this.renderNode(rootNode, nodes, lines, '', true);
    }

    return lines.join('\n');
  }

  /**
   * 构建任务节点
   */
  private buildTaskNodes(tasks: Task[]): TaskNode[] {
    const taskMap = new Map(tasks.map(t => [t.id, t]));

    return tasks.map(task => ({
      id: task.id,
      title: this.truncateTitle(task.title, 20),
      status: task.status,
      dependencies: task.dependencies,
      level: this.calculateLevel(task, taskMap)
    }));
  }

  /**
   * 计算任务层级
   */
  private calculateLevel(task: Task, taskMap: Map<string, Task>): number {
    if (task.dependencies.length === 0) return 0;

    const depLevels = task.dependencies
      .map(depId => {
        const depTask = taskMap.get(depId);
        return depTask ? this.calculateLevel(depTask, taskMap) : 0;
      });

    return Math.max(...depLevels) + 1;
  }

  /**
   * 渲染单个节点
   */
  private renderNode(
    node: TaskNode,
    allNodes: TaskNode[],
    lines: string[],
    prefix: string,
    isLast: boolean
  ): void {
    const icon = this.getStatusIcon(node.status);
    const connector = isLast ? '└─' : '├─';
    const line = `${prefix}${connector} ${icon} ${node.title}`;

    lines.push(line);

    // 找出依赖此任务的子节点
    const children = allNodes.filter(n => n.dependencies.includes(node.id));

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childIsLast = i === children.length - 1;
      const childPrefix = prefix + (isLast ? '  ' : '│ ');
      this.renderNode(child, allNodes, lines, childPrefix, childIsLast);
    }
  }

  /**
   * 渲染任务卡片
   */
  renderTaskCard(task: Task): string {
    const icon = this.getStatusIcon(task.status);
    const lines: string[] = [];

    lines.push(`┌─────────────────────────────────────┐`);
    lines.push(`│ ${icon} ${this.padRight(task.title, 33)} │`);
    lines.push(`├─────────────────────────────────────┤`);
    lines.push(`│ ID: ${this.padRight(task.id, 31)} │`);
    lines.push(`│ 状态: ${this.padRight(this.getStatusText(task.status), 29)} │`);
    lines.push(`│ 优先级: ${this.padRight(task.priority, 28)} │`);
    lines.push(`│ Agent: ${this.padRight(task.assignedAgent, 28)} │`);

    if (task.error) {
      lines.push(`├─────────────────────────────────────┤`);
      lines.push(`│ ❌ 错误: ${this.padRight(this.truncateTitle(task.error, 26), 26)} │`);
    }

    lines.push(`└─────────────────────────────────────┘`);

    return lines.join('\n');
  }

  /**
   * 渲染统计摘要
   */
  renderStatistics(stats: {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    failed: number;
  }): string {
    const lines: string[] = [];
    const percentage = stats.total > 0
      ? Math.round((stats.completed / stats.total) * 100)
      : 0;

    lines.push('');
    lines.push('📊 任务统计');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(this.renderProgressBar(stats.completed, stats.total));
    lines.push('');
    lines.push(`  ✅ 完成: ${stats.completed}`);
    lines.push(`  🔄 进行中: ${stats.inProgress}`);
    lines.push(`  ⏳ 待处理: ${stats.pending}`);
    lines.push(`  ❌ 失败: ${stats.failed}`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * 渲染失败建议
   */
  renderFailureSuggestion(task: Task): string {
    const lines: string[] = [];

    lines.push('');
    lines.push(`❌ ${task.id} 执行失败`);
    lines.push('');
    lines.push(`原因: ${task.error || '未知错误'}`);
    lines.push('');
    lines.push('建议:');
    lines.push(`[1] 增加超时时间 (当前: ${task.timeout / 1000}s)`);
    lines.push('[2] 拆分为更小的子任务');
    lines.push('[3] 检查依赖是否正确');
    lines.push('[4] 跳过此任务');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * 渲染效率分析
   */
  renderEfficiencyAnalysis(stats: {
    totalDuration: number;
    agentCalls: number;
    retryCount: number;
    parallelism: number;
    targetParallelism: number;
  }): string {
    const lines: string[] = [];

    lines.push('');
    lines.push('🏆 效率分析');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 耗时
    const hours = Math.floor(stats.totalDuration / 3600000);
    const minutes = Math.floor((stats.totalDuration % 3600000) / 60000);
    lines.push(`  总耗时: ${hours}h ${minutes}m`);

    // Agent 调用
    lines.push(`  Agent 调用: ${stats.agentCalls} 次`);

    // 重试次数
    lines.push(`  重试次数: ${stats.retryCount} 次`);

    // 并行度
    const parallelismPercentage = Math.round((stats.parallelism / stats.targetParallelism) * 100);
    lines.push(`  并行度: ${stats.parallelism.toFixed(1)} / ${stats.targetParallelism} (${parallelismPercentage}%)`);

    // 优化建议
    if (parallelismPercentage < 80) {
      const potentialImprovement = Math.round((1 - stats.parallelism / stats.targetParallelism) * 100);
      lines.push(`  💡 建议: 增加并发数可提升 ${potentialImprovement}% 效率`);
    }

    lines.push('');

    return lines.join('\n');
  }

  /**
   * 获取状态文本
   */
  private getStatusText(status: TaskStatus): string {
    const texts: Record<TaskStatus, string> = {
      pending: '待处理',
      scheduled: '已调度',
      in_progress: '进行中',
      blocked: '已阻塞',
      waiting: '等待中',
      verify: '验证中',
      accept: '验收中',
      completed: '已完成',
      failed: '已失败',
      retry_queue: '重试队列'
    };
    return texts[status] || status;
  }

  /**
   * 截断标题
   */
  private truncateTitle(title: string, maxLength: number): string {
    if (title.length <= maxLength) return title;
    return title.slice(0, maxLength - 3) + '...';
  }

  /**
   * 填充右侧空格
   */
  private padRight(text: string, length: number): string {
    if (text.length >= length) return text.slice(0, length);
    return text + ' '.repeat(length - text.length);
  }

  /**
   * 渲染完整执行报告
   */
  renderFullReport(options: {
    tasks: Task[];
    statistics: {
      total: number;
      completed: number;
      inProgress: number;
      pending: number;
      failed: number;
    };
    efficiency: {
      totalDuration: number;
      agentCalls: number;
      retryCount: number;
      parallelism: number;
      targetParallelism: number;
    };
  }): string {
    const sections: string[] = [];

    // 标题
    sections.push('');
    sections.push('📋 执行报告');
    sections.push('━'.repeat(42));
    sections.push('');

    // 进度
    sections.push(this.renderStatistics(options.statistics));

    // 依赖图
    sections.push('');
    sections.push('📊 任务依赖图');
    sections.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    sections.push(this.renderDependencyGraph(options.tasks));
    sections.push('');

    // 效率分析
    sections.push(this.renderEfficiencyAnalysis(options.efficiency));

    // 失败任务
    const failedTasks = options.tasks.filter(t => t.status === 'failed');
    if (failedTasks.length > 0) {
      sections.push('');
      sections.push('❌ 失败任务');
      sections.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      for (const task of failedTasks) {
        sections.push(this.renderFailureSuggestion(task));
      }
    }

    return sections.join('\n');
  }
}
