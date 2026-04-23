import { describe, it, expect } from 'vitest';
import type {
  TestFramework,
  TestType,
  TestFrameworkInfo,
  TestConfig,
  TestCase,
  TestStep,
  MockRequirement,
  TestScanResult,
  ExistingTestFile,
  UncoveredSourceFile,
  TestGenerationResult,
  GeneratedTestFile,
  GeneratedMockFile,
  ProjectType,
} from '../../src/types/index.js';

describe('Test Types', () => {
  // ========== TestFramework Type Tests ==========

  describe('TestFramework', () => {
    it('should accept all valid TestFramework values', () => {
      const validFrameworks: TestFramework[] = [
        'vitest',
        'jest',
        'mocha',
        'jasmine',
        'playwright',
        'cypress',
        'selenium',
        'puppeteer',
        'appium',
        'detox',
        'pytest',
        'unittest',
        'junit',
        'testng',
        'xctest',
        'gotest',
        'cargo-test',
        'unknown',
      ];

      validFrameworks.forEach((framework) => {
        expect(framework).toBeDefined();
        expect(typeof framework).toBe('string');
      });
    });

    it('should have exactly 18 framework types plus unknown', () => {
      const frameworks: TestFramework[] = [
        'vitest', 'jest', 'mocha', 'jasmine',
        'playwright', 'cypress', 'selenium', 'puppeteer',
        'appium', 'detox',
        'pytest', 'unittest',
        'junit', 'testng',
        'xctest',
        'gotest', 'cargo-test',
        'unknown',
      ];
      expect(frameworks).toHaveLength(18);
    });

    it('should categorize frameworks correctly', () => {
      // JavaScript/TypeScript frameworks
      const jsFrameworks: TestFramework[] = ['vitest', 'jest', 'mocha', 'jasmine'];
      expect(jsFrameworks).toHaveLength(4);

      // E2E/UI testing frameworks
      const e2eFrameworks: TestFramework[] = ['playwright', 'cypress', 'selenium', 'puppeteer'];
      expect(e2eFrameworks).toHaveLength(4);

      // Mobile testing frameworks
      const mobileFrameworks: TestFramework[] = ['appium', 'detox'];
      expect(mobileFrameworks).toHaveLength(2);

      // Python frameworks
      const pythonFrameworks: TestFramework[] = ['pytest', 'unittest'];
      expect(pythonFrameworks).toHaveLength(2);

      // Java frameworks
      const javaFrameworks: TestFramework[] = ['junit', 'testng'];
      expect(javaFrameworks).toHaveLength(2);

      // Swift/iOS framework
      const swiftFramework: TestFramework = 'xctest';
      expect(swiftFramework).toBe('xctest');

      // Go framework
      const goFramework: TestFramework = 'gotest';
      expect(goFramework).toBe('gotest');

      // Rust framework
      const rustFramework: TestFramework = 'cargo-test';
      expect(rustFramework).toBe('cargo-test');
    });
  });

  // ========== TestType Type Tests ==========

  describe('TestType', () => {
    it('should accept all valid TestType values', () => {
      const validTypes: TestType[] = [
        'unit',
        'integration',
        'e2e',
        'api',
        'ui',
        'visual',
        'performance',
        'accessibility',
      ];

      validTypes.forEach((type) => {
        expect(type).toBeDefined();
        expect(typeof type).toBe('string');
      });
    });

    it('should have exactly 8 test types', () => {
      const testTypes: TestType[] = [
        'unit', 'integration', 'e2e', 'api',
        'ui', 'visual', 'performance', 'accessibility',
      ];
      expect(testTypes).toHaveLength(8);
    });

    it('should be assignable to string type', () => {
      const type: TestType = 'unit';
      const str: string = type;
      expect(typeof str).toBe('string');
    });
  });

  // ========== TestFrameworkInfo Interface Tests ==========

  describe('TestFrameworkInfo', () => {
    it('should create a valid TestFrameworkInfo with required fields', () => {
      const info: TestFrameworkInfo = {
        framework: 'vitest',
        isPrimary: true,
        supportedTypes: ['unit', 'integration'],
        commands: {
          test: 'npm test',
        },
      };

      expect(info.framework).toBe('vitest');
      expect(info.isPrimary).toBe(true);
      expect(info.supportedTypes).toEqual(['unit', 'integration']);
      expect(info.commands.test).toBe('npm test');
    });

    it('should support all optional fields', () => {
      const info: TestFrameworkInfo = {
        framework: 'jest',
        version: '29.0.0',
        configFile: 'jest.config.js',
        isPrimary: true,
        supportedTypes: ['unit', 'integration', 'e2e'],
        commands: {
          test: 'npm test',
          testFile: 'npm test -- <file>',
          testCoverage: 'npm test -- --coverage',
          watch: 'npm test -- --watch',
          updateSnapshot: 'npm test -- -u',
        },
      };

      expect(info.version).toBe('29.0.0');
      expect(info.configFile).toBe('jest.config.js');
      expect(info.commands.testFile).toBe('npm test -- <file>');
      expect(info.commands.testCoverage).toBe('npm test -- --coverage');
      expect(info.commands.watch).toBe('npm test -- --watch');
      expect(info.commands.updateSnapshot).toBe('npm test -- -u');
    });

    it('should allow optional fields to be undefined', () => {
      const info: TestFrameworkInfo = {
        framework: 'mocha',
        isPrimary: false,
        supportedTypes: ['unit'],
        commands: {
          test: 'npm test',
        },
      };

      expect(info.version).toBeUndefined();
      expect(info.configFile).toBeUndefined();
      expect(info.commands.testFile).toBeUndefined();
      expect(info.commands.testCoverage).toBeUndefined();
      expect(info.commands.watch).toBeUndefined();
      expect(info.commands.updateSnapshot).toBeUndefined();
    });

    it('should support different framework types', () => {
      const vitestInfo: TestFrameworkInfo = {
        framework: 'vitest',
        isPrimary: true,
        supportedTypes: ['unit', 'integration'],
        commands: { test: 'vitest run' },
      };

      const playwrightInfo: TestFrameworkInfo = {
        framework: 'playwright',
        isPrimary: false,
        supportedTypes: ['e2e', 'ui', 'visual'],
        commands: { test: 'playwright test' },
      };

      const pytestInfo: TestFrameworkInfo = {
        framework: 'pytest',
        isPrimary: true,
        supportedTypes: ['unit', 'integration', 'api'],
        commands: { test: 'pytest' },
      };

      expect(vitestInfo.framework).toBe('vitest');
      expect(playwrightInfo.framework).toBe('playwright');
      expect(pytestInfo.framework).toBe('pytest');
    });
  });

  // ========== TestConfig Interface Tests ==========

  describe('TestConfig', () => {
    it('should create a valid TestConfig with required fields', () => {
      const config: TestConfig = {
        target: 'src/utils/',
        testTypes: ['unit'],
        framework: 'vitest',
        includeUI: false,
      };

      expect(config.target).toBe('src/utils/');
      expect(config.testTypes).toEqual(['unit']);
      expect(config.framework).toBe('vitest');
      expect(config.includeUI).toBe(false);
    });

    it('should support all optional fields', () => {
      const config: TestConfig = {
        target: 'src/components/',
        testTypes: ['unit', 'integration', 'e2e'],
        framework: 'vitest',
        includeUI: true,
        coverageTarget: 80,
        outputDir: 'tests/',
        namingPattern: '*.test.ts',
        includeSnapshots: true,
        includeMocks: true,
        extraOptions: {
          timeout: 5000,
          retries: 3,
        },
      };

      expect(config.coverageTarget).toBe(80);
      expect(config.outputDir).toBe('tests/');
      expect(config.namingPattern).toBe('*.test.ts');
      expect(config.includeSnapshots).toBe(true);
      expect(config.includeMocks).toBe(true);
      expect(config.extraOptions?.timeout).toBe(5000);
      expect(config.extraOptions?.retries).toBe(3);
    });

    it('should allow optional fields to be undefined', () => {
      const config: TestConfig = {
        target: 'src/',
        testTypes: ['unit'],
        framework: 'jest',
        includeUI: false,
      };

      expect(config.coverageTarget).toBeUndefined();
      expect(config.outputDir).toBeUndefined();
      expect(config.namingPattern).toBeUndefined();
      expect(config.includeSnapshots).toBeUndefined();
      expect(config.includeMocks).toBeUndefined();
      expect(config.extraOptions).toBeUndefined();
    });

    it('should support multiple test types', () => {
      const config: TestConfig = {
        target: 'src/',
        testTypes: ['unit', 'integration', 'e2e', 'api', 'ui'],
        framework: 'vitest',
        includeUI: true,
      };

      expect(config.testTypes).toHaveLength(5);
      expect(config.testTypes).toContain('unit');
      expect(config.testTypes).toContain('integration');
      expect(config.testTypes).toContain('e2e');
      expect(config.testTypes).toContain('api');
      expect(config.testTypes).toContain('ui');
    });
  });

  // ========== TestCase Interface Tests ==========

  describe('TestCase', () => {
    it('should create a valid TestCase with required fields', () => {
      const testCase: TestCase = {
        id: 'TC-001',
        name: 'Test addition function',
        type: 'unit',
        description: 'Test that addition function works correctly',
        filePath: 'tests/math.test.ts',
        sourceFile: 'src/math.ts',
        target: 'add',
        priority: 'P1',
        steps: [
          { step: 1, action: 'Call add(2, 3)' },
        ],
        expectedResults: ['Should return 5'],
      };

      expect(testCase.id).toBe('TC-001');
      expect(testCase.name).toBe('Test addition function');
      expect(testCase.type).toBe('unit');
      expect(testCase.priority).toBe('P1');
      expect(testCase.steps).toHaveLength(1);
    });

    it('should support all optional fields', () => {
      const testCase: TestCase = {
        id: 'TC-002',
        name: 'Test API endpoint',
        type: 'api',
        description: 'Test GET /users endpoint',
        filePath: 'tests/api/users.test.ts',
        sourceFile: 'src/api/users.ts',
        target: 'getUsers',
        priority: 'P0',
        tags: ['api', 'users', 'critical'],
        preconditions: ['Database must be connected', 'User must be authenticated'],
        steps: [
          { step: 1, action: 'Send GET request to /users', input: { headers: { auth: 'token' } } },
          { step: 2, action: 'Verify response status', expectedOutput: 200 },
        ],
        expectedResults: ['Response status is 200', 'Response contains user list'],
        mockRequirements: [
          { type: 'api', target: 'authService', behavior: 'Return valid token', returnValue: 'mock-token' },
        ],
        testData: { userId: 1, role: 'admin' },
        dependencies: ['TC-001'],
      };

      expect(testCase.tags).toHaveLength(3);
      expect(testCase.preconditions).toHaveLength(2);
      expect(testCase.steps).toHaveLength(2);
      expect(testCase.mockRequirements).toHaveLength(1);
      expect(testCase.testData?.userId).toBe(1);
      expect(testCase.dependencies).toHaveLength(1);
    });

    it('should support all priority levels', () => {
      const priorities: TestCase['priority'][] = ['P0', 'P1', 'P2', 'P3'];

      priorities.forEach((priority, index) => {
        const tc: TestCase = {
          id: `TC-${index}`,
          name: 'Test',
          type: 'unit',
          description: 'Test',
          filePath: 'test.ts',
          sourceFile: 'source.ts',
          target: 'func',
          priority,
          steps: [],
          expectedResults: [],
        };
        expect(tc.priority).toBe(priority);
      });
    });

    it('should support all test types', () => {
      const testTypes: TestType[] = ['unit', 'integration', 'e2e', 'api', 'ui', 'visual', 'performance', 'accessibility'];

      testTypes.forEach((type, index) => {
        const tc: TestCase = {
          id: `TC-${index}`,
          name: 'Test',
          type,
          description: 'Test',
          filePath: 'test.ts',
          sourceFile: 'source.ts',
          target: 'func',
          priority: 'P1',
          steps: [],
          expectedResults: [],
        };
        expect(tc.type).toBe(type);
      });
    });
  });

  // ========== TestStep Interface Tests ==========

  describe('TestStep', () => {
    it('should create a valid TestStep with required fields', () => {
      const step: TestStep = {
        step: 1,
        action: 'Click login button',
      };

      expect(step.step).toBe(1);
      expect(step.action).toBe('Click login button');
    });

    it('should support optional input field', () => {
      const step: TestStep = {
        step: 1,
        action: 'Enter username',
        input: 'testuser',
      };

      expect(step.input).toBe('testuser');
    });

    it('should support optional expectedOutput field', () => {
      const step: TestStep = {
        step: 2,
        action: 'Submit form',
        expectedOutput: { status: 'success' },
      };

      expect(step.expectedOutput).toEqual({ status: 'success' });
    });

    it('should support complex input types', () => {
      const step: TestStep = {
        step: 1,
        action: 'Send API request',
        input: {
          method: 'POST',
          url: '/api/users',
          body: { name: 'Test', email: 'test@example.com' },
          headers: { 'Content-Type': 'application/json' },
        },
      };

      expect(step.input).toBeDefined();
      expect(typeof step.input).toBe('object');
    });

    it('should support all optional fields being undefined', () => {
      const step: TestStep = {
        step: 1,
        action: 'Simple action',
      };

      expect(step.input).toBeUndefined();
      expect(step.expectedOutput).toBeUndefined();
    });
  });

  // ========== MockRequirement Interface Tests ==========

  describe('MockRequirement', () => {
    it('should create a valid MockRequirement with required fields', () => {
      const mock: MockRequirement = {
        type: 'function',
        target: 'fetchData',
        behavior: 'Return mock data',
      };

      expect(mock.type).toBe('function');
      expect(mock.target).toBe('fetchData');
      expect(mock.behavior).toBe('Return mock data');
    });

    it('should support all mock types', () => {
      const mockTypes: MockRequirement['type'][] = ['function', 'module', 'api', 'component', 'service'];

      mockTypes.forEach((type, index) => {
        const mock: MockRequirement = {
          type,
          target: `target-${index}`,
          behavior: 'Mock behavior',
        };
        expect(mock.type).toBe(type);
      });
    });

    it('should support optional fields', () => {
      const mock: MockRequirement = {
        type: 'api',
        target: 'authApi',
        behavior: 'Return authentication token',
        returnValue: 'mock-token-123',
        verifyCalls: true,
      };

      expect(mock.returnValue).toBe('mock-token-123');
      expect(mock.verifyCalls).toBe(true);
    });

    it('should allow optional fields to be undefined', () => {
      const mock: MockRequirement = {
        type: 'module',
        target: 'logger',
        behavior: 'Log to console',
      };

      expect(mock.returnValue).toBeUndefined();
      expect(mock.verifyCalls).toBeUndefined();
    });

    it('should support complex returnValue types', () => {
      const mock: MockRequirement = {
        type: 'api',
        target: 'userApi',
        behavior: 'Return user data',
        returnValue: {
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          roles: ['admin', 'user'],
        },
      };

      expect(mock.returnValue).toBeDefined();
      expect(typeof mock.returnValue).toBe('object');
    });
  });

  // ========== TestScanResult Interface Tests ==========

  describe('TestScanResult', () => {
    it('should create a valid TestScanResult with required fields', () => {
      const result: TestScanResult = {
        timestamp: '2024-01-01T00:00:00Z',
        projectRoot: '/project',
        target: 'src/',
        frameworks: [],
        existingTests: [],
        uncoveredSources: [],
        projectType: 'typescript',
        isFrontend: false,
        hasUIComponents: false,
        summary: {
          frameworkCount: 0,
          existingTestCount: 0,
          uncoveredSourceCount: 0,
          hasTestConfig: false,
          hasCoverageConfig: false,
        },
      };

      expect(result.timestamp).toBe('2024-01-01T00:00:00Z');
      expect(result.projectRoot).toBe('/project');
      expect(result.target).toBe('src/');
      expect(result.frameworks).toEqual([]);
      expect(result.existingTests).toEqual([]);
      expect(result.uncoveredSources).toEqual([]);
      expect(result.summary.frameworkCount).toBe(0);
    });

    it('should support framework detection', () => {
      const result: TestScanResult = {
        timestamp: '2024-01-01T00:00:00Z',
        projectRoot: '/project',
        target: 'src/',
        frameworks: [
          {
            framework: 'vitest',
            isPrimary: true,
            supportedTypes: ['unit', 'integration'],
            commands: { test: 'vitest run' },
          },
          {
            framework: 'playwright',
            isPrimary: false,
            supportedTypes: ['e2e'],
            commands: { test: 'playwright test' },
          },
        ],
        existingTests: [],
        uncoveredSources: [],
        projectType: 'typescript',
        isFrontend: true,
        hasUIComponents: true,
        summary: {
          frameworkCount: 2,
          existingTestCount: 0,
          uncoveredSourceCount: 0,
          hasTestConfig: true,
          hasCoverageConfig: true,
        },
      };

      expect(result.frameworks).toHaveLength(2);
      expect(result.frameworks[0].isPrimary).toBe(true);
      expect(result.frameworks[1].framework).toBe('playwright');
      expect(result.summary.frameworkCount).toBe(2);
      expect(result.hasUIComponents).toBe(true);
    });

    it('should support coverage report', () => {
      const result: TestScanResult = {
        timestamp: '2024-01-01T00:00:00Z',
        projectRoot: '/project',
        target: 'src/',
        frameworks: [],
        existingTests: [],
        uncoveredSources: [],
        projectType: 'typescript',
        isFrontend: false,
        hasUIComponents: false,
        coverageReport: {
          total: 75,
          files: [
            { path: 'src/utils.ts', coverage: 90, uncoveredLines: [10, 20] },
            { path: 'src/api.ts', coverage: 60 },
          ],
        },
        summary: {
          frameworkCount: 0,
          existingTestCount: 0,
          uncoveredSourceCount: 0,
          hasTestConfig: false,
          hasCoverageConfig: true,
        },
      };

      expect(result.coverageReport?.total).toBe(75);
      expect(result.coverageReport?.files).toHaveLength(2);
      expect(result.coverageReport?.files[0].uncoveredLines).toEqual([10, 20]);
    });

    it('should support test style detection', () => {
      const result: TestScanResult = {
        timestamp: '2024-01-01T00:00:00Z',
        projectRoot: '/project',
        target: 'src/',
        frameworks: [],
        existingTests: [],
        uncoveredSources: [],
        projectType: 'typescript',
        isFrontend: true,
        hasUIComponents: true,
        testStyle: {
          namingConvention: 'describe-it',
          assertionLibrary: 'expect',
          usesTypeScript: true,
          usesJSX: true,
          fileSuffix: '.test.tsx',
          fileLocation: 'adjacent',
        },
        summary: {
          frameworkCount: 0,
          existingTestCount: 0,
          uncoveredSourceCount: 0,
          hasTestConfig: false,
          hasCoverageConfig: false,
        },
      };

      expect(result.testStyle?.namingConvention).toBe('describe-it');
      expect(result.testStyle?.assertionLibrary).toBe('expect');
      expect(result.testStyle?.usesTypeScript).toBe(true);
      expect(result.testStyle?.usesJSX).toBe(true);
      expect(result.testStyle?.fileSuffix).toBe('.test.tsx');
      expect(result.testStyle?.fileLocation).toBe('adjacent');
    });

    it('should support all namingConvention values', () => {
      const conventions: TestScanResult['testStyle']['namingConvention'][] = ['describe-it', 'test', 'mixed'];

      conventions.forEach((convention) => {
        const result: TestScanResult = {
          timestamp: '2024-01-01T00:00:00Z',
          projectRoot: '/project',
          target: 'src/',
          frameworks: [],
          existingTests: [],
          uncoveredSources: [],
          projectType: 'typescript',
          isFrontend: false,
          hasUIComponents: false,
          testStyle: {
            namingConvention: convention,
            assertionLibrary: 'expect',
            usesTypeScript: true,
            usesJSX: false,
            fileSuffix: '.test.ts',
            fileLocation: 'separate',
          },
          summary: {
            frameworkCount: 0,
            existingTestCount: 0,
            uncoveredSourceCount: 0,
            hasTestConfig: false,
            hasCoverageConfig: false,
          },
        };
        expect(result.testStyle?.namingConvention).toBe(convention);
      });
    });

    it('should support all assertionLibrary values', () => {
      const libraries: TestScanResult['testStyle']['assertionLibrary'][] = ['expect', 'assert', 'should', 'chai', 'unknown'];

      libraries.forEach((library) => {
        const result: TestScanResult = {
          timestamp: '2024-01-01T00:00:00Z',
          projectRoot: '/project',
          target: 'src/',
          frameworks: [],
          existingTests: [],
          uncoveredSources: [],
          projectType: 'typescript',
          isFrontend: false,
          hasUIComponents: false,
          testStyle: {
            namingConvention: 'describe-it',
            assertionLibrary: library,
            usesTypeScript: true,
            usesJSX: false,
            fileSuffix: '.test.ts',
            fileLocation: 'separate',
          },
          summary: {
            frameworkCount: 0,
            existingTestCount: 0,
            uncoveredSourceCount: 0,
            hasTestConfig: false,
            hasCoverageConfig: false,
          },
        };
        expect(result.testStyle?.assertionLibrary).toBe(library);
      });
    });

    it('should support all fileLocation values', () => {
      const locations: TestScanResult['testStyle']['fileLocation'][] = ['adjacent', 'separate'];

      locations.forEach((location) => {
        const result: TestScanResult = {
          timestamp: '2024-01-01T00:00:00Z',
          projectRoot: '/project',
          target: 'src/',
          frameworks: [],
          existingTests: [],
          uncoveredSources: [],
          projectType: 'typescript',
          isFrontend: false,
          hasUIComponents: false,
          testStyle: {
            namingConvention: 'describe-it',
            assertionLibrary: 'expect',
            usesTypeScript: true,
            usesJSX: false,
            fileSuffix: '.test.ts',
            fileLocation: location,
          },
          summary: {
            frameworkCount: 0,
            existingTestCount: 0,
            uncoveredSourceCount: 0,
            hasTestConfig: false,
            hasCoverageConfig: false,
          },
        };
        expect(result.testStyle?.fileLocation).toBe(location);
      });
    });
  });

  // ========== ExistingTestFile Interface Tests ==========

  describe('ExistingTestFile', () => {
    it('should create a valid ExistingTestFile with required fields', () => {
      const file: ExistingTestFile = {
        path: 'tests/utils.test.ts',
        type: 'unit',
      };

      expect(file.path).toBe('tests/utils.test.ts');
      expect(file.type).toBe('unit');
    });

    it('should support optional fields', () => {
      const file: ExistingTestFile = {
        path: 'tests/api/users.test.ts',
        type: 'api',
        sourceFile: 'src/api/users.ts',
        testCount: 15,
        lastModified: '2024-01-01T00:00:00Z',
      };

      expect(file.sourceFile).toBe('src/api/users.ts');
      expect(file.testCount).toBe(15);
      expect(file.lastModified).toBe('2024-01-01T00:00:00Z');
    });

    it('should allow optional fields to be undefined', () => {
      const file: ExistingTestFile = {
        path: 'tests/test.ts',
        type: 'unit',
      };

      expect(file.sourceFile).toBeUndefined();
      expect(file.testCount).toBeUndefined();
      expect(file.lastModified).toBeUndefined();
    });

    it('should support all test types', () => {
      const testTypes: TestType[] = ['unit', 'integration', 'e2e', 'api', 'ui', 'visual', 'performance', 'accessibility'];

      testTypes.forEach((type) => {
        const file: ExistingTestFile = {
          path: `tests/${type}.test.ts`,
          type,
        };
        expect(file.type).toBe(type);
      });
    });
  });

  // ========== UncoveredSourceFile Interface Tests ==========

  describe('UncoveredSourceFile', () => {
    it('should create a valid UncoveredSourceFile with required fields', () => {
      const file: UncoveredSourceFile = {
        path: 'src/utils.ts',
        fileType: 'util',
        exports: ['formatDate', 'parseNumber'],
        hasTest: false,
        suggestedTestTypes: ['unit'],
      };

      expect(file.path).toBe('src/utils.ts');
      expect(file.fileType).toBe('util');
      expect(file.exports).toEqual(['formatDate', 'parseNumber']);
      expect(file.hasTest).toBe(false);
      expect(file.suggestedTestTypes).toEqual(['unit']);
    });

    it('should support all file types', () => {
      const fileTypes: UncoveredSourceFile['fileType'][] = ['module', 'component', 'service', 'util', 'class', 'function', 'unknown'];

      fileTypes.forEach((fileType, index) => {
        const file: UncoveredSourceFile = {
          path: `src/file-${index}.ts`,
          fileType,
          exports: [],
          hasTest: false,
          suggestedTestTypes: [],
        };
        expect(file.fileType).toBe(fileType);
      });
    });

    it('should support complexity metrics', () => {
      const file: UncoveredSourceFile = {
        path: 'src/complex.ts',
        fileType: 'service',
        exports: ['ComplexService'],
        hasTest: false,
        suggestedTestTypes: ['unit', 'integration'],
        complexity: {
          lines: 500,
          functions: 25,
          cyclomaticComplexity: 15,
        },
      };

      expect(file.complexity?.lines).toBe(500);
      expect(file.complexity?.functions).toBe(25);
      expect(file.complexity?.cyclomaticComplexity).toBe(15);
    });

    it('should allow complexity to be undefined', () => {
      const file: UncoveredSourceFile = {
        path: 'src/simple.ts',
        fileType: 'util',
        exports: ['helper'],
        hasTest: false,
        suggestedTestTypes: ['unit'],
      };

      expect(file.complexity).toBeUndefined();
    });

    it('should support multiple suggested test types', () => {
      const file: UncoveredSourceFile = {
        path: 'src/api.ts',
        fileType: 'service',
        exports: ['ApiService'],
        hasTest: false,
        suggestedTestTypes: ['unit', 'integration', 'api', 'e2e'],
      };

      expect(file.suggestedTestTypes).toHaveLength(4);
    });
  });

  // ========== TestGenerationResult Interface Tests ==========

  describe('TestGenerationResult', () => {
    it('should create a valid TestGenerationResult with required fields', () => {
      const result: TestGenerationResult = {
        timestamp: '2024-01-01T00:00:00Z',
        config: {
          target: 'src/',
          testTypes: ['unit'],
          framework: 'vitest',
          includeUI: false,
        },
        files: [],
        testCases: [],
        statistics: {
          fileCount: 0,
          testCaseCount: 0,
          unitTestCount: 0,
          integrationTestCount: 0,
          e2eTestCount: 0,
          mockFileCount: 0,
        },
        runCommand: 'npm test',
      };

      expect(result.timestamp).toBe('2024-01-01T00:00:00Z');
      expect(result.config.framework).toBe('vitest');
      expect(result.files).toEqual([]);
      expect(result.testCases).toEqual([]);
      expect(result.statistics.fileCount).toBe(0);
      expect(result.runCommand).toBe('npm test');
    });

    it('should support generated files', () => {
      const result: TestGenerationResult = {
        timestamp: '2024-01-01T00:00:00Z',
        config: {
          target: 'src/',
          testTypes: ['unit'],
          framework: 'vitest',
          includeUI: false,
        },
        files: [
          {
            path: 'tests/utils.test.ts',
            content: 'import { describe, it } from "vitest";',
            type: 'unit',
            sourceFile: 'src/utils.ts',
            testCaseIds: ['TC-001', 'TC-002'],
            overwrites: false,
          },
        ],
        testCases: [],
        mockFiles: [
          {
            path: 'tests/mocks/api.ts',
            content: 'export const mockApi = {};',
            type: 'api',
            description: 'Mock for API calls',
          },
        ],
        statistics: {
          fileCount: 1,
          testCaseCount: 2,
          unitTestCount: 2,
          integrationTestCount: 0,
          e2eTestCount: 0,
          mockFileCount: 1,
        },
        runCommand: 'vitest run',
        notes: ['Make sure to install dependencies first'],
      };

      expect(result.files).toHaveLength(1);
      expect(result.files[0].testCaseIds).toHaveLength(2);
      expect(result.mockFiles).toHaveLength(1);
      expect(result.statistics.mockFileCount).toBe(1);
      expect(result.notes).toHaveLength(1);
    });

    it('should support estimated coverage increase', () => {
      const result: TestGenerationResult = {
        timestamp: '2024-01-01T00:00:00Z',
        config: {
          target: 'src/',
          testTypes: ['unit'],
          framework: 'vitest',
          includeUI: false,
        },
        files: [],
        testCases: [],
        statistics: {
          fileCount: 0,
          testCaseCount: 0,
          unitTestCount: 0,
          integrationTestCount: 0,
          e2eTestCount: 0,
          mockFileCount: 0,
          estimatedCoverageIncrease: 25,
        },
        runCommand: 'npm test',
      };

      expect(result.statistics.estimatedCoverageIncrease).toBe(25);
    });

    it('should support notes field', () => {
      const result: TestGenerationResult = {
        timestamp: '2024-01-01T00:00:00Z',
        config: {
          target: 'src/',
          testTypes: ['unit'],
          framework: 'vitest',
          includeUI: false,
        },
        files: [],
        testCases: [],
        statistics: {
          fileCount: 0,
          testCaseCount: 0,
          unitTestCount: 0,
          integrationTestCount: 0,
          e2eTestCount: 0,
          mockFileCount: 0,
        },
        runCommand: 'npm test',
        notes: [
          'Some tests may require additional setup',
          'E2E tests need browser environment',
        ],
      };

      expect(result.notes).toHaveLength(2);
    });
  });

  // ========== GeneratedTestFile Interface Tests ==========

  describe('GeneratedTestFile', () => {
    it('should create a valid GeneratedTestFile with all fields', () => {
      const file: GeneratedTestFile = {
        path: 'tests/utils.test.ts',
        content: 'test content',
        type: 'unit',
        sourceFile: 'src/utils.ts',
        testCaseIds: ['TC-001', 'TC-002'],
        overwrites: false,
      };

      expect(file.path).toBe('tests/utils.test.ts');
      expect(file.content).toBe('test content');
      expect(file.type).toBe('unit');
      expect(file.sourceFile).toBe('src/utils.ts');
      expect(file.testCaseIds).toHaveLength(2);
      expect(file.overwrites).toBe(false);
    });

    it('should support overwrite flag', () => {
      const newFile: GeneratedTestFile = {
        path: 'tests/existing.test.ts',
        content: 'new content',
        type: 'unit',
        sourceFile: 'src/existing.ts',
        testCaseIds: ['TC-003'],
        overwrites: false,
      };

      const overwrittenFile: GeneratedTestFile = {
        path: 'tests/existing.test.ts',
        content: 'updated content',
        type: 'unit',
        sourceFile: 'src/existing.ts',
        testCaseIds: ['TC-001', 'TC-002', 'TC-003'],
        overwrites: true,
      };

      expect(newFile.overwrites).toBe(false);
      expect(overwrittenFile.overwrites).toBe(true);
    });

    it('should support all test types', () => {
      const testTypes: TestType[] = ['unit', 'integration', 'e2e', 'api', 'ui', 'visual', 'performance', 'accessibility'];

      testTypes.forEach((type, index) => {
        const file: GeneratedTestFile = {
          path: `tests/${type}.test.ts`,
          content: '',
          type,
          sourceFile: 'src/source.ts',
          testCaseIds: [],
          overwrites: false,
        };
        expect(file.type).toBe(type);
      });
    });
  });

  // ========== GeneratedMockFile Interface Tests ==========

  describe('GeneratedMockFile', () => {
    it('should create a valid GeneratedMockFile with all fields', () => {
      const mock: GeneratedMockFile = {
        path: 'tests/mocks/api.ts',
        content: 'export const mockFetch = vi.fn();',
        type: 'api',
        description: 'Mock for fetch API calls',
      };

      expect(mock.path).toBe('tests/mocks/api.ts');
      expect(mock.content).toBe('export const mockFetch = vi.fn();');
      expect(mock.type).toBe('api');
      expect(mock.description).toBe('Mock for fetch API calls');
    });

    it('should support all mock types', () => {
      const mockTypes: GeneratedMockFile['type'][] = ['function', 'module', 'api', 'component', 'service'];

      mockTypes.forEach((type, index) => {
        const mock: GeneratedMockFile = {
          path: `tests/mocks/${type}.ts`,
          content: '',
          type,
          description: `Mock for ${type}`,
        };
        expect(mock.type).toBe(type);
      });
    });
  });

  // ========== Edge Cases and Complex Scenarios ==========

  describe('Edge Cases', () => {
    it('should handle empty arrays in TestScanResult', () => {
      const result: TestScanResult = {
        timestamp: '2024-01-01T00:00:00Z',
        projectRoot: '/project',
        target: 'src/',
        frameworks: [],
        existingTests: [],
        uncoveredSources: [],
        projectType: 'unknown',
        isFrontend: false,
        hasUIComponents: false,
        summary: {
          frameworkCount: 0,
          existingTestCount: 0,
          uncoveredSourceCount: 0,
          hasTestConfig: false,
          hasCoverageConfig: false,
        },
      };

      expect(result.frameworks).toEqual([]);
      expect(result.existingTests).toEqual([]);
      expect(result.uncoveredSources).toEqual([]);
    });

    it('should handle minimal TestCase', () => {
      const minimalTestCase: TestCase = {
        id: 'TC-MIN',
        name: 'Minimal',
        type: 'unit',
        description: 'Minimal test case',
        filePath: 'test.ts',
        sourceFile: 'source.ts',
        target: 'func',
        priority: 'P3',
        steps: [],
        expectedResults: [],
      };

      expect(minimalTestCase.tags).toBeUndefined();
      expect(minimalTestCase.preconditions).toBeUndefined();
      expect(minimalTestCase.mockRequirements).toBeUndefined();
      expect(minimalTestCase.testData).toBeUndefined();
      expect(minimalTestCase.dependencies).toBeUndefined();
    });

    it('should handle complex test case with multiple steps', () => {
      const complexTestCase: TestCase = {
        id: 'TC-COMPLEX',
        name: 'Complex E2E Test',
        type: 'e2e',
        description: 'Full user registration flow',
        filePath: 'tests/e2e/registration.test.ts',
        sourceFile: 'src/pages/registration.tsx',
        target: 'RegistrationPage',
        priority: 'P0',
        tags: ['e2e', 'registration', 'critical'],
        preconditions: ['App is running', 'Database is clean'],
        steps: [
          { step: 1, action: 'Navigate to registration page' },
          { step: 2, action: 'Enter email', input: 'test@example.com' },
          { step: 3, action: 'Enter password', input: 'password123' },
          { step: 4, action: 'Click submit', expectedOutput: { success: true } },
          { step: 5, action: 'Verify redirect to dashboard' },
        ],
        expectedResults: ['User is registered', 'Redirect to dashboard'],
        mockRequirements: [
          { type: 'api', target: 'authApi', behavior: 'Return success response', returnValue: { token: 'mock-token' } },
          { type: 'service', target: 'emailService', behavior: 'Skip email sending' },
        ],
        testData: { timeout: 30000 },
        dependencies: ['TC-001'],
      };

      expect(complexTestCase.steps).toHaveLength(5);
      expect(complexTestCase.mockRequirements).toHaveLength(2);
      expect(complexTestCase.tags).toHaveLength(3);
    });

    it('should handle full TestScanResult with all data', () => {
      const fullResult: TestScanResult = {
        timestamp: '2024-01-01T12:00:00Z',
        projectRoot: '/home/user/project',
        target: 'src/',
        frameworks: [
          {
            framework: 'vitest',
            version: '1.0.0',
            configFile: 'vitest.config.ts',
            isPrimary: true,
            supportedTypes: ['unit', 'integration'],
            commands: {
              test: 'vitest run',
              testFile: 'vitest run <file>',
              testCoverage: 'vitest run --coverage',
              watch: 'vitest watch',
              updateSnapshot: 'vitest run -u',
            },
          },
        ],
        existingTests: [
          { path: 'tests/utils.test.ts', type: 'unit', sourceFile: 'src/utils.ts', testCount: 5 },
        ],
        uncoveredSources: [
          {
            path: 'src/api.ts',
            fileType: 'service',
            exports: ['apiCall', 'handleRequest'],
            hasTest: false,
            suggestedTestTypes: ['unit', 'integration'],
            complexity: { lines: 100, functions: 10, cyclomaticComplexity: 5 },
          },
        ],
        projectType: 'typescript',
        isFrontend: true,
        hasUIComponents: true,
        coverageReport: {
          total: 65,
          files: [
            { path: 'src/utils.ts', coverage: 90 },
            { path: 'src/api.ts', coverage: 40, uncoveredLines: [15, 20, 25] },
          ],
        },
        testStyle: {
          namingConvention: 'describe-it',
          assertionLibrary: 'expect',
          usesTypeScript: true,
          usesJSX: true,
          fileSuffix: '.test.tsx',
          fileLocation: 'adjacent',
        },
        summary: {
          frameworkCount: 1,
          existingTestCount: 1,
          uncoveredSourceCount: 1,
          hasTestConfig: true,
          hasCoverageConfig: true,
        },
      };

      expect(fullResult.frameworks).toHaveLength(1);
      expect(fullResult.existingTests).toHaveLength(1);
      expect(fullResult.uncoveredSources).toHaveLength(1);
      expect(fullResult.coverageReport?.files).toHaveLength(2);
      expect(fullResult.testStyle?.namingConvention).toBe('describe-it');
    });
  });

  // ========== Type Constraint Tests ==========

  describe('Type Constraints', () => {
    it('should enforce TestFramework values at compile time', () => {
      const vitest: TestFramework = 'vitest';
      const jest: TestFramework = 'jest';
      const playwright: TestFramework = 'playwright';
      const pytest: TestFramework = 'pytest';
      const unknown: TestFramework = 'unknown';

      expect([vitest, jest, playwright, pytest, unknown]).toHaveLength(5);
    });

    it('should enforce TestType values at compile time', () => {
      const unit: TestType = 'unit';
      const integration: TestType = 'integration';
      const e2e: TestType = 'e2e';
      const api: TestType = 'api';

      expect([unit, integration, e2e, api]).toHaveLength(4);
    });

    it('should enforce TestCase priority values at compile time', () => {
      const p0: TestCase['priority'] = 'P0';
      const p1: TestCase['priority'] = 'P1';
      const p2: TestCase['priority'] = 'P2';
      const p3: TestCase['priority'] = 'P3';

      expect([p0, p1, p2, p3]).toHaveLength(4);
    });

    it('should enforce MockRequirement type values at compile time', () => {
      const functionMock: MockRequirement['type'] = 'function';
      const moduleMock: MockRequirement['type'] = 'module';
      const apiMock: MockRequirement['type'] = 'api';
      const componentMock: MockRequirement['type'] = 'component';
      const serviceMock: MockRequirement['type'] = 'service';

      expect([functionMock, moduleMock, apiMock, componentMock, serviceMock]).toHaveLength(5);
    });
  });

  // ========== ProjectType Integration Tests ==========

  describe('ProjectType Integration', () => {
    it('should support various project types in TestScanResult', () => {
      const projectTypes: ProjectType[] = [
        'typescript', 'nodejs', 'python', 'java', 'go', 'rust',
        'react', 'vue', 'angular', 'nextjs',
        'openmatrix', 'unknown',
      ];

      projectTypes.forEach((projectType) => {
        const result: TestScanResult = {
          timestamp: '2024-01-01T00:00:00Z',
          projectRoot: '/project',
          target: 'src/',
          frameworks: [],
          existingTests: [],
          uncoveredSources: [],
          projectType,
          isFrontend: false,
          hasUIComponents: false,
          summary: {
            frameworkCount: 0,
            existingTestCount: 0,
            uncoveredSourceCount: 0,
            hasTestConfig: false,
            hasCoverageConfig: false,
          },
        };
        expect(result.projectType).toBe(projectType);
      });
    });
  });
});