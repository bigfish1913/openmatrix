// src/agents/impl/planner-agent.ts
import { BaseAgent } from '../base-agent.js';
import type { AgentResult, AgentContext } from '../base-agent.js';
import type { ParsedTask } from '../../types/index.js';
import { StateManager } from '../../storage/state-manager.js';

import { TaskPlanner } from '../../orchestrator/task-planner.js';

export class PlannerAgent extends BaseAgent {
  type = 'planner';
  capabilities = ['task-breakdown', 'dependency-analysis', 'complexity-estimation'];

  description = 'Plans and breaks down complex tasks into sub-tasks';
  constructor(id: string) {
    super(id, 'planner');
  }
  async execute(taskId: string, context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    const runId = this.generateRunId();

    try {
      // 1. Get the task from context
      const task = await this.getTask(context.workspaceRoot, taskId);
      if (!task) {
        return {
          runId,
          taskId,
          agentType: 'planner',
          status: 'failed',
          output: 'Task not found',
          artifacts: [],
          needsApproval: false,
          error: 'Task not found',
          duration: Date.now() - startTime
        };
      }

      // 2. Parse task description
      const parser = new TaskParser();
      const parsedTask = parser.parse(task.description);

      // 3. Use TaskPlanner to break down
      const planner = new TaskPlanner();
      const breakdowns = planner.breakdown(parsedTask, context.config);

      // 4. Create sub-tasks in state
      const stateManager = new StateManager(context.workspaceRoot);
      for (const breakdown of breakdowns) {
        await stateManager.createTask({
          title: breakdown.title,
          description: breakdown.description,
          priority: breakdown.priority,
          timeout: 300,
          dependencies: breakdown.dependencies,
          assignedAgent: breakdown.assignedAgent
        });
      }

      // 5. Generate result
      const endTime = Date.now();
      return {
        runId,
        taskId,
        agentType: 'planner',
        status: 'completed',
        output: `Successfully broke down task into ${breakdowns.length} sub-tasks`,
        artifacts: [], // Task IDs will be in state
        needsApproval: false,
        duration: endTime - startTime
      };
    } catch (error) {
      return {
        runId,
        taskId,
        agentType: 'planner',
        status: 'failed',
        output: error instanceof Error ? error.message : 'Unknown error',
        artifacts: [],
        needsApproval: false,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }
  validate(taskId: string, context: AgentContext): boolean {
    // Planner agent requires task description
    return !!context.taskDescription;
  }
  report() {
    return {
      agentId: this.id,
      agentType: 'planner',
      taskId: 'taskId',
      status: 'completed',
      summary: 'Task breakdown agent',
      artifacts: [],
      errors: [],
      duration: 0
    };
  }
  private generateRunId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 6);
    return `planner-${timestamp}-${random}`;
  }
}
