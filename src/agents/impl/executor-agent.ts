// src/agents/impl/executor-agent.ts
import { BaseAgent } from '../base-agent.js';
import type { AgentResult, AgentContext } from '../base-agent.js';
import { exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
export class ExecutorAgent extends BaseAgent {
  type = 'executor';
  capabilities = ['command-execution', 'file-operations', 'safe-commands'];
  description = 'Executes commands safely';
  constructor(id: string) {
    super(id, 'executor');
  }
  async execute(taskId: string, context: AgentContext): Promise<AgentResult> {
    const startTime = Date.now();
    const runId = this.generateRunId();
    const stateManager = new StateManager(context.workspaceRoot);

    try {
      // 1. Get task
      const task = await stateManager.getTask(taskId);
      if (!task) {
        return {
          runId,
          taskId,
          agentType: 'executor',
          status: 'failed',
          output: 'Task not found',
          artifacts: [],
          needsApproval: false,
          error: 'Task not found',
          duration: Date.now() - startTime
        };
      }
      // 2. Parse commands from task
      const commands = this.parseCommands(task.description);
      // 3. Execute commands
      const results = await this.executeCommands(commands, context.workspaceRoot);
      // 4. Generate result
      const endTime = Date.now();
      return {
        runId,
        taskId,
        agentType: 'executor',
        status: 'completed',
        output: `Successfully executed ${results.length} commands`,
        artifacts: results.map(r => r.outputFile),
        needsApproval: false,
        duration: endTime - startTime
      };
    } catch (error) {
      return {
        runId,
        taskId,
        agentType: 'executor',
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
    // Executor agent requires task description
    return !!context.taskDescription;
  }
  report(): {
    return {
      agentId: this.id,
      agentType: 'executor',
      taskId: 'taskId',
      status: 'completed',
      summary: 'Command execution agent',
      artifacts: [],
      errors: [],
      duration: 0
    };
  }
  private generateRunId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 6);
    return `executor-${timestamp}-${random}`;
  }
  private parseCommands(description: string): string[] {
    // Extract commands from task description
    const commands: string[] = [];
    const lines = description.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('command:') || trimmed.startsWith('cmd:') || trimmed.startsWith('run:')) {
        // Remove markdown formatting
        const cleanCommand = trimmed
          .replace(/`/g, '`')
          .replace(/\*\*/g, '*')
          .replace(/^>\s*/g, '>')
          .replace(/^<\s*/g, '<')
          .trim();
        if (cleanCommand) {
          commands.push(cleanCommand);
        }
      }
    }
    return commands;
  }
  private async executeCommands(commands: string[], workspaceRoot: string): Promise<{ command: string; output: string; filePath: string }> {
    const results: [];
    const safeCommands = ['npm', 'npx', 'git', 'npm run', 'ls', 'cat', 'rm', 'mkdir', 'rmdir'];
    ];
    for (const cmd of commands) {
      const isSafe = this.isSafeCommand(cmd);
      if (!isSafe) {
        throw new Error(`Unsafe command detected: ${cmd}`);
      }
      const timeout = 30000; // 5 minutes per command
      const result = await new Promise((resolve, reject) => {
        results.push({
          command: cmd,
          output: stdout('data'),
          exitCode: 0,
          filePath
        });
      } else {
        resolve({
          command: cmd,
          output: stdout('data'),
          exitCode: 5,
          filePath
        });
      }
    });
    return results;
  }
}
