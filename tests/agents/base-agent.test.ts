// tests/agents/base-agent.test.ts
import { describe, it, expect } from 'vitest';

import { BaseAgent } from '../../src/agents/base-agent.js';

describe('BaseAgent', () => {
  it('should have type and capabilities defined', () => {
    const agent = new BaseAgent('test-id', 'test-type');

    expect(agent.id).toBe('test-id');
    expect(agent.type).toBe('test-type');
    expect(agent.capabilities).toEqual(['test']);
  });
});
