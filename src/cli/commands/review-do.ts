// src/cli/commands/review-do.ts
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import { getProjectRoot } from '../../utils/gitignore.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * CLI 选项接口
 */
interface ReviewDoOptions {
  json?: boolean;
  plan?: string;
  maxLoops?: number;
  skipStart?: boolean;
}

/**
 * 对比结果接口
 */
interface ComparisonResult {
  matchScore: number;
  missingItems: Array<{
    item: string;
    severity: 'high' | 'medium' | 'low';
    suggestion: string;
  }>;
  extraItems: Array<{
    item: string;
    severity: 'low';
    note: string;
  }>;
  recommendation: 'continue_fixing' | 'complete';
}

export const reviewDoCommand = new Command('review-do')
  .description('Review实现与Plan对比 - 循环修复遗漏项，最后调用om:start')
  .option('--json', '输出 JSON 格式 (供 Skill 解析)')
  .option('--plan <path>', '指定计划文件路径 (默认 .openmatrix/plan.md)')
  .option('--max-loops <n>', '最大循环次数 (默认 10)', parseInt, 10)
  .option('--skip-start', '跳过最后的 om:start 调用')
  .action(async (options: ReviewDoOptions) => {
    const basePath = await getProjectRoot();
    const omPath = path.join(basePath, '.openmatrix');
    const maxLoops = options.maxLoops ?? 10;

    // 初始化状态管理器
    const stateManager = new StateManager(omPath);
    await stateManager.initialize();

    // 确定计划文件路径
    let planPath = options.plan;
    if (!planPath) {
      // 尝试查找 plan.md
      const state = await stateManager.getState();
      const runIdPath = path.join(omPath, state.runId || '', 'plan.md');
      const rootPlanPath = path.join(omPath, 'plan.md');

      if (await fileExists(runIdPath)) {
        planPath = runIdPath;
      } else if (await fileExists(rootPlanPath)) {
        planPath = rootPlanPath;
      } else {
        if (options.json) {
          console.log(JSON.stringify({
            status: 'error',
            message: '未找到 plan.md 文件',
            hint: '请先使用 /om:plan 生成计划文档'
          }));
        } else {
          console.log('❌ 未找到 plan.md 文件');
          console.log('   请先使用 /om:plan 生成计划文档');
        }
        return;
      }
    }

    // 读取计划内容
    let planContent: string;
    try {
      planContent = await fs.readFile(planPath, 'utf-8');
    } catch {
      if (options.json) {
        console.log(JSON.stringify({
          status: 'error',
          message: `无法读取计划文件: ${planPath}`
        }));
      } else {
        console.log(`❌ 无法读取计划文件: ${planPath}`);
      }
      return;
    }

    // 创建 review-do 会话
    const sessionId = `REVIEW-DO-${Date.now()}`;
    const session = {
      sessionId,
      status: 'initialized',
      planPath,
      planContent,
      loopCount: 0,
      maxLoops,
      missingItems: [],
      completedItems: [],
      startedAt: new Date().toISOString()
    };

    // 保存会话
    await fs.mkdir(path.join(omPath, 'review-do'), { recursive: true });
    await fs.writeFile(
      path.join(omPath, 'review-do', `${sessionId}.json`),
      JSON.stringify(session, null, 2)
    );

    if (options.json) {
      console.log(JSON.stringify({
        status: 'initialized',
        sessionId,
        planPath,
        maxLoops,
        message: 'Review-Do 会话已初始化',
        hint: '使用 Agent 工具执行对比分析'
      }));
    } else {
      console.log('\n🔍 Review-Do 会话已初始化');
      console.log(`   会话 ID: ${sessionId}`);
      console.log(`   计划文件: ${planPath}`);
      console.log(`   最大循环: ${maxLoops} 次`);
      console.log('\n使用 /om:review-do 技能启动对比分析');
    }
  });

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
 * 更新 review-do 会话状态
 */
export async function updateReviewDoSession(
  omPath: string,
  sessionId: string,
  updates: Partial<{
    status: string;
    loopCount: number;
    missingItems: Array<{ item: string; severity: string; suggestion: string }>;
    completedItems: string[];
    lastComparison: ComparisonResult;
  }>
): Promise<void> {
  const sessionPath = path.join(omPath, 'review-do', `${sessionId}.json`);
  const content = await fs.readFile(sessionPath, 'utf-8');
  const session = JSON.parse(content);
  const updated = { ...session, ...updates, updatedAt: new Date().toISOString() };
  await fs.writeFile(sessionPath, JSON.stringify(updated, null, 2));
}

/**
 * 获取当前实现状态（供 Agent 使用）
 */
export async function getImplementationStatus(basePath: string): Promise<{
  tasks: Array<{ id: string; title: string; status: string }>;
  filesModified: string[];
  summary: string;
}> {
  const omPath = path.join(basePath, '.openmatrix');
  const stateManager = new StateManager(omPath);
  await stateManager.initialize();

  const tasks = await stateManager.listTasks();
  const state = await stateManager.getState();

  return {
    tasks: tasks.map(t => ({
      id: t.id,
      title: t.title,
      status: t.status
    })),
    filesModified: [], // 需要从 git diff 获取
    summary: `总任务: ${state.statistics.totalTasks}, 完成: ${state.statistics.completed}, 进行中: ${state.statistics.inProgress}`
  };
}