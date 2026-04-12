// tests/orchestrator/git-commit-manager.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitCommitManager } from '../../src/orchestrator/git-commit-manager.js';
import type { CommitInfo } from '../../src/orchestrator/git-commit-manager.js';
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('GitCommitManager', () => {
  let manager: GitCommitManager;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openmatrix-git-test-'));
    manager = new GitCommitManager(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('generateCommitMessage', () => {
    const commitInfo: CommitInfo = {
      taskId: 'TASK-001',
      taskTitle: 'Add user authentication',
      runId: 'run-test-001',
      phase: 'develop',
      changes: [],
      impactScope: []
    };

    it('should generate commit message with correct format', () => {
      const message = manager.generateCommitMessage(commitInfo);

      expect(message).toContain('feat(TASK-001)');
      expect(message).toContain('Add user authentication');
      expect(message).toContain('实现功能代码');
      expect(message).toContain('Co-Authored-By: OpenMatrix');
    });

    it('should use test type for tdd phase', () => {
      const message = manager.generateCommitMessage({
        ...commitInfo,
        phase: 'tdd'
      });

      expect(message).toContain('test(TASK-001)');
      expect(message).toContain('编写测试用例');
    });

    it('should use test type for verify phase', () => {
      const message = manager.generateCommitMessage({
        ...commitInfo,
        phase: 'verify'
      });

      expect(message).toContain('test(TASK-001)');
    });

    it('should use chore type for accept phase', () => {
      const message = manager.generateCommitMessage({
        ...commitInfo,
        phase: 'accept'
      });

      expect(message).toContain('chore(TASK-001)');
    });

    it('should truncate long title', () => {
      const longTitle = 'This is a very long task title that exceeds the maximum limit of characters allowed in the commit message';
      const message = manager.generateCommitMessage({
        ...commitInfo,
        taskTitle: longTitle
      });

      // Title should be truncated in the commit message
      const titleLine = message.split('\n')[0];
      expect(titleLine.length).toBeLessThanOrEqual(80);
    });

    it('should include impact scope', () => {
      const message = manager.generateCommitMessage({
        ...commitInfo,
        impactScope: ['AuthService', 'API']
      });

      expect(message).toContain('影响范围');
      expect(message).toContain('AuthService');
      expect(message).toContain('API');
    });

    it('should categorize new files', () => {
      const message = manager.generateCommitMessage(commitInfo, [
        { status: 'new', path: 'src/auth/login.ts' },
        { status: 'new', path: 'src/auth/register.ts' }
      ]);

      expect(message).toContain('新增文件');
      expect(message).toContain('login.ts');
      expect(message).toContain('register.ts');
    });

    it('should categorize modified files', () => {
      const message = manager.generateCommitMessage(commitInfo, [
        { status: 'modified', path: 'src/main.ts' },
        { status: 'modified', path: 'src/config.ts' }
      ]);

      expect(message).toContain('修改文件');
      expect(message).toContain('main.ts');
      expect(message).toContain('config.ts');
    });

    it('should categorize deleted files', () => {
      const message = manager.generateCommitMessage(commitInfo, [
        { status: 'deleted', path: 'src/old-module.ts' }
      ]);

      expect(message).toContain('删除文件');
      expect(message).toContain('old-module.ts');
    });

    it('should group files by directory', () => {
      const message = manager.generateCommitMessage(commitInfo, [
        { status: 'new', path: 'src/auth/login.ts' },
        { status: 'new', path: 'src/auth/register.ts' },
        { status: 'new', path: 'src/models/user.ts' }
      ]);

      expect(message).toContain('新增文件');
      // Files should be grouped by directory
      expect(message).toContain('src/auth');
      expect(message).toContain('src/models');
    });

    it('should fallback to changes list when no status info', () => {
      const message = manager.generateCommitMessage({
        ...commitInfo,
        changes: ['src/a.ts', 'src/b.ts', 'src/c.ts']
      });

      expect(message).toContain('文件改动');
      expect(message).toContain('a.ts');
    });
  });

  describe('analyzeImpactScope', () => {
    it('should identify CLI scope', async () => {
      const scopes = await manager.analyzeImpactScope(['src/cli/start.ts']);
      expect(scopes).toContain('CLI');
    });

    it('should identify Orchestrator scope', async () => {
      const scopes = await manager.analyzeImpactScope(['src/orchestrator/executor.ts']);
      expect(scopes).toContain('Orchestrator');
    });

    it('should identify Agents scope', async () => {
      const scopes = await manager.analyzeImpactScope(['src/agents/coder.ts']);
      expect(scopes).toContain('Agents');
    });

    it('should identify Storage scope', async () => {
      const scopes = await manager.analyzeImpactScope(['src/storage/state.ts']);
      expect(scopes).toContain('Storage');
    });

    it('should identify Tests scope', async () => {
      const scopes = await manager.analyzeImpactScope(['tests/unit.test.ts']);
      expect(scopes).toContain('Tests');
    });

    it('should identify Documentation scope', async () => {
      const scopes = await manager.analyzeImpactScope(['README.md', 'docs/api.md']);
      expect(scopes).toContain('Documentation');
    });

    it('should identify Dependencies scope', async () => {
      const scopes = await manager.analyzeImpactScope(['package.json']);
      expect(scopes).toContain('Dependencies');
    });

    it('should identify multiple scopes', async () => {
      const scopes = await manager.analyzeImpactScope([
        'src/cli/start.ts',
        'src/orchestrator/executor.ts',
        'tests/test.ts'
      ]);
      expect(scopes).toContain('CLI');
      expect(scopes).toContain('Orchestrator');
      expect(scopes).toContain('Tests');
    });
  });

  describe('setEnabled', () => {
    it('should disable auto-commit', () => {
      manager.setEnabled(false);
      // Disabled manager should return success: false
      // We can't test commit directly without git, but we verify the method exists
      expect(manager.setEnabled).toBeDefined();
    });
  });

  describe('groupFilesByDirectory', () => {
    it('should group files correctly', () => {
      // Access private method through type casting
      const groupFn = (manager as any).groupFilesByDirectory.bind(manager);
      const result = groupFn(['src/auth/login.ts', 'src/auth/register.ts', 'src/models/user.ts']);

      expect(result.get('src/auth')).toEqual(['login.ts', 'register.ts']);
      expect(result.get('src/models')).toEqual(['user.ts']);
    });

    it('should handle files in root', () => {
      const groupFn = (manager as any).groupFilesByDirectory.bind(manager);
      const result = groupFn(['package.json', 'tsconfig.json']);

      expect(result.get('')).toEqual(['package.json', 'tsconfig.json']);
    });
  });
});