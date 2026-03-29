// src/cli/commands/start.ts
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import { TaskParser } from '../../orchestrator/task-parser.js';
import { TaskPlanner } from '../../orchestrator/task-planner.js';
import { ApprovalManager } from '../../orchestrator/approval-manager.js';
import { OrchestratorExecutor } from '../../orchestrator/executor.js';
import { ensureOpenmatrixGitignore } from '../../utils/gitignore.js';
import { QUALITY_PRESETS, type QualityConfig } from '../../types/index.js';
import type { TaskPriority } from '../../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * --tasks-json 接收的 AI 解析结果（ParsedTask 格式）
 * AI 代替 TaskParser 提取 goals/constraints/deliverables，
 * 然后仍由 TaskPlanner 做拆分，保持拆分逻辑不变。
 */
interface AIParsedInput {
  title: string;
  description?: string;
  goals: string[];
  constraints?: string[];
  deliverables?: string[];
  /** 额外上下文（如技术栈、文档要求等） */
  answers?: Record<string, string>;
  quality?: 'strict' | 'balanced' | 'fast';
  mode?: 'confirm-all' | 'confirm-key' | 'auto';
  /** AI 生成的执行计划，供 TaskPlanner 和 agent 参考 */
  plan?: string;
}

/**
 * CLI 选项接口
 */
interface StartOptions {
  config?: string;
  skipQuestions?: boolean;
  mode?: string;
  json?: boolean;
  initOnly?: boolean;
  title?: string;
  description?: string;
  quality?: string;
  techStack?: string;
  docs?: string;
  tasksJson?: string;
}

export const startCommand = new Command('start')
  .description('启动新的任务执行周期')
  .argument('[input]', '任务文件路径或描述')
  .option('-c, --config <path>', '配置文件路径')
  .option('--init-only', '仅初始化 .openmatrix 目录，不执行任务')
  .option('--skip-questions', '跳过澄清问题')
  .option('--mode <mode>', '执行模式 (confirm-all|confirm-key|auto)')
  .option('--json', '输出 JSON 格式 (供 Skill 解析)')
  .option('--title <title>', '任务标题')
  .option('--description <desc>', '任务描述')
  .option('-q, --quality <level>', '质量级别 (strict|balanced|fast)')
  .option('-t, --tech-stack <stack>', '技术栈 (逗号分隔，如 "TypeScript,Vue.js,PostgreSQL")')
  .option('--docs <level>', '文档级别 (full|basic|minimal|none)')
  .option('--tasks-json <json>', 'AI 已拆分的任务 JSON (跳过自动解析)')
  .action(async (input: string | undefined, options: StartOptions) => {
    const basePath = process.cwd();
    const omPath = path.join(basePath, '.openmatrix');

    // 确保目录存在
    await fs.mkdir(omPath, { recursive: true });
    await fs.mkdir(path.join(omPath, 'tasks'), { recursive: true });
    await fs.mkdir(path.join(omPath, 'approvals'), { recursive: true });

    // 确保 .openmatrix 被 git 忽略
    await ensureOpenmatrixGitignore(basePath);

    // --init-only 模式：仅初始化目录后返回
    if (options.initOnly) {
      if (options.json) {
        console.log(JSON.stringify({
          status: 'initialized',
          message: '.openmatrix 目录已初始化',
          path: omPath
        }));
      } else {
        console.log('✅ .openmatrix 目录已初始化');
        console.log(`   路径: ${omPath}`);
      }
      return;
    }

    const stateManager = new StateManager(omPath);
    await stateManager.initialize();

    const state = await stateManager.getState();

    // 检查是否已有运行中的任务
    if (state.status === 'running') {
      if (options.json) {
        console.log(JSON.stringify({
          status: 'error',
          message: '已有任务在执行中',
          hint: '使用 /om:status 查看状态，或 /om:resume 恢复执行'
        }));
      } else {
        console.log('⚠️  已有任务在执行中');
        console.log('   使用 /om:status 查看状态');
        console.log('   使用 /om:resume 恢复执行');
      }
      return;
    }

    // ============================
    // 路径 A: AI 已拆分 (--tasks-json)
    // ============================
    if (options.tasksJson) {
      await handleTasksJson(options, stateManager, state, omPath);
      return;
    }

    // ============================
    // 路径 B: 自动解析 (fallback)
    // ============================
    await handleAutoParse(input, options, stateManager, state);
  });

/**
 * 处理 AI 解析的任务 (--tasks-json)
 * AI 提供 ParsedTask 格式的结构化数据，仍由 TaskPlanner 做拆分
 */
async function handleTasksJson(
  options: StartOptions,
  stateManager: StateManager,
  state: Awaited<ReturnType<StateManager['getState']>>,
  omPath: string
): Promise<void> {
  let tasksInput: AIParsedInput;

  try {
    // 支持 @file 语法读取文件
    let jsonStr = options.tasksJson!;
    if (jsonStr.startsWith('@')) {
      jsonStr = await fs.readFile(jsonStr.slice(1), 'utf-8');
    }
    tasksInput = JSON.parse(jsonStr);
  } catch (e) {
    if (options.json) {
      console.log(JSON.stringify({
        status: 'error',
        message: `--tasks-json 解析失败: ${e instanceof Error ? e.message : e}`
      }));
    } else {
      console.log(`❌ --tasks-json 解析失败: ${e instanceof Error ? e.message : e}`);
    }
    return;
  }

  if (!tasksInput.goals || tasksInput.goals.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ status: 'error', message: '--tasks-json 中 goals 为空' }));
    } else {
      console.log('❌ --tasks-json 中 goals 为空');
    }
    return;
  }

  // 保存 AI 生成的执行计划
  if (tasksInput.plan) {
    await fs.writeFile(
      path.join(omPath, 'plan.md'),
      tasksInput.plan,
      'utf-8'
    );
  }

  // 构建 ParsedTask
  const parsedTask: import('../../types/index.js').ParsedTask = {
    title: tasksInput.title,
    description: tasksInput.description || '',
    goals: tasksInput.goals,
    constraints: tasksInput.constraints || [],
    deliverables: tasksInput.deliverables || [],
    rawContent: ''
  };

  // 解析质量配置
  const qualityLevel = tasksInput.quality || options.quality || 'balanced';
  const qualityConfig = QUALITY_PRESETS[qualityLevel.toLowerCase()] || QUALITY_PRESETS.balanced;

  if (!options.json) {
    console.log(`\n📋 任务: ${parsedTask.title}`);
    console.log(`   目标: ${parsedTask.goals.join(', ')}`);
    console.log('\n🔧 拆解任务...');
  }

  // 使用 TaskPlanner 拆分（保持原有拆分逻辑）
  const answers = tasksInput.answers || {};
  const planner = new TaskPlanner();
  const subTasks = planner.breakdown(parsedTask, answers, qualityConfig, tasksInput.plan);

  // 创建任务到状态管理器，并建立 ID 映射
  // TaskPlanner 生成的 taskId 和 StateManager 创建的 id 不同，
  // 需要映射后才能正确设置 dependencies
  const taskIdMap = new Map<string, string>();

  for (const task of subTasks) {
    const created = await stateManager.createTask({
      title: task.title,
      description: task.description,
      priority: task.priority as TaskPriority,
      timeout: task.estimatedComplexity === 'high' ? 300000 :
               task.estimatedComplexity === 'medium' ? 180000 : 120000,
      dependencies: [],  // 先创建，稍后更新依赖
      assignedAgent: task.assignedAgent
    });
    taskIdMap.set(task.taskId, created.id);
  }

  // 映射并更新依赖关系
  for (const task of subTasks) {
    const actualId = taskIdMap.get(task.taskId)!;
    const resolvedDeps = task.dependencies
      .map(dep => taskIdMap.get(dep))
      .filter((id): id is string => id !== undefined);

    if (resolvedDeps.length > 0) {
      await stateManager.updateTask(actualId, { dependencies: resolvedDeps });
    }
  }

  // 解析执行模式
  const executionMode = tasksInput.mode || options.mode || 'confirm-key';
  const approvalPoints = resolveApprovalPoints(executionMode);

  await stateManager.updateState({
    status: 'running',
    currentPhase: 'execution',
    config: {
      ...state.config,
      approvalPoints: approvalPoints as ('plan' | 'merge' | 'deploy')[],
      quality: qualityConfig
    }
  });

  // 创建审批请求（如果有审批点）
  const approvalManager = new ApprovalManager(stateManager);
  if (approvalPoints.includes('plan')) {
    const approval = await approvalManager.createPlanApproval(
      'plan-approval',
      `# 执行计划\n\n${subTasks.map((t, i) => `${i + 1}. ${t.title} (${t.assignedAgent})`).join('\n')}`
    );

    await stateManager.updateState({ status: 'paused' });

    if (options.json) {
      console.log(JSON.stringify({
        status: 'waiting_approval',
        approvalId: approval.id,
        approvalType: 'plan',
        message: '等待计划审批',
        tasks: subTasks.map((t, i) => ({
          index: i + 1,
          title: t.title,
          priority: t.priority,
          assignedAgent: t.assignedAgent
        })),
        taskInfo: {
          title: tasksInput.title,
          description: tasksInput.description,
          quality: qualityLevel
        }
      }));
    } else {
      console.log(`\n📋 ${tasksInput.title} - ${subTasks.length} 个子任务:\n`);
      subTasks.forEach((task, i) => {
        console.log(`  ${i + 1}. ${task.title} (${task.priority}, ${task.assignedAgent})`);
      });
      console.log(`\n🎯 执行模式: ${executionMode}`);
      console.log(`⏸️  等待计划审批 (ID: ${approval.id})`);
    }
    return;
  }

  // 无审批点，直接开始执行
  const executor = new OrchestratorExecutor(stateManager, approvalManager, {
    maxConcurrent: state.config.maxConcurrentAgents,
    taskTimeout: state.config.timeout * 1000
  });

  const phaseExecutor = executor.getPhaseExecutor();
  if (phaseExecutor) {
    phaseExecutor.setRunId(state.runId);
    if (executionMode === 'auto') {
      phaseExecutor.setAutoMode(true);
    }
  }

  const result = await executor.step();

  if (options.json) {
    console.log(JSON.stringify({
      status: result.status,
      message: result.message,
      statistics: result.statistics,
      subagentTasks: result.subagentTasks.map(t => ({
        subagent_type: t.subagent_type,
        description: t.description,
        prompt: t.prompt,
        isolation: t.isolation,
        taskId: t.taskId,
        agentType: t.agentType,
        timeout: t.timeout
      })),
      taskInfo: {
        title: tasksInput.title,
        description: tasksInput.description,
        quality: qualityLevel
      }
    }));
  } else {
    console.log(`\n📋 ${tasksInput.title} - ${subTasks.length} 个子任务已创建`);
    console.log(`🎯 执行模式: ${executionMode}`);
    console.log(`   质量级别: ${qualityLevel}`);
    console.log('\n🚀 开始执行...');
    console.log('   使用 /om:status 查看进度');
  }
}

/**
 * 处理自动解析 (fallback，无 AI 时使用)
 */
async function handleAutoParse(
  input: string | undefined,
  options: StartOptions,
  stateManager: StateManager,
  state: Awaited<ReturnType<StateManager['getState']>>
): Promise<void> {
  // 构建任务内容
  let taskContent = input;

  if (options.title || options.description) {
    const title = options.title || '未命名任务';
    const description = options.description || '';
    const techStack = options.techStack ? `\n\n技术栈: ${options.techStack}` : '';
    const docs = options.docs ? `\n文档要求: ${options.docs}` : '';
    taskContent = `# ${title}\n\n${description}${techStack}${docs}`;
  }

  if (!taskContent) {
    const defaultPath = path.join(process.cwd(), 'TASK.md');
    try {
      taskContent = await fs.readFile(defaultPath, 'utf-8');
      if (!options.json) {
        console.log(`📄 读取任务文件: ${defaultPath}`);
      }
    } catch {
      if (options.json) {
        console.log(JSON.stringify({ status: 'error', message: '请提供任务文件路径或描述' }));
      } else {
        console.log('❌ 请提供任务文件路径或描述');
      }
      return;
    }
  } else if (taskContent.endsWith('.md')) {
    try {
      taskContent = await fs.readFile(taskContent, 'utf-8');
    } catch {
      if (options.json) {
        console.log(JSON.stringify({ status: 'error', message: `无法读取文件: ${input}` }));
      } else {
        console.log(`❌ 无法读取文件: ${input}`);
      }
      return;
    }
  }

  if (!options.json) {
    console.log('\n🔍 解析任务...');
  }
  const parser = new TaskParser();
  const parsedTask = parser.parse(taskContent);

  if (!options.json) {
    console.log(`\n📋 任务: ${parsedTask.title}`);
    console.log(`   目标: ${parsedTask.goals.join(', ')}`);
  }

  if (!options.json) {
    console.log('\n🔧 拆解任务...');
  }

  let qualityConfig: QualityConfig | undefined;
  if (options.quality) {
    const qualityLevel = options.quality.toLowerCase();
    if (['strict', 'balanced', 'fast'].includes(qualityLevel)) {
      qualityConfig = QUALITY_PRESETS[qualityLevel];
    }
  }

  const planner = new TaskPlanner();
  const subTasks = planner.breakdown(parsedTask, {}, qualityConfig);

  // 创建任务，并建立 TaskPlanner ID → StateManager ID 的映射
  const taskIdMap = new Map<string, string>();

  for (const subTask of subTasks) {
    const created = await stateManager.createTask({
      title: subTask.title,
      description: subTask.description,
      priority: subTask.priority as TaskPriority,
      timeout: subTask.estimatedComplexity === 'high' ? 300000 :
               subTask.estimatedComplexity === 'medium' ? 180000 : 120000,
      dependencies: [],
      assignedAgent: subTask.assignedAgent
    });
    taskIdMap.set(subTask.taskId, created.id);
  }

  // 映射并更新依赖关系
  for (const subTask of subTasks) {
    const actualId = taskIdMap.get(subTask.taskId)!;
    const resolvedDeps = subTask.dependencies
      .map(dep => taskIdMap.get(dep))
      .filter((id): id is string => id !== undefined);

    if (resolvedDeps.length > 0) {
      await stateManager.updateTask(actualId, { dependencies: resolvedDeps });
    }
  }

  const executionMode = options.mode || 'confirm-key';
  const approvalPoints = resolveApprovalPoints(executionMode);

  await stateManager.updateState({
    status: 'running',
    currentPhase: 'execution',
    config: {
      ...state.config,
      approvalPoints: approvalPoints as ('plan' | 'merge' | 'deploy')[],
      quality: qualityConfig || state.config.quality
    }
  });

  const approvalManager = new ApprovalManager(stateManager);
  if (approvalPoints.includes('plan')) {
    const approval = await approvalManager.createPlanApproval(
      'plan-approval',
      `# 执行计划\n\n${subTasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n')}`
    );

    await stateManager.updateState({ status: 'paused' });

    if (options.json) {
      console.log(JSON.stringify({
        status: 'waiting_approval',
        approvalId: approval.id,
        approvalType: 'plan',
        message: '等待计划审批',
        tasks: subTasks.map((t, i) => ({ index: i + 1, title: t.title, priority: t.priority })),
        taskInfo: {
          title: options.title || parsedTask.title,
          description: options.description,
          quality: options.quality,
          techStack: options.techStack,
          docs: options.docs
        }
      }));
    } else {
      console.log(`\n📋 生成 ${subTasks.length} 个子任务:\n`);
      subTasks.forEach((task, i) => {
        console.log(`  ${i + 1}. ${task.title} (${task.priority})`);
      });
      console.log(`\n🎯 执行模式: ${executionMode}`);
      console.log(`⏸️  等待计划审批 (ID: ${approval.id})`);
    }
    return;
  }

  const executor = new OrchestratorExecutor(stateManager, approvalManager, {
    maxConcurrent: state.config.maxConcurrentAgents,
    taskTimeout: state.config.timeout * 1000
  });

  const phaseExecutor = executor.getPhaseExecutor();
  if (phaseExecutor) {
    phaseExecutor.setRunId(state.runId);
    if (executionMode === 'auto') {
      phaseExecutor.setAutoMode(true);
    }
  }

  const result = await executor.step();

  if (options.json) {
    console.log(JSON.stringify({
      status: result.status,
      message: result.message,
      statistics: result.statistics,
      subagentTasks: result.subagentTasks.map(t => ({
        subagent_type: t.subagent_type,
        description: t.description,
        prompt: t.prompt,
        isolation: t.isolation,
        taskId: t.taskId,
        agentType: t.agentType,
        timeout: t.timeout
      })),
      taskInfo: {
        title: options.title || parsedTask.title,
        description: options.description,
        quality: options.quality,
        techStack: options.techStack,
        docs: options.docs
      }
    }));
  } else {
    console.log(`\n📋 生成 ${subTasks.length} 个子任务`);
    console.log(`🎯 执行模式: ${executionMode}`);
    console.log('\n🚀 开始执行...');
    console.log('   使用 /om:status 查看进度');
  }
}

/**
 * 根据执行模式解析审批点
 */
function resolveApprovalPoints(mode: string): string[] {
  switch (mode) {
    case 'confirm-all': return ['plan', 'phase', 'merge', 'deploy'];
    case 'confirm-key': return ['plan', 'merge', 'deploy'];
    case 'auto': return [];
    default: return ['plan', 'merge'];
  }
}
