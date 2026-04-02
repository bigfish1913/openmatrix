// src/orchestrator/git-commit-manager.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';
import type { Task } from '../types/index.js';
import { ensureOpenmatrixGitignore } from '../utils/gitignore.js';

const execAsync = promisify(exec);

export interface CommitInfo {
  taskId: string;
  taskTitle: string;
  runId: string;
  phase: 'tdd' | 'develop' | 'verify' | 'accept';
  changes: string[];
  impactScope: string[];
}

export interface CommitResult {
  success: boolean;
  commitHash?: string;
  message?: string;
  error?: string;
}

/**
 * GitCommitManager - Git 自动提交管理器
 *
 * 功能:
 * 1. 自动生成详细提交信息
 * 2. 包含任务名、修改内容、影响范围
 * 3. 支持每个子任务完成后自动提交
 */
export class GitCommitManager {
  private repoPath: string;
  private gitRoot: string | null = null;
  private enabled: boolean = true;

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = repoPath;
  }

  /**
   * 获取 git 仓库根目录（支持 .git 在父级目录的情况）
   */
  private async getGitRoot(): Promise<string> {
    if (this.gitRoot) return this.gitRoot;
    try {
      const { stdout } = await execAsync('git rev-parse --show-toplevel', { cwd: this.repoPath });
      this.gitRoot = stdout.trim();
    } catch {
      // 不是 git 仓库，回退到 repoPath
      this.gitRoot = this.repoPath;
    }
    return this.gitRoot;
  }

  /**
   * 设置是否启用自动提交
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 检查是否在 Git 仓库中
   */
  async isGitRepo(): Promise<boolean> {
    try {
      await execAsync('git rev-parse --is-inside-work-tree', { cwd: this.repoPath });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取当前分支名
   */
  async getCurrentBranch(): Promise<string> {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: this.repoPath });
    return stdout.trim();
  }

  /**
   * 获取未提交的文件列表
   */
  async getUncommittedFiles(): Promise<string[]> {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: this.repoPath });
      return stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.slice(3).trim());
    } catch {
      return [];
    }
  }

  /**
   * 获取已修改的文件差异统计
   */
  async getDiffStats(): Promise<Map<string, { additions: number; deletions: number }>> {
    const stats = new Map<string, { additions: number; deletions: number }>();

    try {
      const { stdout } = await execAsync('git diff --stat', { cwd: this.repoPath });
      const lines = stdout.split('\n').filter(l => l.trim());

      for (const line of lines) {
        const match = line.match(/^(.+?)\s+\|\s+(\d+)\s+([+-]+)/);
        if (match) {
          const file = match[1].trim();
          const changes = match[3] || '';
          stats.set(file, {
            additions: (changes.match(/\+/g) || []).length,
            deletions: (changes.match(/-/g) || []).length
          });
        }
      }
    } catch {
      // ignore
    }

    return stats;
  }

  /**
   * 分析影响范围
   */
  async analyzeImpactScope(files: string[]): Promise<string[]> {
    const scopes = new Set<string>();

    for (const file of files) {
      // 根据文件路径分析影响范围
      if (file.includes('src/cli/')) scopes.add('CLI');
      if (file.includes('src/orchestrator/')) scopes.add('Orchestrator');
      if (file.includes('src/agents/')) scopes.add('Agents');
      if (file.includes('src/storage/')) scopes.add('Storage');
      if (file.includes('src/types/')) scopes.add('Types');
      if (file.includes('skills/')) scopes.add('Skills');
      if (file.includes('docs/')) scopes.add('Documentation');
      if (file.includes('tests/')) scopes.add('Tests');
      if (file.endsWith('.md')) scopes.add('Documentation');
      if (file.endsWith('package.json')) scopes.add('Dependencies');
      if (file.endsWith('tsconfig.json')) scopes.add('TypeScript Config');
    }

    return Array.from(scopes);
  }

  /**
   * 生成提交信息
   *
   * 格式规范:
   * <type>: 简短描述
   *
   * 改动点1
   * 改动点2
   *
   * 影响范围: 模块/功能
   * 文件改动: 文件1, 文件2
   *
   * Co-Authored-By: OpenMatrix https://github.com/bigfish1913/openmatrix
   */
  generateCommitMessage(info: CommitInfo): string {
    const lines: string[] = [];

    // 类型映射：根据 phase 确定提交类型
    const phaseToType: Record<string, string> = {
      tdd: 'test',
      develop: 'feat',
      verify: 'test',
      accept: 'chore'
    };
    const commitType = phaseToType[info.phase] || 'feat';

    // 标题行 - 限制 72 字符
    let title = info.taskTitle;
    if (title.length > 60) {
      title = title.slice(0, 57) + '...';
    }

    // 格式: feat(TASK-001): 简短描述
    lines.push(`${commitType}(${info.taskId}): ${title}`);
    lines.push('');

    // Phase 描述作为改动点
    const phaseDescriptions: Record<string, string> = {
      tdd: '编写测试用例',
      develop: '实现功能代码',
      verify: '运行测试验证',
      accept: '验收检查通过'
    };
    lines.push(phaseDescriptions[info.phase] || '代码变更');

    // 影响范围
    if (info.impactScope.length > 0) {
      lines.push('');
      lines.push(`影响范围: ${info.impactScope.join('、')}`);
    }

    // 文件改动
    const changedFiles = info.changes.slice(0, 5).map(f => {
      const parts = f.split('/');
      return parts.length > 2 ? parts.slice(-2).join('/') : f;
    });
    if (changedFiles.length > 0) {
      const fileSummary = changedFiles.join(', ');
      const suffix = info.changes.length > 5 ? ` 等 ${info.changes.length} 个文件` : '';
      lines.push(`文件改动: ${fileSummary}${suffix}`);
    }

    lines.push('');

    // Co-Author
    lines.push(`Co-Authored-By: OpenMatrix https://github.com/bigfish1913/openmatrix`);

    return lines.join('\n');
  }

  /**
   * 执行提交
   */
  async commit(info: CommitInfo): Promise<CommitResult> {
    if (!this.enabled) {
      return { success: false, message: 'Auto-commit is disabled' };
    }

    try {
      // 检查是否在 Git 仓库中，如果不是则自动初始化
      if (!await this.isGitRepo()) {
        await execAsync('git init', { cwd: this.repoPath });
        this.gitRoot = this.repoPath;  // 刚初始化的仓库，根目录就是 repoPath
      }

      // 确保 .gitignore 中包含 .openmatrix（写入到 git 根目录）
      await ensureOpenmatrixGitignore(this.repoPath);

      // 获取未提交的文件
      const files = await this.getUncommittedFiles();
      if (files.length === 0) {
        return { success: false, message: 'No changes to commit' };
      }

      // 分析影响范围
      const impactScope = await this.analyzeImpactScope(files);

      // 更新 commit info
      const fullInfo: CommitInfo = {
        ...info,
        changes: files,
        impactScope: info.impactScope.length > 0 ? info.impactScope : impactScope
      };

      // 生成提交信息
      const commitMessage = this.generateCommitMessage(fullInfo);

      // 添加文件 - 使用 git add . 而不是 git add -A
      // git add . 只添加当前目录及子目录的文件，不会添加上级目录的文件
      // 同时通过 .gitignore 排除不需要的文件
      await execAsync('git add .', { cwd: this.repoPath });

      // 检查是否有文件被暂存（避免空提交）
      const { stdout: staged } = await execAsync('git diff --cached --name-only', { cwd: this.repoPath });
      if (!staged.trim()) {
        return {
          success: false,
          message: 'No files to commit (all changes ignored or no changes)'
        };
      }

      // 使用临时文件传递 commit message（避免 Windows 下多行消息转义问题）
      const tmpFile = path.join(await this.getGitRoot(), '.git', 'COMMIT_MSG_TMP');
      await fs.writeFile(tmpFile, commitMessage, 'utf-8');

      try {
        const { stdout } = await execAsync(
          `git commit -F "${tmpFile}"`,
          { cwd: this.repoPath }
        );

        // 提取 commit hash
        const hashMatch = stdout.match(/\[.+?\s+([a-f0-9]+)\]/);
        const commitHash = hashMatch ? hashMatch[1] : undefined;

        return {
          success: true,
          commitHash,
          message: `Committed ${files.length} files`
        };
      } finally {
        // 清理临时文件
        await fs.unlink(tmpFile).catch(() => {});
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 提交任务完成
   */
  async commitTaskCompletion(task: Task, runId: string): Promise<CommitResult> {
    return this.commit({
      taskId: task.id,
      taskTitle: task.title,
      runId,
      phase: 'develop',
      changes: [],
      impactScope: []
    });
  }

  /**
   * 提交验证阶段完成
   */
  async commitVerifyComplete(task: Task, runId: string, testResults: string[]): Promise<CommitResult> {
    return this.commit({
      taskId: task.id,
      taskTitle: task.title,
      runId,
      phase: 'verify',
      changes: testResults,
      impactScope: ['Tests']
    });
  }

  /**
   * 提交验收阶段完成
   */
  async commitAcceptComplete(task: Task, runId: string): Promise<CommitResult> {
    return this.commit({
      taskId: task.id,
      taskTitle: task.title,
      runId,
      phase: 'accept',
      changes: [],
      impactScope: []
    });
  }
}
