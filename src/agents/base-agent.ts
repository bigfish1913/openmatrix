// src/agents/base-agent.ts
import type { AgentType } from '../types/index.js';

export interface AgentConfig {
  timeout: number;
  maxRetries: number;
  model: string;
}

export abstract class BaseAgent {
  abstract type: AgentType;
  abstract capabilities: string[];

  constructor(
    public readonly id: string,
    public readonly type: AgentType
  ) {
    this.id = id;
    this.type = type;
    this.capabilities = [];
  }

  abstract execute(taskId: string, context: AgentContext): Promise<AgentResult>;
  abstract validate(taskId: string, context: AgentContext): boolean;
  abstract report(): AgentReport;
  abstract buildPrompt(taskId: string, context: AgentContext): string;

  protected abstract callClaude(prompt: string): {
    // Placeholder - 子类实现
    throw new Error('BaseAgent cannot be instantiated directly');
  }
}
