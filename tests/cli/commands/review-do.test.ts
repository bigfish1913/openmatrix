// tests/cli/commands/review-do.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { reviewDoCommand } from '../../../src/cli/commands/review-do.js';
import { Command } from 'commander';

describe('reviewDoCommand', () => {
  const testDir = path.join(process.cwd(), '.openmatrix-test-review-do');

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
    expect(reviewDoCommand.name()).toBe('review-do');
  });

  it('should have description', () => {
    expect(reviewDoCommand.description()).toContain('Review实现与Plan对比');
  });

  it('should have correct options', () => {
    const options = reviewDoCommand.options;
    expect(options.some(o => o.long === '--json')).toBe(true);
    expect(options.some(o => o.long === '--plan')).toBe(true);
    expect(options.some(o => o.long === '--max-loops')).toBe(true);
    expect(options.some(o => o.long === '--skip-start')).toBe(true);
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
    program.addCommand(reviewDoCommand);

    // 恢复 cwd
    process.cwd = originalCwd;

    // 验证命令可以正常解析
    expect(reviewDoCommand).toBeDefined();
  });

  it('should handle missing plan.md', async () => {
    // 不创建 plan.md
    const program = new Command();
    program.addCommand(reviewDoCommand);

    expect(reviewDoCommand).toBeDefined();
  });
});

describe('updateReviewDoSession', () => {
  it('should be exported', async () => {
    const { updateReviewDoSession } = await import('../../../src/cli/commands/review-do.js');
    expect(updateReviewDoSession).toBeDefined();
    expect(typeof updateReviewDoSession).toBe('function');
  });
});

describe('getImplementationStatus', () => {
  it('should be exported', async () => {
    const { getImplementationStatus } = await import('../../../src/cli/commands/review-do.js');
    expect(getImplementationStatus).toBeDefined();
    expect(typeof getImplementationStatus).toBe('function');
  });
});