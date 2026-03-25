// tests/utils/logger.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createLogger, getLogger, setLogger, logger } from '../../src/utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import winston from 'winston';

const TEST_LOG_DIR = path.join(process.cwd(), '.openmatrix-test-logs');

describe('Logger', () => {
  beforeEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(TEST_LOG_DIR, { recursive: true, force: true });
    } catch {}
  });

  afterEach(async () => {
    // 清理测试目录
    try {
      await fs.rm(TEST_LOG_DIR, { recursive: true, force: true });
    } catch {}
  });

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
  });

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
  });

  describe('task logging helpers', () => {
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
  });

  describe('agent logging helpers', () => {
    it('should have agent.call method', () => {
      expect(typeof logger.agent.call).toBe('function');
    });

    it('should have agent.result method', () => {
      expect(typeof logger.agent.result).toBe('function');
    });
  });

  describe('approval logging helpers', () => {
    it('should have approval.request method', () => {
      expect(typeof logger.approval.request).toBe('function');
    });

    it('should have approval.decision method', () => {
      expect(typeof logger.approval.decision).toBe('function');
    });
  });

  describe('write to file', () => {
    it('should write to combined.log', async () => {
      const testLogger = createLogger({
        logDir: TEST_LOG_DIR,
        console: false
      });

      testLogger.info('Test message');

      // 等待文件写入
      await new Promise(resolve => setTimeout(resolve, 100));

      const logFile = path.join(TEST_LOG_DIR, 'combined.log');
      const exists = await fs.access(logFile).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });
});
