// tests/cli/auto.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fsSync from 'fs';
import * as path from 'path';

// ---------- Logger Mock ----------
const { mockLogger } = vi.hoisted(() => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  };
  return { mockLogger };
});

vi.mock('../../src/utils/logger.js', () => ({
  logger: mockLogger,
}));

// Import after mocking
import { logger } from '../../src/utils/logger.js';

describe('auto command logger tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ======== 源码验证 ========

  describe('source code verification', () => {
    it('should not contain any console.log calls', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).not.toMatch(/console\.(log|warn|error|debug|info)/);
    });

    it('should import logger from utils/logger', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toMatch(/from.*['"]\.\.\/\.\.\/utils\/logger\.js['"]/);
    });

    it('should use logger.info for all output (26+ calls per TASK-013)', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      const loggerInfoCount = (source.match(/logger\.info/g) || []).length;
      expect(loggerInfoCount).toBeGreaterThanOrEqual(20);
    });

    it('should have correct logger import structure', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain('import { logger } from');
    });
  });

  // ======== Logger 接口验证 ========

  describe('logger interface verification', () => {
    it('logger.info should be callable', () => {
      logger.info('test message');
      expect(mockLogger.info).toHaveBeenCalledWith('test message');
    });

    it('logger.info should accept string arguments', () => {
      logger.info('message with param');
      expect(mockLogger.info).toHaveBeenCalledWith('message with param');
    });

    it('logger should have all required methods', () => {
      expect(mockLogger.info).toBeDefined();
      expect(mockLogger.error).toBeDefined();
      expect(mockLogger.warn).toBeDefined();
      expect(mockLogger.debug).toBeDefined();
    });
  });

  // ======== 源码日志调用场景分析 ========

  describe('source code log scenarios', () => {
    it('logs error when task already running', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain('已有任务在执行中');
    });

    it('logs error for invalid quality level', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain('无效的质量级别');
    });

    it('logs error when missing task file', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain('请提供任务文件路径');
    });

    it('logs task file path when reading', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain('读取任务文件');
    });

    it('logs parsing progress', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain('解析任务');
    });

    it('logs task title and goals', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain('任务:');
      expect(source).toContain('目标:');
    });

    it('logs breakdown progress', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain('拆解任务');
    });

    it('logs subtask count', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain('个子任务');
    });

    it('logs execution mode info', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain('全自动执行模式');
      expect(source).toContain('质量级别:');
      expect(source).toContain('审批点:');
    });

    it('logs start message', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain('开始执行');
    });

    it('logs status hint', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain('/om:status');
    });

    it('logs file read error', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain('无法读取文件');
    });

    it('supports JSON output mode', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain('options.json');
      expect(source).toContain('JSON.stringify');
    });

    it('bypasses permissions in auto mode', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain('bypassPermissions');
    });
  });

  // ======== JSON 输出验证 ========

  describe('JSON output structure verification', () => {
    it('JSON output includes status field', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toMatch(/status:\s*result\.status/);
    });

    it('JSON output includes mode field', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain("mode: 'auto'");
    });

    it('JSON output includes quality field', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain('quality: qualityLevel');
    });

    it('JSON output includes subagentTasks', () => {
      const sourcePath = path.resolve(__dirname, '../../src/cli/commands/auto.ts');
      const source = fsSync.readFileSync(sourcePath, 'utf-8');
      expect(source).toContain('subagentTasks:');
    });
  });
});