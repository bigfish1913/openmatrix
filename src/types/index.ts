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
  currentPhase: 'planning' | 'execution' | 'verification' | 'acceptance';
  startedAt: string;
  config: AppConfig;
  statistics: {
    totalTasks: number;
    completed: number;
    inProgress: number;
    failed: number;
    pending: number;
  };
}

export interface AppConfig {
  timeout: number;
  maxRetries: number;
  approvalPoints: ('plan' | 'merge' | 'deploy')[];
  maxConcurrentAgents: number;
  model: string;
}

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
  constraints: string[];
  deliverables: string[];
  rawContent: string;
}
