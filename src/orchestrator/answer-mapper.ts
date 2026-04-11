// src/orchestrator/answer-mapper.ts
import type { QuestionInference } from './smart-question-analyzer.js';

/**
 * 答案键映射 — 统一三套 ID 体系
 *
 * Brainstorm 问题 ID  →  规范 ID  →  TaskPlanner 期望的键
 */

/** Brainstorm 旧 ID → 规范 ID */
const BRAINSTORM_TO_CANONICAL: Record<string, string> = {
  core_objective: 'objective',
  user_value: 'user_value',
  complexity: 'complexity',
  tech_constraints: 'tech_stack',
  risks: 'risks',
  acceptance: 'acceptance',
  priority: 'priority',
  quality: 'quality_level',
  execution_mode: 'execution_mode',
  e2e_tests: 'e2e_tests',
};

/** 规范 ID → TaskPlanner extractUserContext() 期望的键 */
const CANONICAL_TO_PLANNER: Record<string, Record<string, string>> = {
  objective: { '目标': '', objective: '' },
  tech_stack: { '技术栈': '', techStack: '' },
  test_coverage: { '测试': '', testCoverage: '' },
  documentation_level: { '文档': '', documentationLevel: '' },
  e2e_tests: { 'E2E测试': '', e2eTests: '', e2e: '' },
  e2e_type: { 'E2E类型': '', e2eType: '' },
};

/** Analyzer 旧 ID → 规范 ID */
const ANALYZER_TO_CANONICAL: Record<string, string> = {
  quality_level: 'quality_level',
  tech_stack: 'tech_stack',
  doc_level: 'documentation_level',
  e2e_test: 'e2e_tests',
  execution_mode: 'execution_mode',
  objective: 'objective',
  test_coverage: 'test_coverage',
};

/**
 * 将 brainstorm 答案键翻译为 TaskPlanner 期望的键
 *
 * 支持两种输入:
 * 1. 规范 ID (如 objective, quality_level) → 直接映射
 * 2. 旧 brainstorm ID (如 core_objective, quality) → 先转规范 ID 再映射
 */
export function translateBrainstormAnswers(
  answers: Record<string, string | string[]>
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(answers)) {
    // 步骤 1: 旧 brainstorm ID → 规范 ID
    const canonical = BRAINSTORM_TO_CANONICAL[key] || key;

    // 步骤 2: 规范 ID → planner 键
    const plannerKeys = CANONICAL_TO_PLANNER[canonical];
    if (plannerKeys) {
      for (const plannerKey of Object.keys(plannerKeys)) {
        result[plannerKey] = value;
      }
    }

    // 同时保留原始键和规范 ID（向后兼容）
    result[key] = value;
    if (canonical !== key) {
      result[canonical] = value;
    }
  }

  return result;
}

/**
 * 将 SmartQuestionAnalyzer 推理结果转换为 brainstorm 规范 ID
 */
export function translateAnalyzerInferences(
  inferences: QuestionInference[]
): Map<string, { answer: string | string[]; reason: string }> {
  const result = new Map<string, { answer: string | string[]; reason: string }>();

  for (const inf of inferences) {
    if (inf.inferredAnswer === undefined) continue;
    const canonical = ANALYZER_TO_CANONICAL[inf.questionId] || inf.questionId;
    result.set(canonical, {
      answer: inf.inferredAnswer,
      reason: inf.reason
    });
  }

  return result;
}

/**
 * 从 brainstorm 答案中提取 tasks-input.json 所需的字段
 */
export function extractTasksInputFields(
  answers: Record<string, string | string[]>
): { quality?: string; mode?: string; e2eTests?: boolean; e2eType?: string } {
  const result: { quality?: string; mode?: string; e2eTests?: boolean; e2eType?: string } = {};

  // quality_level / quality → quality 字段
  const quality = answers['quality_level'] || answers['quality'];
  if (typeof quality === 'string') {
    result.quality = quality;
  }

  // execution_mode → mode 字段
  const mode = answers['execution_mode'];
  if (typeof mode === 'string') {
    result.mode = mode;
  }

  // e2e_tests → e2eTests 布尔字段 + e2eType
  const e2e = answers['e2e_tests'] || answers['e2eTests'] || answers['E2E测试'];
  if (e2e !== undefined) {
    const e2eStr = Array.isArray(e2e) ? e2e[0] : e2e;
    result.e2eTests = e2eStr === 'functional' || e2eStr === 'visual' || e2eStr === 'true' || e2eStr === '启用 E2E 测试' || e2eStr === '是';
    if (result.e2eTests && e2eStr === 'visual') {
      result.e2eType = 'visual';
    }
  }

  return result;
}
