// src/agents/base-agent.ts
import type { AgentType, AgentResult } from '../types/index.js';

/**
 * Base class for all Worker Agents
 */
export abstract class BaseAgent {
  abstract type: AgentType;
  abstract capabilities: string[];

  constructor(
    public readonly id: string,
    public readonly type: AgentType
  ) {
    this.capabilities = capabilities;
  }

  abstract async execute(taskId: string, context: AgentContext): Promise<AgentResult>;
  abstract validate(taskId: string, context: AgentContext): boolean;
  abstract report(): AgentReport;

  /**
   * Build the prompt for the agent
   */
  protected abstract buildPrompt(taskId: string, context: AgentContext): string;
  /**
   * Call Claude API with the prompt
   */
  protected async callClaude(prompt: string): Promise<ClaudeResponse>;
}

```

### Agent Types
export type AgentContext = {
  taskId: string;
  taskDescription: string;
  relevantFiles: string[];
  constraints: string[];
  workspaceRoot: string;
  config: AgentConfig;
};

export interface AgentConfig {
  timeout: number;
  maxRetries: number;
  model: string;
}
export interface AgentReport {
  agentId: string;
  agentType: AgentType;
  taskId: string;
  status: 'success' | 'failed' | 'needs_approval';
  summary: string;
  artifacts: string[];
  errors: string[];
  duration: number;
}
