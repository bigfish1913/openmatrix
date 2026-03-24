// src/agents/base-agent.ts
import type { AgentType } from '../types/index.js';

export interface AgentConfig {
  timeout: number;
  maxRetries: number;
  model: string;
}

export interface AgentContext {
  workspaceRoot: string;
  taskDescription: string;
  relevantFiles: string[];
  constraints: string[];
  config: AgentConfig;
}

export interface AgentResult {
  runId: string;
  taskId: string;
  agentType: AgentType;
  status: 'completed' | 'failed' | 'needs_approval';
  output: string;
  artifacts: string[];
  needsApproval: boolean;
  error?: string;
  duration: number;
}

export interface AgentReport {
  agentId: string;
  agentType: AgentType;
  taskId: string;
  status: string;
  summary: string;
  artifacts: string[];
  errors: string[];
  duration: number;
}

export abstract class BaseAgent {
  abstract type: AgentType;
  abstract capabilities: string[];

  constructor(
    public readonly id: string,
    public readonly agentType: AgentType
  ) {
    // capabilities is defined by subclass
  }

  abstract execute(taskId: string, context: AgentContext): Promise<AgentResult>;
  abstract validate(taskId: string, context: AgentContext): boolean;
  abstract report(): AgentReport;
  abstract buildPrompt(taskId: string, context: AgentContext): string;

  protected async callClaude(prompt: string): Promise<string> {
    // Placeholder - 子类实现
    throw new Error('BaseAgent.callClaude must be implemented by subclass');
  }
}
