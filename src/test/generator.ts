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

  // 需要生命周期钩子的文件类型
  const needsLifecycle = ['service', 'util', 'api', 'module'].includes(source.fileType);

  // 需要 vi 导入的测试类型（使用 Mock 验证副作用）
  const needsViImport = ['service', 'util', 'api', 'component', 'module'].includes(source.fileType);

  // 测试块
  const testBlocks = source.exports.map(exp =>
    generateTestBlock(exp, framework, usesDescribeIt, source.fileType)
  );

  // 组装内容
  const content = `${needsViImport ? `import { vi } from 'vitest';\n` : ''}${imports}
${needsLifecycle ? `
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
` : ''}
${testBlocks.join('\n\n')}
`;

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
 * 生成测试块 - 根据文件类型生成有意义的业务测试
 */
function generateTestBlock(
  exportName: string,
  framework: string,
  usesDescribeIt: boolean | undefined,
  fileType: string
): string {
  const useDescribe = usesDescribeIt ?? true;

  if (useDescribe) {
    // 根据文件类型生成不同的测试场景
    const testCases = generateBusinessTestCases(exportName, fileType);
    const testBlocks = testCases.map(tc => generateTestCaseBlock(tc, exportName));

    return `describe('${getDescribeTitle(exportName, fileType)}', () => {
${testBlocks.join('\n\n')}
});`;
  } else {
    return `test('${exportName}', () => {
  expect(${exportName}).toBeDefined();
  expect(${exportName}(null)).toBeDefined();
});`;
  }
}

/**
 * 测试用例定义
 */
interface BusinessTestCase {
  name: string;
  arrange: string;
  act: string;
  assert: string[];
}

/**
 * 根据文件类型生成业务测试用例
 */
function generateBusinessTestCases(exportName: string, fileType: string): BusinessTestCase[] {
  switch (fileType) {
    case 'service':
      return [
        {
          name: 'should return valid result on successful execution',
          arrange: `// Arrange - 准备有效的输入参数
    const params = { id: 'test-id', data: {} };
    const spy = vi.spyOn({ ${exportName} }, '${exportName}');`,
          act: `// Act - 执行服务方法
    const result = await ${exportName}(params);`,
          assert: [
            'expect(result).toBeDefined();',
            'expect(result).toHaveProperty(\'data\');',
            'expect(result.error).toBeUndefined();',
            `expect(spy).toHaveBeenCalledWith(params);`,
            'expect(spy).toHaveBeenCalledTimes(1);'
          ]
        },
        {
          name: 'should handle invalid input gracefully',
          arrange: `// Arrange - 准备无效输入
    const invalidParams = { id: null, data: undefined };`,
          act: `// Act - 使用无效参数调用
    const result = await ${exportName}(invalidParams);`,
          assert: [
            'expect(result).toBeDefined();',
            'expect(result).toHaveProperty(\'error\');'
          ]
        },
        {
          name: 'should handle empty parameters',
          arrange: `// Arrange - 空参数测试`,
          act: `// Act & Assert - 验证空参数处理
    const result = await ${exportName}({});`,
          assert: [
            'expect(result).toBeDefined();',
            '// 应该返回默认值或错误信息，而非崩溃'
          ]
        },
        {
          name: 'should handle missing required fields',
          arrange: `// Arrange - 缺少必填字段`,
          act: `// Act`,
          assert: [
            `expect(() => ${exportName}(null)).not.toThrow();`,
            'expect(() => ${exportName}(undefined)).not.toThrow();'
          ]
        }
      ];

    case 'util':
      return [
        {
          name: 'should process valid input correctly',
          arrange: `// Arrange - 准备有效输入
    const input = 'test-value';
    const expected = 'expected-result';
    const spy = vi.spyOn({ ${exportName} }, '${exportName}');`,
          act: `// Act
    const result = ${exportName}(input);`,
          assert: [
            'expect(result).toBeDefined();',
            'expect(typeof result).toBe(\'string\');',
            `expect(spy).toHaveBeenCalledWith(input);`,
            'expect(spy).toHaveBeenCalledTimes(1);'
          ]
        },
        {
          name: 'should handle null input',
          arrange: `// Arrange - null 输入`,
          act: `// Act & Assert`,
          assert: [
            `expect(() => ${exportName}(null)).not.toThrow();`,
            'const result = ${exportName}(null);',
            'expect(result).toBeDefined();'
          ]
        },
        {
          name: 'should handle empty string input',
          arrange: `// Arrange - 空字符串输入`,
          act: `// Act
    const result = ${exportName}('');`,
          assert: [
            'expect(result).toBeDefined();',
            '// 验证空字符串的预期行为'
          ]
        },
        {
          name: 'should handle various input types',
          arrange: `// Arrange - 多种输入类型测试`,
          act: `// Act - 测试不同类型`,
          assert: [
            'const numResult = ${exportName}(123);',
            'const boolResult = ${exportName}(true);',
            'const objResult = ${exportName}({ key: \'value\' });',
            'expect(numResult).toBeDefined();',
            'expect(boolResult).toBeDefined();',
            'expect(objResult).toBeDefined();'
          ]
        }
      ];

    case 'component':
      return [
        {
          name: 'should render without crashing',
          arrange: `// Arrange - 准备组件 props
    const props = { title: \'Test Title\', onClick: vi.fn() };`,
          act: `// Act - 渲染组件
    const { container } = render(<${exportName} {...props} />);`,
          assert: [
            'expect(container).toBeDefined();',
            'expect(container.firstChild).toBeInTheDocument();'
          ]
        },
        {
          name: 'should handle user interaction',
          arrange: `// Arrange - 准备交互测试
    const handleClick = vi.fn();
    const props = { onClick: handleClick };`,
          act: `// Act - 模拟用户点击
    const { getByRole } = render(<${exportName} {...props} />);
    fireEvent.click(getByRole(\'button\'));`,
          assert: [
            'expect(handleClick).toHaveBeenCalledTimes(1);'
          ]
        },
        {
          name: 'should display correct content with props',
          arrange: `// Arrange - 准备显示内容测试
    const testContent = \'Hello World\';
    const props = { children: testContent };`,
          act: `// Act - 渲染并检查内容
    const { getByText } = render(<${exportName} {...props} />);`,
          assert: [
            'expect(getByText(testContent)).toBeInTheDocument();'
          ]
        },
        {
          name: 'should handle missing optional props',
          arrange: `// Arrange - 无可选 props`,
          act: `// Act - 仅传递必需 props
    const { container } = render(<${exportName} />);`,
          assert: [
            'expect(container).toBeDefined();',
            '// 组件应使用默认值正常渲染'
          ]
        }
      ];

    case 'api':
      return [
        {
          name: 'should return success response for valid request',
          arrange: `// Arrange - 准备有效的 API 请求参数
    const request = { method: \'GET\', path: \'/api/test\' };
    const mockResponse = { status: 200, data: { id: 1 } };
    const spy = vi.spyOn({ ${exportName} }, '${exportName}').mockResolvedValue(mockResponse);`,
          act: `// Act - 执行 API 调用
    const response = await ${exportName}(request);`,
          assert: [
            'expect(response).toBeDefined();',
            'expect(response.status).toBe(200);',
            'expect(response.data).toBeDefined();',
            `expect(spy).toHaveBeenCalledWith(request);`,
            'expect(spy).toHaveBeenCalledTimes(1);'
          ]
        },
        {
          name: 'should handle 404 not found',
          arrange: `// Arrange - 准备不存在的资源请求
    const request = { method: \'GET\', path: \'/api/nonexistent\' };
    const mockResponse = { status: 404, error: \'Not Found\' };
    vi.spyOn({ ${exportName} }, '${exportName}').mockResolvedValue(mockResponse);`,
          act: `// Act - 请求不存在的资源
    const response = await ${exportName}(request);`,
          assert: [
            'expect(response.status).toBe(404);',
            'expect(response.error).toBeDefined();'
          ]
        },
        {
          name: 'should handle invalid request body',
          arrange: `// Arrange - 准备无效的请求体
    const request = { method: \'POST\', path: \'/api/test\', body: null };
    const mockResponse = { status: 400, error: \'invalid request\' };
    vi.spyOn({ ${exportName} }, '${exportName}').mockResolvedValue(mockResponse);`,
          act: `// Act - 发送无效请求
    const response = await ${exportName}(request);`,
          assert: [
            'expect(response.status).toBe(400);',
            'expect(response.error).toContain(\'invalid\');'
          ]
        },
        {
          name: 'should handle network errors gracefully',
          arrange: `// Arrange - 模拟网络错误
    const request = { method: \'GET\', path: \'/api/error\' };
    vi.spyOn({ ${exportName} }, '${exportName}').mockRejectedValue(new Error('Network Error'));`,
          act: `// Act - 处理错误响应`,
          assert: [
            `await expect(${exportName}(request)).rejects.toThrow('Network Error');`,
            '// 应该返回错误对象而非抛出异常'
          ]
        }
      ];

    default:
      // 通用模块测试
      return [
        {
          name: 'should return defined result for valid input',
          arrange: `// Arrange - 准备有效输入
    const input = {};`,
          act: `// Act - 执行函数
    const result = ${exportName}(input);`,
          assert: [
            'expect(result).toBeDefined();'
          ]
        },
        {
          name: 'should handle null input',
          arrange: `// Arrange - null 输入`,
          act: `// Act`,
          assert: [
            `expect(() => ${exportName}(null)).not.toThrow();`
          ]
        },
        {
          name: 'should handle undefined input',
          arrange: `// Arrange - undefined 输入`,
          act: `// Act`,
          assert: [
            `expect(() => ${exportName}(undefined)).not.toThrow();`
          ]
        }
      ];
  }
}

/**
 * 生成单个测试用例块
 */
function generateTestCaseBlock(tc: BusinessTestCase, exportName: string): string {
  const indent = '  ';
  const actIndent = tc.act.includes('\n') ? indent : indent + '  ';
  const assertLines = tc.assert.map(a => `${indent}  ${a}`).join('\n');

  return `${indent}it('${tc.name}', () => {
${indent}  ${tc.arrange}
${actIndent}${tc.act}
${assertLines}
${indent}});`;
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