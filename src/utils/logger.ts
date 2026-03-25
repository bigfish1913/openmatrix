// src/utils/logger.ts
import winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';

export interface LoggerOptions {
  level?: string;
  logDir?: string;
  console?: boolean;
}

/**
 * OpenMatrix Logger - 基于 Winston 的日志系统
 *
 * 特性:
 * 1. 多级别日志 (error, warn, info, debug)
 * 2. 文件滚动日志
 * 3. 控制台彩色输出
 * 4. 结构化 JSON 日志
 */
let defaultLogger: winston.Logger | null = null;

/**
 * 创建或获取默认 Logger
 */
export function createLogger(options: LoggerOptions = {}): winston.Logger {
  const {
    level = process.env.OPENMATRIX_LOG_LEVEL || 'info',
    logDir = '.openmatrix/logs',
    console: enableConsole = true
  } = options;

  // 确保日志目录存在
  const absoluteLogDir = path.resolve(process.cwd(), logDir);
  if (!fs.existsSync(absoluteLogDir)) {
    fs.mkdirSync(absoluteLogDir, { recursive: true });
  }

  // 定义日志格式
  const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, ...metadata }) => {
      const metaStr = Object.keys(metadata).length ? JSON.stringify(metadata) : '';
      return `${timestamp} [${level.toUpperCase()}] ${message} ${metaStr}`;
    })
  );

  // JSON 格式 (用于文件)
  const jsonFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  );

  // 控制台格式 (带颜色)
  const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp, ...metadata }) => {
      const metaStr = Object.keys(metadata).length ? JSON.stringify(metadata) : '';
      return `${timestamp} ${level} ${message} ${metaStr}`;
    })
  );

  // 创建 transports
  const transports: winston.transport[] = [];

  // 文件日志
  transports.push(
    new winston.transports.File({
      filename: path.join(absoluteLogDir, 'error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5
    })
  );

  transports.push(
    new winston.transports.File({
      filename: path.join(absoluteLogDir, 'combined.log'),
      format: jsonFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10
    })
  );

  // 控制台日志
  if (enableConsole) {
    transports.push(
      new winston.transports.Console({
        format: consoleFormat,
        level
      })
    );
  }

  // 创建 logger
  const logger = winston.createLogger({
    level,
    defaultMeta: { service: 'openmatrix' },
    transports
  });

  return logger;
}

/**
 * 获取默认 logger 实例
 */
export function getLogger(): winston.Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger();
  }
  return defaultLogger;
}

/**
 * 设置默认 logger
 */
export function setLogger(logger: winston.Logger): void {
  defaultLogger = logger;
}

/**
 * 便捷方法: 直接记录日志
 */
export const logger = {
  info: (message: string, meta?: any) => getLogger().info(message, meta),
  error: (message: string, meta?: any) => getLogger().error(message, meta),
  warn: (message: string, meta?: any) => getLogger().warn(message, meta),
  debug: (message: string, meta?: any) => getLogger().debug(message, meta),

  // 任务相关日志
  task: {
    start: (taskId: string, title: string) => {
      getLogger().info(`Task started: ${taskId}`, { taskId, title });
    },
    complete: (taskId: string, duration?: number) => {
      getLogger().info(`Task completed: ${taskId}`, { taskId, duration });
    },
    fail: (taskId: string, error: string) => {
      getLogger().error(`Task failed: ${taskId}`, { taskId, error });
    },
    retry: (taskId: string, attempt: number) => {
      getLogger().warn(`Task retry: ${taskId}`, { taskId, attempt });
    }
  },

  // Agent 相关日志
  agent: {
    call: (agentType: string, taskId: string) => {
      getLogger().info(`Agent called: ${agentType}`, { agentType, taskId });
    },
    result: (agentType: string, taskId: string, success: boolean) => {
      getLogger().debug(`Agent result: ${agentType}`, { agentType, taskId, success });
    }
  },

  // 审批相关日志
  approval: {
    request: (approvalId: string, type: string) => {
      getLogger().info(`Approval requested: ${approvalId}`, { approvalId, type });
    },
    decision: (approvalId: string, decision: string) => {
      getLogger().info(`Approval decision: ${approvalId}`, { approvalId, decision });
    }
  }
};
