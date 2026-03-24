// tests/orchestrator/task-planner.test.ts
import { describe, it, expect } from 'vitest';
import { TaskPlanner } from '../../src/orchestrator/task-planner.js';
import type { ParsedTask } from '../../src/types/index.js';

describe('TaskPlanner', () => {
  const planner = new TaskPlanner();

  describe('breakdown', () => {
    const parsedTask: ParsedTask = {
      title: 'Test Task',
      goals: ['Goal 1', 'Goal 2', 'Goal 3'],
      constraints: ['Constraint 1'],
      deliverables: ['Deliverable 1'],
      rawContent: ''
    };

    const result = planner.breakdown(parsedTask);

    expect(result).toHaveLength(4);
    expect(result[0].title).toBe('Goal 1');
    expect(result[0].priority).toBe('P1');
    expect(result[0].assignedAgent).toBeDefined();
  });
});
