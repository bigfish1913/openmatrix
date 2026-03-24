// tests/orchestrator/task-planner.test.ts
import { describe, it, expect } from 'vitest';
import { TaskPlanner } from '../../src/orchestrator/task-planner.js';
import type { ParsedTask } from '../../src/types/index.js';

describe('TaskPlanner', () => {
  const planner = new TaskPlanner();

  describe('breakdown', () => {
    it('should break down task with multiple goals', () => {
      const parsedTask: ParsedTask = {
        title: 'Test Task',
        goals: ['Goal 1', 'Goal 2', 'Goal 3'],
        constraints: ['Constraint 1'],
        deliverables: ['Deliverable 1'],
        rawContent: ''
      };

      const result = planner.breakdown(parsedTask, {});

      // Should have at least 3 goals + potentially 1 integration task
      expect(result.length).toBeGreaterThanOrEqual(3);
      expect(result[0].title).toBeDefined();
      expect(result[0].priority).toBeDefined();
      expect(result[0].assignedAgent).toBeDefined();
    });

    it('should handle empty goals', () => {
      const parsedTask: ParsedTask = {
        title: 'Empty Task',
        goals: [],
        constraints: [],
        deliverables: [],
        rawContent: ''
      };

      const result = planner.breakdown(parsedTask, {});
      expect(result).toHaveLength(0);
    });
  });
});
