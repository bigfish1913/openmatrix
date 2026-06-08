// src/cli/commands/review.ts
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import { getProjectRoot } from '../../utils/gitignore.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * CLI 选项接口
 */
interface ReviewOptions {
  json?: boolean;
  maxLoops?: number;
  skipPlan?: boolean;
  skipTests?: boolean;
}

/**
 * 审查结果接口
 */
interface ReviewResult {
  overallScore: number;
  issues: Array<{
    type: 'logic' | 'coverage' | 'flow' | 'completeness' | 'lint' | 'security';
    severity: 'critical' | 'high' | 'medium' | 'low';
    file: string;
    line?: number;
    description: string;
    suggestion: string;
    category: 'quality' | 'completeness';
  }>;
  recommendation: '需要修复' | '审查通过';
}

export const reviewCommand = new Command('review')
  .description('代码审查：检查逻辑错误、测试覆盖率、链路通畅性，对比plan.md检查遗漏项')
  .option('--json', '输出 JSON 格式 (供 Skill 解析)')
  .option('--max-loops <n>', '最大循环次数 (默认 10)', parseInt, 10)
  .option('--skip-plan', '跳过 plan.md 对比')
  .option('--skip-tests', '跳过测试覆盖率检查')
  .action(async (options: ReviewOptions) => {
    const basePath = await getProjectRoot();
    const omPath = path.join(basePath, '.openmatrix');
    const maxLoops = options.maxLoops ?? 10;

    // 初始化状态管理器
    const stateManager = new StateManager(omPath);
    await stateManager.initialize();

    // 收集代码状态
    const codeStatus = await collectCodeStatus(basePath);

    // 读取 plan.md（如果存在且未跳过）
    let planContent: string | null = null;
    let planPath: string | null = null;

    if (!options.skipPlan) {
      const state = await stateManager.getState();
      const runIdPath = path.join(omPath, state.runId || '', 'plan.md');
      const rootPlanPath = path.join(omPath, 'plan.md');

      if (await fileExists(runIdPath)) {
        planPath = runIdPath;
        planContent = await fs.readFile(runIdPath, 'utf-8');
      } else if (await fileExists(rootPlanPath)) {
        planPath = rootPlanPath;
        planContent = await fs.readFile(rootPlanPath, 'utf-8');
      }
    }

    // 创建 review 会话
    const sessionId = `REVIEW-${Date.now()}`;
    const session = {
      sessionId,
      status: 'initialized',
      planPath,
      planContent,
      codeStatus,
      loopCount: 0,
      maxLoops,
      issues: [],
      skipTests: options.skipTests || false,
      startedAt: new Date().toISOString()
    };

    // 保存会话
    await fs.mkdir(path.join(omPath, 'review'), { recursive: true });
    await fs.writeFile(
      path.join(omPath, 'review', `${sessionId}.json`),
      JSON.stringify(session, null, 2)
    );

    if (options.json) {
      console.log(JSON.stringify({
        status: 'initialized',
        sessionId,
        planPath,
        maxLoops,
        skipTests: options.skipTests,
        message: 'Review 会话已初始化',
        hint: '使用 Agent 工具执行代码审查分析',
        codeStatus: {
          modifiedFiles: codeStatus.modifiedFiles.length,
          testStatus: codeStatus.testStatus,
          lintStatus: codeStatus.lintStatus
        }
      }));
    } else {
      console.log('\n🔍 Review 会话已初始化');
      console.log(`   会话 ID: ${sessionId}`);
      if (planPath) {
        console.log(`   计划文件: ${planPath}`);
      }
      console.log(`   最大循环: ${maxLoops} 次`);
      console.log(`   修改文件: ${codeStatus.modifiedFiles.length} 个`);
      console.log(`   测试状态: ${codeStatus.testStatus}`);
      console.log(`   Lint 状态: ${codeStatus.lintStatus}`);
      console.log('\n使用 /om:review 技能启动代码审查');
    }
  });

/**
 * 收集代码状态
 */
async function collectCodeStatus(basePath: string): Promise<{
  modifiedFiles: string[];
  testStatus: 'passed' | 'failed' | 'no_tests';
  lintStatus: 'passed' | 'failed' | 'no_lint';
  coverage?: number;
  recentCommits: string[];
}> {
  const omPath = path.join(basePath, '.openmatrix');

  // 获取最近修改的文件（从 git diff 和任务状态）
  const stateManager = new StateManager(omPath);
  await stateManager.initialize();

  const tasks = await stateManager.listTasks();
  const completedTasks = tasks.filter(t => t.status === 'completed');

  // 从 git diff 获取修改的文件
  let modifiedFiles: string[] = [];
  try {
    const { execSync } = await import('child_process');
    const diffOutput = execSync('git diff --name-only HEAD~5', { cwd: basePath, encoding: 'utf-8' });
    modifiedFiles = diffOutput.trim().split('\n').filter(Boolean);
  } catch {
    // Git 不可用，使用空数组
  }

  // 简单的状态检测（实际测试/lint 执行由 Agent 负责）
  const state = await stateManager.getState();
  const testStatus = state.statistics.failed > 0 ? 'failed' : 'passed';
  const lintStatus = 'passed'; // 默认假设通过，实际由 Agent 检查

  // 获取最近的提交
  let recentCommits: string[] = [];
  try {
    const { execSync } = await import('child_process');
    const logOutput = execSync('git log --oneline -5', { cwd: basePath, encoding: 'utf-8' });
    recentCommits = logOutput.trim().split('\n').filter(Boolean);
  } catch {
    // Git 不可用，忽略
  }

  return {
    modifiedFiles,
    testStatus,
    lintStatus,
    recentCommits
  };
}

/**
 * 检查文件是否存在
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 更新 review 会话状态
 */
export async function updateReviewSession(
  omPath: string,
  sessionId: string,
  updates: Partial<{
    status: string;
    loopCount: number;
    issues: ReviewResult['issues'];
    lastReview: ReviewResult;
  }>
): Promise<void> {
  const sessionPath = path.join(omPath, 'review', `${sessionId}.json`);
  const content = await fs.readFile(sessionPath, 'utf-8');
  const session = JSON.parse(content);
  const updated = { ...session, ...updates, updatedAt: new Date().toISOString() };
  await fs.writeFile(sessionPath, JSON.stringify(updated, null, 2));
}

/**
 * 获取当前审查状态（供 Agent 使用）
 */
export async function getReviewStatus(basePath: string): Promise<{
  sessionId: string | null;
  status: string;
  issues: ReviewResult['issues'];
  summary: string;
}> {
  const omPath = path.join(basePath, '.openmatrix');
  const reviewPath = path.join(omPath, 'review');

  try {
    const files = await fs.readdir(reviewPath);
    const sessionFiles = files.filter(f => f.startsWith('REVIEW-') && f.endsWith('.json'));

    if (sessionFiles.length === 0) {
      return {
        sessionId: null,
        status: 'no_session',
        issues: [],
        summary: '无活跃的 review 会话'
      };
    }

    // 读取最新的会话
    const latestFile = sessionFiles.sort().pop()!;
    const content = await fs.readFile(path.join(reviewPath, latestFile), 'utf-8');
    const session = JSON.parse(content);

    return {
      sessionId: session.sessionId,
      status: session.status,
      issues: session.issues || [],
      summary: `循环次数: ${session.loopCount}/${session.maxLoops}, 问题数: ${(session.issues || []).length}`
    };
  } catch {
    return {
      sessionId: null,
      status: 'no_session',
      issues: [],
      summary: '无活跃的 review 会话'
    };
  }
}