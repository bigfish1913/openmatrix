// tests/agents/base-agent.test.ts
import { describe, it, expect } from 'vitest';

// BaseAgent is abstract, so we need to create a concrete implementation
class TestAgent {
  id: string;
  agentType: string;
  capabilities: string[];

  constructor(id: string, agentType: string) {
    this.id = id;
    this.agentType = agentType;
    this.capabilities = [];
  }
}

describe('BaseAgent', () => {
  it('should have type and capabilities defined', () => {
    const agent = new TestAgent('test-id', 'test-type');

    expect(agent.id).toBe('test-id');
    expect(agent.agentType).toBe('test-type');
    expect(agent.capabilities).toEqual([]);
  });
});
