// tests/orchestrator/task-parser.test.ts
import { describe, it, expect } from 'vitest';
import { TaskParser } from '../../src/orchestrator/task-parser.js';

describe('TaskParser', () => {
  const parser = new TaskParser();

  describe('markdown format', () => {
    it('should parse task title from markdown', () => {
      const content = `# 用户登录功能开发

实现基于 JWT 的用户登录认证功能。`;
      const result = parser.parse(content);
      expect(result.title).toBe('用户登录功能开发');
    });

    it('should extract goals from task description', () => {
      const content = `# 任务

## 目标
- 实现用户登录
- 实现 JWT 认证
- 添加登录日志`;
      const result = parser.parse(content);
      expect(result.goals).toHaveLength(3);
      expect(result.goals).toContain('实现用户登录');
    });

    it('should extract constraints', () => {
      const content = `# 任务

## 约束
- 必须使用 TypeScript
- 兼容 Node.js 18+`;
      const result = parser.parse(content);
      expect(result.constraints).toHaveLength(2);
    });

    it('should extract deliverables', () => {
      const content = `# 任务

## 交付物
- src/auth/login.ts
- tests/auth.test.ts
- docs/login.md`;
      const result = parser.parse(content);
      expect(result.deliverables).toHaveLength(3);
    });
  });

  describe('plain text fallback', () => {
    it('should extract goals from simple text description', () => {
      const content = '实现用户登录功能';
      const result = parser.parse(content);
      expect(result.goals.length).toBeGreaterThanOrEqual(1);
      expect(result.goals[0]).toContain('实现用户登录');
    });

    it('should extract goals from ordered list in plain text', () => {
      const content = `实现登录功能
1. 创建登录页面
2. 实现认证逻辑
3. 添加session管理`;
      const result = parser.parse(content);
      expect(result.goals).toHaveLength(3);
      expect(result.goals[0]).toBe('创建登录页面');
      expect(result.goals[1]).toBe('实现认证逻辑');
      expect(result.goals[2]).toBe('添加session管理');
    });

    it('should extract goals from unordered list in plain text', () => {
      const content = `实现登录功能
- 创建登录页面
- 实现认证逻辑
- 添加session管理`;
      const result = parser.parse(content);
      expect(result.goals).toHaveLength(3);
      expect(result.goals).toContain('创建登录页面');
    });

    it('should extract goals from Chinese sentences', () => {
      const content = '实现用户登录；实现用户注册；实现密码重置';
      const result = parser.parse(content);
      expect(result.goals.length).toBeGreaterThanOrEqual(2);
    });

    it('should use title as single goal when no other structure exists', () => {
      const content = '# 实现用户登录功能';
      const result = parser.parse(content);
      expect(result.goals.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate deliverables from goals when none provided', () => {
      const content = '实现用户登录功能';
      const result = parser.parse(content);
      expect(result.deliverables.length).toBe(result.goals.length);
      result.deliverables.forEach(d => {
        expect(d).toContain('的实现');
      });
    });

    it('should use markdown deliverables when available (not fallback)', () => {
      const content = `# 任务

## 目标
- 实现登录

## 交付物
- src/login.ts`;
      const result = parser.parse(content);
      expect(result.deliverables).toEqual(['src/login.ts']);
    });

    it('should have non-empty description for simple text', () => {
      const content = '实现用户登录功能，支持邮箱和密码登录';
      const result = parser.parse(content);
      expect(result.description.length).toBeGreaterThan(0);
    });
  });
});
