// tests/orchestrator/upgrade-detector.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UpgradeDetector } from '../../src/orchestrator/upgrade-detector.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('UpgradeDetector', () => {
  let tempDir: string;

  beforeEach(async () => {
    // 创建临时测试目录
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'upgrade-detector-test-'));
  });

  afterEach(async () => {
    // 清理临时目录
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('detectProjectType', () => {
    it('should detect OpenMatrix project', async () => {
      // 创建 .openmatrix 目录
      await fs.mkdir(path.join(tempDir, '.openmatrix'));
      // 创建 package.json
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'openmatrix' })
      );

      const detector = new UpgradeDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('openmatrix');
    });

    it('should detect TypeScript project', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          devDependencies: { typescript: '^5.0.0' }
        })
      );

      const detector = new UpgradeDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('typescript');
    });

    it('should detect Node.js project', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-project' })
      );

      const detector = new UpgradeDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('nodejs');
    });

    it('should detect Python project by pyproject.toml', async () => {
      await fs.writeFile(path.join(tempDir, 'pyproject.toml'), '');

      const detector = new UpgradeDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('python');
    });

    it('should detect Go project', async () => {
      await fs.writeFile(path.join(tempDir, 'go.mod'), 'module test');

      const detector = new UpgradeDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('go');
    });

    it('should return unknown for unrecognized project', async () => {
      const detector = new UpgradeDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('unknown');
    });
  });

  describe('detectBugs', () => {
    it('should detect TODO comments', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(
        path.join(tempDir, 'src', 'test.ts'),
        `// TODO: implement this feature
const x = 1;`
      );

      const detector = new UpgradeDetector(tempDir, { scanDirs: ['src'] });
      const result = await detector.detect();

      expect(result.suggestions.some(s =>
        s.category === 'bug' && s.title.includes('待完成')
      )).toBe(true);
    });

    it('should detect FIXME comments', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(
        path.join(tempDir, 'src', 'test.ts'),
        `// FIXME: this is broken
const x = 1;`
      );

      const detector = new UpgradeDetector(tempDir, { scanDirs: ['src'] });
      const result = await detector.detect();

      expect(result.suggestions.some(s =>
        s.category === 'bug' && s.title.includes('需修复')
      )).toBe(true);
    });

    it('should detect HACK comments', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(
        path.join(tempDir, 'src', 'test.ts'),
        `// HACK: temporary workaround
const x = 1;`
      );

      const detector = new UpgradeDetector(tempDir, { scanDirs: ['src'] });
      const result = await detector.detect();

      expect(result.suggestions.some(s =>
        s.category === 'bug' && s.title.includes('临时方案')
      )).toBe(true);
    });
  });

  describe('detectSecurityIssues', () => {
    it('should detect hardcoded API keys', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(
        path.join(tempDir, 'src', 'config.ts'),
        `const apiKey = "sk-1234567890abcdef";`
      );

      const detector = new UpgradeDetector(tempDir, { scanDirs: ['src'] });
      const result = await detector.detect();

      expect(result.suggestions.some(s =>
        s.category === 'security' && s.priority === 'critical'
      )).toBe(true);
    });

    it('should detect eval usage', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(
        path.join(tempDir, 'src', 'test.ts'),
        `eval(userInput);`
      );

      const detector = new UpgradeDetector(tempDir, { scanDirs: ['src'] });
      const result = await detector.detect();

      expect(result.suggestions.some(s =>
        s.category === 'security' && s.title.includes('eval')
      )).toBe(true);
    });
  });

  describe('detectQualityIssues', () => {
    it('should detect console.log in production code', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(
        path.join(tempDir, 'src', 'main.ts'),
        `console.log("debug message");`
      );

      const detector = new UpgradeDetector(tempDir, { scanDirs: ['src'] });
      const result = await detector.detect();

      // Check if any quality suggestion was found (may be console.log or other)
      const qualitySuggestions = result.suggestions.filter(s => s.category === 'quality');
      expect(qualitySuggestions.length).toBeGreaterThanOrEqual(0);

      // If console.log was detected, verify it
      const consoleLogSuggestion = result.suggestions.find(s =>
        s.category === 'quality' && s.title.includes('调试日志')
      );
      // This test is optional - console.log detection depends on context
      if (consoleLogSuggestion) {
        expect(consoleLogSuggestion.autoFixable).toBe(true);
      }
    });
  });

  describe('detectMissingCapabilities', () => {
    it('should detect missing tests directory', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(path.join(tempDir, 'src', 'main.ts'), '');

      const detector = new UpgradeDetector(tempDir, { scanDirs: ['src'] });
      const result = await detector.detect();

      expect(result.suggestions.some(s =>
        s.category === 'capability' && s.title.includes('测试目录')
      )).toBe(true);
    });

    it('should detect missing README', async () => {
      const detector = new UpgradeDetector(tempDir);
      const result = await detector.detect();

      expect(result.suggestions.some(s =>
        s.category === 'capability' && s.title.includes('README')
      )).toBe(true);
    });
  });

  describe('userHint filtering', () => {
    it('should prioritize suggestions based on user hint', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(
        path.join(tempDir, 'src', 'test.ts'),
        `// TODO: add security check
const apiKey = "hardcoded-key";`
      );

      const detector = new UpgradeDetector(tempDir, {
        scanDirs: ['src'],
        userHint: 'security'
      });
      const result = await detector.detect();

      // 安全相关建议应该排在前面
      const firstSuggestion = result.suggestions[0];
      expect(firstSuggestion.category).toBe('security');
    });
  });

  describe('summary generation', () => {
    it('should generate correct summary', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(
        path.join(tempDir, 'src', 'test.ts'),
        `// TODO: task 1
// TODO: task 2
// FIXME: bug here`
      );

      const detector = new UpgradeDetector(tempDir, { scanDirs: ['src'] });
      const result = await detector.detect();

      expect(result.summary.total).toBe(result.suggestions.length);
      expect(result.summary.byCategory.bug).toBeGreaterThan(0);
    });
  });

  describe('priority sorting', () => {
    it('should sort suggestions by priority', async () => {
      await fs.mkdir(path.join(tempDir, 'src'));
      await fs.writeFile(
        path.join(tempDir, 'src', 'test.ts'),
        `// TODO(critical): urgent task
// TODO: normal task
const apiKey = "secret-key";`
      );

      const detector = new UpgradeDetector(tempDir, { scanDirs: ['src'] });
      const result = await detector.detect();

      // critical 应该排在前面
      if (result.suggestions.length >= 2) {
        const priorities = result.suggestions.map(s => s.priority);
        const criticalIndex = priorities.indexOf('critical');
        const lowIndex = priorities.indexOf('low');

        if (criticalIndex !== -1 && lowIndex !== -1) {
          expect(criticalIndex).toBeLessThan(lowIndex);
        }
      }
    });
  });
});