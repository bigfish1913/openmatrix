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
  /** 每个 goal 的类型标注 (由 AI 在提取时标注)，与 goals 数组一一对应 */
  goalTypes?: import('../../types/index.js').GoalType[];
  /** 每个 goal 的复杂度标注 (由 AI 在提取时标注)，与 goals 数组一一对应 */
  goalComplexity?: ('low' | 'medium' | 'high')[];
  constraints?: string[];
  deliverables?: string[];
  /** 额外上下文（如技术栈、文档要求等） */
  answers?: Record<string, string>;
  quality?: 'strict' | 'balanced' | 'fast';
  mode?: 'confirm-all' | 'confirm-key' | 'auto';
  /** 是否启用 E2E 测试 */
  e2eTests?: boolean;
  /** E2E 测试类型 (functional/visual) */
  e2eType?: 'functional' | 'visual';
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
  e2eTests?: boolean;
  e2eType?: string;
  /** 研究上下文 JSON 路径（来自 /om:research 产出的 context.json） */
  researchContext?: string;
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
  .option('--e2e-tests', '启用 E2E 测试')
  .option('--e2e-type <type>', 'E2E 测试类型 (web|visual)')
  .option('--research-context <path>', '研究上下文 JSON 路径 (来自 /om:research 的 context.json)')
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
      await handleTasksJson(options, stateManager, state, omPath, basePath);
      return;
    }

    // ============================
    // 路径 B: 自动解析 (fallback)
    // ============================
    await handleAutoParse(input, options, stateManager, state, basePath, omPath);
  });

/**
 * Research context JSON 结构（由 /om:research 产出）
 */
interface ResearchContext {
  topic: string;
  domain: string;
  goals?: string[];
  constraints?: string[];
  deliverables?: string[];
  reportPath?: string;
  knowledgePath?: string;
}

/**
 * 加载研究上下文
 */
async function loadResearchContext(
  researchContextPath: string | undefined,
  basePath: string,
  omPath: string
): Promise<{ context: ResearchContext | null; report: string | null }> {
  let contextPath = researchContextPath;
  if (!contextPath) {
    // 自动检测默认路径
    const defaultPath = path.join(omPath, 'research', 'context.json');
    try {
      await fs.access(defaultPath);
      contextPath = `@${defaultPath}`;
    } catch {
      return { context: null, report: null };
    }
  }

  if (!contextPath) {
    return { context: null, report: null };
  }

  try {
    // 支持 @file 语法
    let jsonStr = contextPath;
    if (jsonStr.startsWith('@')) {
      const filePath = jsonStr.slice(1);
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(basePath, filePath);
      jsonStr = await fs.readFile(resolvedPath, 'utf-8');
    }
    const context: ResearchContext = JSON.parse(jsonStr);

    // 读取研究报告
    let report: string | null = null;
    if (context.reportPath) {
      const reportPath = path.isAbsolute(context.reportPath)
        ? context.reportPath
        : path.join(basePath, context.reportPath);
      try {
        report = await fs.readFile(reportPath, 'utf-8');
      } catch {
        // 研究报告不存在不影响流程
      }
    }

    return { context, report };
  } catch {
    return { context: null, report: null };
  }
}

/**
 * 合并研究上下文到 AI 解析的输入
 */
function mergeResearchContext(
  tasksInput: AIParsedInput,
  researchContext: ResearchContext
): AIParsedInput {
  const merged = { ...tasksInput };

  // goals: 研究的基础 goals + AI 补充的 goals（去重）
  const baseGoals = researchContext.goals || [];
  const aiGoals = tasksInput.goals || [];
  const mergedGoals = [...new Set([...baseGoals, ...aiGoals])];
  if (mergedGoals.length > 0) {
    merged.goals = mergedGoals;
  }

  // constraints: 合并
  const baseConstraints = researchContext.constraints || [];
  const aiConstraints = tasksInput.constraints || [];
  const mergedConstraints = [...new Set([...baseConstraints, ...aiConstraints])];
  if (mergedConstraints.length > 0) {
    merged.constraints = mergedConstraints;
  }

  // deliverables: 合并
  const baseDeliverables = researchContext.deliverables || [];
  const aiDeliverables = tasksInput.deliverables || [];
  const mergedDeliverables = [...new Set([...baseDeliverables, ...aiDeliverables])];
  if (mergedDeliverables.length > 0) {
    merged.deliverables = mergedDeliverables;
  }

  return merged;
}

/**
 * 处理 AI 解析的任务 (--tasks-json)
 * AI 提供 ParsedTask 格式的结构化数据，仍由 TaskPlanner 做拆分
 */
async function handleTasksJson(
  options: StartOptions,
  stateManager: StateManager,
  state: Awaited<ReturnType<StateManager['getState']>>,
  omPath: string,
  basePath: string
): Promise<void> {
  let tasksInput: AIParsedInput;

  try {
    // 支持 @file 语法读取文件
    let jsonStr = options.tasksJson!;
    if (jsonStr.startsWith('@')) {
      const filePath = jsonStr.slice(1);
      // 如果是相对路径，转换为绝对路径
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(basePath, filePath);
      jsonStr = await fs.readFile(resolvedPath, 'utf-8');
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

  // 加载并合并研究上下文
  const { context: researchContext } = await loadResearchContext(
    options.researchContext,
    basePath,
    omPath
  );
  let resolvedInput = tasksInput;
  if (researchContext) {
    resolvedInput = mergeResearchContext(tasksInput, researchContext);
    if (!options.json) {
      console.log(`🔬 已加载研究领域: ${researchContext.domain}`);
    }
  }

  // 读取独立的技术方案文档（plan.md）
  let planContent: string | undefined;
  const planPath = path.join(omPath, 'plan.md');
  try {
    planContent = await fs.readFile(planPath, 'utf-8');
    if (!options.json) {
      console.log(`📄 已加载技术方案: plan.md`);
    }
  } catch {
    // plan.md 不存在时继续（可能由 AI 后续生成或无 plan）
  }

  // 构建 ParsedTask
  const parsedTask: import('../../types/index.js').ParsedTask = {
    title: resolvedInput.title || tasksInput.title,
    description: resolvedInput.description || '',
    goals: resolvedInput.goals,
    goalTypes: resolvedInput.goalTypes,
    goalComplexity: resolvedInput.goalComplexity,
    constraints: resolvedInput.constraints || [],
    deliverables: resolvedInput.deliverables || [],
    rawContent: ''
  };

  // 解析质量配置
  const qualityLevel = tasksInput.quality || options.quality || 'balanced';
  const qualityConfig = { ...(QUALITY_PRESETS[qualityLevel.toLowerCase()] || QUALITY_PRESETS.balanced) };

  // E2E 测试覆盖（用户在 Skill 问答中选择启用）
  if (tasksInput.e2eTests || options.e2eTests) {
    qualityConfig.e2eTests = true;
  }

  // E2E 类型（通过 answers 传递给 TaskPlanner）
  const extraAnswers = { ...(resolvedInput.answers || {}) };
  // tasks-input.json 中的 e2eType 或 CLI 参数
  const e2eTypeValue = tasksInput.e2eType || options.e2eType;
  if (e2eTypeValue) {
    extraAnswers.e2eType = e2eTypeValue;
  }

  if (!options.json) {
    console.log(`\n📋 任务: ${parsedTask.title}`);
    console.log(`   目标: ${parsedTask.goals.join(', ')}`);
    console.log('\n🔧 拆解任务...');
  }

  // 使用 TaskPlanner 拆分（保持原有拆分逻辑）
  const planner = new TaskPlanner();
  const subTasks = planner.breakdown(parsedTask, extraAnswers, qualityConfig, planContent);

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
          title: resolvedInput.title,
          description: resolvedInput.description,
          quality: qualityLevel,
          domain: researchContext?.domain
        }
      }));
    } else {
      console.log(`\n📋 ${resolvedInput.title} - ${subTasks.length} 个子任务:\n`);
      subTasks.forEach((task, i) => {
        console.log(`  ${i + 1}. ${task.title} (${task.priority}, ${task.assignedAgent})`);
      });
      console.log(`\n🎯 执行模式: ${executionMode}`);
      console.log(`⏸️  等待计划审批 (ID: ${approval.id})`);
    }
    return;
  }

  // 无审批点，返回任务列表供 Skill 执行
  const allTasks = await stateManager.listTasks();
  const subagentTasks = allTasks.map(t => ({
    taskId: t.id,
    agentType: t.assignedAgent,
    title: t.title,
    description: t.description,
    priority: t.priority,
    dependencies: t.dependencies,
    timeout: t.timeout
  }));

  if (options.json) {
    console.log(JSON.stringify({
      status: 'tasks_ready',
      message: '任务已准备就绪，等待 Skill 执行',
      statistics: {
        totalTasks: allTasks.length,
        pending: allTasks.filter(t => t.status === 'pending').length
      },
      subagentTasks,
      taskInfo: {
        title: resolvedInput.title,
        description: resolvedInput.description,
        quality: qualityLevel,
        domain: researchContext?.domain
      }
    }));
  } else {
    console.log(`\n📋 ${resolvedInput.title} - ${subTasks.length} 个子任务已创建`);
    console.log(`🎯 执行模式：${executionMode}`);
    console.log(`   质量级别：${qualityLevel}`);
    console.log('\n🚀 等待 Skill 执行任务...');
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
  state: Awaited<ReturnType<StateManager['getState']>>,
  basePath: string,
  omPath: string
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

  // 如果没有提供输入，先检测研究上下文，再检测 TASK.md
  if (!taskContent) {
    // 优先检测研究上下文
    const { context: researchContext, report: researchReport } = await loadResearchContext(
      options.researchContext,
      basePath,
      omPath
    );

    if (researchContext) {
      // 基于研究上下文构建 ParsedTask
      const parsedTitle = researchContext.topic || researchContext.domain || '未命名任务';
      const researchGoals = researchContext.goals || [];

      if (!options.json) {
        console.log(`\n🔬 检测到研究领域: ${researchContext.domain}`);
        console.log(`   研究目标: ${researchGoals.length > 0 ? researchGoals.join(', ') : '待拆分'}`);
        console.log('\n🔍 基于研究结果解析任务...');
      }

      const parsedTask: import('../../types/index.js').ParsedTask = {
        title: parsedTitle,
        description: researchGoals.length > 0 ? researchGoals.join('\n') : '',
        goals: researchGoals,
        goalTypes: researchGoals.map(() => 'development' as import('../../types/index.js').GoalType),
        constraints: researchContext.constraints || [],
        deliverables: researchContext.deliverables || [],
        rawContent: researchReport || ''
      };

      if (!options.json) {
        console.log(`\n📋 任务: ${parsedTask.title}`);
        console.log(`   目标: ${parsedTask.goals.join(', ') || '(待 AI 补充)'}`);
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
      const subTasks = planner.breakdown(parsedTask, {}, qualityConfig, researchReport || undefined);
      await finalizeAndOutput(subTasks, options, stateManager, state, qualityConfig, parsedTask.title);
      return;
    }

    // 无研究上下文，回退到 TASK.md
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

  await finalizeAndOutput(subTasks, options, stateManager, state, qualityConfig, parsedTask.title);
}

/**
 * 公共函数：创建任务、更新状态、处理审批、输出结果
 * 被 handleTasksJson 和 handleAutoParse 共用
 */
async function finalizeAndOutput(
  subTasks: import('../../orchestrator/task-planner.js').TaskBreakdown[],
  options: StartOptions,
  stateManager: StateManager,
  state: Awaited<ReturnType<StateManager['getState']>>,
  qualityConfig: QualityConfig | undefined,
  taskTitle: string
): Promise<void> {
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
        taskInfo: { title: taskTitle, quality: options.quality }
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

  // 无审批点，返回任务列表供 Skill 执行
  const allTasks = await stateManager.listTasks();
  const subagentTasks = allTasks.map(t => ({
    taskId: t.id,
    agentType: t.assignedAgent,
    title: t.title,
    description: t.description,
    priority: t.priority,
    dependencies: t.dependencies,
    timeout: t.timeout
  }));

  if (options.json) {
    console.log(JSON.stringify({
      status: 'tasks_ready',
      message: '任务已准备就绪，等待 Skill 执行',
      statistics: {
        totalTasks: allTasks.length,
        pending: allTasks.filter(t => t.status === 'pending').length
      },
      subagentTasks,
      taskInfo: { title: taskTitle, quality: options.quality }
    }));
  } else {
    console.log(`\n📋 生成 ${subTasks.length} 个子任务`);
    console.log(`🎯 执行模式：${executionMode}`);
    console.log('\n🚀 等待 Skill 执行任务...');
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
