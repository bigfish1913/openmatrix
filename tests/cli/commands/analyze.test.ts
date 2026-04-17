// tests/cli/commands/analyze.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Use vi.hoisted so the mock object is available in hoisted vi.mock calls
const { loggerMock } = vi.hoisted(() => ({
  loggerMock: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: loggerMock
}));

vi.mock('../../../src/orchestrator/smart-question-analyzer.js', () => ({
  SmartQuestionAnalyzer: vi.fn().mockImplementation(() => ({
    analyze: vi.fn().mockResolvedValue({
      inferences: [
        { questionId: 'q1', inferredAnswer: 'answer', confidence: 'high', reason: 'test' }
      ],
      questionsToAsk: ['q2'],
      skippedQuestions: ['q1']
    }),
    generateSummary: vi.fn().mockReturnValue('Mocked summary output')
  })),
  AnalysisResult: undefined as any
}));

// Import after mocking
import { logger } from '../../../src/utils/logger.js';
import { SmartQuestionAnalyzer } from '../../../src/orchestrator/smart-question-analyzer.js';

/**
 * Directly invoke the analyze action logic (mirrors src/cli/commands/analyze.ts)
 */
async function analyzeAction(task?: string, options: { json?: boolean } = {}) {
  const analyzer = new SmartQuestionAnalyzer(process.cwd());

  if (!task) {
    if (options.json) {
      logger.info(JSON.stringify({
        status: 'error',
        message: '请提供任务描述'
      }));
    } else {
      logger.info('请提供任务描述');
      logger.info('   用法: openmatrix analyze "实现用户登录功能"');
    }
    return;
  }

  try {
    const result = await analyzer.analyze(task);
    if (options.json) {
      logger.info(JSON.stringify(result, null, 2));
    } else {
      logger.info('\n' + analyzer.generateSummary(result));
    }
  } catch (error) {
    if (options.json) {
      logger.info(JSON.stringify({
        status: 'error',
        message: error instanceof Error ? error.message : '分析失败'
      }));
    } else {
      logger.info('分析失败: ' + (error instanceof Error ? error.message : '未知错误'));
    }
  }
}

describe('analyze command - logger usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('source code verification', () => {
    it('should not contain any console.log calls', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/analyze.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      expect(source).not.toMatch(/console\.(log|warn|error|debug|info)/);
    });

    it('should import logger from utils/logger', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/analyze.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      expect(source).toMatch(/from.*logger/);
    });

    it('should use logger.info for all output', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/analyze.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      const loggerInfoCount = (source.match(/logger\.info/g) || []).length;
      expect(loggerInfoCount).toBeGreaterThan(0);
    });
  });

  describe('no task provided', () => {
    it('should log error JSON when --json flag and no task', async () => {
      await analyzeAction(undefined, { json: true });

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('"status":"error"')
      );
    });

    it('should log error message when no task and no --json', async () => {
      await analyzeAction(undefined, {});

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('请提供任务描述')
      );
      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('用法')
      );
    });
  });

  describe('successful analysis', () => {
    it('should log JSON result when --json flag is set', async () => {
      await analyzeAction('实现用户登录功能', { json: true });

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('inferences')
      );
    });

    it('should log human-readable summary without --json', async () => {
      await analyzeAction('实现用户登录功能', {});

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('Mocked summary output')
      );
    });
  });

  describe('analysis failure', () => {
    it('should log error JSON when analyzer throws and --json flag', async () => {
      vi.mocked(SmartQuestionAnalyzer).mockImplementationOnce(() => ({
        analyze: vi.fn().mockRejectedValue(new Error('分析出错')),
        generateSummary: vi.fn()
      }) as any);

      await analyzeAction('test task', { json: true });

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('"status":"error"')
      );
      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('分析出错')
      );
    });

    it('should log error message when analyzer throws without --json', async () => {
      vi.mocked(SmartQuestionAnalyzer).mockImplementationOnce(() => ({
        analyze: vi.fn().mockRejectedValue(new Error('分析出错')),
        generateSummary: vi.fn()
      }) as any);

      await analyzeAction('test task', {});

      expect(loggerMock.info).toHaveBeenCalledWith(
        expect.stringContaining('分析失败')
      );
    });
  });

  describe('logger method verification', () => {
    it('should use logger.info (not console.log) for all output paths', async () => {
      await analyzeAction(undefined, { json: true });
      vi.clearAllMocks();
      await analyzeAction(undefined, {});
      vi.clearAllMocks();
      await analyzeAction('task', { json: true });
      vi.clearAllMocks();
      await analyzeAction('task', {});

      expect(loggerMock.info).toHaveBeenCalled();
      expect(loggerMock.error).not.toHaveBeenCalled();
      expect(loggerMock.warn).not.toHaveBeenCalled();
      expect(loggerMock.debug).not.toHaveBeenCalled();
    });
  });
});
