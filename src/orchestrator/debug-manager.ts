// src/orchestrator/debug-manager.ts
import * as fs from 'fs';
import * as path from 'path';
import type { DebugSession, DiagnosisReport, ProblemType } from '../types/index.js';
import type { DebugContext } from './context-collector.js';
import { ProblemDetector } from './problem-detector.js';
import { ContextCollector } from './context-collector.js';
import { DebugReporter } from './debug-reporter.js';

export interface DebugConfig {
  description?: string;
  taskId?: string;
  diagnoseOnly?: boolean;
}

export interface DebugInitResult {
  sessionId: string;
  status: string;
  problemType: ProblemType;
  report: Partial<DiagnosisReport>;
}

/**
 * 调试管理器 - 协调整个调试流程
 */
export class DebugManager {
  private omPath: string;
  private detector: ProblemDetector;
  private collector: ContextCollector;
  private reporter: DebugReporter;

  constructor(omPath: string) {
    this.omPath = omPath;
    this.detector = new ProblemDetector();
    this.collector = new ContextCollector(omPath);
    this.reporter = new DebugReporter(omPath);
  }

  /**
   * 初始化调试会话
   */
  async initialize(config: DebugConfig): Promise<DebugInitResult> {
    // 如果有任务 ID，尝试读取任务信息
    let taskError: string | null = null;
    if (config.taskId) {
      taskError = await this.getTaskError(config.taskId);
    }

    // 判断问题类型
    const problemType = await this.detector.detect({
      description: config.description,
      taskId: config.taskId,
      taskError
    });

    // 收集上下文
    const context = await this.collectContext(problemType, config);

    // 创建会话
    const sessionId = this.generateSessionId();
    const session: DebugSession = {
      id: sessionId,
      status: config.diagnoseOnly ? 'initialized' : 'diagnosing',
      report: {
        id: sessionId,
        problemType,
        trigger: config.taskId ? 'auto' : 'explicit',
        description: config.description || `调试任务 ${config.taskId}`,
        relatedTaskId: config.taskId,
        errorInfo: taskError ? {
          message: taskError,
          timestamp: new Date().toISOString()
        } : undefined,
        relatedFiles: (context.projectFiles as string[] | undefined) || [],
        rootCause: '', // 由 Skill 阶段 Agent 填充
        impactScope: [],
        suggestedFix: '', // 由 Skill 阶段 Agent 填充
        diagnosedAt: new Date().toISOString()
      },
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 持久化会话
    this.saveSession(session);

    return {
      sessionId,
      status: session.status,
      problemType,
      report: {
        description: session.report.description,
        relatedTaskId: session.report.relatedTaskId,
        relatedFiles: session.report.relatedFiles,
        errorInfo: session.report.errorInfo
      }
    };
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): DebugSession | null {
    const sessionPath = this.getSessionPath(sessionId);
    if (!fs.existsSync(sessionPath)) return null;

    try {
      return JSON.parse(fs.readFileSync(sessionPath, 'utf-8'));
    } catch {
      return null;
    }
  }

  /**
   * 更新会话
   */
  updateSession(sessionId: string, updates: Partial<DebugSession>): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    Object.assign(session, updates, { updatedAt: new Date().toISOString() });
    this.saveSession(session);
  }

  /**
   * 完成会话
   */
  async completeSession(sessionId: string): Promise<string | null> {
    const session = this.getSession(sessionId);
    if (!session) return null;

    session.status = 'completed';
    session.completedAt = new Date().toISOString();
    this.saveSession(session);

    return await this.reporter.generateReport(session);
  }

  /**
   * 列出最近的调试会话
   */
  listRecent(): { id: string; status: string; description: string; createdAt: string }[] {
    const debugDir = path.join(this.omPath, 'debug');
    if (!fs.existsSync(debugDir)) return [];

    const files = fs.readdirSync(debugDir)
      .filter(f => f.endsWith('.json') && f.startsWith('DEBUG-'))
      .sort()
      .reverse()
      .slice(0, 10);

    return files.map(f => {
      const session = JSON.parse(fs.readFileSync(path.join(debugDir, f), 'utf-8')) as DebugSession;
      return {
        id: session.id,
        status: session.status,
        description: session.report.description,
        createdAt: session.createdAt
      };
    });
  }

  private async collectContext(problemType: ProblemType, config: DebugConfig): Promise<DebugContext> {
    switch (problemType) {
      case 'task_failure':
        return config.taskId ? await this.collector.collectForTaskFailure(config.taskId) : {};
      case 'project_bug':
        return await this.collector.collectForProjectBug();
      case 'environment':
        return await this.collector.collectForEnvironment();
      case 'system_bug':
        return await this.collector.collectForSystemBug();
      default:
        return {};
    }
  }

  private async getTaskError(taskId: string): Promise<string | null> {
    const taskPath = path.join(this.omPath, 'tasks', `${taskId}.json`);
    if (!fs.existsSync(taskPath)) return null;

    try {
      const task = JSON.parse(fs.readFileSync(taskPath, 'utf-8'));
      return task.error || null;
    } catch {
      return null;
    }
  }

  private saveSession(session: DebugSession): void {
    const debugDir = path.join(this.omPath, 'debug');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    const sessionPath = this.getSessionPath(session.id);
    fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
  }

  private getSessionPath(sessionId: string): string {
    return path.join(this.omPath, 'debug', `${sessionId}.json`);
  }

  private generateSessionId(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `DEBUG-${timestamp}${random}`;
  }
}
