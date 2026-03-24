// tests/orchestrator/task-parser.test.ts
import { describe, it, expect } from 'vitest';
import { TaskParser } from '../../src/orchestrator/task-parser.js';

describe('TaskParser', () => {
  const parser = new TaskParser();

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

  it('should handle empty sections gracefully', () => {
    const content = `# 简单任务

这是一个简单的任务描述。`;
    const result = parser.parse(content);
    expect(result.title).toBe('简单任务');
    expect(result.goals).toEqual([]);
    expect(result.constraints).toEqual([]);
    expect(result.deliverables).toEqual([]);
  });
});
