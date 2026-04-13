// tests/agents/base-agent.test.ts
import { describe, it, expect } from 'vitest';
import { BaseAgent } from '../../src/agents/base-agent.js';
import type {
  AgentConfig,
  AgentContext,
  AgentResult,
  AgentReport
} from '../../src/agents/base-agent.js';
import type { AgentType } from '../../src/types/index.js';

// Create a concrete subclass to test BaseAgent behavior
class ConcreteAgent extends BaseAgent {
  type: AgentType = 'coder';
  capabilities: string[] = ['code-generation', 'testing'];

  async execute(taskId: string, context: AgentContext): Promise<AgentResult> {
    return {
      runId: 'test-run',
      taskId,
      agentType: this.agentType,
      status: 'completed',
      output: 'Test output',
      artifacts: [],
      needsApproval: false,
      duration: 100
    };
  }

  validate(taskId: string, context: AgentContext): boolean {
    return taskId.length > 0;
  }

  report(): AgentReport {
    return {
      agentId: this.id,
      agentType: this.agentType,
      taskId: '',
      status: 'idle',
      summary: 'Test agent',
      artifacts: [],
      errors: [],
      duration: 0
    };
  }

  buildPrompt(taskId: string, context: AgentContext): string {
    return `Task: ${taskId}\nContext: ${context.taskDescription}`;
  }

  // Expose callClaude for testing the protected method
  async testCallClaude(prompt: string): Promise<string> {
    return this.callClaude(prompt);
  }
}

// Helper to build a valid AgentContext
function createContext(overrides?: Partial<AgentContext>): AgentContext {
  return {
    workspaceRoot: '/test/workspace',
    taskDescription: 'Test task',
    relevantFiles: ['src/index.ts'],
    constraints: ['No external dependencies'],
    config: {
      timeout: 5000,
      maxRetries: 3,
      model: 'claude-3'
    },
    ...overrides
  };
}

describe('BaseAgent', () => {
  it('should create agent with correct id and agentType', () => {
    const agent = new ConcreteAgent('agent-001', 'coder');

    expect(agent.id).toBe('agent-001');
    expect(agent.agentType).toBe('coder');
  });

  it('should have abstract type property', () => {
    const agent = new ConcreteAgent('agent-001', 'coder');

    expect(agent.type).toBe('coder');
  });

  it('should have abstract capabilities property', () => {
    const agent = new ConcreteAgent('agent-001', 'coder');

    expect(agent.capabilities).toEqual(['code-generation', 'testing']);
    expect(Array.isArray(agent.capabilities)).toBe(true);
  });

  it('should implement execute method', async () => {
    const agent = new ConcreteAgent('agent-001', 'coder');
    const context = createContext();
    const result = await agent.execute('task-001', context);

    expect(result.runId).toBe('test-run');
    expect(result.taskId).toBe('task-001');
    expect(result.agentType).toBe('coder');
    expect(result.status).toBe('completed');
    expect(result.output).toBe('Test output');
    expect(result.artifacts).toEqual([]);
    expect(result.needsApproval).toBe(false);
    expect(result.duration).toBe(100);
  });

  it('should implement validate method', () => {
    const agent = new ConcreteAgent('agent-001', 'coder');
    const context = createContext();

    expect(agent.validate('task-001', context)).toBe(true);
    expect(agent.validate('', context)).toBe(false);
  });

  it('should implement report method', () => {
    const agent = new ConcreteAgent('agent-001', 'coder');
    const report = agent.report();

    expect(report.agentId).toBe('agent-001');
    expect(report.agentType).toBe('coder');
    expect(report.taskId).toBe('');
    expect(report.status).toBe('idle');
    expect(report.summary).toBe('Test agent');
    expect(report.artifacts).toEqual([]);
    expect(report.errors).toEqual([]);
    expect(report.duration).toBe(0);
  });

  it('should implement buildPrompt method', () => {
    const agent = new ConcreteAgent('agent-001', 'coder');
    const context = createContext({ taskDescription: 'Build a feature' });
    const prompt = agent.buildPrompt('task-001', context);

    expect(prompt).toContain('task-001');
    expect(prompt).toContain('Build a feature');
    expect(typeof prompt).toBe('string');
  });

  it('should throw error when callClaude is called directly', async () => {
    const agent = new ConcreteAgent('agent-001', 'coder');

    await expect(agent.testCallClaude('test prompt')).rejects.toThrow(
      'BaseAgent.callClaude must be implemented by subclass'
    );
  });

  it('should create agents with different agent types', () => {
    const agentTypes: AgentType[] = [
      'planner',
      'coder',
      'tester',
      'reviewer',
      'researcher',
      'executor'
    ];

    for (const agentType of agentTypes) {
      class TypedAgent extends BaseAgent {
        type: AgentType = agentType;
        capabilities: string[] = [];

        async execute(
          taskId: string,
          context: AgentContext
        ): Promise<AgentResult> {
          return {
            runId: 'test-run',
            taskId,
            agentType: this.agentType,
            status: 'completed',
            output: '',
            artifacts: [],
            needsApproval: false,
            duration: 0
          };
        }

        validate(taskId: string, context: AgentContext): boolean {
          return true;
        }

        report(): AgentReport {
          return {
            agentId: this.id,
            agentType: this.agentType,
            taskId: '',
            status: 'idle',
            summary: '',
            artifacts: [],
            errors: [],
            duration: 0
          };
        }

        buildPrompt(taskId: string, context: AgentContext): string {
          return '';
        }
      }

      const agent = new TypedAgent(`agent-${agentType}`, agentType);
      expect(agent.agentType).toBe(agentType);
      expect(agent.type).toBe(agentType);
    }
  });

  it('should have readonly id and agentType', () => {
    const agent = new ConcreteAgent('agent-001', 'coder');

    // TypeScript enforces readonly at compile time; at runtime we verify
    // the properties exist and hold the expected values.
    expect(agent.id).toBe('agent-001');
    expect(agent.agentType).toBe('coder');

    // Properties are defined as own instance properties via constructor parameter
    const idDesc = Object.getOwnPropertyDescriptor(agent, 'id');
    const typeDesc = Object.getOwnPropertyDescriptor(agent, 'agentType');

    expect(idDesc).toBeDefined();
    expect(idDesc!.value).toBe('agent-001');
    expect(typeDesc).toBeDefined();
    expect(typeDesc!.value).toBe('coder');

    // Note: TypeScript readonly is a compile-time constraint only.
    // At runtime the properties are writable, but TypeScript prevents
    // reassignment during compilation.
    expect(idDesc!.writable).toBe(true);
    expect(typeDesc!.writable).toBe(true);
  });
});
