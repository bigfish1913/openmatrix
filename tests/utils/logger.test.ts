// tests/utils/logger.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLogger, getLogger, setLogger, logger, persistLog, initLoggerWithRunId, type StructuredLog } from '../../src/utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import winston from 'winston';

describe('Logger', () => {
  const TEST_LOG_DIR = path.join(process.cwd(), '.openmatrix-test-logs');

  beforeEach(async () => {
    // Reset default logger before each test
    setLogger(null as any);
    try {
      await fs.rm(TEST_LOG_DIR, { recursive: true, force: true });
    } catch {}
  });

  afterEach(async () => {
    try {
      await fs.rm(TEST_LOG_DIR, { recursive: true, force: true });
    } catch {}
  });

  // ============ createLogger ============

  describe('createLogger', () => {
    it('should create logger with default options', () => {
      const testLogger = createLogger({ logDir: TEST_LOG_DIR });

      expect(testLogger).toBeDefined();
      expect(testLogger.level).toBe('info');
    });

    it('should create logger with custom level', () => {
      const testLogger = createLogger({
        level: 'debug',
        logDir: TEST_LOG_DIR
      });

      expect(testLogger.level).toBe('debug');
    });

    it('should respect OPENMATRIX_LOG_LEVEL env var', () => {
      const origEnv = process.env.OPENMATRIX_LOG_LEVEL;
      process.env.OPENMATRIX_LOG_LEVEL = 'debug';
      try {
        const testLogger = createLogger({ logDir: TEST_LOG_DIR });
        expect(testLogger.level).toBe('debug');
      } finally {
        if (origEnv === undefined) {
          delete process.env.OPENMATRIX_LOG_LEVEL;
        } else {
          process.env.OPENMATRIX_LOG_LEVEL = origEnv;
        }
      }
    });

    it('should create log directory', async () => {
      createLogger({ logDir: TEST_LOG_DIR });

      const exists = await fs.access(TEST_LOG_DIR).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should have file transports', () => {
      const testLogger = createLogger({ logDir: TEST_LOG_DIR });

      const fileTransports = testLogger.transports.filter(
        t => t instanceof winston.transports.File
      );
      expect(fileTransports.length).toBeGreaterThanOrEqual(2); // error.log + combined.log
    });

    it('should have console transport when enabled', () => {
      const testLogger = createLogger({
        logDir: TEST_LOG_DIR,
        console: true
      });

      const consoleTransports = testLogger.transports.filter(
        t => t instanceof winston.transports.Console
      );
      expect(consoleTransports.length).toBe(1);
    });

    it('should not have console transport when disabled', () => {
      const testLogger = createLogger({
        logDir: TEST_LOG_DIR,
        console: false
      });

      const consoleTransports = testLogger.transports.filter(
        t => t instanceof winston.transports.Console
      );
      expect(consoleTransports.length).toBe(0);
    });

    it('should include runId in defaultMeta when provided', () => {
      const testLogger = createLogger({ logDir: TEST_LOG_DIR, runId: 'test-run-123' });
      expect(testLogger.defaultMeta).toHaveProperty('runId', 'test-run-123');
    });

    it('should have service in defaultMeta', () => {
      const testLogger = createLogger({ logDir: TEST_LOG_DIR });
      expect(testLogger.defaultMeta).toHaveProperty('service', 'openmatrix');
    });
  });

  // ============ getLogger / setLogger ============

  describe('getLogger', () => {
    it('should return default logger', () => {
      const testLogger = getLogger();
      expect(testLogger).toBeDefined();
      expect(testLogger).toBeInstanceOf(winston.Logger);
    });

    it('should return same instance on multiple calls', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      expect(logger1).toBe(logger2);
    });
  });

  describe('setLogger', () => {
    it('should set custom logger as default', () => {
      const customLogger = createLogger({
        level: 'debug',
        logDir: TEST_LOG_DIR,
        console: false
      });

      setLogger(customLogger);

      const defaultLogger = getLogger();
      expect(defaultLogger.level).toBe('debug');
    });
  });

  // ============ Convenience methods ============

  describe('logger convenience methods', () => {
    it('should have info method', () => {
      expect(typeof logger.info).toBe('function');
    });

    it('should have error method', () => {
      expect(typeof logger.error).toBe('function');
    });

    it('should have warn method', () => {
      expect(typeof logger.warn).toBe('function');
    });

    it('should have debug method', () => {
      expect(typeof logger.debug).toBe('function');
    });

    it('should call underlying winston logger for info', () => {
      const customLogger = createLogger({ logDir: TEST_LOG_DIR, console: false });
      setLogger(customLogger);
      // Should not throw
      expect(() => logger.info('test message', { key: 'value' })).not.toThrow();
    });

    it('should call underlying winston logger for error', () => {
      const customLogger = createLogger({ logDir: TEST_LOG_DIR, console: false });
      setLogger(customLogger);
      expect(() => logger.error('error message')).not.toThrow();
    });
  });

  // ============ Task logging helpers ============

  describe('task logging helpers', () => {
    beforeEach(() => {
      setLogger(createLogger({ logDir: TEST_LOG_DIR, console: false }));
    });

    it('should have task.start method', () => {
      expect(typeof logger.task.start).toBe('function');
    });

    it('should have task.complete method', () => {
      expect(typeof logger.task.complete).toBe('function');
    });

    it('should have task.fail method', () => {
      expect(typeof logger.task.fail).toBe('function');
    });

    it('should have task.retry method', () => {
      expect(typeof logger.task.retry).toBe('function');
    });

    it('should have task.timeout method', () => {
      expect(typeof logger.task.timeout).toBe('function');
    });

    it('should not throw when calling task.start', () => {
      expect(() => logger.task.start('TASK-001', 'Test title')).not.toThrow();
    });

    it('should not throw when calling task.complete with duration', () => {
      expect(() => logger.task.complete('TASK-001', 5000)).not.toThrow();
    });

    it('should not throw when calling task.complete without duration', () => {
      expect(() => logger.task.complete('TASK-001')).not.toThrow();
    });

    it('should not throw when calling task.fail', () => {
      expect(() => logger.task.fail('TASK-001', 'Something went wrong')).not.toThrow();
    });

    it('should not throw when calling task.retry', () => {
      expect(() => logger.task.retry('TASK-001', 2)).not.toThrow();
    });

    it('should not throw when calling task.timeout with omPath', async () => {
      const omPath = await fs.mkdtemp(path.join(os.tmpdir(), 'om-log-test-'));
      try {
        expect(() => logger.task.timeout('TASK-001', 300, 'develop', omPath)).not.toThrow();
      } finally {
        await fs.rm(omPath, { recursive: true, force: true });
      }
    });
  });

  // ============ Agent logging helpers ============

  describe('agent logging helpers', () => {
    beforeEach(() => {
      setLogger(createLogger({ logDir: TEST_LOG_DIR, console: false }));
    });

    it('should have agent.call method', () => {
      expect(typeof logger.agent.call).toBe('function');
    });

    it('should have agent.result method', () => {
      expect(typeof logger.agent.result).toBe('function');
    });

    it('should not throw when calling agent.call', () => {
      expect(() => logger.agent.call('coder', 'TASK-001')).not.toThrow();
    });

    it('should not throw when calling agent.result', () => {
      expect(() => logger.agent.result('coder', 'TASK-001', true)).not.toThrow();
      expect(() => logger.agent.result('coder', 'TASK-001', false)).not.toThrow();
    });
  });

  // ============ Approval logging helpers ============

  describe('approval logging helpers', () => {
    beforeEach(() => {
      setLogger(createLogger({ logDir: TEST_LOG_DIR, console: false }));
    });

    it('should have approval.request method', () => {
      expect(typeof logger.approval.request).toBe('function');
    });

    it('should have approval.decision method', () => {
      expect(typeof logger.approval.decision).toBe('function');
    });

    it('should not throw when calling approval.request', () => {
      expect(() => logger.approval.request('approval-1', 'plan')).not.toThrow();
    });

    it('should not throw when calling approval.decision', () => {
      expect(() => logger.approval.decision('approval-1', 'approve')).not.toThrow();
    });
  });

  // ============ Orchestration logging helpers ============

  describe('orchestration logging helpers', () => {
    beforeEach(() => {
      setLogger(createLogger({ logDir: TEST_LOG_DIR, console: false }));
    });

    it('should have orchestration.breakdown method', () => {
      expect(typeof logger.orchestration.breakdown).toBe('function');
    });

    it('should have orchestration.schedule method', () => {
      expect(typeof logger.orchestration.schedule).toBe('function');
    });

    it('should have orchestration.dependencyResolved method', () => {
      expect(typeof logger.orchestration.dependencyResolved).toBe('function');
    });

    it('should not throw when calling orchestration.breakdown', () => {
      expect(() => logger.orchestration.breakdown(3, ['mod1', 'mod2', 'mod3'])).not.toThrow();
    });

    it('should not throw when calling orchestration.breakdown with omPath', async () => {
      const omPath = await fs.mkdtemp(path.join(os.tmpdir(), 'om-orch-test-'));
      try {
        expect(() => logger.orchestration.breakdown(2, ['a', 'b'], omPath)).not.toThrow();
      } finally {
        await fs.rm(omPath, { recursive: true, force: true });
      }
    });

    it('should not throw when calling orchestration.schedule', () => {
      expect(() => logger.orchestration.schedule('TASK-001', ['TASK-000'])).not.toThrow();
    });

    it('should not throw when calling orchestration.dependencyResolved', () => {
      expect(() => logger.orchestration.dependencyResolved('TASK-001')).not.toThrow();
    });
  });

  // ============ Structured logging helpers ============

  describe('structured logging helpers', () => {
    beforeEach(() => {
      setLogger(createLogger({ logDir: TEST_LOG_DIR, console: false }));
    });

    it('should have structured.info method', () => {
      expect(typeof logger.structured.info).toBe('function');
    });

    it('should have structured.error method', () => {
      expect(typeof logger.structured.error).toBe('function');
    });

    it('should have structured.warn method', () => {
      expect(typeof logger.structured.warn).toBe('function');
    });

    it('should not throw when calling structured.info without omPath', () => {
      expect(() => logger.structured.info('testOp', 'test message')).not.toThrow();
    });

    it('should not throw when calling structured.info with omPath', async () => {
      const omPath = await fs.mkdtemp(path.join(os.tmpdir(), 'om-struct-test-'));
      try {
        expect(() => logger.structured.info('testOp', 'test message', { key: 'val' }, omPath)).not.toThrow();
      } finally {
        await fs.rm(omPath, { recursive: true, force: true });
      }
    });

    it('should not throw when calling structured.error', () => {
      expect(() => logger.structured.error('errorOp', 'error msg')).not.toThrow();
    });

    it('should not throw when calling structured.warn', () => {
      expect(() => logger.structured.warn('warnOp', 'warn msg')).not.toThrow();
    });
  });

  // ============ persistLog ============

  describe('persistLog', () => {
    it('should persist structured log to file', async () => {
      const omPath = await fs.mkdtemp(path.join(os.tmpdir(), 'om-persist-test-'));
      try {
        const log: StructuredLog = {
          level: 'info',
          runId: 'run-123',
          operation: 'test',
          message: 'test message',
          metadata: { key: 'value' },
          timestamp: new Date().toISOString()
        };

        persistLog(log, omPath);

        const logFile = path.join(omPath, 'logs', 'run-123.log');
        const content = await fs.readFile(logFile, 'utf-8');
        const parsed = JSON.parse(content.trim());
        expect(parsed.level).toBe('info');
        expect(parsed.runId).toBe('run-123');
        expect(parsed.operation).toBe('test');
        expect(parsed.message).toBe('test message');
        expect(parsed.metadata).toEqual({ key: 'value' });
      } finally {
        await fs.rm(omPath, { recursive: true, force: true });
      }
    });

    it('should use default filename when no runId', async () => {
      const omPath = await fs.mkdtemp(path.join(os.tmpdir(), 'om-persist-no-runid-'));
      try {
        const log: StructuredLog = {
          level: 'info',
          operation: 'test',
          message: 'no runId',
          timestamp: new Date().toISOString()
        };

        persistLog(log, omPath);

        const logFile = path.join(omPath, 'logs', 'default.log');
        const exists = await fs.access(logFile).then(() => true).catch(() => false);
        expect(exists).toBe(true);
      } finally {
        await fs.rm(omPath, { recursive: true, force: true });
      }
    });

    it('should append multiple logs to same file', async () => {
      const omPath = await fs.mkdtemp(path.join(os.tmpdir(), 'om-persist-append-'));
      try {
        const log1: StructuredLog = {
          level: 'info',
          runId: 'run-append',
          operation: 'op1',
          message: 'first',
          timestamp: new Date().toISOString()
        };
        const log2: StructuredLog = {
          level: 'error',
          runId: 'run-append',
          operation: 'op2',
          message: 'second',
          timestamp: new Date().toISOString()
        };

        persistLog(log1, omPath);
        persistLog(log2, omPath);

        const logFile = path.join(omPath, 'logs', 'run-append.log');
        const content = await fs.readFile(logFile, 'utf-8');
        const lines = content.trim().split('\n');
        expect(lines).toHaveLength(2);
        expect(JSON.parse(lines[0]).message).toBe('first');
        expect(JSON.parse(lines[1]).message).toBe('second');
      } finally {
        await fs.rm(omPath, { recursive: true, force: true });
      }
    });

    it('should not throw when persistLog fails', () => {
      // Passing an invalid path should not throw
      expect(() => persistLog({
        level: 'info',
        operation: 'test',
        message: 'test',
        timestamp: new Date().toISOString()
      }, '/nonexistent/path/that/does/not/exist')).not.toThrow();
    });
  });

  // ============ initLoggerWithRunId ============

  describe('initLoggerWithRunId', () => {
    it('should initialize logger with runId', () => {
      initLoggerWithRunId('test-run-abc');
      const initialized = getLogger();
      expect(initialized.defaultMeta).toHaveProperty('runId', 'test-run-abc');
    });

    it('should initialize logger with runId and persist init log', async () => {
      const omPath = await fs.mkdtemp(path.join(os.tmpdir(), 'om-init-test-'));
      try {
        initLoggerWithRunId('test-run-init', omPath);

        const logFile = path.join(omPath, 'logs', 'test-run-init.log');
        const exists = await fs.access(logFile).then(() => true).catch(() => false);
        expect(exists).toBe(true);

        const content = await fs.readFile(logFile, 'utf-8');
        const parsed = JSON.parse(content.trim());
        expect(parsed.operation).toBe('init');
        expect(parsed.message).toBe('Logger initialized');
      } finally {
        await fs.rm(omPath, { recursive: true, force: true });
      }
    });

    it('should initialize logger with runId without omPath', () => {
      expect(() => initLoggerWithRunId('test-run-no-om')).not.toThrow();
    });
  });

  // ============ File transport ============

  describe('write to file', () => {
    it('should write to combined.log', async () => {
      const testLogger = createLogger({
        logDir: TEST_LOG_DIR,
        console: false
      });

      testLogger.info('Test message');

      // Wait for file write
      await new Promise(resolve => setTimeout(resolve, 200));

      const logFile = path.join(TEST_LOG_DIR, 'combined.log');
      const exists = await fs.access(logFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should write to error.log for error level', async () => {
      const testLogger = createLogger({
        logDir: TEST_LOG_DIR,
        console: false
      });

      testLogger.error('Test error message');

      await new Promise(resolve => setTimeout(resolve, 200));

      const logFile = path.join(TEST_LOG_DIR, 'error.log');
      const exists = await fs.access(logFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  // ============ StructuredLog interface conformance ============

  describe('StructuredLog interface', () => {
    it('should create valid StructuredLog with all required fields', () => {
      const log: StructuredLog = {
        level: 'info',
        operation: 'test',
        message: 'test message',
        timestamp: new Date().toISOString()
      };
      expect(log.level).toBe('info');
      expect(log.operation).toBe('test');
      expect(log.message).toBe('test message');
      expect(log.timestamp).toBeDefined();
    });

    it('should create valid StructuredLog with optional fields', () => {
      const log: StructuredLog = {
        level: 'error',
        runId: 'run-001',
        taskId: 'TASK-001',
        operation: 'taskExecution',
        message: 'Task failed',
        metadata: { reason: 'timeout', attempt: 3 },
        timestamp: new Date().toISOString()
      };
      expect(log.runId).toBe('run-001');
      expect(log.taskId).toBe('TASK-001');
      expect(log.metadata).toEqual({ reason: 'timeout', attempt: 3 });
    });

    it('should accept all valid levels', () => {
      const levels: Array<StructuredLog['level']> = ['info', 'warn', 'error', 'debug'];
      for (const level of levels) {
        const log: StructuredLog = {
          level,
          operation: 'test',
          message: `${level} message`,
          timestamp: new Date().toISOString()
        };
        expect(log.level).toBe(level);
      }
    });
  });

  // ============ LoggerOptions interface conformance ============

  describe('LoggerOptions', () => {
    it('should create logger with all options specified', () => {
      const testLogger = createLogger({
        level: 'warn',
        logDir: TEST_LOG_DIR,
        console: false,
        runId: 'run-full-options'
      });
      expect(testLogger.level).toBe('warn');
      expect(testLogger.defaultMeta).toHaveProperty('runId', 'run-full-options');
    });

    it('should create logger with empty options', () => {
      const testLogger = createLogger();
      expect(testLogger).toBeDefined();
      expect(testLogger.level).toBeDefined();
    });
  });
});
