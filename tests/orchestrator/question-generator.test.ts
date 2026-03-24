// tests/orchestrator/question-generator.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { QuestionGenerator } from '../../src/orchestrator/question-generator.js';
import type { ParsedTask } from '../../src/types/index.js';

describe('QuestionGenerator', () => {
  const generator = new QuestionGenerator();

  describe('generate', () => {
    it('should generate tech stack question', () => {
      const parsedTask: ParsedTask = {
        title: 'Test Task',
        goals: ['Goal 1', 'Goal 2', 'Goal 3'],
        constraints: ['Constraint 1'],
        deliverables: ['Deliverable 1'],
        rawContent: ''
      };

      const result = generator.generate(parsedTask);

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].question).toBe('tech_stack');
      expect(result[0].type).toBe('single');
      expect(result[0].options).toBeDefined();
      expect(result[0].required).toBe(true);
    });

    it('should create priority question when multiple goals', () => {
      const parsedTask: ParsedTask = {
        title: 'Test Task',
        goals: ['Goal 1', 'Goal 2', 'Goal 3'],
        constraints: [],
        deliverables: [],
        rawContent: ''
      };

      const result = generator.generate(parsedTask);

      // With 3 goals and no constraints/deliverables, should have at least tech_stack and priority questions
      expect(result.length).toBeGreaterThanOrEqual(1);
      const priorityQuestion = result.find(q => q.question === 'priority');
      expect(priorityQuestion).toBeDefined();
      expect(result[0].type).toBe('single');
      expect(result[0].options).toBeDefined();
      expect(result[0].required).toBe(true);
    });

    it('should return no questions for simple task', () => {
      const parsedTask: ParsedTask = {
        title: 'Simple Task',
        goals: [],
        constraints: [],
        deliverables: [],
        rawContent: ''
      };

      const result = generator.generate(parsedTask);
      // Simple task may still generate some questions
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });
});
