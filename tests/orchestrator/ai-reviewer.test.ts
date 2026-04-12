// tests/orchestrator/ai-reviewer.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AIReviewer } from '../../src/orchestrator/ai-reviewer.js';
import type { Task } from '../../src/types/index.js';

describe('AIReviewer', () => {
  let reviewer: AIReviewer;

  beforeEach(() => {
    reviewer = new AIReviewer();
  });

  // Helper to create a test task
  function createTestTask(): Task {
    return {
      id: 'TASK-001',
      title: 'Add user authentication',
      description: 'Implement login and registration',
      status: 'accept',
      priority: 'P0',
      timeout: 120000,
      dependencies: [],
      assignedAgent: 'coder',
      phases: {
        develop: { status: 'completed', duration: 100 },
        verify: { status: 'completed', duration: 50 },
        accept: { status: 'in_progress', duration: null }
      },
      retryCount: 0,
      error: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  describe('buildReviewPrompt', () => {
    it('should generate review prompt with task info', () => {
      const task = createTestTask();
      const prompt = reviewer.buildReviewPrompt(task);

      expect(prompt).toContain('TASK-001');
      expect(prompt).toContain('Add user authentication');
      expect(prompt).toContain('Implement login and registration');
    });

    it('should include all review categories', () => {
      const task = createTestTask();
      const prompt = reviewer.buildReviewPrompt(task);

      expect(prompt).toContain('代码质量');
      expect(prompt).toContain('安全性');
      expect(prompt).toContain('性能');
      expect(prompt).toContain('最佳实践');
      expect(prompt).toContain('测试覆盖');
    });

    it('should include review status markers', () => {
      const task = createTestTask();
      const prompt = reviewer.buildReviewPrompt(task);

      expect(prompt).toContain('AI_REVIEW_APPROVED');
      expect(prompt).toContain('AI_REVIEW_NEEDS_CHANGES');
      expect(prompt).toContain('AI_REVIEW_REJECTED');
    });
  });

  describe('parseReviewResult', () => {
    it('should parse approved status', () => {
      const output = `
## 总结
All good!

AI_REVIEW_APPROVED
`;
      const report = reviewer.parseReviewResult('TASK-001', output);

      expect(report.taskId).toBe('TASK-001');
      expect(report.overallStatus).toBe('approved');
    });

    it('should parse needs_changes status', () => {
      const output = `
## 总结
Some issues found.

AI_REVIEW_NEEDS_CHANGES
需要修复的问题:
1. [Critical] SQL injection vulnerability
`;
      const report = reviewer.parseReviewResult('TASK-001', output);

      expect(report.overallStatus).toBe('needs_changes');
    });

    it('should parse rejected status', () => {
      const output = `
## 总结
Major security issues.

AI_REVIEW_REJECTED
拒绝原因:
1. Authentication bypass vulnerability
`;
      const report = reviewer.parseReviewResult('TASK-001', output);

      expect(report.overallStatus).toBe('rejected');
    });

    it('should parse critical issues', () => {
      const output = `
### 严重 - 必须修复
1. src/auth.ts:10 SQL injection in login query
   - 建议: Use parameterized queries
2. src/auth.ts:25 Missing password hashing

AI_REVIEW_NEEDS_CHANGES
`;
      const report = reviewer.parseReviewResult('TASK-001', output);

      expect(report.issues.length).toBeGreaterThan(0);
      expect(report.issues[0].severity).toBe('critical');
      expect(report.issues[0].description).toContain('SQL injection');
    });

    it('should parse major issues', () => {
      const output = `
### 重要 - 强烈建议修复
1. src/utils.ts:50 Performance issue in data processing
   - 建议: Use caching
2. Missing error handling in API calls

AI_REVIEW_NEEDS_CHANGES
`;
      const report = reviewer.parseReviewResult('TASK-001', output);

      expect(report.issues.length).toBeGreaterThan(0);
      expect(report.issues.some(i => i.severity === 'major')).toBe(true);
    });

    it('should parse minor issues', () => {
      const output = `
### 次要 - 可选优化
1. Variable naming could be improved
2. Add more comments

AI_REVIEW_APPROVED
`;
      const report = reviewer.parseReviewResult('TASK-001', output);

      expect(report.issues.some(i => i.severity === 'minor')).toBe(true);
    });

    it('should parse suggestions', () => {
      const output = `
### 建议 - 改进建议
1. Consider using async/await instead of callbacks
2. Add unit tests for edge cases

AI_REVIEW_APPROVED
`;
      const report = reviewer.parseReviewResult('TASK-001', output);

      expect(report.suggestions.length).toBeGreaterThan(0);
      expect(report.suggestions.some(s => s.includes('async/await'))).toBe(true);
    });

    it('should parse category scores', () => {
      const output = `
### 1. 代码质量
- 评分: 85
- 状态: ✅
- 详情:
  - Good naming conventions

### 2. 安全性
- 评分: 70
- 状态: ⚠️

### 3. 性能
- 评分: 90
- 状态: ✅

AI_REVIEW_APPROVED
`;
      const report = reviewer.parseReviewResult('TASK-001', output);

      expect(report.categories.length).toBeGreaterThan(0);
      expect(report.categories.find(c => c.name === '代码质量')?.score).toBe(85);
      expect(report.categories.find(c => c.name === '安全性')?.score).toBe(70);
    });

    it('should set pass status for score >= 80', () => {
      const output = `
### 1. 代码质量
- 评分: 85

AI_REVIEW_APPROVED
`;
      const report = reviewer.parseReviewResult('TASK-001', output);

      const category = report.categories.find(c => c.name === '代码质量');
      expect(category?.status).toBe('pass');
    });

    it('should set warning status for score 60-79', () => {
      const output = `
### 2. 安全性
- 评分: 70

AI_REVIEW_NEEDS_CHANGES
`;
      const report = reviewer.parseReviewResult('TASK-001', output);

      const category = report.categories.find(c => c.name === '安全性');
      expect(category?.status).toBe('warning');
    });

    it('should set fail status for score < 60', () => {
      const output = `
### 3. 性能
- 评分: 45

AI_REVIEW_REJECTED
`;
      const report = reviewer.parseReviewResult('TASK-001', output);

      const category = report.categories.find(c => c.name === '性能');
      expect(category?.status).toBe('fail');
    });

    it('should parse summary', () => {
      const output = `
## 总结
Overall the code is good quality with minor security concerns.
Please address the SQL injection issue before merging.

AI_REVIEW_NEEDS_CHANGES
`;
      const report = reviewer.parseReviewResult('TASK-001', output);

      expect(report.summary).toContain('Overall');
      expect(report.summary).toContain('security concerns');
    });
  });

  describe('buildAcceptPrompt', () => {
    it('should generate accept prompt with task info', () => {
      const task = createTestTask();
      const prompt = reviewer.buildAcceptPrompt(task);

      expect(prompt).toContain('TASK-001');
      expect(prompt).toContain('验收阶段');
      expect(prompt).toContain('AI Code Review');
    });

    it('should include review prompt', () => {
      const task = createTestTask();
      const prompt = reviewer.buildAcceptPrompt(task);

      // Should include all review content
      expect(prompt).toContain('代码质量');
      expect(prompt).toContain('安全性');
    });

    it('should include accept result markers', () => {
      const task = createTestTask();
      const prompt = reviewer.buildAcceptPrompt(task);

      expect(prompt).toContain('ACCEPT_PASSED');
      expect(prompt).toContain('ACCEPT_NEEDS_MODIFICATION');
      expect(prompt).toContain('ACCEPT_FAILED');
    });
  });

  describe('generateFixTasks', () => {
    it('should generate fix tasks for critical issues', () => {
      const task = createTestTask();
      const report = {
        taskId: 'TASK-001',
        overallStatus: 'needs_changes',
        categories: [],
        issues: [
          { severity: 'critical', description: 'SQL injection', file: 'auth.ts', line: 10 }
        ],
        suggestions: [],
        summary: '',
        reviewedAt: new Date().toISOString()
      };

      const fixTasks = reviewer.generateFixTasks(task, report, 'REVIEW-001');

      expect(fixTasks.length).toBeGreaterThan(0);
      expect(fixTasks[0].priority).toBe('P0');
      expect(fixTasks[0].assignedAgent).toBe('coder');
      expect(fixTasks[0].dependencies).toContain('REVIEW-001');
    });

    it('should generate fix tasks for major issues', () => {
      const task = createTestTask();
      const report = {
        taskId: 'TASK-001',
        overallStatus: 'needs_changes',
        categories: [],
        issues: [
          { severity: 'major', description: 'Missing error handling', file: 'api.ts' }
        ],
        suggestions: [],
        summary: '',
        reviewedAt: new Date().toISOString()
      };

      const fixTasks = reviewer.generateFixTasks(task, report, 'REVIEW-001');

      expect(fixTasks.length).toBeGreaterThan(0);
      expect(fixTasks[0].priority).toBe('P1');
    });

    it('should not generate fix tasks for minor issues', () => {
      const task = createTestTask();
      const report = {
        taskId: 'TASK-001',
        overallStatus: 'approved',
        categories: [],
        issues: [
          { severity: 'minor', description: 'Variable naming' },
          { severity: 'suggestion', description: 'Add comments' }
        ],
        suggestions: [],
        summary: '',
        reviewedAt: new Date().toISOString()
      };

      const fixTasks = reviewer.generateFixTasks(task, report, 'REVIEW-001');

      // Only generates reverify task if there were fix tasks
      expect(fixTasks.length).toBe(0);
    });

    it('should group issues by file', () => {
      const task = createTestTask();
      const report = {
        taskId: 'TASK-001',
        overallStatus: 'needs_changes',
        categories: [],
        issues: [
          { severity: 'critical', description: 'Issue 1', file: 'auth.ts' },
          { severity: 'major', description: 'Issue 2', file: 'auth.ts' },
          { severity: 'critical', description: 'Issue 3', file: 'api.ts' }
        ],
        suggestions: [],
        summary: '',
        reviewedAt: new Date().toISOString()
      };

      const fixTasks = reviewer.generateFixTasks(task, report, 'REVIEW-001');

      // Should have 2 fix tasks (auth.ts, api.ts) + 1 reverify task
      expect(fixTasks.length).toBe(3);
      expect(fixTasks[0].taskId).toContain('FIX-01');
      expect(fixTasks[1].taskId).toContain('FIX-02');
    });

    it('should generate reverify task after fix tasks', () => {
      const task = createTestTask();
      const report = {
        taskId: 'TASK-001',
        overallStatus: 'needs_changes',
        categories: [],
        issues: [
          { severity: 'critical', description: 'Issue 1', file: 'auth.ts' }
        ],
        suggestions: [],
        summary: '',
        reviewedAt: new Date().toISOString()
      };

      const fixTasks = reviewer.generateFixTasks(task, report, 'REVIEW-001');

      // Last task should be reverify
      const lastTask = fixTasks[fixTasks.length - 1];
      expect(lastTask.taskId).toContain('REVERIFY');
      expect(lastTask.assignedAgent).toBe('reviewer');
      expect(lastTask.dependencies.length).toBeGreaterThan(1); // Depends on review + all fix tasks
    });

    it('should use P0 priority for critical issues', () => {
      const task = createTestTask();
      const report = {
        taskId: 'TASK-001',
        overallStatus: 'needs_changes',
        categories: [],
        issues: [
          { severity: 'critical', description: 'Critical issue', file: 'file.ts' }
        ],
        suggestions: [],
        summary: '',
        reviewedAt: new Date().toISOString()
      };

      const fixTasks = reviewer.generateFixTasks(task, report, 'REVIEW-001');

      expect(fixTasks[0].priority).toBe('P0');
      expect(fixTasks[0].title).toContain('紧急修复');
    });
  });

  describe('needsAutoFix', () => {
    it('should return true for critical issues', () => {
      const report = {
        taskId: 'TASK-001',
        overallStatus: 'needs_changes',
        categories: [],
        issues: [
          { severity: 'critical', description: 'Security issue' }
        ],
        suggestions: [],
        summary: '',
        reviewedAt: new Date().toISOString()
      };

      expect(reviewer.needsAutoFix(report)).toBe(true);
    });

    it('should return true for major issues', () => {
      const report = {
        taskId: 'TASK-001',
        overallStatus: 'needs_changes',
        categories: [],
        issues: [
          { severity: 'major', description: 'Performance issue' }
        ],
        suggestions: [],
        summary: '',
        reviewedAt: new Date().toISOString()
      };

      expect(reviewer.needsAutoFix(report)).toBe(true);
    });

    it('should return false for only minor issues', () => {
      const report = {
        taskId: 'TASK-001',
        overallStatus: 'approved',
        categories: [],
        issues: [
          { severity: 'minor', description: 'Naming issue' },
          { severity: 'suggestion', description: 'Add comments' }
        ],
        suggestions: [],
        summary: '',
        reviewedAt: new Date().toISOString()
      };

      expect(reviewer.needsAutoFix(report)).toBe(false);
    });

    it('should return false for no issues', () => {
      const report = {
        taskId: 'TASK-001',
        overallStatus: 'approved',
        categories: [],
        issues: [],
        suggestions: [],
        summary: '',
        reviewedAt: new Date().toISOString()
      };

      expect(reviewer.needsAutoFix(report)).toBe(false);
    });
  });
});