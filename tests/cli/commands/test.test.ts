// tests/cli/commands/test.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  detectTestFrameworks,
  detectProjectType,
  scanTestFiles,
  scanSourceFiles,
  scanDirectory,
  inferSourceFile,
  inferFileType,
  extractExports,
  hasCorrespondingTest,
  inferTestTypes,
  detectFrontend,
  performScan
} from '../../../dist/cli/commands/test.js';
import type { TestFrameworkInfo, ExistingTestFile, ProjectType } from '../../../dist/types/index.js';

describe('CLI test command', () => {
  let tempDir: string;

  beforeEach(() => {
    // 创建临时测试目录
    tempDir = path.join(os.tmpdir(), `test-cli-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    // 清理临时目录
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('detectTestFrameworks', () => {
    it('should detect vitest from package.json', () => {
      // 创建 package.json
      const packageJson = {
        devDependencies: { vitest: '1.0.0' }
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));
      fs.writeFileSync(path.join(tempDir, 'vitest.config.ts'), '');

      const frameworks = detectTestFrameworks(tempDir);

      expect(frameworks.length).toBeGreaterThan(0);
      expect(frameworks.some(f => f.framework === 'vitest')).toBe(true);

      const vitest = frameworks.find(f => f.framework === 'vitest');
      expect(vitest?.version).toBe('1.0.0');
      expect(vitest?.configFile).toBe('vitest.config.ts');
      expect(vitest?.isPrimary).toBe(true);
    });

    it('should detect jest from package.json', () => {
      const packageJson = {
        devDependencies: { jest: '29.0.0' }
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));
      fs.writeFileSync(path.join(tempDir, 'jest.config.js'), '');

      const frameworks = detectTestFrameworks(tempDir);

      expect(frameworks.some(f => f.framework === 'jest')).toBe(true);

      const jest = frameworks.find(f => f.framework === 'jest');
      expect(jest?.version).toBe('29.0.0');
    });

    it('should detect playwright for E2E tests', () => {
      const packageJson = {
        devDependencies: {
          vitest: '1.0.0',
          '@playwright/test': '1.40.0'
        }
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));
      fs.writeFileSync(path.join(tempDir, 'playwright.config.ts'), '');

      const frameworks = detectTestFrameworks(tempDir);

      const playwright = frameworks.find(f => f.framework === 'playwright');
      expect(playwright).toBeDefined();
      expect(playwright?.isPrimary).toBe(false);
      expect(playwright?.supportedTypes).toContain('e2e');
    });

    it('should return unknown when no framework detected', () => {
      // 空目录，没有 package.json

      const frameworks = detectTestFrameworks(tempDir);

      expect(frameworks.length).toBe(1);
      expect(frameworks[0].framework).toBe('unknown');
    });

    it('should detect pytest from requirements.txt', () => {
      fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'pytest>=7.0.0\nrequests>=2.0.0');

      const frameworks = detectTestFrameworks(tempDir);

      expect(frameworks.some(f => f.framework === 'pytest')).toBe(true);
    });

    it('should detect go test from go.mod', () => {
      fs.writeFileSync(path.join(tempDir, 'go.mod'), 'module example\n\ngo 1.21');

      const frameworks = detectTestFrameworks(tempDir);

      expect(frameworks.some(f => f.framework === 'gotest')).toBe(true);
    });
  });

  describe('detectProjectType', () => {
    it('should detect react project', () => {
      const packageJson = {
        dependencies: { react: '18.0.0', 'react-dom': '18.0.0' }
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));

      const projectType = detectProjectType(tempDir);

      expect(projectType).toBe('react');
    });

    it('should detect vue project', () => {
      const packageJson = {
        dependencies: { vue: '3.0.0' }
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));

      const projectType = detectProjectType(tempDir);

      expect(projectType).toBe('vue');
    });

    it('should detect typescript project', () => {
      const packageJson = {
        devDependencies: { typescript: '5.0.0' }
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');

      const projectType = detectProjectType(tempDir);

      expect(projectType).toBe('typescript');
    });

    it('should detect python project', () => {
      fs.writeFileSync(path.join(tempDir, 'requirements.txt'), 'pytest');

      const projectType = detectProjectType(tempDir);

      expect(projectType).toBe('python');
    });

    it('should detect go project', () => {
      fs.writeFileSync(path.join(tempDir, 'go.mod'), 'module example');

      const projectType = detectProjectType(tempDir);

      expect(projectType).toBe('go');
    });

    it('should return unknown for empty project', () => {
      const projectType = detectProjectType(tempDir);

      expect(projectType).toBe('unknown');
    });
  });

  describe('scanTestFiles', () => {
    it('should find test files in tests directory', () => {
      // 创建测试文件
      fs.mkdirSync(path.join(tempDir, 'tests'));
      fs.writeFileSync(path.join(tempDir, 'tests/example.test.ts'), 'describe("test", () => {});');
      fs.writeFileSync(path.join(tempDir, 'tests/utils.spec.js'), 'test("utils", () => {});');

      const testFiles = scanTestFiles(tempDir, ['tests']);

      expect(testFiles.length).toBe(2);
      expect(testFiles.some(t => t.path.includes('example.test.ts'))).toBe(true);
      expect(testFiles.some(t => t.path.includes('utils.spec.js'))).toBe(true);
    });

    it('should detect test type from path', () => {
      fs.mkdirSync(path.join(tempDir, 'tests/e2e'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'tests/e2e/login.test.ts'), '');

      const testFiles = scanTestFiles(tempDir, ['tests']);

      const e2eTest = testFiles.find(t => t.path.includes('login.test.ts'));
      expect(e2eTest?.type).toBe('e2e');
    });

    it('should infer source file for test', () => {
      // 创建源文件和测试文件
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src/utils.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'src/utils.test.ts'), '');

      const testFiles = scanTestFiles(tempDir, ['src']);

      const test = testFiles.find(t => t.path.includes('utils.test.ts'));
      expect(test?.sourceFile).toBeDefined();
    });
  });

  describe('scanSourceFiles', () => {
    it('should find source files', () => {
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src/index.ts'), 'export const main = () => {};');
      fs.writeFileSync(path.join(tempDir, 'src/utils.ts'), 'export function helper() {}');

      const sourceFiles = scanSourceFiles(tempDir, ['src'], []);

      expect(sourceFiles.length).toBe(2);
      expect(sourceFiles.some(s => s.path.includes('index.ts'))).toBe(true);
    });

    it('should exclude test files', () => {
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src/index.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'src/index.test.ts'), '');

      const sourceFiles = scanSourceFiles(tempDir, ['src'], []);

      expect(sourceFiles.some(s => s.path.includes('index.test.ts'))).toBe(false);
    });

    it('should extract exports', () => {
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src/module.ts'),
        'export function funcA() {}\nexport class ClassB {}\nexport const constC = 1;');

      const sourceFiles = scanSourceFiles(tempDir, ['src'], []);

      const module = sourceFiles.find(s => s.path.includes('module.ts'));
      expect(module?.exports).toContain('funcA');
      expect(module?.exports).toContain('ClassB');
      expect(module?.exports).toContain('constC');
    });

    it('should detect covered sources', () => {
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src/utils.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'src/utils.test.ts'), '');

      const existingTests: ExistingTestFile[] = [
        { path: 'src/utils.test.ts', type: 'unit', sourceFile: 'src/utils.ts' }
      ];

      const sourceFiles = scanSourceFiles(tempDir, ['src'], existingTests);

      // 已覆盖的文件应该被排除
      expect(sourceFiles.some(s => s.path.includes('utils.ts'))).toBe(false);
    });
  });

  describe('scanDirectory', () => {
    it('should recursively scan directories', () => {
      fs.mkdirSync(path.join(tempDir, 'src/nested'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'src/a.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'src/nested/b.ts'), '');

      const files: string[] = [];
      scanDirectory(path.join(tempDir, 'src'), (filePath) => {
        files.push(filePath);
      });

      expect(files.length).toBe(2);
    });

    it('should exclude node_modules and dist', () => {
      fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'dist'), { recursive: true });
      fs.mkdirSync(path.join(tempDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'src/file.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'node_modules/package.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'dist/bundle.js'), '');

      const files: string[] = [];
      scanDirectory(tempDir, (filePath) => {
        files.push(filePath);
      });

      expect(files.length).toBe(1);
      expect(files[0].replace(/\\/g, '/')).toContain('src/file.ts');
    });
  });

  describe('inferFileType', () => {
    it('should detect component type', () => {
      expect(inferFileType('src/components/Button.tsx')).toBe('component');
      expect(inferFileType('src/Button.jsx')).toBe('component');
    });

    it('should detect service type', () => {
      expect(inferFileType('src/services/UserService.ts')).toBe('service');
      // UserService.ts matches class pattern due to uppercase letter
      expect(inferFileType('src/user_service.ts')).toBe('service');
    });

    it('should detect util type', () => {
      expect(inferFileType('src/utils/format.ts')).toBe('util');
      // formatUtil.ts contains uppercase letter which matches class pattern
      expect(inferFileType('src/format_util.ts')).toBe('util');
    });

    it('should return module for unknown types', () => {
      expect(inferFileType('src/lib/helper.ts')).toBe('module');
    });
  });

  describe('extractExports', () => {
    it('should extract function exports', () => {
      const filePath = path.join(tempDir, 'test.ts');
      fs.writeFileSync(filePath, 'export function myFunc() {}\nexport async function asyncFunc() {}');

      const exports = extractExports(filePath);

      expect(exports).toContain('myFunc');
      expect(exports).toContain('asyncFunc');
    });

    it('should extract class exports', () => {
      const filePath = path.join(tempDir, 'test.ts');
      fs.writeFileSync(filePath, 'export class MyClass {}');

      const exports = extractExports(filePath);

      expect(exports).toContain('MyClass');
    });

    it('should extract const exports', () => {
      const filePath = path.join(tempDir, 'test.ts');
      fs.writeFileSync(filePath, 'export const MY_CONST = 1;');

      const exports = extractExports(filePath);

      expect(exports).toContain('MY_CONST');
    });

    it('should extract named exports', () => {
      const filePath = path.join(tempDir, 'test.ts');
      fs.writeFileSync(filePath, 'export { funcA, funcB };');

      const exports = extractExports(filePath);

      expect(exports).toContain('funcA');
      expect(exports).toContain('funcB');
    });

    it('should extract Python defs', () => {
      const filePath = path.join(tempDir, 'test.py');
      fs.writeFileSync(filePath, 'def public_func():\n    pass\ndef _private_func():\n    pass');

      const exports = extractExports(filePath);

      expect(exports).toContain('public_func');
      expect(exports).not.toContain('_private_func');
    });
  });

  describe('inferTestTypes', () => {
    it('should suggest unit for all files', () => {
      const types = inferTestTypes('module', 'src/file.ts');
      expect(types).toContain('unit');
    });

    it('should suggest ui for components', () => {
      const types = inferTestTypes('component', 'src/Button.tsx');
      expect(types).toContain('ui');
    });

    it('should suggest integration for services', () => {
      const types = inferTestTypes('service', 'src/UserService.ts');
      expect(types).toContain('integration');
    });

    it('should suggest api for api routes', () => {
      const types = inferTestTypes('module', 'src/api/users.ts');
      expect(types).toContain('api');
    });
  });

  describe('detectFrontend', () => {
    it('should detect frontend project', () => {
      const packageJson = {
        dependencies: { react: '18.0.0' }
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));

      const { isFrontend } = detectFrontend(tempDir, 'react');

      expect(isFrontend).toBe(true);
    });

    it('should detect UI components directory', () => {
      fs.mkdirSync(path.join(tempDir, 'components'), { recursive: true });

      const { hasUIComponents } = detectFrontend(tempDir, 'react');

      expect(hasUIComponents).toBe(true);
    });

    it('should return false for non-frontend project', () => {
      const { isFrontend } = detectFrontend(tempDir, 'nodejs');

      expect(isFrontend).toBe(false);
    });
  });

  describe('performScan', () => {
    it('should return complete scan result', () => {
      // 创建一个完整的项目结构
      const packageJson = {
        devDependencies: { vitest: '1.0.0', typescript: '5.0.0' }
      };
      fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson));
      fs.writeFileSync(path.join(tempDir, 'vitest.config.ts'), '');
      fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), '{}');

      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.mkdirSync(path.join(tempDir, 'tests'));

      fs.writeFileSync(path.join(tempDir, 'src/utils.ts'), 'export function helper() {}');
      fs.writeFileSync(path.join(tempDir, 'tests/utils.test.ts'), 'describe("utils", () => {});');

      const result = performScan(tempDir);

      expect(result.projectRoot).toBe(tempDir);
      expect(result.frameworks.length).toBeGreaterThan(0);
      expect(result.projectType).toBe('typescript');
      expect(result.existingTests.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should scan specific target directory', () => {
      fs.mkdirSync(path.join(tempDir, 'src/features'), { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'src/features/auth.ts'), '');

      const result = performScan(tempDir, 'src/features');

      expect(result.target).toBe('src/features');
    });
  });

  describe('hasCorrespondingTest', () => {
    it('should find matching test file', () => {
      const existingTests: ExistingTestFile[] = [
        { path: 'src/utils.test.ts', type: 'unit' }
      ];

      const result = hasCorrespondingTest('src/utils.ts', existingTests);
      expect(result).toBe(true);
    });

    it('should return false when no matching test', () => {
      const existingTests: ExistingTestFile[] = [
        { path: 'src/other.test.ts', type: 'unit' }
      ];

      const result = hasCorrespondingTest('src/utils.ts', existingTests);
      expect(result).toBe(false);
    });
  });

  describe('inferSourceFile', () => {
    it('should infer source from test file', () => {
      fs.mkdirSync(path.join(tempDir, 'src'));
      fs.writeFileSync(path.join(tempDir, 'src/utils.ts'), '');

      const result = inferSourceFile(path.join(tempDir, 'src/utils.test.ts'), tempDir);

      // Normalize path for cross-platform compatibility
      expect(result?.replace(/\\/g, '/')).toBe('src/utils.ts');
    });
  });
});