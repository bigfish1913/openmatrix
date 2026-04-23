// src/test/generator.ts
/**
 * 测试用例生成器 - 基于上下文生成测试用例模板
 *
 * 功能：
 * - 生成测试文件模板
 * - 根据现有测试风格保持一致性
 * - 支持多种测试框架
 * - 生成 Mock 文件
 *
 * 模块依赖: test/context-analyzer → test/generator → skills/test
 */
import * as fs from 'fs';
import * as path from 'path';
import type {
  TestScanResult,
  TestFrameworkInfo,
  UncoveredSourceFile,
  TestStyle,
  TestType,
  TestCase,
  GeneratedTestFile,
  GeneratedMockFile,
  TestGenerationResult,
  TestConfig
} from '../types/index.js';

/**
 * 测试模板配置
 */
interface TemplateConfig {
  framework: string;
  testStyle: TestStyle | undefined;
  outputDir: string;
  fileSuffix: string;
}

/**
 * 生成测试文件
 */
export function generateTestFiles(
  scanResult: TestScanResult,
  config: TestConfig,
  selectedSources: UncoveredSourceFile[]
): TestGenerationResult {
  const templateConfig: TemplateConfig = {
    framework: config.framework,
    testStyle: scanResult.testStyle,
    outputDir: config.outputDir || 'tests',
    fileSuffix: scanResult.testStyle?.fileSuffix || '.test.ts'
  };

  const files: GeneratedTestFile[] = [];
  const testCases: TestCase[] = [];
  const mockFiles: GeneratedMockFile[] = [];

  for (const source of selectedSources) {
    const testFile = generateSingleTestFile(source, templateConfig, scanResult.projectRoot);
    files.push(testFile);

    const cases = generateTestCaseDescriptions(source, config.testTypes);
    testCases.push(...cases);
  }

  // 如果需要 Mock
  if (config.includeMocks) {
    const mocks = generateMockFiles(selectedSources, templateConfig, scanResult.projectRoot);
    mockFiles.push(...mocks);
  }

  // 获取运行命令
  const primaryFramework = scanResult.frameworks.find(f => f.isPrimary);
  const runCommand = primaryFramework?.commands.test || 'npm test';

  return {
    timestamp: new Date().toISOString(),
    config,
    files,
    testCases,
    mockFiles,
    statistics: {
      fileCount: files.length,
      testCaseCount: testCases.length,
      unitTestCount: testCases.filter(c => c.type === 'unit').length,
      integrationTestCount: testCases.filter(c => c.type === 'integration').length,
      e2eTestCount: testCases.filter(c => c.type === 'e2e').length,
      mockFileCount: mockFiles.length
    },
    runCommand,
    notes: [
      '测试文件已生成，请检查内容是否符合预期',
      '运行测试前请确保安装了必要的依赖'
    ]
  };
}

/**
 * 生成单个测试文件
 */
function generateSingleTestFile(
  source: UncoveredSourceFile,
  config: TemplateConfig,
  projectRoot: string
): GeneratedTestFile {
  const testPath = determineTestPath(source.path, config);
  const content = generateTestContent(source, config);

  return {
    path: testPath,
    content,
    type: config.testStyle?.usesTypeScript ? 'unit' : 'unit',
    sourceFile: source.path,
    testCaseIds: source.exports.map((exp, i) => `${source.path}-${exp}-${i}`),
    overwrites: false
  };
}

/**
 * 确定测试文件路径
 */
function determineTestPath(sourcePath: string, config: TemplateConfig): string {
  const sourceFileName = path.basename(sourcePath);
  const sourceDir = path.dirname(sourcePath);
  const ext = path.extname(sourceFileName);

  let testFileName: string;
  if (config.testStyle?.fileLocation === 'adjacent') {
    // 同目录
    testFileName = sourceFileName.replace(ext, config.fileSuffix.replace('.test', '.test').replace('.spec', '.spec'));
    return path.join(sourceDir, testFileName);
  } else {
    // 独立目录
    testFileName = sourceFileName.replace(ext, config.fileSuffix);
    return path.join(config.outputDir, sourceDir, testFileName);
  }
}

/**
 * 生成测试内容
 */
function generateTestContent(source: UncoveredSourceFile, config: TemplateConfig): string {
  const framework = config.framework;
  const usesDescribeIt = config.testStyle?.namingConvention === 'describe-it';
  const usesTypeScript = config.testStyle?.usesTypeScript ?? true;

  // 导入语句
  const importPath = source.path.replace(/\.(ts|tsx)$/, '').replace(/\.(js|jsx)$/, '');
  const imports = generateImports(source.exports, importPath, usesTypeScript);

  // 测试块
  const testBlocks = source.exports.map(exp => generateTestBlock(exp, framework, usesDescribeIt, source.fileType));

  // 组装内容
  const content = `${imports}\n\n${testBlocks.join('\n\n')}\n`;

  return content;
}

/**
 * 生成导入语句
 */
function generateImports(exports: string[], importPath: string, usesTypeScript: boolean): string {
  if (exports.length === 0) {
    return usesTypeScript
      ? `import * as target from '../../${importPath}';`
      : `const target = require('../../${importPath}');`;
  }

  return usesTypeScript
    ? `import { ${exports.join(', ')} } from '../../${importPath}';`
    : `const { ${exports.join(', ')} } = require('../../${importPath}');`;
}

/**
 * 生成测试块
 */
function generateTestBlock(
  exportName: string,
  framework: string,
  usesDescribeIt: boolean | undefined,
  fileType: string
): string {
  const useDescribe = usesDescribeIt ?? true;
  const describeOrTest = usesDescribeIt ? 'describe' : 'test';

  if (useDescribe) {
    return `describe('${getDescribeTitle(exportName, fileType)}', () => {
  it('should work correctly', () => {
    // Arrange
    const input = {};

    // Act
    const result = ${exportName}(input);

    // Assert
    expect(result).toBeDefined();
  });

  it('should handle edge cases', () => {
    // Arrange
    const input = null;

    // Act & Assert
    expect(() => ${exportName}(input)).not.toThrow();
  });
});`;
  } else {
    return `test('${exportName}', () => {
  expect(${exportName}).toBeDefined();
  expect(${exportName}(null)).toBeDefined();
});`;
  }
}

/**
 * 获取 describe 标题
 */
function getDescribeTitle(exportName: string, fileType: string): string {
  const typeLabels: Record<string, string> = {
    component: 'Component',
    service: 'Service',
    util: 'Util',
    module: 'Module',
    class: 'Class',
    function: 'Function'
  };

  const label = typeLabels[fileType] || 'Module';
  return `${label}: ${exportName}`;
}

/**
 * 生成测试用例描述
 */
function generateTestCaseDescriptions(
  source: UncoveredSourceFile,
  testTypes: TestType[]
): TestCase[] {
  const cases: TestCase[] = [];
  let caseId = 0;

  for (const exportName of source.exports) {
    for (const testType of testTypes) {
      cases.push({
        id: `${source.path}-${exportName}-${caseId++}`,
        name: `${exportName} - ${testType} test`,
        type: testType,
        description: `Test ${exportName} from ${source.path}`,
        filePath: source.path,
        sourceFile: source.path,
        target: exportName,
        priority: 'P2',
        steps: [
          { step: 1, action: `Prepare test input for ${exportName}` },
          { step: 2, action: `Call ${exportName} with prepared input` },
          { step: 3, action: 'Verify result matches expected output' }
        ],
        expectedResults: ['Function returns expected value', 'No errors thrown']
      });
    }
  }

  return cases;
}

/**
 * 生成 Mock 文件
 */
function generateMockFiles(
  sources: UncoveredSourceFile[],
  config: TemplateConfig,
  projectRoot: string
): GeneratedMockFile[] {
  const mocks: GeneratedMockFile[] = [];
  const mockDir = path.join(config.outputDir, '__mocks__');

  for (const source of sources) {
    // 为有外部依赖的文件生成 Mock
    if (source.fileType === 'service' || source.fileType === 'module') {
      const mockPath = path.join(mockDir, path.basename(source.path).replace(/\.(ts|js)$/, '.mock.ts'));
      const mockContent = generateMockContent(source, config);

      mocks.push({
        path: mockPath,
        content: mockContent,
        type: 'module',
        description: `Mock for ${source.path}`
      });
    }
  }

  return mocks;
}

/**
 * 生成 Mock 内容
 */
function generateMockContent(source: UncoveredSourceFile, config: TemplateConfig): string {
  const mockExports = source.exports.map(exp => {
    return `export const ${exp} = vi.fn(() => ({
  // Default mock implementation
  data: null,
  error: null
}));`;
  });

  return `// Mock for ${source.path}
import { vi } from 'vitest';

${mockExports.join('\n\n')}

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});
`;
}

/**
 * 生成 E2E 测试文件
 */
export function generateE2ETestFiles(
  scanResult: TestScanResult,
  config: TestConfig,
  uiComponents: UncoveredSourceFile[]
): GeneratedTestFile[] {
  const files: GeneratedTestFile[] = [];

  if (!config.includeUI) return files;

  const e2eDir = 'tests/e2e';

  for (const component of uiComponents) {
    const testPath = path.join(e2eDir, `${component.exports[0] || 'component'}.spec.ts`);
    const content = generateE2EContent(component, config.framework);

    files.push({
      path: testPath,
      content,
      type: 'e2e',
      sourceFile: component.path,
      testCaseIds: [`e2e-${component.path}`],
      overwrites: false
    });
  }

  return files;
}

/**
 * 生成 E2E 测试内容
 */
function generateE2EContent(component: UncoveredSourceFile, framework: string): string {
  if (framework === 'playwright') {
    return `// E2E test for ${component.path}
import { test, expect } from '@playwright/test';

test.describe('${component.exports[0] || 'Component'} E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should render correctly', async ({ page }) => {
    // Navigate to component page
    await page.waitForSelector('[data-testid="${component.exports[0]?.toLowerCase() || 'component'}"]');

    // Take screenshot
    await page.screenshot({ path: 'screenshots/${component.exports[0]?.toLowerCase() || 'component'}.png' });
  });

  test('should handle user interaction', async ({ page }) => {
    const element = await page.locator('[data-testid="${component.exports[0]?.toLowerCase() || 'component'}"]');
    await element.click();

    // Verify state change
    await expect(element).toHaveAttribute('data-active', 'true');
  });
});
`;
  }

  // Default Cypress style
  return `// E2E test for ${component.path}
describe('${component.exports[0] || 'Component'} E2E', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should render correctly', () => {
    cy.get('[data-testid="${component.exports[0]?.toLowerCase() || 'component'}"]')
      .should('be.visible');

    cy.screenshot('${component.exports[0]?.toLowerCase() || 'component'}');
  });

  it('should handle user interaction', () => {
    cy.get('[data-testid="${component.exports[0]?.toLowerCase() || 'component'}"]')
      .click()
      .should('have.attr', 'data-active', 'true');
  });
});
`;
}

/**
 * 写入生成的测试文件
 */
export function writeGeneratedFiles(
  files: GeneratedTestFile[],
  mockFiles: GeneratedMockFile[],
  projectRoot: string
): void {
  // 写入测试文件
  for (const file of files) {
    const fullPath = path.join(projectRoot, file.path);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (file.overwrites || !fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, file.content, 'utf-8');
    }
  }

  // 写入 Mock 文件
  for (const mock of mockFiles) {
    const fullPath = path.join(projectRoot, mock.path);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, mock.content, 'utf-8');
  }
}

/**
 * 生成测试文件（简化接口）
 */
export function generateTests(
  projectRoot: string,
  scanResult: TestScanResult,
  targetFiles?: string[]
): TestGenerationResult {
  // 确定要生成测试的源文件
  const sources = targetFiles
    ? scanResult.uncoveredSources.filter(s => targetFiles.includes(s.path))
    : scanResult.uncoveredSources;

  // 默认配置
  const config: TestConfig = {
    target: scanResult.target,
    testTypes: ['unit'],
    framework: scanResult.frameworks.find(f => f.isPrimary)?.framework || 'vitest',
    includeUI: scanResult.isFrontend && scanResult.hasUIComponents,
    includeMocks: true
  };

  return generateTestFiles(scanResult, config, sources);
}