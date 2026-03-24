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

    try {
      // 1. Parse commands from task description
      const commands = this.parseCommands(context.taskDescription || '');

      // 2. Execute commands
      const results = await this.executeCommands(commands, context.workspaceRoot);

      // 3. Generate result
      const endTime = Date.now();
      return {
        runId,
        taskId,
        agentType: 'executor',
        status: 'completed',
        output: `Successfully executed ${results.length} commands`,
        artifacts: results.map(r => r.outputFile).filter(Boolean) as string[],
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
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  validate(taskId: string, context: AgentContext): boolean {
    return !!context.taskDescription;
  }

  report(): { agentId: string; agentType: string; taskId: string; status: string; summary: string; artifacts: string[]; errors: string[]; duration: number } {
    return {
      agentId: this.id,
      agentType: 'executor',
      taskId: '',
      status: 'idle',
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
    const commands: string[] = [];
    const lines = description.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('command:') || trimmed.startsWith('cmd:') || trimmed.startsWith('run:')) {
        const cleanCommand = trimmed
          .replace(/^(command:|cmd:|run:)\s*/, '')
          .replace(/`/g, '')
          .trim();
        if (cleanCommand) {
          commands.push(cleanCommand);
        }
      }
    }

    return commands;
  }

  private async executeCommands(commands: string[], workspaceRoot: string): Promise<{ command: string; output: string; outputFile?: string }[]> {
    const results: { command: string; output: string; outputFile?: string }[] = [];

    for (const cmd of commands) {
      const isSafe = this.isSafeCommand(cmd);
      if (!isSafe) {
        throw new Error(`Unsafe command detected: ${cmd}`);
      }

      const result = await this.runCommand(cmd, workspaceRoot);
      results.push(result);
    }

    return results;
  }

  private async runCommand(cmd: string, cwd: string): Promise<{ command: string; output: string; outputFile?: string }> {
    return new Promise((resolve, reject) => {
      const timeout = 30000;

      exec(cmd, { cwd, timeout }, (error, stdout, stderr) => {
        if (error) {
          resolve({
            command: cmd,
            output: stderr || error.message
          });
        } else {
          resolve({
            command: cmd,
            output: stdout
          });
        }
      });

      setTimeout(() => {
        reject(new Error(`Command timed out: ${cmd}`));
      }, timeout);
    });
  }

  private isSafeCommand(cmd: string): boolean {
    const safeCommands = ['npm', 'npx', 'git', 'ls', 'cat', 'mkdir', 'rm', 'node'];
    const lowerCmd = cmd.toLowerCase();
    return safeCommands.some(safe => lowerCmd.startsWith(safe));
  }
}
