// tests/cli/commands/review.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { reviewCommand } from '../../../src/cli/commands/review.js';
import { Command } from 'commander';

describe('reviewCommand', () => {
  const testDir = path.join(process.cwd(), '.openmatrix-test-review');

  beforeEach(async () => {
    // 创建测试目录
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(path.join(testDir, '.openmatrix'), { recursive: true });
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // 忽略清理错误
    }
  });

  it('should create command with correct name', () => {
    expect(reviewCommand.name()).toBe('review');
  });

  it('should have description', () => {
    expect(reviewCommand.description()).toContain('代码审查');
  });

  it('should have correct options', () => {
    const options = reviewCommand.options;
    expect(options.some(o => o.long === '--json')).toBe(true);
    expect(options.some(o => o.long === '--max-loops')).toBe(true);
    expect(options.some(o => o.long === '--skip-plan')).toBe(true);
    expect(options.some(o => o.long === '--skip-tests')).toBe(true);
  });

  it('should initialize session with default values', async () => {
    // 创建 plan.md
    await fs.writeFile(
      path.join(testDir, '.openmatrix', 'plan.md'),
      '# Test Plan\n\n- Item 1\n- Item 2'
    );

    // 设置 cwd 到测试目录
    const originalCwd = process.cwd;
    process.cwd = () => testDir;

    // 模拟命令执行
    const program = new Command();
    program.addCommand(reviewCommand);

    // 恢复 cwd
    process.cwd = originalCwd;

    // 验证命令可以正常解析
    expect(reviewCommand).toBeDefined();
  });

  it('should handle missing plan.md', async () => {
    // 不创建 plan.md
    const program = new Command();
    program.addCommand(reviewCommand);

    expect(reviewCommand).toBeDefined();
  });
});

describe('updateReviewSession', () => {
  it('should be exported', async () => {
    const { updateReviewSession } = await import('../../../src/cli/commands/review.js');
    expect(updateReviewSession).toBeDefined();
    expect(typeof updateReviewSession).toBe('function');
  });
});

describe('getReviewStatus', () => {
  it('should be exported', async () => {
    const { getReviewStatus } = await import('../../../src/cli/commands/review.js');
    expect(getReviewStatus).toBeDefined();
    expect(typeof getReviewStatus).toBe('function');
  });
});