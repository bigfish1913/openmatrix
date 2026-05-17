// tests/utils/worktree-sync.test.ts
import { describe, it, expect } from 'vitest';
import { WorktreeSyncManager } from '../../src/utils/worktree-sync.js';

describe('WorktreeSyncManager', () => {
  describe('constructor', () => {
    it('should create instance with default path', () => {
      const manager = new WorktreeSyncManager();
      expect(manager).toBeDefined();
    });

    it('should create instance with custom path', () => {
      const manager = new WorktreeSyncManager('/custom/path');
      expect(manager).toBeDefined();
    });
  });

  // Note: Full integration tests require actual git worktree setup
  // These are better suited for e2e tests in a real git environment
  describe('integration tests placeholder', () => {
    it.skip('should list worktrees in real git repo', async () => {
      // This test requires a real git repository with worktrees
      // Setup: create git repo, add worktree, test listWorktrees()
    });

    it.skip('should sync worktree changes to main', async () => {
      // This test requires:
      // 1. Real git repo
      // 2. Create worktree
      // 3. Make changes in worktree
      // 4. Run syncWorktreeToMain()
      // 5. Verify changes appear in main worktree
    });
  });
});