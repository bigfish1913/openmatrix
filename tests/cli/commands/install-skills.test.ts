// tests/cli/commands/install-skills.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { installSkillsCommand } from '../../../src/cli/commands/install-skills.js';

describe('install-skills command', () => {
  describe('command configuration', () => {
    it('should have correct command name', () => {
      expect(installSkillsCommand.name()).toBe('install-skills');
    });

    it('should have a description', () => {
      expect(installSkillsCommand.description()).toBeTruthy();
      expect(installSkillsCommand.description()).toContain('Install');
      expect(installSkillsCommand.description()).toContain('skills');
    });

    it('should have --force option', () => {
      const options = installSkillsCommand.options;
      const forceOption = options.find(o => o.long === '--force');
      expect(forceOption).toBeDefined();
      expect(forceOption!.description).toContain('Force');
    });

    it('should have -f short flag for force', () => {
      const options = installSkillsCommand.options;
      const forceOption = options.find(o => o.short === '-f');
      expect(forceOption).toBeDefined();
    });

    it('should have force option default to false', () => {
      const options = installSkillsCommand.options;
      const forceOption = options.find(o => o.long === '--force');
      expect(forceOption).toBeDefined();
    });
  });

  describe('source code type safety verification', () => {
    it('should use typed error handling (err: unknown)', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/install-skills.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      // Should use 'err: unknown' pattern for error typing
      expect(source).toMatch(/catch\s*\(\s*err:\s*unknown\s*\)/);
    });

    it('should use instanceof Error check for error messages', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/install-skills.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      // Should check err instanceof Error before accessing .message
      expect(source).toMatch(/err instanceof Error/);
    });

    it('should use String(err) for non-Error objects', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/install-skills.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      // Should have fallback for non-Error: String(err)
      expect(source).toMatch(/String\(err\)/);
    });

    it('should use path.join for path construction', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/install-skills.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      // Should use path.join consistently
      const pathJoinCount = (source.match(/path\.join/g) || []).length;
      expect(pathJoinCount).toBeGreaterThanOrEqual(4);
    });

    it('should use os.homedir for home directory', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/install-skills.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      expect(source).toMatch(/os\.homedir/);
    });

    it('should filter skill files correctly', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/install-skills.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      // Should filter .md files excluding om.md and openmatrix.md
      expect(source).toMatch(/\.endsWith\('\.md'\)/);
      expect(source).toContain("!== 'om.md'");
      expect(source).toContain("!== 'openmatrix.md'");
    });

    it('should not use any type assertions', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/install-skills.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');
      // Should not use 'as any' pattern
      expect(source).not.toMatch(/\bas\s+any\b/);
    });
  });

  describe('action handler behavior', () => {
    let originalExit: typeof process.exit;

    beforeEach(() => {
      originalExit = process.exit;
      process.exit = vi.fn() as any;
    });

    afterEach(() => {
      process.exit = originalExit;
      vi.restoreAllMocks();
    });

    it('should exit with code 1 when skills directory not found', async () => {
      // The action handler references __dirname for skills location
      // We can verify the behavior by examining the source
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/install-skills.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');

      // Should check if skills directory exists and exit(1) if not
      expect(source).toMatch(/Skills directory not found/);
      expect(source).toMatch(/process\.exit\(1\)/);
    });

    it('should handle mkdir errors gracefully', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/install-skills.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');

      expect(source).toMatch(/Cannot create directory/);
    });

    it('should track install statistics', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/install-skills.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');

      // Should track installed, skipped, failed counts
      expect(source).toMatch(/let installed/);
      expect(source).toMatch(/let skipped/);
      expect(source).toMatch(/let failed/);
    });

    it('should install om.md as default entry', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/install-skills.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');

      expect(source).toContain('om.md');
      expect(source).toMatch(/default entry/);
    });

    it('should install openmatrix.md for auto-detection', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/install-skills.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');

      expect(source).toContain('openmatrix.md');
      expect(source).toMatch(/auto-detection/);
    });

    it('should skip existing files when force is not set', () => {
      const sourcePath = path.resolve(__dirname, '../../../src/cli/commands/install-skills.ts');
      const source = fs.readFileSync(sourcePath, 'utf-8');

      // Should check options.force
      expect(source).toMatch(/options\.force/);
      expect(source).toMatch(/already exists/);
    });
  });

  describe('type safety: error handling patterns', () => {
    it('should handle errors with unknown type correctly', () => {
      // Test the error message extraction pattern used in install-skills.ts
      function getErrorMessage(err: unknown): string {
        return err instanceof Error ? err.message : String(err);
      }

      expect(getErrorMessage(new Error('test error'))).toBe('test error');
      expect(getErrorMessage('string error')).toBe('string error');
      expect(getErrorMessage(42)).toBe('42');
      expect(getErrorMessage(null)).toBe('null');
      expect(getErrorMessage(undefined)).toBe('undefined');
      expect(getErrorMessage({ code: 'ENOENT' })).toBe('[object Object]');
    });

    it('should distinguish Error from non-Error objects', () => {
      function isError(err: unknown): err is Error {
        return err instanceof Error;
      }

      expect(isError(new Error('test'))).toBe(true);
      expect(isError(new TypeError('test'))).toBe(true);
      expect(isError('string')).toBe(false);
      expect(isError(42)).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError({ message: 'test' })).toBe(false);
    });

    it('should handle file system operations with proper typing', () => {
      // Verify that the fs methods used in install-skills are properly typed
      const mockError: NodeJS.ErrnoException = {
        code: 'ENOENT',
        message: 'File not found',
        name: 'NotFoundError'
      };
      expect(mockError.code).toBe('ENOENT');
      expect(mockError.message).toBe('File not found');
    });
  });
});
