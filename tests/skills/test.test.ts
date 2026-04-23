// tests/skills/test.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Path to the skill file
const SKILL_FILE_PATH = path.resolve(__dirname, '../../skills/test.md');

describe('skills/test.md', () => {
  describe('file existence and readability', () => {
    it('should exist in the skills directory', () => {
      expect(fs.existsSync(SKILL_FILE_PATH)).toBe(true);
    });

    it('should be readable', () => {
      const content = fs.readFileSync(SKILL_FILE_PATH, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe('YAML frontmatter format', () => {
    let content: string;
    let frontmatter: Record<string, string>;

    beforeAll(() => {
      content = fs.readFileSync(SKILL_FILE_PATH, 'utf-8');
      frontmatter = parseFrontmatter(content);
    });

    it('should have valid YAML frontmatter delimited by ---', () => {
      expect(content.startsWith('---')).toBe(true);
      // Find the closing ---
      const endIndex = content.indexOf('\n---', 4);
      expect(endIndex).toBeGreaterThan(0);
    });

    it('should have name field in frontmatter', () => {
      expect(frontmatter.name).toBeDefined();
      expect(frontmatter.name).toBe('om:test');
    });

    it('should have description field in frontmatter', () => {
      expect(frontmatter.description).toBeDefined();
      expect(frontmatter.description.length).toBeGreaterThan(0);
    });

    it('should have priority field in frontmatter', () => {
      expect(frontmatter.priority).toBeDefined();
      expect(frontmatter.priority).toBe('high');
    });

    it('should contain trigger keywords in description', () => {
      expect(frontmatter.description).toContain('生成测试');
      expect(frontmatter.description).toContain('测试覆盖');
      expect(frontmatter.description).toContain('补测试');
    });
  });

  describe('required sections', () => {
    let content: string;

    beforeAll(() => {
      content = fs.readFileSync(SKILL_FILE_PATH, 'utf-8');
    });

    it('should have NO-OTHER-SKILLS section', () => {
      expect(content).toContain('<NO-OTHER-SKILLS>');
      expect(content).toContain('</NO-OTHER-SKILLS>');
    });

    it('should have MANDATORY-EXECUTION-ORDER section', () => {
      expect(content).toContain('<MANDATORY-EXECUTION-ORDER>');
      expect(content).toContain('</MANDATORY-EXECUTION-ORDER>');
    });

    it('should have objective section', () => {
      expect(content).toContain('<objective>');
      expect(content).toContain('</objective>');
    });

    it('should have process section', () => {
      expect(content).toContain('<process>');
      expect(content).toContain('</process>');
    });

    it('should have arguments section', () => {
      expect(content).toContain('<arguments>');
      expect(content).toContain('</arguments>');
    });

    it('should have examples section', () => {
      expect(content).toContain('<examples>');
      expect(content).toContain('</examples>');
    });

    it('should have notes section', () => {
      expect(content).toContain('<notes>');
      expect(content).toContain('</notes>');
    });
  });

  describe('execution order (8 steps)', () => {
    let content: string;

    beforeAll(() => {
      content = fs.readFileSync(SKILL_FILE_PATH, 'utf-8');
    });

    it('should define all 8 steps in MANDATORY-EXECUTION-ORDER', () => {
      // Check all 8 steps are listed
      expect(content).toContain('Step 1:');
      expect(content).toContain('Step 2:');
      expect(content).toContain('Step 3:');
      expect(content).toContain('Step 4:');
      expect(content).toContain('Step 5:');
      expect(content).toContain('Step 6:');
      expect(content).toContain('Step 7:');
      expect(content).toContain('Step 8:');
    });

    it('should have detailed process sections for each step', () => {
      // Check detailed step sections exist in <process>
      expect(content).toContain('## Step 1: 调用 CLI 扫描项目');
      expect(content).toContain('## Step 2: AI 分析项目上下文');
      expect(content).toContain('## Step 3: 发现测试缺失');
      expect(content).toContain('## Step 4: UI 测试决策');
      expect(content).toContain('## Step 5: 确认测试范围');
      expect(content).toContain('## Step 6: 生成测试代码');
      expect(content).toContain('## Step 7: 自动验证测试');
      expect(content).toContain('## Step 8: 输出测试报告');
    });

    it('should mention CLI command for scanning', () => {
      expect(content).toContain('openmatrix test --json');
    });

    it('should mention Agent tool usage', () => {
      expect(content).toContain('Agent({');
    });

    it('should define retry mechanism in Step 7', () => {
      expect(content).toContain('retryCount');
      expect(content).toContain('< 3 次');
      expect(content).toContain('>= 3 次');
    });

    it('should have UI test decision step for frontend projects', () => {
      expect(content).toContain('isFrontend=true');
      expect(content).toContain('hasUIComponents=true');
      expect(content).toContain('AskUserQuestion');
    });
  });

  describe('test generation principles', () => {
    let content: string;

    beforeAll(() => {
      content = fs.readFileSync(SKILL_FILE_PATH, 'utf-8');
    });

    it('should emphasize business-oriented testing', () => {
      expect(content).toContain('业务角度');
      expect(content).toContain('业务场景');
    });

    it('should mention style consistency', () => {
      expect(content).toContain('风格一致');
      expect(content).toContain('namingConvention');
      expect(content).toContain('assertionLibrary');
    });

    it('should define maximum retry count as 3', () => {
      expect(content).toContain('3 次');
      expect(content).toContain('最多 3 次');
    });

    it('should include anti-patterns warning', () => {
      expect(content).toContain('反模式');
      expect(content).toContain('❌');
    });
  });
});

// Helper function to parse YAML frontmatter
function parseFrontmatter(content: string): Record<string, string> {
  if (!content.startsWith('---')) {
    return {};
  }

  const endIndex = content.indexOf('\n---', 4);
  if (endIndex < 0) {
    return {};
  }

  const frontmatterText = content.slice(4, endIndex);
  const result: Record<string, string> = {};

  // Simple YAML parsing for single-level key-value pairs
  const lines = frontmatterText.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      // Remove surrounding quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        result[key] = value.slice(1, -1);
      } else {
        result[key] = value;
      }
    }
  }

  return result;
}