// src/utils/worktree-sync.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logError } from './error-handler.js';

const execAsync = promisify(exec);

/**
 * Worktree 同步结果
 */
export interface WorktreeSyncResult {
  success: boolean;
  syncedFiles: string[];
  commitHash?: string;
  branch?: string;
  error?: string;
}

/**
 * Worktree 信息
 */
export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  isMain: boolean;
}

/**
 * WorktreeSyncManager - 管理 Git Worktree 同步
 *
 * 当 Agent 在 worktree 中工作时，改动会提交到 worktree 的分支。
 * 此类负责将这些改动同步回主工作树。
 *
 * 同步策略：
 * 1. 检测 Agent 创建的 worktree
 * 2. 获取 worktree 中的提交和改动文件
 * 3. 将改动文件复制到主工作树（或 cherry-pick 提交）
 * 4. 清理临时 worktree
 */
export class WorktreeSyncManager {
  private repoPath: string;
  private gitRoot: string | null = null;

  constructor(repoPath: string = process.cwd()) {
    this.repoPath = repoPath;
  }

  /**
   * 获取 git 仓库根目录
   */
  private async getGitRoot(): Promise<string> {
    if (this.gitRoot) return this.gitRoot;
    try {
      const { stdout } = await execAsync('git rev-parse --show-toplevel', { cwd: this.repoPath });
      this.gitRoot = stdout.trim();
    } catch (error) {
      logError(error, { operation: 'getGitRoot', file: this.repoPath });
      this.gitRoot = this.repoPath;
    }
    return this.gitRoot;
  }

  /**
   * 列出所有 worktree
   */
  async listWorktrees(): Promise<WorktreeInfo[]> {
    try {
      const { stdout } = await execAsync('git worktree list --porcelain', { cwd: this.repoPath });
      const worktrees: WorktreeInfo[] = [];
      const lines = stdout.split('\n');

      let current: Partial<WorktreeInfo> = {};
      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          if (current.path) {
            worktrees.push({
              path: current.path!,
              branch: current.branch || '',
              commit: current.commit || '',
              isMain: current.isMain || false
            });
          }
          current = { path: line.slice(9) };
          // 第一个 worktree 是主工作树
          current.isMain = worktrees.length === 0;
        } else if (line.startsWith('HEAD ')) {
          current.commit = line.slice(5);
        } else if (line.startsWith('branch ')) {
          current.branch = line.slice(7);
        }
      }
      // 添加最后一个
      if (current.path) {
        worktrees.push({
          path: current.path!,
          branch: current.branch || '',
          commit: current.commit || '',
          isMain: current.isMain || false
        });
      }

      return worktrees;
    } catch (error) {
      logError(error, { operation: 'listWorktrees', file: this.repoPath });
      return [];
    }
  }

  /**
   * 获取 Agent worktree 目录
   *
   * Claude Code 创建的 worktree 通常在 .claude/worktrees/ 目录下
   */
  async getAgentWorktrees(): Promise<WorktreeInfo[]> {
    const worktrees = await this.listWorktrees();
    const gitRoot = await this.getGitRoot();

    // 过滤出 Agent 创建的 worktree（通常以 agent- 开头或在 .claude/worktrees 下）
    return worktrees.filter(w =>
      !w.isMain &&
      (w.path.includes('.claude/worktrees') || w.path.includes('agent-'))
    );
  }

  /**
   * 获取 worktree 相对于主工作树的改动
   */
  async getWorktreeChanges(worktreePath: string): Promise<string[]> {
    try {
      const gitRoot = await this.getGitRoot();

      // 获取 worktree 相对于主分支的改动文件
      const { stdout } = await execAsync(
        `git diff --name-only HEAD "${worktreePath}"`,
        { cwd: gitRoot }
      );

      return stdout.split('\n').filter(f => f.trim());
    } catch (error) {
      // 如果上面的方法失败，尝试直接在 worktree 中获取未提交的改动
      try {
        const { stdout } = await execAsync(
          'git diff --name-only HEAD',
          { cwd: worktreePath }
        );
        return stdout.split('\n').filter(f => f.trim());
      } catch (innerError) {
        logError(innerError, { operation: 'getWorktreeChanges', file: worktreePath });
        return [];
      }
    }
  }

  /**
   * 获取 worktree 中最新提交的改动文件
   */
  async getLatestCommitChanges(worktreePath: string): Promise<string[]> {
    try {
      // 在 worktree 中获取最新提交改动的文件
      const { stdout } = await execAsync(
        'git diff --name-only HEAD~1 HEAD',
        { cwd: worktreePath }
      );
      return stdout.split('\n').filter(f => f.trim());
    } catch (error) {
      // 可能只有一个提交，尝试获取与初始提交的差异
      try {
        const { stdout } = await execAsync(
          'git diff --name-only HEAD',
          { cwd: worktreePath }
        );
        return stdout.split('\n').filter(f => f.trim());
      } catch (innerError) {
        logError(innerError, { operation: 'getLatestCommitChanges', file: worktreePath });
        return [];
      }
    }
  }

  /**
   * 同步 worktree 改动到主工作树
   *
   * 策略：
   * 1. 获取 worktree 中已提交但未同步的改动
   * 2. 将改动文件复制到主工作树
   * 3. 在主工作树中暂存这些文件
   *
   * @param worktreePath worktree 路径（可选，不提供则自动检测所有 Agent worktree）
   */
  async syncWorktreeToMain(worktreePath?: string): Promise<WorktreeSyncResult[]> {
    const gitRoot = await this.getGitRoot();
    const worktrees = worktreePath
      ? [{ path: worktreePath, branch: '', commit: '', isMain: false }]
      : await this.getAgentWorktrees();

    if (worktrees.length === 0) {
      return [{
        success: true,
        syncedFiles: [],
        error: 'No agent worktrees found'
      }];
    }

    const results: WorktreeSyncResult[] = [];

    for (const wt of worktrees) {
      try {
        // 1. 获取改动文件
        const changedFiles = await this.getLatestCommitChanges(wt.path);

        if (changedFiles.length === 0) {
          results.push({
            success: true,
            syncedFiles: [],
            branch: wt.branch,
            error: 'No changes in worktree'
          });
          continue;
        }

        // 2. 复制文件到主工作树
        const syncedFiles: string[] = [];
        for (const file of changedFiles) {
          const srcPath = path.join(wt.path, file);
          const destPath = path.join(gitRoot, file);

          try {
            // 确保目标目录存在
            const destDir = path.dirname(destPath);
            await fs.mkdir(destDir, { recursive: true });

            // 复制文件
            await fs.copyFile(srcPath, destPath);
            syncedFiles.push(file);
          } catch (copyError) {
            logError(copyError, { operation: 'copyFile', file: srcPath, metadata: { dest: destPath } });
          }
        }

        // 3. 在主工作树中暂存文件
        if (syncedFiles.length > 0) {
          const filesArg = syncedFiles.map(f => `"${f}"`).join(' ');
          await execAsync(`git add ${filesArg}`, { cwd: gitRoot });
        }

        // 4. 获取 worktree 的最新提交 hash
        let commitHash: string | undefined;
        try {
          const { stdout } = await execAsync('git rev-parse HEAD', { cwd: wt.path });
          commitHash = stdout.trim();
        } catch {}

        results.push({
          success: true,
          syncedFiles,
          commitHash,
          branch: wt.branch
        });

      } catch (error) {
        results.push({
          success: false,
          syncedFiles: [],
          branch: wt.branch,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return results;
  }

  /**
   * Cherry-pick worktree 的提交到主工作树
   *
   * 替代方案：直接 cherry-pick worktree 的提交
   * 适用于：改动较大、需要保留完整提交历史的场景
   */
  async cherryPickWorktreeCommit(worktreePath: string): Promise<WorktreeSyncResult> {
    const gitRoot = await this.getGitRoot();

    try {
      // 1. 获取 worktree 的最新提交 hash
      const { stdout: commitHash } = await execAsync('git rev-parse HEAD', { cwd: worktreePath });
      const hash = commitHash.trim();

      // 2. 在主工作树中 cherry-pick 这个提交
      await execAsync(`git cherry-pick ${hash} --no-commit`, { cwd: gitRoot });

      // 3. 获取被 cherry-pick 的文件列表
      const { stdout: files } = await execAsync('git diff --name-only --cached', { cwd: gitRoot });
      const syncedFiles = files.split('\n').filter(f => f.trim());

      return {
        success: true,
        syncedFiles,
        commitHash: hash
      };

    } catch (error) {
      // Cherry-pick 可能失败（冲突），尝试放弃并返回错误
      try {
        await execAsync('git cherry-pick --abort', { cwd: gitRoot });
      } catch {}

      return {
        success: false,
        syncedFiles: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 清理已同步的 worktree
   */
  async cleanupWorktree(worktreePath: string): Promise<boolean> {
    try {
      const gitRoot = await this.getGitRoot();

      // 0. 检查是否有未提交的改动（防止丢失工作）
      try {
        const { stdout: statusOutput } = await execAsync(
          `git status --porcelain`,
          { cwd: worktreePath }
        );
        if (statusOutput.trim().length > 0) {
          // 有未提交改动，记录警告但不强制移除
          console.warn(`⚠️ Worktree ${worktreePath} 有未提交改动，跳过清理`);
          console.warn(`   未提交文件: ${statusOutput.trim().split('\n').length} 个`);
          return false;
        }
      } catch {
        // status 检查失败，继续尝试清理（可能 worktree 已损坏）
      }

      // 1. 移除 worktree
      await execAsync(`git worktree remove "${worktreePath}"`, { cwd: gitRoot });

      // 2. 清理可能的残留分支（如果是临时分支）
      // 注意：不自动删除分支，因为可能还需要

      return true;
    } catch (error) {
      // 如果普通移除失败，尝试强制移除（但已确认无未提交改动）
      try {
        const gitRoot = await this.getGitRoot();
        await execAsync(`git worktree remove "${worktreePath}" --force`, { cwd: gitRoot });
        return true;
      } catch (forceError) {
        logError(forceError, { operation: 'cleanupWorktreeForce', file: worktreePath });
        return false;
      }
    }
  }

  /**
   * 完整的同步流程
   *
   * 1. 检测所有 Agent worktree
   * 2. 同步改动到主工作树
   * 3. 清理 worktree
   *
   * @returns 同步结果
   */
  async fullSync(): Promise<{
    syncResults: WorktreeSyncResult[];
    cleanupResults: { path: string; success: boolean }[];
  }> {
    // 1. 同步
    const syncResults = await this.syncWorktreeToMain();

    // 2. 清理已成功同步的 worktree
    const cleanupResults: { path: string; success: boolean }[] = [];
    const worktrees = await this.getAgentWorktrees();

    for (const wt of worktrees) {
      const syncResult = syncResults.find(r => r.branch === wt.branch);
      if (syncResult?.success && syncResult.syncedFiles.length > 0) {
        const cleanupSuccess = await this.cleanupWorktree(wt.path);
        cleanupResults.push({ path: wt.path, success: cleanupSuccess });
      }
    }

    return { syncResults, cleanupResults };
  }

  /**
   * 检查是否有未同步的 worktree 改动
   */
  async hasUnsyncedChanges(): Promise<boolean> {
    const worktrees = await this.getAgentWorktrees();

    for (const wt of worktrees) {
      const changes = await this.getLatestCommitChanges(wt.path);
      if (changes.length > 0) return true;
    }

    return false;
  }
}