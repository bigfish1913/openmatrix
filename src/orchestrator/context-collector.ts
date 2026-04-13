// src/orchestrator/context-collector.ts
import * as fs from 'fs';
import * as path from 'path';

export interface DebugContext {
  state?: Record<string, unknown>;
  task?: Record<string, unknown>;
  logs?: string;
  errorStack?: string;
  projectFiles?: string[];
  envInfo?: Record<string, unknown>;
  configFiles?: string[];
  cliLogs?: string;
  systemState?: Record<string, unknown>;
}

/**
 * 根据问题类型收集上下文信息
 */
export class ContextCollector {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async collectForTaskFailure(taskId: string): Promise<DebugContext> {
    const context: DebugContext = {};

    // 读取全局状态
    const statePath = path.join(this.basePath, 'state.json');
    if (fs.existsSync(statePath)) {
      try {
        context.state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      } catch { /* ignore */ }
    }

    // 读取任务文件
    const taskPath = path.join(this.basePath, 'tasks', `${taskId}.json`);
    if (fs.existsSync(taskPath)) {
      try {
        context.task = JSON.parse(fs.readFileSync(taskPath, 'utf-8'));
      } catch { /* ignore */ }
    }

    // 读取日志
    const logPath = path.join(this.basePath, 'logs');
    if (fs.existsSync(logPath)) {
      try {
        const files = fs.readdirSync(logPath);
        const logs = files
          .filter(f => f.endsWith('.log') || f.includes(taskId))
          .map(f => fs.readFileSync(path.join(logPath, f), 'utf-8'))
          .join('\n---\n');
        if (logs) context.logs = logs;
      } catch { /* ignore */ }
    }

    return context;
  }

  async collectForProjectBug(): Promise<DebugContext> {
    const context: DebugContext = {};

    // 扫描项目关键文件
    const projectRoot = path.resolve(this.basePath, '..');
    const scanDirs = ['src', 'lib', 'app', 'server', 'api', 'controllers', 'routes'];
    const projectFiles: string[] = [];

    for (const dir of scanDirs) {
      const fullPath = path.join(projectRoot, dir);
      if (fs.existsSync(fullPath)) {
        const files = this.scanFiles(fullPath, ['.ts', '.js', '.tsx', '.jsx'], 2);
        projectFiles.push(...files);
      }
    }

    if (projectFiles.length > 0) {
      context.projectFiles = projectFiles.slice(0, 50);
    }

    return context;
  }

  async collectForEnvironment(): Promise<DebugContext> {
    const context: DebugContext = {};

    // 收集环境信息
    const envInfo: Record<string, unknown> = {
      nodeVersion: process.version,
      platform: process.platform,
      cwd: process.cwd(),
      envVars: Object.keys(process.env).slice(0, 20)
    };
    context.envInfo = envInfo;

    // 扫描配置文件
    const projectRoot = path.resolve(this.basePath, '..');
    const configFiles = [
      'package.json',
      'tsconfig.json',
      '.env',
      '.env.local',
      'config.json',
      'webpack.config.js',
      'vite.config.ts',
      '.openmatrix/state.json'
    ];

    const found: string[] = [];
    for (const file of configFiles) {
      const fullPath = path.join(projectRoot, file);
      if (fs.existsSync(fullPath)) {
        found.push(file);
      }
    }

    if (found.length > 0) {
      context.configFiles = found;
    }

    return context;
  }

  async collectForSystemBug(): Promise<DebugContext> {
    const context: DebugContext = {};

    // 读取系统状态
    const statePath = path.join(this.basePath, 'state.json');
    if (fs.existsSync(statePath)) {
      try {
        context.systemState = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
      } catch { /* ignore */ }
    }

    return context;
  }

  private scanFiles(dir: string, extensions: string[], maxDepth: number, currentDepth = 0): string[] {
    if (currentDepth > maxDepth) return [];

    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            results.push(...this.scanFiles(fullPath, extensions, maxDepth, currentDepth + 1));
          }
        } else if (extensions.some(ext => entry.name.endsWith(ext))) {
          results.push(fullPath.replace(process.cwd() + path.sep, ''));
        }
      }
    } catch { /* ignore */ }

    return results;
  }
}
