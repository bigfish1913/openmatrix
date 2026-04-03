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
   * 获取未提交的文件列表（带状态信息）
   */
  async getUncommittedFilesWithStatus(): Promise<{ status: 'new' | 'modified' | 'deleted'; path: string }[]> {
    try {
      const { stdout } = await execAsync('git status --porcelain', { cwd: this.repoPath });
      return stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const statusCode = line.slice(0, 2);
          const filePath = line.slice(3).trim();
          let status: 'new' | 'modified' | 'deleted' = 'modified';
          if (statusCode.includes('?') || statusCode.includes('A')) {
            status = 'new';
          } else if (statusCode.includes('D')) {
            status = 'deleted';
          }
          return { status, path: filePath };
        });
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
   * feat(TASK-001): 简短描述
   *
   * 实现内容:
   * 模块A: 功能描述
   * 模块B: 功能描述
   *
   * 新增文件:
   * model/xxx.go
   * service/xxx.go
   *
   * 修改文件:
   * main.go: 路由注册和handler初始化
   *
   * Co-Authored-By: OpenMatrix https://github.com/bigfish1913/openmatrix
   */
  generateCommitMessage(info: CommitInfo, filesWithStatus?: { status: 'new' | 'modified' | 'deleted'; path: string }[]): string {
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

    // Phase 描述
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

    // 按新增/修改分类列出文件
    if (filesWithStatus && filesWithStatus.length > 0) {
      const newFiles = filesWithStatus.filter(f => f.status === 'new').map(f => f.path);
      const modifiedFiles = filesWithStatus.filter(f => f.status === 'modified').map(f => f.path);
      const deletedFiles = filesWithStatus.filter(f => f.status === 'deleted').map(f => f.path);

      if (newFiles.length > 0) {
        lines.push('');
        lines.push('新增文件:');
        // 按目录分组
        const grouped = this.groupFilesByDirectory(newFiles);
        for (const [dir, files] of grouped) {
          lines.push(`${dir ? dir + '/' : ''}${files.join(', ')}`);
        }
      }

      if (modifiedFiles.length > 0) {
        lines.push('');
        lines.push('修改文件:');
        const grouped = this.groupFilesByDirectory(modifiedFiles);
        for (const [dir, files] of grouped) {
          lines.push(`${dir ? dir + '/' : ''}${files.join(', ')}`);
        }
      }

      if (deletedFiles.length > 0) {
        lines.push('');
        lines.push('删除文件:');
        for (const f of deletedFiles) {
          lines.push(f);
        }
      }
    } else if (info.changes.length > 0) {
      // 回退：无状态信息时使用 changes 列表
      const changedFiles = info.changes.slice(0, 10).map(f => {
        const parts = f.split('/');
        return parts.length > 2 ? parts.slice(-2).join('/') : f;
      });
      lines.push('');
      lines.push(`文件改动: ${changedFiles.join(', ')}`);
      if (info.changes.length > 10) {
        lines.push(`...等 ${info.changes.length} 个文件`);
      }
    }

    lines.push('');

    // Co-Author
    lines.push(`Co-Authored-By: OpenMatrix https://github.com/bigfish1913/openmatrix`);

    return lines.join('\n');
  }

  /**
   * 按目录分组文件
   */
  private groupFilesByDirectory(files: string[]): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const file of files) {
      const parts = file.split('/');
      const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
      const fileName = parts[parts.length - 1];
      if (!groups.has(dir)) {
        groups.set(dir, []);
      }
      groups.get(dir)!.push(fileName);
    }
    return groups;
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

      // 获取未提交的文件（用于生成 commit message，在 git add 之前获取）
      const files = await this.getUncommittedFiles();
      if (files.length === 0) {
        return { success: false, message: 'No changes to commit' };
      }

      // 分析影响范围
      const impactScope = await this.analyzeImpactScope(files);

      // 获取文件状态信息（新增/修改/删除）
      const filesWithStatus = await this.getUncommittedFilesWithStatus();

      // 更新 commit info
      const fullInfo: CommitInfo = {
        ...info,
        changes: files,
        impactScope: info.impactScope.length > 0 ? info.impactScope : impactScope
      };

      // 生成提交信息
      const commitMessage = this.generateCommitMessage(fullInfo, filesWithStatus);

      // 暂存所有文件（.gitignore 已更新，.openmatrix/ 等目录会被排除）
      await execAsync('git add .', { cwd: this.repoPath });

      // 动态检查：用 git check-ignore 逐个检查暂存文件，移除应被忽略的
      // 这样无论 .gitignore 怎么更新，都不会误提交构建产物、依赖目录等
      const { stdout: stagedFiles } = await execAsync('git diff --cached --name-only', { cwd: this.repoPath });
      const filesToUnstage: string[] = [];
      for (const file of stagedFiles.split('\n').filter(Boolean)) {
        try {
          await execAsync(`git check-ignore -q "${file}"`, { cwd: this.repoPath });
          // check-ignore 返回 0 → 文件应该被忽略
          filesToUnstage.push(file);
        } catch {
          // check-ignore 返回 1 → 文件不应被忽略，保留暂存
        }
      }
      if (filesToUnstage.length > 0) {
        const unstageCmd = filesToUnstage.map(f => `"${f}"`).join(' ');
        await execAsync(`git reset HEAD -- ${unstageCmd}`, { cwd: this.repoPath }).catch(() => {});
      }

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
