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
  timeout: number;
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
