// src/types/index.ts

// ============ Task Types ============

export type TaskStatus =
  | 'pending'
  | 'scheduled'
  | 'in_progress'
  | 'blocked'
  | 'waiting'
  | 'verify'
  | 'accept'
  | 'completed'
  | 'failed'
  | 'retry_queue';

export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type ResearchMode = 'domain' | 'tech' | 'problem';

export interface TaskPhase {
  status: TaskStatus;
  duration: number | null;
  startedAt?: string;
  completedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  timeout: number;
  dependencies: string[];
  assignedAgent: AgentType;
  phases: {
    develop: TaskPhase;
    verify: TaskPhase;
    accept: TaskPhase;
  };
  retryCount: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  /** 验收标准 */
  acceptanceCriteria?: string[];
  /** 关联的测试任务 ID */
  testTaskId?: string;
  /** 任务所属阶段 */
  phase?: 'design' | 'develop' | 'verify' | 'accept';
}

// ============ Agent Types ============

export type AgentType =
  | 'planner'
  | 'coder'
  | 'tester'
  | 'reviewer'
  | 'researcher'
  | 'executor';

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface AgentResult {
  runId: string;
  taskId: string;
  agentType: AgentType;
  status: AgentStatus;
  output: string;
  artifacts: string[];
  needsApproval: boolean;
  error?: string;
  duration: number;
  completedAt: string;
}

// ============ Subagent Types ============

/**
 * Claude Code Subagent 类型
 */
export type ClaudeCodeSubagentType = 'general-purpose' | 'Explore' | 'Plan';

/**
 * Subagent 任务配置 - 用于 Agent 工具调用
 */
export interface SubagentTask {
  /** Subagent 类型 */
  subagent_type: ClaudeCodeSubagentType;
  /** 简短描述 (3-5 词) */
  description: string;
  /** 完整任务提示词 */
  prompt: string;
  /** 是否使用隔离 worktree */
  isolation?: 'worktree';
  /** 任务 ID (用于追踪) */
  taskId: string;
  /** 原始 Agent 类型 */
  agentType: AgentType;
  /** 超时时间 (ms) */
  timeout: number;
  /** 是否需要审批 */
  needsApproval: boolean;
}

// ============ State Types ============

export type RunStatus = 'initialized' | 'running' | 'paused' | 'completed' | 'failed';

export interface GlobalState {
  version: string;
  runId: string;
  status: RunStatus;
  currentPhase: 'planning' | 'execution' | 'verification' | 'acceptance' | 'completed';
  startedAt: string;
  config: AppConfig;
  statistics: {
    totalTasks: number;
    completed: number;
    inProgress: number;
    failed: number;
    pending: number;
    scheduled: number;
    blocked: number;
    waiting: number;
    verify: number;
    accept: number;
    retry_queue: number;
  };
}

export interface AppConfig {
  /** 单个任务超时时间（秒） */
  timeout: number;
  /** 任务执行超时时间（毫秒） */
  taskTimeout?: number;
  maxRetries: number;
  approvalPoints: ('plan' | 'merge' | 'deploy')[];
  maxConcurrentAgents: number;
  model: string;
  /** 质量配置 */
  quality?: QualityConfig;
}

// ============ Quality Types ============

/**
 * 质量配置 - 控制自动化质量门禁
 */
export interface QualityConfig {
  /** 启用 TDD 模式 (先写测试再写代码) */
  tdd: boolean;
  /** 最低测试覆盖率 (%) */
  minCoverage: number;
  /** 严格 Lint (error 即失败) */
  strictLint: boolean;
  /** 安全扫描 */
  securityScan: boolean;
  /** 端到端测试 (适用于 Web 项目等需要 E2E 测试的场景) */
  e2eTests: boolean;
  /** 质量级别 */
  level: 'fast' | 'balanced' | 'strict';
}

/**
 * 质量报告 - Verify 阶段产出
 */
export interface QualityReport {
  taskId: string;
  timestamp: string;
  /** 测试结果 */
  tests: {
    passed: number;
    failed: number;
    skipped: number;
    coverage: number;
    status: 'pass' | 'fail';
  };
  /** 构建结果 */
  build: {
    success: boolean;
    errors: string[];
    status: 'pass' | 'fail';
  };
  /** Lint 结果 */
  lint: {
    errors: number;
    warnings: number;
    status: 'pass' | 'fail' | 'warning';
  };
  /** 安全扫描结果 */
  security: {
    vulnerabilities: SecurityVulnerability[];
    status: 'pass' | 'fail';
  };
  /** E2E 测试结果 */
  e2e: {
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    status: 'pass' | 'fail' | 'skipped';
  };
  /** 验收标准检查 */
  acceptance: {
    total: number;
    met: number;
    details: AcceptanceCheck[];
    status: 'pass' | 'fail';
  };
  /** 总体状态 */
  overall: 'pass' | 'fail' | 'warning';
}

export interface SecurityVulnerability {
  severity: 'low' | 'medium' | 'high' | 'critical';
  package: string;
  description: string;
}

export interface AcceptanceCheck {
  criterion: string;
  met: boolean;
  evidence?: string;
}

/**
 * 预设质量配置
 */
export const QUALITY_PRESETS: Record<string, QualityConfig> = {
  fast: {
    tdd: false,
    minCoverage: 0,
    strictLint: false,
    securityScan: false,
    e2eTests: false,
    level: 'fast'
  },
  balanced: {
    tdd: false,
    minCoverage: 60,
    strictLint: true,
    securityScan: true,
    e2eTests: false,
    level: 'balanced'
  },
  strict: {
    tdd: true,
    minCoverage: 80,
    strictLint: true,
    securityScan: true,
    e2eTests: false, // 让用户选择，因为 E2E 测试耗时
    level: 'strict'
  }
};

// ============ Approval Types ============

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Approval {
  id: string;
  type: 'plan' | 'merge' | 'deploy' | 'meeting' | 'custom';
  taskId: string;
  title: string;
  description: string;
  content: string;
  options: ApprovalOption[];
  status: ApprovalStatus;
  decision?: 'approve' | 'modify' | 'reject';
  createdAt: string;
  decidedAt?: string;
}

export interface ApprovalOption {
  key: string;
  label: string;
}

// ============ Meeting Types ============

export type MeetingStatus = 'pending' | 'in_progress' | 'resolved' | 'cancelled';

export type MeetingType = 'blocking' | 'decision' | 'review' | 'planning' | 'ambiguity';

export interface Meeting {
  id: string;
  type: MeetingType;
  status: MeetingStatus;
  taskId: string;
  title: string;
  description: string;
  blockingReason?: string;
  impactScope: string[];
  participants: string[];
  resolution?: string;
  createdAt: string;
  startedAt?: string;
  resolvedAt?: string;
  /** 歧义报告 (仅 type 为 'ambiguity' 时使用) */
  ambiguityReport?: AmbiguityReport;
  /** 建议的问题列表 (用于歧义处理) */
  suggestedQuestions?: string[];
}

// ============ Task Parser Types ============

export interface ParsedTask {
  title: string;
  description: string;
  goals: string[];
  /** 每个 goal 的类型标注 (由 AI 在提取时标注)，与 goals 数组一一对应 */
  goalTypes?: GoalType[];
  constraints: string[];
  deliverables: string[];
  rawContent: string;
}

/** 目标类型 */
export type GoalType = 'development' | 'testing' | 'documentation' | 'other';

// ============ Research Types ============

export interface ResearchAgentConfig {
  role: string;
  focus: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
}

export interface ResearchQuestion {
  id: string;
  question: string;
  header: string;
  options: Array<{ label: string; description: string }>;
  multiSelect: boolean;
}

export interface ResearchSession {
  status: 'initialized' | 'preview' | 'researching' | 'questioning' | 'completed';
  topic: string;
  domain: string;
  aspects: string[];
  estimatedQuestions: number;
  agents: ResearchAgentConfig[];
  domainQuestions: ResearchQuestion[];
  answers: Record<string, string | string[]>;
  report?: string;
  knowledge: string[];
  context?: {
    goals: string[];
    constraints: string[];
    deliverables: string[];
  };
  createdAt: string;
  completedAt?: string;
}

// ============ Debug Types ============

/** 问题类型 */
export type ProblemType =
  | 'task_failure'    // 任务执行失败
  | 'project_bug'     // 用户项目代码 bug
  | 'system_bug'      // OpenMatrix 系统自身 bug
  | 'environment';    // 环境配置问题

/** 诊断报告 */
export interface DiagnosisReport {
  id: string;
  problemType: ProblemType;
  trigger: 'explicit' | 'auto';
  description: string;
  errorInfo?: {
    message: string;
    stack?: string;
    timestamp: string;
  };
  relatedTaskId?: string;
  relatedFiles?: string[];
  rootCause: string;
  impactScope: string[];
  suggestedFix: string;
  diagnosedAt: string;
  diagnosisDuration?: number;
}

/** 调试会话状态 */
export type DebugStatus =
  | 'initialized'
  | 'diagnosing'
  | 'awaiting_fix'
  | 'fixing'
  | 'verifying'
  | 'completed'
  | 'cancelled';

/** 调试会话 */
export interface DebugSession {
  id: string;
  status: DebugStatus;
  report: DiagnosisReport;
  fixDecision?: 'approve' | 'skip' | 'manual';
  fixResult?: {
    success: boolean;
    operations: string[];
    modifiedFiles: string[];
    output: string;
  };
  verifyResult?: {
    passed: boolean;
    details: string;
  };
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

// ============ Ambiguity Types ============

/**
 * 歧义类型
 * - requirement: 需求歧义 (需求描述不清晰、存在多种解读)
 * - technical: 技术歧义 (技术方案选择、实现方式不明确)
 * - dependency: 依赖歧义 (依赖项版本、接口契约不明确)
 * - acceptance: 验收歧义 (验收标准不清晰、无法验证)
 * - test_result: 测试结果歧义 (测试结果不一致、无法判断)
 */
export type AmbiguityType =
  | 'requirement'
  | 'technical'
  | 'dependency'
  | 'acceptance'
  | 'test_result';

/**
 * 歧义严重程度
 * - critical: 严重歧义，必须立即解决，否则任务无法继续
 * - high: 高优先级歧义，影响核心功能，应尽快解决
 * - medium: 中等优先级歧义，影响非核心功能，可稍后解决
 * - low: 低优先级歧义，影响较小，可在后续处理
 */
export type AmbiguitySeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * 歧义项 - 描述单个歧义点
 */
export interface AmbiguityItem {
  /** 歧义唯一标识 */
  id: string;
  /** 歧义类型 */
  type: AmbiguityType;
  /** 严重程度 */
  severity: AmbiguitySeverity;
  /** 歧义描述 */
  description: string;
  /** 影响范围 */
  impactScope: string[];
  /** 可能的解决方案 */
  possibleSolutions?: string[];
  /** 相关文件 */
  relatedFiles?: string[];
  /** 相关任务 ID */
  relatedTaskIds?: string[];
}

/**
 * 歧义报告 - Agent 输出的歧义检测结果
 */
export interface AmbiguityReport {
  /** 报告唯一标识 */
  id: string;
  /** 关联的任务 ID */
  taskId: string;
  /** 检测阶段: 'pre_execution' 执行前 | 'during_execution' 执行中 */
  detectionPhase: 'pre_execution' | 'during_execution';
  /** 检测到的歧义列表 */
  ambiguities: AmbiguityItem[];
  /** 是否存在歧义 */
  hasAmbiguity: boolean;
  /** 最高严重程度 (用于快速判断) */
  maxSeverity?: AmbiguitySeverity;
  /** 检测时间 */
  detectedAt: string;
  /** 建议的处理策略 */
  suggestedStrategy?: 'ask_immediate' | 'write_meeting' | 'continue';
  /** 建议的问题列表 (用于 AskUserQuestion) */
  suggestedQuestions?: string[];
}

// ============ Environment Detection Types ============

/**
 * 构建工具类型
 */
export type BuildToolType =
  | 'npm'         // npm scripts
  | 'yarn'        // yarn commands
  | 'pnpm'        // pnpm commands
  | 'make'        // Makefile
  | 'docker'      // Docker/Docker Compose
  | 'gradle'      // Gradle (Java)
  | 'maven'       // Maven (Java)
  | 'cargo'       // Cargo (Rust)
  | 'go'          // Go commands
  | 'pip'         // pip (Python)
  | 'poetry'      // Poetry (Python)
  | 'nuget'       // NuGet (C#)
  | 'msbuild'     // MSBuild (C#)
  | 'webpack'     // webpack
  | 'vite'        // Vite
  | 'esbuild'     // esbuild
  | 'rollup'      // Rollup
  | 'turbo'       // Turborepo
  | 'bazel'       // Bazel
  | 'unknown';    // Unknown build tool

/**
 * 构建工具信息
 */
export interface BuildTool {
  /** 工具类型 */
  type: BuildToolType;
  /** 可用命令列表 */
  commands: string[];
  /** 配置文件路径 */
  configFile?: string;
  /** 是否为默认构建工具 */
  isDefault?: boolean;
  /** 工具版本 */
  version?: string;
}

/**
 * 部署方式
 */
export type DeployMethod =
  | 'docker'          // Docker 部署
  | 'docker-compose'  // Docker Compose 部署
  | 'kubernetes'      // Kubernetes 部署
  | 'helm'            // Helm 部署
  | 'npm'             // npm 发布
  | 'make'            // Makefile 部署命令
  | 'script'          // 自定义脚本
  | 'github-pages'    // GitHub Pages
  | 'vercel'          // Vercel
  | 'netlify'         // Netlify
  | 'aws'             // AWS 部署
  | 'gcp'             // Google Cloud 部署
  | 'azure'           // Azure 部署
  | 'heroku'          // Heroku
  | 'unknown';        // 未知部署方式

/**
 * 部署选项
 */
export interface DeployOption {
  /** 部署方式 */
  method: DeployMethod;
  /** 部署命令 */
  command?: string;
  /** 配置文件路径 */
  configFile?: string;
  /** 部署环境 */
  environment?: 'development' | 'staging' | 'production';
  /** 是否推荐 */
  recommended?: boolean;
  /** 描述信息 */
  description?: string;
}

/**
 * CI 平台类型
 */
export type CIPlatform =
  | 'github-actions'  // GitHub Actions
  | 'gitlab-ci'       // GitLab CI
  | 'jenkins'         // Jenkins
  | 'circleci'        // CircleCI
  | 'travis-ci'       // Travis CI
  | 'azure-pipelines' // Azure Pipelines
  | 'bitbucket-pipelines' // Bitbucket Pipelines
  | 'drone'           // Drone CI
  | 'teamcity'        // TeamCity
  | 'unknown';        // 未知 CI 平台

/**
 * CI 配置信息
 */
export interface CIConfig {
  /** CI 平台 */
  platform: CIPlatform;
  /** 配置文件列表 */
  configFiles: string[];
  /** 可用的 workflow 名称 */
  workflows?: string[];
  /** 触发条件 */
  triggers?: string[];
}

/**
 * 开发命令信息
 */
export interface DevCommands {
  /** 安装/设置命令 */
  setup: string[];
  /** 构建命令 */
  build: string[];
  /** 测试命令 */
  test: string[];
  /** 开发/调试命令 */
  dev: string[];
  /** 启动命令 */
  start: string[];
  /** 清理命令 */
  clean?: string[];
  /** Lint 命令 */
  lint?: string[];
  /** 格式化命令 */
  format?: string[];
}

/**
 * 项目环境检测结果
 */
export interface EnvironmentInfo {
  /** 项目名称 */
  projectName: string;
  /** 项目类型 */
  projectType: ProjectType;
  /** 项目根目录 */
  projectRoot: string;
  /** 检测时间 */
  timestamp: string;
  /** 构建工具列表 */
  buildTools: BuildTool[];
  /** CI 配置 */
  ciConfig?: CIConfig;
  /** 部署选项 */
  deployOptions: DeployOption[];
  /** 开发命令 */
  devCommands: DevCommands;
  /** 检测摘要 */
  summary: {
    /** 是否有构建工具 */
    hasBuildTool: boolean;
    /** 是否有 CI 配置 */
    hasCIConfig: boolean;
    /** 是否有部署选项 */
    hasDeployOption: boolean;
    /** 构建工具数量 */
    buildToolCount: number;
    /** 部署选项数量 */
    deployOptionCount: number;
  };
}

/**
 * 项目类型 (复用 UpgradeDetector 中的定义)
 * 注意：如果 UpgradeDetector 的 ProjectType 发生变化，这里需要同步
 */
export type ProjectType =
  | 'openmatrix'    // OpenMatrix 自身
  | 'ai-project'    // AI 项目 (包含 prompts/skills/agents)
  | 'nodejs'        // Node.js 项目
  | 'typescript'    // TypeScript 项目
  | 'python'        // Python 项目
  | 'go'            // Go 项目
  | 'rust'          // Rust 项目
  | 'java'          // Java 项目
  | 'csharp'        // C# 项目
  | 'cpp'           // C/C++ 项目
  | 'php'           // PHP 项目
  | 'dart'          // Dart 项目
  | 'ruby'          // Ruby 项目
  | 'swift'         // Swift 项目
  | 'kotlin'        // Kotlin 项目
  | 'scala'         // Scala 项目
  | 'flutter'       // Flutter 项目
  | 'react'         // React 项目
  | 'vue'           // Vue 项目
  | 'angular'       // Angular 项目
  | 'nextjs'        // Next.js 项目
  | 'nuxt'          // Nuxt.js 项目
  | 'svelte'        // Svelte 项目
  | 'unknown';      // 未知类型

/**
 * 环境检测器配置
 */
export interface EnvironmentDetectorConfig {
  /** 扫描目录 */
  scanDirs: string[];
  /** 排除目录 */
  excludeDirs: string[];
  /** 最大建议数量 */
  maxDeployOptions?: number;
}
