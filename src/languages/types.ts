// src/languages/types.ts

/**
 * Supported programming languages
 */
export type SupportedLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'go'
  | 'java'
  | 'rust'
  | 'vue'
  | 'html';

/**
 * Language detection result
 */
export interface LanguageDetectionResult {
  /** Detected language */
  language: SupportedLanguage;
  /** Confidence level (0-1) */
  confidence: number;
  /** Detection method used */
  method: 'package-file' | 'config-file' | 'source-analysis';
  /** Evidence found */
  evidence: string[];
}

/**
 * Language-specific test configuration
 */
export interface TestConfig {
  /** Test command */
  command: string;
  /** Test framework */
  framework: string;
  /** File pattern for test files */
  testFilePattern: string;
  /** Coverage command (if available) */
  coverageCommand?: string;
  /** Minimum coverage threshold */
  minCoverage?: number;
}

/**
 * Language-specific build configuration
 */
export interface BuildConfig {
  /** Build command */
  command: string;
  /** Output directory */
  outputDir?: string;
  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * Language-specific lint configuration
 */
export interface LintConfig {
  /** Lint command */
  command: string;
  /** Format command */
  formatCommand?: string;
  /** Config file */
  configFile?: string;
  /** Strict mode (treat warnings as errors) */
  strict?: boolean;
}

/**
 * Language-specific template
 */
export interface LanguageTemplates {
  /** Unit test template */
  unitTest: string;
  /** Performance test template */
  performanceTest: string;
  /** CI/CD configuration template */
  ci: string;
}

/**
 * Language conventions
 */
export interface LanguageConventions {
  /** Naming convention description */
  namingConvention: string;
  /** Recommended directory structure */
  directoryStructure: string[];
  /** Best practices */
  bestPractices: string[];
  /** Code style guidelines */
  codeStyle: string[];
}

/**
 * Language-specific agent prompts
 */
export interface AgentPrompts {
  /** Coder agent prompt */
  coder: string;
  /** Tester agent prompt */
  tester: string;
  /** Reviewer agent prompt */
  reviewer: string;
}

/**
 * Complete language configuration
 */
export interface LanguageConfig {
  /** Language name */
  name: SupportedLanguage;
  /** Display name */
  displayName: string;
  /** File extensions */
  extensions: string[];
  /** Detection files (package files, config files) */
  detectionFiles: string[];

  /** Test configuration */
  test: TestConfig;
  /** Build configuration */
  build?: BuildConfig;
  /** Lint configuration */
  lint?: LintConfig;

  /** Templates */
  templates: LanguageTemplates;
  /** Conventions */
  conventions: LanguageConventions;
  /** Agent prompts */
  agentPrompts: AgentPrompts;

  /** Package manager */
  packageManager?: string;
  /** Dependency file */
  dependencyFile?: string;
}

/**
 * Project language info
 */
export interface ProjectLanguageInfo {
  /** Primary language */
  primary: LanguageDetectionResult;
  /** All detected languages */
  all: LanguageDetectionResult[];
  /** Project root path */
  projectRoot: string;
  /** Package manager (if detected) */
  packageManager?: string;
}