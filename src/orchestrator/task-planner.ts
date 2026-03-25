// src/orchestrator/task-planner.ts
import type { ParsedTask } from '../types/index.js';
import type { Task } from '../types/index.js';

export interface TaskBreakdown {
  taskId: string;
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  dependencies: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
  assignedAgent: 'planner' | 'coder' | 'tester' | 'reviewer' | 'researcher' | 'executor';
}

export class TaskPlanner {
  /**
   * Break down a parsed task into sub-tasks
   */
  breakdown(parsedTask: ParsedTask, answers: Record<string, string>): TaskBreakdown[] {
    const breakdowns: TaskBreakdown[] = [];
    const seenTitles = new Set<string>();  // 用于去重

    // 1. Create tasks for each goal
    for (let i = 0; i < parsedTask.goals.length; i++) {
      const title = parsedTask.goals[i];

      // 跳过重复项
      if (seenTitles.has(title)) {
        continue;
      }
      seenTitles.add(title);

      breakdowns.push({
        taskId: this.generateTaskId(),
        title,
        description: `实现: ${title}`,
        priority: this.determinePriority(i),
        dependencies: [],
        estimatedComplexity: this.estimateComplexity(title),
        assignedAgent: this.determineAgent(title)
      });
    }

    // 2. Create integration task if multiple deliverables
    if (parsedTask.deliverables.length > 1) {
      breakdowns.push({
        taskId: this.generateTaskId(),
        title: '集成测试',
        description: `验证所有交付物正确集成`,
        priority: 'P1',
        dependencies: parsedTask.deliverables,
        estimatedComplexity: 'medium',
        assignedAgent: 'tester'
      });
    }

    return breakdowns;
  }

  private generateTaskId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 4).toUpperCase();
    return `TASK-${timestamp}${rand}`;
  }

  private determinePriority(goalIndex: number): 'P0' | 'P1' | 'P2' | 'P3' {
    // First goal is highest priority
    if (goalIndex === 0) return 'P1';
    return 'P2';
  }

  private estimateComplexity(goal: string): 'low' | 'medium' | 'high' {
    if (goal.includes('测试')) return 'medium';
    if (goal.includes('实现') || goal.includes('开发')) return 'low';
    if (goal.includes('设计') || goal.includes('研究')) return 'high';
    return 'high';
  }

  private determineAgent(goal: string): 'planner' | 'coder' | 'tester' | 'reviewer' | 'researcher' | 'executor' {
    if (goal.includes('测试')) return 'tester';
    if (goal.includes('实现') || goal.includes('开发')) return 'coder';
    if (goal.includes('设计') || goal.includes('研究')) return 'researcher';
    if (goal.includes('文档') || goal.includes('说明')) return 'executor';
    return 'executor';
  }
}
