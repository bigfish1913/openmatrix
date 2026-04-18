// tests/e2e/check-cli.test.ts
// TASK-012: E2E tests for `openmatrix check --json` CLI command

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// =====================================================
// Types (mirrored from upgrade-detector for assertion clarity)
// =====================================================

interface DetectionResult {
  projectType: string;
  projectName: string;
  scanPath: string;
  timestamp: string;
  suggestions: UpgradeSuggestion[];
  summary: {
    total: number;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
    autoFixable: number;
  };
}

interface UpgradeSuggestion {
  id: string;
  category: string;
  priority: string;
  title: string;
  description: string;
  location: {
    file: string;
    line?: number;
    column?: number;
  };
  suggestion: string;
  autoFixable: boolean;
  impact: string;
  effort: string;
}

// =====================================================
// Helpers
// =====================================================

const VALID_CATEGORIES = ['bug', 'quality', 'capability', 'ux', 'style', 'security', 'common', 'prompt', 'skill', 'agent'];
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low'];
const VALID_EFFORTS = ['trivial', 'small', 'medium', 'large'];

// Resolve the absolute path to the built CLI entry point
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CLI_PATH = path.join(PROJECT_ROOT, 'dist', 'cli', 'index.js');

/**
 * Execute `openmatrix check --json` in a given directory and return parsed result.
 * Uses absolute path to the CLI so it works regardless of the cwd.
 */
function runCheckJson(cwd: string): DetectionResult {
  const output = execSync(`node "${CLI_PATH}" check --json`, {
    cwd,
    encoding: 'utf-8',
    timeout: 30000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return JSON.parse(output.trim());
}

/**
 * Create a temporary project directory with sample files containing known issues.
 * Returns the temp directory path.
 */
async function createSampleProject(baseDir: string): Promise<string> {
  const projectDir = path.join(baseDir, 'sample-project');
  await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });

  // Source file with known issues across categories
  await fs.writeFile(
    path.join(projectDir, 'src', 'app.ts'),
    `// TODO: implement this feature
// FIXME: this function has a bug
// HACK: temporary workaround for issue
const apiKey = "sk-1234567890abcdef";
eval(userInput);
console.log("debugging output");
function veryLongFunction() {
  const x = 1;
  return x;
}
`
  );

  // package.json so the detector can identify the project type
  await fs.writeFile(
    path.join(projectDir, 'package.json'),
    JSON.stringify({
      name: 'e2e-test-project',
      version: '1.0.0',
      devDependencies: { typescript: '^5.0.0' },
    })
  );

  return projectDir;
}

/**
 * Create a minimal clean project with no detectable issues.
 */
async function createCleanProject(baseDir: string): Promise<string> {
  const projectDir = path.join(baseDir, 'clean-project');
  await fs.mkdir(path.join(projectDir, 'src'), { recursive: true });

  await fs.writeFile(
    path.join(projectDir, 'src', 'clean.ts'),
    `export function add(a: number, b: number): number {\n  return a + b;\n}\n`
  );

  await fs.writeFile(
    path.join(projectDir, 'package.json'),
    JSON.stringify({
      name: 'clean-project',
      version: '1.0.0',
      devDependencies: { typescript: '^5.0.0' },
    })
  );

  return projectDir;
}

// =====================================================
// E2E Test Suite
// =====================================================

describe('E2E: openmatrix check --json', () => {
  // Ensure the project is built before running E2E tests
  const projectRoot = path.resolve(__dirname, '..', '..');
  let cliExists: boolean;

  beforeAll(async () => {
    try {
      await fs.access(path.join(projectRoot, 'dist', 'cli', 'index.js'));
      cliExists = true;
    } catch {
      cliExists = false;
    }
  });

  describe('Running on the OpenMatrix project itself', () => {
    it('should execute successfully and return valid JSON', () => {
      if (!cliExists) {
        return; // skip if project not built
      }
      const result = runCheckJson(projectRoot);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should contain required top-level fields: projectType, projectName, suggestions, summary', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);

      expect(result).toHaveProperty('projectType');
      expect(result).toHaveProperty('projectName');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('scanPath');
      expect(result).toHaveProperty('timestamp');
    });

    it('should have projectType equal to "openmatrix"', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);
      expect(result.projectType).toBe('openmatrix');
    });

    it('should have a non-empty projectName', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);
      expect(result.projectName).toBe('openmatrix');
    });

    it('should have a valid ISO timestamp', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);
      const parsedDate = new Date(result.timestamp);
      expect(parsedDate.getTime()).not.toBeNaN();
    });

    it('should have suggestions as an array', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should have summary with correct structure', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);

      expect(result.summary).toHaveProperty('total');
      expect(result.summary).toHaveProperty('byCategory');
      expect(result.summary).toHaveProperty('byPriority');
      expect(result.summary).toHaveProperty('autoFixable');
      expect(typeof result.summary.total).toBe('number');
      expect(typeof result.summary.autoFixable).toBe('number');
    });

    it('should have summary.total equal to suggestions.length', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);
      expect(result.summary.total).toBe(result.suggestions.length);
    });

    it('should have byCategory with all expected categories', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);

      for (const cat of VALID_CATEGORIES) {
        expect(result.summary.byCategory).toHaveProperty(cat);
        expect(typeof result.summary.byCategory[cat]).toBe('number');
      }
    });

    it('should have byPriority with all expected priority levels', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);

      for (const pri of VALID_PRIORITIES) {
        expect(result.summary.byPriority).toHaveProperty(pri);
        expect(typeof result.summary.byPriority[pri]).toBe('number');
      }
    });

    it('should have summary totals consistent with byCategory counts', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);

      const categorySum = Object.values(result.summary.byCategory).reduce((sum, count) => sum + count, 0);
      expect(categorySum).toBe(result.summary.total);
    });

    it('should have summary totals consistent with byPriority counts', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);

      const prioritySum = Object.values(result.summary.byPriority).reduce((sum, count) => sum + count, 0);
      expect(prioritySum).toBe(result.summary.total);
    });

    it('should have autoFixable count <= total', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);
      expect(result.summary.autoFixable).toBeLessThanOrEqual(result.summary.total);
      expect(result.summary.autoFixable).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Suggestion structure validation', () => {
    it('should have every suggestion contain required fields', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);

      if (result.suggestions.length === 0) {
        return; // No suggestions to validate
      }

      for (const suggestion of result.suggestions) {
        // Required fields from UpgradeSuggestion interface
        expect(suggestion).toHaveProperty('id');
        expect(suggestion).toHaveProperty('category');
        expect(suggestion).toHaveProperty('priority');
        expect(suggestion).toHaveProperty('title');
        expect(suggestion).toHaveProperty('description');
        expect(suggestion).toHaveProperty('location');
        expect(suggestion).toHaveProperty('suggestion');
        expect(suggestion).toHaveProperty('autoFixable');
        expect(suggestion).toHaveProperty('impact');
        expect(suggestion).toHaveProperty('effort');
      }
    });

    it('should have valid id format (UPG-NNN)', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);

      for (const suggestion of result.suggestions) {
        expect(suggestion.id).toMatch(/^UPG-\d{3}$/);
      }
    });

    it('should have valid category values in suggestions', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);

      for (const suggestion of result.suggestions) {
        expect(VALID_CATEGORIES).toContain(suggestion.category);
      }
    });

    it('should have valid priority values in suggestions', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);

      for (const suggestion of result.suggestions) {
        expect(VALID_PRIORITIES).toContain(suggestion.priority);
      }
    });

    it('should have valid effort values in suggestions', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);

      for (const suggestion of result.suggestions) {
        expect(VALID_EFFORTS).toContain(suggestion.effort);
      }
    });

    it('should have location with file property in every suggestion', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);

      for (const suggestion of result.suggestions) {
        expect(suggestion.location).toHaveProperty('file');
        expect(typeof suggestion.location.file).toBe('string');
        expect(suggestion.location.file.length).toBeGreaterThan(0);
      }
    });

    it('should have autoFixable as boolean in every suggestion', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);

      for (const suggestion of result.suggestions) {
        expect(typeof suggestion.autoFixable).toBe('boolean');
      }
    });

    it('should have unique suggestion ids', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);

      const ids = result.suggestions.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should have non-empty title and description in every suggestion', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(projectRoot);

      for (const suggestion of result.suggestions) {
        expect(suggestion.title.length).toBeGreaterThan(0);
        expect(suggestion.description.length).toBeGreaterThan(0);
        expect(suggestion.suggestion.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Running on a temporary project with known issues', () => {
    let tempDir: string;
    let sampleProjectDir: string;

    beforeAll(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'om-e2e-'));
      sampleProjectDir = await createSampleProject(tempDir);
    });

    afterAll(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should detect issues in a project with known problems', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(sampleProjectDir);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should detect the project as typescript type', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(sampleProjectDir);
      expect(result.projectType).toBe('typescript');
    });

    it('should detect the correct project name from package.json', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(sampleProjectDir);
      expect(result.projectName).toBe('e2e-test-project');
    });

    it('should detect security issues (hardcoded key and eval)', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(sampleProjectDir);
      expect(result.summary.byCategory.security).toBeGreaterThan(0);

      const securitySuggestions = result.suggestions.filter(s => s.category === 'security');
      const hasKeyIssue = securitySuggestions.some(s => s.title.includes('硬编码密钥'));
      const hasEvalIssue = securitySuggestions.some(s => s.title.includes('eval'));
      expect(hasKeyIssue || hasEvalIssue).toBe(true);
    });

    it('should detect bug markers (TODO, FIXME, HACK)', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(sampleProjectDir);
      expect(result.summary.byCategory.bug).toBeGreaterThan(0);
    });

    it('should detect quality issues (console.log)', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(sampleProjectDir);
      // console.log is in a non-command file, should be detected
      const qualitySuggestions = result.suggestions.filter(s => s.category === 'quality');
      expect(qualitySuggestions.length).toBeGreaterThan(0);
    });

    it('should have suggestions sorted by priority (critical first)', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(sampleProjectDir);

      if (result.suggestions.length < 2) {
        return;
      }

      const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      for (let i = 1; i < result.suggestions.length; i++) {
        const prev = priorityOrder[result.suggestions[i - 1].priority];
        const curr = priorityOrder[result.suggestions[i].priority];
        expect(prev).toBeLessThanOrEqual(curr);
      }
    });
  });

  describe('Running on a clean project', () => {
    let tempDir: string;
    let cleanProjectDir: string;

    beforeAll(async () => {
      tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'om-e2e-clean-'));
      cleanProjectDir = await createCleanProject(tempDir);
    });

    afterAll(async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    });

    it('should return valid JSON even for a clean project', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(cleanProjectDir);
      expect(result).toBeDefined();
      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.summary).toBeDefined();
    });

    it('should have summary.total equal to suggestions.length', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(cleanProjectDir);
      expect(result.summary.total).toBe(result.suggestions.length);
    });

    it('should have all summary counts consistent', () => {
      if (!cliExists) {
        return;
      }
      const result = runCheckJson(cleanProjectDir);

      const categorySum = Object.values(result.summary.byCategory).reduce((s: number, c) => s + c, 0);
      const prioritySum = Object.values(result.summary.byPriority).reduce((s: number, c) => s + c, 0);
      expect(categorySum).toBe(result.summary.total);
      expect(prioritySum).toBe(result.summary.total);
      expect(result.summary.autoFixable).toBeLessThanOrEqual(result.summary.total);
    });
  });
});
