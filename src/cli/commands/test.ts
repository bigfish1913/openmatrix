// src/cli/commands/test.ts
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type {
  TestScanResult,
  TestFrameworkInfo,
  TestFramework,
  TestType,
  ExistingTestFile,
  UncoveredSourceFile,
  ProjectType
} from '../../types/index.js';

/**
 * 检测测试框架
 */
function detectTestFrameworks(projectRoot: string): TestFrameworkInfo[] {
  const frameworks: TestFrameworkInfo[] = [];

  // 检测 package.json (Node.js/TypeScript)
  const packageJsonPath = path.join(projectRoot, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Vitest
      if (deps.vitest) {
        const configFiles = ['vitest.config.ts', 'vitest.config.js', 'vite.config.ts', 'vite.config.js'];
        const configFile = configFiles.find(f => fs.existsSync(path.join(projectRoot, f)));
        frameworks.push({
          framework: 'vitest',
          version: deps.vitest,
          configFile,
          isPrimary: true,
          supportedTypes: ['unit', 'integration'],
          commands: {
            test: 'vitest run',
            testFile: 'vitest run <file>',
            testCoverage: 'vitest run --coverage',
            watch: 'vitest watch',
            updateSnapshot: 'vitest run --update'
          }
        });
      }

      // Jest
      if (deps.jest || deps['@types/jest']) {
        const configFiles = ['jest.config.ts', 'jest.config.js', 'jest.config.json'];
        const configFile = configFiles.find(f => fs.existsSync(path.join(projectRoot, f)));
        frameworks.push({
          framework: 'jest',
          version: deps.jest || deps['@types/jest'],
          configFile,
          isPrimary: !frameworks.some(f => f.framework === 'vitest'),
          supportedTypes: ['unit', 'integration'],
          commands: {
            test: 'jest',
            testFile: 'jest <file>',
            testCoverage: 'jest --coverage',
            watch: 'jest --watch',
            updateSnapshot: 'jest --updateSnapshot'
          }
        });
      }

      // Mocha
      if (deps.mocha) {
        const configFiles = ['.mocharc.json', '.mocharc.js', '.mocharc.yml'];
        const configFile = configFiles.find(f => fs.existsSync(path.join(projectRoot, f)));
        frameworks.push({
          framework: 'mocha',
          version: deps.mocha,
          configFile,
          isPrimary: !frameworks.some(f => f.isPrimary),
          supportedTypes: ['unit', 'integration'],
          commands: {
            test: 'mocha',
            testFile: 'mocha <file>',
            testCoverage: 'nyc mocha'
          }
        });
      }

      // Playwright (E2E)
      if (deps['@playwright/test']) {
        const configFile = fs.existsSync(path.join(projectRoot, 'playwright.config.ts'))
          ? 'playwright.config.ts'
          : fs.existsSync(path.join(projectRoot, 'playwright.config.js'))
            ? 'playwright.config.js'
            : undefined;
        frameworks.push({
          framework: 'playwright',
          version: deps['@playwright/test'],
          configFile,
          isPrimary: false,
          supportedTypes: ['e2e', 'ui', 'visual', 'accessibility'],
          commands: {
            test: 'playwright test',
            testFile: 'playwright test <file>',
            watch: 'playwright test --ui'
          }
        });
      }

      // Cypress (E2E)
      if (deps.cypress) {
        const configFile = fs.existsSync(path.join(projectRoot, 'cypress.config.ts'))
          ? 'cypress.config.ts'
          : fs.existsSync(path.join(projectRoot, 'cypress.config.js'))
            ? 'cypress.config.js'
            : undefined;
        frameworks.push({
          framework: 'cypress',
          version: deps.cypress,
          configFile,
          isPrimary: false,
          supportedTypes: ['e2e', 'ui', 'integration'],
          commands: {
            test: 'cypress run',
            testFile: 'cypress run --spec <file>',
            watch: 'cypress open'
          }
        });
      }
    } catch {
      // 忽略 JSON 解析错误
    }
  }

  // 检测 Python 测试框架
  const requirementsPath = path.join(projectRoot, 'requirements.txt');
  if (fs.existsSync(requirementsPath)) {
    const requirements = fs.readFileSync(requirementsPath, 'utf-8');
    if (requirements.includes('pytest')) {
      frameworks.push({
        framework: 'pytest',
        isPrimary: frameworks.length === 0,
        supportedTypes: ['unit', 'integration', 'api'],
        commands: {
          test: 'pytest',
          testFile: 'pytest <file>',
          testCoverage: 'pytest --cov'
        }
      });
    }
    if (requirements.includes('unittest')) {
      frameworks.push({
        framework: 'unittest',
        isPrimary: frameworks.length === 0 && !requirements.includes('pytest'),
        supportedTypes: ['unit', 'integration'],
        commands: {
          test: 'python -m unittest discover',
          testFile: 'python -m unittest <file>'
        }
      });
    }
  }

  // 检测 pyproject.toml (Python)
  const pyprojectPath = path.join(projectRoot, 'pyproject.toml');
  if (fs.existsSync(pyprojectPath)) {
    const pyproject = fs.readFileSync(pyprojectPath, 'utf-8');
    if (pyproject.includes('pytest')) {
      frameworks.push({
        framework: 'pytest',
        isPrimary: !frameworks.some(f => f.framework === 'pytest'),
        supportedTypes: ['unit', 'integration', 'api'],
        commands: {
          test: 'pytest',
          testFile: 'pytest <file>',
          testCoverage: 'pytest --cov'
        }
      });
    }
  }

  // 检测 Go 测试
  const goModPath = path.join(projectRoot, 'go.mod');
  if (fs.existsSync(goModPath)) {
    frameworks.push({
      framework: 'gotest',
      isPrimary: frameworks.length === 0,
      supportedTypes: ['unit', 'integration'],
      commands: {
        test: 'go test ./...',
        testFile: 'go test <file>',
        testCoverage: 'go test -cover ./...'
      }
    });
  }

  // 检测 Rust 测试
  const cargoPath = path.join(projectRoot, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    frameworks.push({
      framework: 'cargo-test',
      isPrimary: frameworks.length === 0,
      supportedTypes: ['unit', 'integration'],
      commands: {
        test: 'cargo test',
        testCoverage: 'cargo tarpaulin'
      }
    });
  }

  // 检测 Java 测试框架
  const pomPath = path.join(projectRoot, 'pom.xml');
  if (fs.existsSync(pomPath)) {
    const pom = fs.readFileSync(pomPath, 'utf-8');
    if (pom.includes('junit')) {
      frameworks.push({
        framework: 'junit',
        isPrimary: frameworks.length === 0,
        supportedTypes: ['unit', 'integration'],
        commands: {
          test: 'mvn test',
          testFile: 'mvn test -Dtest=<class>'
        }
      });
    }
    if (pom.includes('testng')) {
      frameworks.push({
        framework: 'testng',
        isPrimary: frameworks.length === 0 && !pom.includes('junit'),
        supportedTypes: ['unit', 'integration'],
        commands: {
          test: 'mvn test',
          testFile: 'mvn test -Dtest=<class>'
        }
      });
    }
  }

  // 检测 Gradle (Java/Kotlin)
  const gradlePath = path.join(projectRoot, 'build.gradle');
  const gradleKtsPath = path.join(projectRoot, 'build.gradle.kts');
  if (fs.existsSync(gradlePath) || fs.existsSync(gradleKtsPath)) {
    const gradleFile = fs.existsSync(gradlePath) ? gradlePath : gradleKtsPath;
    const gradle = fs.readFileSync(gradleFile, 'utf-8');
    if (gradle.includes('junit') || gradle.includes('test')) {
      frameworks.push({
        framework: 'junit',
        isPrimary: frameworks.length === 0,
        supportedTypes: ['unit', 'integration'],
        commands: {
          test: 'gradle test',
          testFile: 'gradle test --tests <class>'
        }
      });
    }
  }

  // 如果没有检测到框架，标记为 unknown
  if (frameworks.length === 0) {
    frameworks.push({
      framework: 'unknown',
      isPrimary: true,
      supportedTypes: [],
      commands: {
        test: ''
      }
    });
  }

  return frameworks;
}

/**
 * 检测项目类型
 */
function detectProjectType(projectRoot: string): ProjectType {
  const packageJsonPath = path.join(projectRoot, 'package.json');

  // Node.js/TypeScript 项目
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // 前端框架检测
      if (deps.react || deps['react-dom']) return 'react';
      if (deps.vue) return 'vue';
      if (deps['@angular/core']) return 'angular';
      if (deps.next) return 'nextjs';
      if (deps.nuxt) return 'nuxt';
      if (deps.svelte) return 'svelte';

      // TypeScript 检测
      if (deps.typescript || fs.existsSync(path.join(projectRoot, 'tsconfig.json'))) {
        return 'typescript';
      }

      return 'nodejs';
    } catch {
      return 'nodejs';
    }
  }

  // Python 项目
  if (
    fs.existsSync(path.join(projectRoot, 'requirements.txt')) ||
    fs.existsSync(path.join(projectRoot, 'pyproject.toml')) ||
    fs.existsSync(path.join(projectRoot, 'setup.py'))
  ) {
    return 'python';
  }

  // Go 项目
  if (fs.existsSync(path.join(projectRoot, 'go.mod'))) {
    return 'go';
  }

  // Rust 项目
  if (fs.existsSync(path.join(projectRoot, 'Cargo.toml'))) {
    return 'rust';
  }

  // Java 项目
  if (
    fs.existsSync(path.join(projectRoot, 'pom.xml')) ||
    fs.existsSync(path.join(projectRoot, 'build.gradle')) ||
    fs.existsSync(path.join(projectRoot, 'build.gradle.kts'))
  ) {
    return 'java';
  }

  // Flutter 项目
  if (fs.existsSync(path.join(projectRoot, 'pubspec.yaml'))) {
    const pubspec = fs.readFileSync(path.join(projectRoot, 'pubspec.yaml'), 'utf-8');
    if (pubspec.includes('flutter')) return 'flutter';
    return 'dart';
  }

  return 'unknown';
}

/**
 * 扫描测试文件
 */
function scanTestFiles(projectRoot: string, testDirs: string[]): ExistingTestFile[] {
  const testFiles: ExistingTestFile[] = [];
  const testPatterns = [
    /\.test\.(ts|tsx|js|jsx)$/,
    /\.spec\.(ts|tsx|js|jsx)$/,
    /_test\.(py)$/,
    /test_.*\.py$/,
    /_test\.go$/,
    /Test.*\.java$/,
    /.*Test\.java$/,
    /.*Tests\.cs$/
  ];

  for (const testDir of testDirs) {
    const fullPath = path.join(projectRoot, testDir);
    if (!fs.existsSync(fullPath)) continue;

    scanDirectory(fullPath, (filePath) => {
      const relativePath = path.relative(projectRoot, filePath);
      const fileName = path.basename(filePath);

      // 检查是否匹配测试文件模式
      const isTestFile = testPatterns.some(p => p.test(fileName));
      if (!isTestFile) return;

      // 推断测试类型
      let testType: TestType = 'unit';
      if (relativePath.includes('e2e') || relativePath.includes('end-to-end')) {
        testType = 'e2e';
      } else if (relativePath.includes('integration')) {
        testType = 'integration';
      } else if (relativePath.includes('api')) {
        testType = 'api';
      } else if (relativePath.includes('ui') || relativePath.includes('component')) {
        testType = 'ui';
      }

      // 尝试推断关联的源文件
      const sourceFile = inferSourceFile(filePath, projectRoot);

      testFiles.push({
        path: relativePath,
        type: testType,
        sourceFile,
        lastModified: fs.statSync(filePath).mtime.toISOString()
      });
    });
  }

  return testFiles;
}

/**
 * 扫描源文件
 */
function scanSourceFiles(projectRoot: string, sourceDirs: string[], existingTests: ExistingTestFile[]): UncoveredSourceFile[] {
  const sourceFiles: UncoveredSourceFile[] = [];
  const sourcePatterns = [
    /\.(ts|tsx)$/,
    /\.(js|jsx)$/,
    /\.py$/,
    /\.go$/,
    /\.java$/,
    /\.rs$/,
    /\.cs$/
  ];

  // 排除测试文件
  const excludePatterns = [
    /\.test\.(ts|tsx|js|jsx)$/,
    /\.spec\.(ts|tsx|js|jsx)$/,
    /_test\.(py)$/,
    /test_.*\.py$/,
    /_test\.go$/,
    /Test.*\.java$/,
    /__tests__/,
    /tests?\//
  ];

  // 已有测试覆盖的源文件集合
  const coveredSources = new Set<string>();
  for (const test of existingTests) {
    if (test.sourceFile) {
      coveredSources.add(test.sourceFile);
    }
  }

  for (const sourceDir of sourceDirs) {
    const fullPath = path.join(projectRoot, sourceDir);
    if (!fs.existsSync(fullPath)) continue;

    scanDirectory(fullPath, (filePath) => {
      const relativePath = path.relative(projectRoot, filePath);
      const fileName = path.basename(filePath);

      // 排除测试文件
      if (excludePatterns.some(p => p.test(relativePath) || p.test(fileName))) return;

      // 检查是否匹配源文件模式
      const isSourceFile = sourcePatterns.some(p => p.test(fileName));
      if (!isSourceFile) return;

      // 排除类型声明文件
      if (fileName.endsWith('.d.ts')) return;

      // 推断文件类型
      const fileType = inferFileType(relativePath);

      // 提取导出（简化版）
      const exports = extractExports(filePath);

      // 检查是否有对应的测试文件
      const hasTest = coveredSources.has(relativePath) || hasCorrespondingTest(relativePath, existingTests);

      // 推断建议的测试类型
      const suggestedTestTypes = inferTestTypes(fileType, relativePath);

      sourceFiles.push({
        path: relativePath,
        fileType,
        exports,
        hasTest,
        suggestedTestTypes
      });
    });
  }

  return sourceFiles.filter(f => !f.hasTest);
}

/**
 * 递归扫描目录
 */
function scanDirectory(dir: string, callback: (filePath: string) => void): void {
  const excludeDirs = ['node_modules', 'dist', 'build', '.git', '__pycache__', 'vendor', 'target'];

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // 排除特定目录
      if (excludeDirs.includes(entry.name)) continue;
      scanDirectory(fullPath, callback);
    } else if (entry.isFile()) {
      callback(fullPath);
    }
  }
}

/**
 * 推断关联的源文件
 */
function inferSourceFile(testPath: string, projectRoot: string): string | undefined {
  const testFileName = path.basename(testPath);
  const testDir = path.dirname(testPath);

  // 移除测试后缀
  let sourceName = testFileName
    .replace(/\.test\.(ts|tsx|js|jsx)$/, '.$1')
    .replace(/\.spec\.(ts|tsx|js|jsx)$/, '$1')
    .replace(/_test\.py$/, '.py')
    .replace(/test_(.*)\.py$/, '$1.py')
    .replace(/_test\.go$/, '.go');

  if (sourceName === testFileName) return undefined;

  // 在同目录或父目录寻找源文件
  const possibleDirs = [
    testDir,
    path.join(testDir, '..'),
    path.join(projectRoot, 'src'),
    path.join(projectRoot, 'lib')
  ];

  for (const dir of possibleDirs) {
    const sourcePath = path.join(dir, sourceName);
    if (fs.existsSync(sourcePath)) {
      return path.relative(projectRoot, sourcePath);
    }
  }

  return undefined;
}

/**
 * 推断文件类型
 */
function inferFileType(filePath: string): UncoveredSourceFile['fileType'] {
  const fileName = path.basename(filePath);
  const dirPath = path.dirname(filePath);

  if (dirPath.includes('component') || fileName.includes('.tsx') || fileName.includes('.jsx')) {
    return 'component';
  }
  if (dirPath.includes('service') || fileName.includes('service')) {
    return 'service';
  }
  if (dirPath.includes('util') || dirPath.includes('utils') || fileName.includes('util')) {
    return 'util';
  }
  if (fileName.includes('.class.') || fileName.match(/[A-Z][a-z]+\.ts$/)) {
    return 'class';
  }
  if (dirPath.includes('api') || dirPath.includes('route')) {
    return 'module';
  }

  return 'module';
}

/**
 * 提取导出（简化版）
 */
function extractExports(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const exports: string[] = [];

    // 提取 export function/class/const
    const exportPatterns = [
      /export\s+function\s+(\w+)/g,
      /export\s+class\s+(\w+)/g,
      /export\s+const\s+(\w+)/g,
      /export\s+async\s+function\s+(\w+)/g,
      /export\s+\{[^}]*\}/g  // export { ... }
    ];

    for (const pattern of exportPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          exports.push(match[1]);
        } else {
          // 解析 export { ... }
          const items = match[0].match(/\w+/g);
          if (items) {
            exports.push(...items.filter(i => i !== 'export'));
          }
        }
      }
    }

    // Python def/class
    if (filePath.endsWith('.py')) {
      const pyPatterns = [
        /^def\s+(\w+)/gm,
        /^class\s+(\w+)/gm
      ];
      for (const pattern of pyPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          if (match[1] && !match[1].startsWith('_')) {
            exports.push(match[1]);
          }
        }
      }
    }

    return exports.slice(0, 10); // 限制数量
  } catch {
    return [];
  }
}

/**
 * 检查是否有对应的测试文件
 */
function hasCorrespondingTest(sourcePath: string, existingTests: ExistingTestFile[]): boolean {
  const sourceFileName = path.basename(sourcePath);

  // 生成可能的测试文件名
  const possibleTestNames = [
    sourceFileName.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1'),
    sourceFileName.replace(/\.(ts|tsx|js|jsx)$/, '.spec.$1'),
    sourceFileName.replace(/\.py$/, '_test.py'),
    sourceFileName.replace(/\.py$/, 'test_' + sourceFileName.replace('.py', '') + '.py'),
    sourceFileName.replace(/\.go$/, '_test.go')
  ];

  return existingTests.some(t => possibleTestNames.includes(path.basename(t.path)));
}

/**
 * 推断建议的测试类型
 */
function inferTestTypes(fileType: UncoveredSourceFile['fileType'], filePath: string): TestType[] {
  const types: TestType[] = ['unit'];

  if (fileType === 'component') {
    types.push('ui');
  }
  if (fileType === 'service') {
    types.push('integration');
  }
  if (filePath.includes('api') || filePath.includes('route')) {
    types.push('api');
  }

  return types;
}

/**
 * 检测测试风格
 */
function detectTestStyle(projectRoot: string, existingTests: ExistingTestFile[]): TestScanResult['testStyle'] | undefined {
  if (existingTests.length === 0) return undefined;

  // 读取第一个测试文件分析风格
  const sampleTest = existingTests[0];
  const testPath = path.join(projectRoot, sampleTest.path);

  try {
    const content = fs.readFileSync(testPath, 'utf-8');

    // 命名约定
    const hasDescribeIt = content.includes('describe(') && content.includes('it(');
    const hasTest = content.includes('test(');
    const namingConvention: 'describe-it' | 'test' | 'mixed' =
      hasDescribeIt && hasTest ? 'mixed' :
      hasDescribeIt ? 'describe-it' : 'test';

    // 断言库
    type AssertionLibrary = 'expect' | 'assert' | 'should' | 'chai' | 'unknown';
    let assertionLibrary: AssertionLibrary = 'expect';
    if (content.includes('assert(')) assertionLibrary = 'assert';
    if (content.includes('should(')) assertionLibrary = 'should';
    if (content.includes('chai')) assertionLibrary = 'chai';

    // TypeScript/JSX
    const usesTypeScript = testPath.endsWith('.ts') || testPath.endsWith('.tsx');
    const usesJSX = testPath.endsWith('.tsx') || testPath.endsWith('.jsx');

    // 文件后缀
    const fileSuffix = path.extname(testPath);

    // 文件位置
    const testDir = path.dirname(sampleTest.path);
    const sourceDir = sampleTest.sourceFile ? path.dirname(sampleTest.sourceFile) : '';
    const fileLocation: 'adjacent' | 'separate' =
      testDir === sourceDir || testDir === '__tests__' ? 'adjacent' : 'separate';

    return {
      namingConvention,
      assertionLibrary,
      usesTypeScript,
      usesJSX,
      fileSuffix,
      fileLocation
    };
  } catch {
    return undefined;
  }
}

/**
 * 检测是否有前端项目
 */
function detectFrontend(projectRoot: string, projectType: ProjectType): {
  isFrontend: boolean;
  hasUIComponents: boolean;
} {
  const frontendTypes: ProjectType[] = ['react', 'vue', 'angular', 'nextjs', 'nuxt', 'svelte', 'flutter'];
  const isFrontend = frontendTypes.includes(projectType);

  // 检查是否有 UI 组件目录
  const componentDirs = ['components', 'src/components', 'pages', 'src/pages', 'views', 'src/views'];
  const hasUIComponents = componentDirs.some(d => fs.existsSync(path.join(projectRoot, d)));

  return { isFrontend, hasUIComponents };
}

/**
 * 检测覆盖率报告
 */
function detectCoverageReport(projectRoot: string): TestScanResult['coverageReport'] | undefined {
  const coveragePaths = [
    'coverage/coverage-summary.json',
    'coverage/lcov-report/lcov.info',
    '.nyc_output/out.json',
    'coverage.json'
  ];

  for (const coveragePath of coveragePaths) {
    const fullPath = path.join(projectRoot, coveragePath);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const data = JSON.parse(content);

        // 简化覆盖率数据提取
        if (data.total) {
          return {
            total: data.total.lines?.pct || data.total,
            files: []
          };
        }
      } catch {
        // 忽略解析错误
      }
    }
  }

  return undefined;
}

/**
 * 运行测试验证
 */
async function runTests(projectRoot: string, frameworks: TestFrameworkInfo[]): Promise<{
  success: boolean;
  output: string;
  coverage?: number;
}> {
  const primaryFramework = frameworks.find(f => f.isPrimary) || frameworks[0];

  if (!primaryFramework || primaryFramework.framework === 'unknown') {
    return {
      success: false,
      output: 'No test framework detected'
    };
  }

  const testCommand = primaryFramework.commands.test;
  if (!testCommand) {
    return {
      success: false,
      output: 'No test command available'
    };
  }

  try {
    const { spawn } = await import('child_process');
    const parts = testCommand.split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    return new Promise((resolve) => {
      let output = '';
      const proc = spawn(command, args, {
        cwd: projectRoot,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        // 从输出提取覆盖率
        let coverage: number | undefined;
        const coverageMatch = output.match(/All files[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*([\d.]+)%/);
        if (coverageMatch) {
          coverage = parseFloat(coverageMatch[1]);
        }

        resolve({
          success: code === 0,
          output,
          coverage
        });
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          output: `Failed to run tests: ${err.message}`
        });
      });
    });
  } catch {
    return {
      success: false,
      output: 'Failed to spawn test process'
    };
  }
}

/**
 * 执行测试扫描
 */
function performScan(projectRoot: string, target?: string): TestScanResult {
  // 确定扫描目录
  const testDirs = ['tests', 'test', '__tests__', 'spec', 'src/__tests__', 'cypress/e2e', 'e2e'];
  const sourceDirs = target ? [target] : ['src', 'lib', 'app', 'packages'];

  // 检测测试框架
  const frameworks = detectTestFrameworks(projectRoot);

  // 检测项目类型
  const projectType = detectProjectType(projectRoot);

  // 扫描测试文件
  const existingTests = scanTestFiles(projectRoot, testDirs);

  // 扫描源文件
  const uncoveredSources = scanSourceFiles(projectRoot, sourceDirs, existingTests);

  // 检测前端信息
  const { isFrontend, hasUIComponents } = detectFrontend(projectRoot, projectType);

  // 检测测试风格
  const testStyle = detectTestStyle(projectRoot, existingTests);

  // 检测覆盖率报告
  const coverageReport = detectCoverageReport(projectRoot);

  // 构建结果
  return {
    timestamp: new Date().toISOString(),
    projectRoot,
    target: target || 'all',
    frameworks,
    existingTests,
    uncoveredSources,
    projectType,
    isFrontend,
    hasUIComponents,
    coverageReport,
    testStyle,
    summary: {
      frameworkCount: frameworks.length,
      existingTestCount: existingTests.length,
      uncoveredSourceCount: uncoveredSources.length,
      hasTestConfig: frameworks.some(f => f.configFile),
      hasCoverageConfig: frameworks.some(f => f.commands.testCoverage)
    }
  };
}

export const testCommand = new Command('test')
  .description('扫描项目测试状况 - 检测框架、扫描文件、发现缺失')
  .argument('[target]', '扫描目标目录或文件')
  .option('--json', '输出 JSON 格式')
  .option('--verify', '扫描后运行测试验证')
  .action(async (target: string | undefined, options) => {
    const projectRoot = process.cwd();

    // 检查项目目录
    if (!fs.existsSync(projectRoot)) {
      console.log('❌ 项目目录不存在');
      return;
    }

    // 执行扫描
    const result = performScan(projectRoot, target);

    // 如果需要验证
    if (options.verify) {
      console.log('🔍 执行测试验证...\n');
      const verifyResult = await runTests(projectRoot, result.frameworks);
      result.coverageReport = {
        total: verifyResult.coverage || 0,
        files: []
      };

      if (!options.json) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`测试验证: ${verifyResult.success ? '✅ 通过' : '❌ 失败'}`);
        if (verifyResult.coverage) {
          console.log(`覆盖率: ${verifyResult.coverage}%`);
        }
        if (!verifyResult.success) {
          console.log('\n错误输出:');
          console.log(verifyResult.output.slice(0, 500));
        }
      }
    }

    // 输出结果
    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // 格式化输出
    console.log('\n🔍 测试扫描结果');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`扫描时间:   ${result.timestamp}`);
    console.log(`项目类型:   ${result.projectType}`);
    console.log(`前端项目:   ${result.isFrontend ? '是' : '否'}`);
    console.log(`UI组件:     ${result.hasUIComponents ? '有' : '无'}`);

    console.log('\n📊 测试框架:');
    for (const framework of result.frameworks) {
      const primary = framework.isPrimary ? ' (主要)' : '';
      console.log(`  - ${framework.framework}${primary}`);
      if (framework.version) console.log(`    版本: ${framework.version}`);
      if (framework.configFile) console.log(`    配置: ${framework.configFile}`);
      console.log(`    支持类型: ${framework.supportedTypes.join(', ')}`);
    }

    console.log('\n📁 文件统计:');
    console.log(`  现有测试: ${result.existingTests.length} 个`);
    console.log(`  未覆盖源: ${result.uncoveredSources.length} 个`);

    if (result.coverageReport) {
      console.log(`\n📈 覆盖率: ${result.coverageReport.total}%`);
    }

    if (result.testStyle) {
      console.log('\n📝 测试风格:');
      console.log(`  命名约定: ${result.testStyle.namingConvention}`);
      console.log(`  断言库:   ${result.testStyle.assertionLibrary}`);
      console.log(`  TypeScript: ${result.testStyle.usesTypeScript ? '是' : '否'}`);
    }

    if (result.uncoveredSources.length > 0) {
      console.log('\n⚠️  未覆盖的源文件:');
      for (const source of result.uncoveredSources.slice(0, 10)) {
        console.log(`  - ${source.path} (${source.fileType})`);
        if (source.exports.length > 0) {
          console.log(`    导出: ${source.exports.slice(0, 3).join(', ')}`);
        }
      }
      if (result.uncoveredSources.length > 10) {
        console.log(`  ... 还有 ${result.uncoveredSources.length - 10} 个文件`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 下一步:');
    console.log('   使用 /om:test 进入测试生成流程');
    console.log('   或使用 openmatrix test --verify 运行测试验证');
  });