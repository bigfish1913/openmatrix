// src/utils/error-handler.ts
import { getLogger } from './logger.js';
import type { Logger } from 'winston';

/**
 * 错误上下文信息
 */
export interface ErrorContext {
  operation: string;
  file?: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 将任意错误转换为 Error 对象并保留 stack trace
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === 'string') {
    return new Error(error);
  }
  return new Error(JSON.stringify(error));
}

/**
 * 记录错误日志（保留 stack trace）
 */
export function logError(error: unknown, context: ErrorContext): void {
  const err = toError(error);
  const logger = getLogger();

  logger.error({
    message: err.message,
    stack: err.stack,
    operation: context.operation,
    file: context.file,
    taskId: context.taskId,
    ...context.metadata,
    timestamp: new Date().toISOString()
  });
}

/**
 * 包装错误，添加上下文信息到错误消息
 */
export function wrapError(error: unknown, context: ErrorContext): Error {
  const err = toError(error);
  const wrapped = new Error(`${context.operation}: ${err.message}`);
  wrapped.stack = err.stack;
  wrapped.cause = err;
  return wrapped;
}

/**
 * 包装并抛出错误
 */
export function throwWrapped(error: unknown, context: ErrorContext): never {
  throw wrapError(error, context);
}

/**
 * 安全执行函数，捕获并记录错误但不抛出
 * @returns 返回值或 null（如果发生错误）
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  context: ErrorContext
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    logError(error, context);
    return null;
  }
}

/**
 * 安全执行同步函数
 */
export function safeExecuteSync<T>(
  fn: () => T,
  context: ErrorContext
): T | null {
  try {
    return fn();
  } catch (error) {
    logError(error, context);
    return null;
  }
}

/**
 * 执行函数，捕获错误并包装后抛出
 */
export async function executeWithError<T>(
  fn: () => Promise<T>,
  context: ErrorContext
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throwWrapped(error, context);
  }
}

/**
 * 判断错误是否可恢复（如网络超时、临时文件锁等）
 */
export function isRecoverableError(error: unknown): boolean {
  const err = toError(error);
  const recoverablePatterns = [
    /timeout/i,
    /temporarily unavailable/i,
    /ECONNRESET/i,
    /ENOTFOUND/i,
    /lock/i,
    /retry/i
  ];
  return recoverablePatterns.some(p => p.test(err.message));
}

/**
 * 判断错误是否为文件系统错误
 */
export function isFileSystemError(error: unknown): boolean {
  const err = toError(error);
  const fsPatterns = [
    /ENOENT/i,
    /EACCES/i,
    /EPERM/i,
    /EISDIR/i,
    /ENOTDIR/i,
    /EMFILE/i
  ];
  return fsPatterns.some(p => p.test(err.message));
}