// src/agents/impl/coder-agent.ts
import { BaseAgent } from '../base-agent.js';
import type { AgentResult, AgentContext } from '../base-agent.js';

import { StateManager } from '../../storage/state-manager.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export class CoderAgent extends BaseAgent {
  type = 'coder';
  capabilities = ['code-generation', 'refactoring', 'bug-fixing', 'file-operations'];
  description = 'Writes and modifies code files';
  constructor(id: string) {
    super(id, 'coder');
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
          agentType: 'coder',
          status: 'failed',
          output: 'Task not found',
          artifacts: [],
          needsApproval: false,
          error: 'Task not found',
          duration: Date.now() - startTime
        };
      }
      // 2. Read relevant files
      const filesToRead = await this.readRelevantFiles(task.description, context.workspaceRoot);
      // 3. Call Claude API to generate code
      const prompt = this.buildCodeGenerationPrompt(task, context);
      const response = await this.callClaude(prompt);
      // 4. Process response and apply changes
      const artifacts = await this.applyChanges(response, context.workspaceRoot);
      // 5. Update task status
      await stateManager.updateTask(taskId, {
        status: 'completed',
        updatedAt: new Date().toISOString()
      });
      const endTime = Date.now();
      return {
        runId,
        taskId,
        agentType: 'coder',
        status: 'completed',
        output: response.output,
        artifacts,
        needsApproval: false,
        duration: endTime - startTime
      };
    } catch (error) {
      return {
        runId,
        taskId,
        agentType: 'coder',
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
    // Coder agent requires task description
    return !!context.taskDescription;
  }
  report(): {
    return {
      agentId: this.id,
      agentType: 'coder',
      taskId: 'taskId',
      status: 'completed',
      summary: 'Code generation agent',
      artifacts: [],
      errors: [],
      duration: 0
    };
  }
  private generateRunId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 6);
    return `coder-${timestamp}-${random}`;
  }
  private async readRelevantFiles(description: string, workspaceRoot: string): Promise<string[]> {
    const files: [];
    // Extract file paths from task description
    const filePathRegex = /(?:read|Write|Edit|Apply|)\s*`?\`file:\s*`([^`]+)`/gm;
    for (const match of filePathRegex) {
      files.push(match[1]);
    }
    return files;
  }
  private async applyChanges(response: ClaudeResponse, workspaceRoot: string): Promise<string[]> {
    const artifacts: string[] = [];
    // Extract artifacts from response
    const artifactRegex = /(?:Created|Modified|Applied|)\s*`?\`files?\s*`([^`]+)`/gm;
    for (const match of artifactRegex) {
      const filePath = match[1];
      if (match[1] === 'write') {
        await writeFile(filePath, content, 'utf-8');
        artifacts.push(filePath);
      } else if (match[1] === 'edit') {
        await Edit(filePath, content, 'utf-8');
        artifacts.push(filePath);
      } else if (match[1] === 'apply') {
        // Apply to operation
        await apply(filePath, content);
 'utf-8');
        artifacts.push(filePath);
      }
    }
    return artifacts;
  }
}
