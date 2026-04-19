// src/cli/commands/brainstorm.ts
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import { ensureOpenmatrixGitignore } from '../../utils/gitignore.js';
import { SmartQuestionAnalyzer } from '../../orchestrator/smart-question-analyzer.js';
import { InteractiveQuestionGenerator } from '../../orchestrator/interactive-question-generator.js';
import { TaskParser } from '../../orchestrator/task-parser.js';
import { translateAnalyzerInferences } from '../../orchestrator/answer-mapper.js';
import { logger } from '../../utils/logger.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * CLI 选项接口
 */
export interface BrainstormOptions {
  json?: boolean;
  complete?: boolean;
  results?: string;
}

/**
 * 头脑风暴问题类型
 */
interface BrainstormQuestion {
  id: string;
  question: string;
  header: string;
  options: Array<{
    label: string;
    description: string;
  }>;
  multiSelect: boolean;
  why: string;
}

/**
 * 头脑风暴阶段结果
 */
export interface BrainstormResult {
  status: 'brainstorming' | 'ready_to_start';
  taskInput: string;
  taskTitle: string;
  questions: BrainstormQuestion[];
  answers: Record<string, string | string[]>;
  insights: string[];
  designNotes: string[];
  /** 如果检测到垂直领域，建议进入 research */
  suggestResearch?: string;
}

export const brainstormCommand = new Command('brainstorm')
  .description('头脑风暴 - 探索需求和设计后再执行任务')
  .argument('[input]', '任务文件路径或描述')
  .option('--json', '输出 JSON 格式 (供 Skill 解析)')
  .option('--complete', '标记头脑风暴完成，准备执行 start')
  .option('--results <json>', '头脑风暴结果 JSON (从 Skill 传入)')
  .action(async (input: string | undefined, options: BrainstormOptions) => {
    const basePath = process.cwd();
    const omPath = path.join(basePath, '.openmatrix');

    // 确保目录存在
    await fs.mkdir(omPath, { recursive: true });
    await fs.mkdir(path.join(omPath, 'tasks'), { recursive: true });
    await fs.mkdir(path.join(omPath, 'approvals'), { recursive: true });
    await fs.mkdir(path.join(omPath, 'brainstorm'), { recursive: true });

    await ensureOpenmatrixGitignore(basePath);

    const stateManager = new StateManager(omPath);
    await stateManager.initialize();

    const brainstormPath = path.join(omPath, 'brainstorm', 'session.json');

    // --complete 模式：头脑风暴完成，输出 start 所需信息
    if (options.complete) {
      await handleCompleteMode(brainstormPath, options);
      return;
    }

    // 获取任务内容
    const taskContent = await loadTaskContent(input, basePath, options);
    if (!taskContent) return;

    // 创建新的头脑风暴会话
    await createNewSession(taskContent, basePath, brainstormPath, options);
  });

/**
 * 处理 --complete 模式：标记头脑风暴完成，输出 start 所需信息
 */
export async function handleCompleteMode(brainstormPath: string, options: BrainstormOptions): Promise<void> {
  try {
    const sessionData = await fs.readFile(brainstormPath, 'utf-8');
    const session: BrainstormResult = JSON.parse(sessionData);
    session.status = 'ready_to_start';

    mergeSessionResults(session, options.results);

    await fs.writeFile(brainstormPath, JSON.stringify(session, null, 2));
    outputCompleteResult(session, options.json);
  } catch {
    outputSessionNotFound(options.json);
  }
}

/**
 * 合并外部传入的结果到已有会话
 */
export function mergeSessionResults(session: BrainstormResult, resultsJson?: string): void {
  if (!resultsJson) return;
  try {
    const results = JSON.parse(resultsJson);
    session.answers = { ...session.answers, ...results.answers };
    session.insights = [...session.insights, ...(results.insights || [])];
    session.designNotes = [...session.designNotes, ...(results.designNotes || [])];
  } catch {
    // 忽略解析错误
  }
}

/**
 * 输出 complete 模式的结果
 */
export function outputCompleteResult(session: BrainstormResult, jsonMode?: boolean): void {
  if (jsonMode) {
    logger.info(JSON.stringify({
      status: 'ready_to_start',
      message: '头脑风暴完成，准备执行任务',
      taskInput: session.taskInput,
      taskTitle: session.taskTitle,
      answers: session.answers,
      insights: session.insights,
      designNotes: session.designNotes,
      hint: '使用 /om:start 开始执行任务'
    }));
  } else {
    logger.info('头脑风暴完成!');
    logger.info(`   任务: ${session.taskTitle}`);
    logger.info('收集的洞察:');
    session.insights.forEach((insight, i) => {
      logger.info(`   ${i + 1}. ${insight}`);
    });
    logger.info('设计要点:');
    session.designNotes.forEach((note, i) => {
      logger.info(`   ${i + 1}. ${note}`);
    });
    logger.info('使用 /om:start 开始执行任务');
  }
}

/**
 * 输出会话未找到的错误信息
 */
export function outputSessionNotFound(jsonMode?: boolean): void {
  if (jsonMode) {
    logger.info(JSON.stringify({
      status: 'error',
      message: '没有进行中的头脑风暴会话'
    }));
  } else {
    logger.info('没有进行中的头脑风暴会话');
    logger.info('   使用 openmatrix brainstorm <task> 开始新的头脑风暴');
  }
}

/**
 * 从输入参数或文件加载任务内容，返回 null 表示加载失败（已输出错误）
 */
export async function loadTaskContent(
  input: string | undefined,
  basePath: string,
  options: BrainstormOptions
): Promise<string | null> {
  let taskContent = input;
  if (!taskContent) {
    return loadTaskFromDefaultFile(basePath, options.json);
  } else if (taskContent.endsWith('.md')) {
    return loadTaskFromSpecifiedFile(taskContent, input!, options.json);
  }
  return taskContent;
}

/**
 * 从默认 TASK.md 文件加载任务内容
 */
export async function loadTaskFromDefaultFile(basePath: string, jsonMode?: boolean): Promise<string | null> {
  const defaultPath = path.join(basePath, 'TASK.md');
  try {
    const content = await fs.readFile(defaultPath, 'utf-8');
    if (!jsonMode) {
      logger.info(`读取任务文件: ${defaultPath}`);
    }
    return content;
  } catch {
    if (jsonMode) {
      logger.info(JSON.stringify({ status: 'error', message: '请提供任务文件路径或描述' }));
    } else {
      logger.info('请提供任务文件路径或描述');
      logger.info('   用法: openmatrix brainstorm <task.md>');
      logger.info('   或创建 TASK.md 文件');
    }
    return null;
  }
}

/**
 * 从用户指定的 .md 文件加载任务内容
 */
export async function loadTaskFromSpecifiedFile(filePath: string, displayName: string, jsonMode?: boolean): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    if (!jsonMode) {
      logger.info(`读取任务文件: ${displayName}`);
    }
    return content;
  } catch {
    if (jsonMode) {
      logger.info(JSON.stringify({ status: 'error', message: `无法读取文件: ${displayName}` }));
    } else {
      logger.info(`无法读取文件: ${displayName}`);
    }
    return null;
  }
}

/**
 * 从任务内容中提取标题
 */
export function extractTaskTitle(taskContent: string): string {
  const lines = taskContent.split('\n');
  for (const line of lines) {
    const match = line.match(/^#\s+(.+)$/);
    if (match) {
      return match[1].trim();
    }
  }
  return '未命名任务';
}

/**
 * 创建新的头脑风暴会话并输出
 */
export async function createNewSession(
  taskContent: string,
  basePath: string,
  brainstormPath: string,
  options: BrainstormOptions
): Promise<void> {
  const taskTitle = extractTaskTitle(taskContent);
  const questions = await generateSmartQuestions(taskContent, basePath);
  const domainDetection = detectVerticalDomain(taskContent);

  const session: BrainstormResult = {
    status: 'brainstorming',
    taskInput: taskContent,
    taskTitle,
    questions,
    answers: {},
    insights: [],
    designNotes: [],
    suggestResearch: domainDetection.isVertical ? domainDetection.domain : undefined
  };

  await fs.writeFile(brainstormPath, JSON.stringify(session, null, 2));
  outputNewSession(taskTitle, questions, domainDetection, options.json);
}

/**
 * 输出新头脑风暴会话的信息
 */
export function outputNewSession(
  taskTitle: string,
  questions: BrainstormQuestion[],
  domainDetection: { isVertical: boolean; domain: string },
  jsonMode?: boolean
): void {
  if (jsonMode) {
    outputNewSessionJson(taskTitle, questions, domainDetection);
  } else {
    outputNewSessionText(taskTitle, questions, domainDetection);
  }
}

/**
 * JSON 模式输出新会话信息
 */
export function outputNewSessionJson(
  taskTitle: string,
  questions: BrainstormQuestion[],
  domainDetection: { isVertical: boolean; domain: string }
): void {
  const output: Record<string, unknown> = {
    status: 'brainstorming',
    message: '开始头脑风暴',
    taskTitle,
    questions: questions.map(q => ({
      id: q.id,
      question: q.question,
      header: q.header,
      options: q.options,
      multiSelect: q.multiSelect
    })),
    hint: '请逐一回答问题，完成后再调用 --complete'
  };

  if (domainDetection.isVertical) {
    output.suggestResearch = domainDetection.domain;
    output.researchHint = `检测到垂直领域「${domainDetection.domain}」，建议先进行领域调研`;
  }

  logger.info(JSON.stringify(output));
}

/**
 * 文本模式输出新会话信息
 */
export function outputNewSessionText(
  taskTitle: string,
  questions: BrainstormQuestion[],
  domainDetection: { isVertical: boolean; domain: string }
): void {
  logger.info('开始头脑风暴...');
  logger.info(`任务: ${taskTitle}`);

  if (domainDetection.isVertical) {
    logger.info(`检测到垂直领域: ${domainDetection.domain}`);
    logger.info('   建议使用 /om:research 进行领域调研');
  }

  logger.info('需要探索以下问题:');
  questions.forEach((q, i) => {
    logger.info(`  ${i + 1}. ${q.question}`);
  });
  logger.info('使用 /om:brainstorm 技能进行交互式问答');
}

/**
 * 检测是否可能需要领域调研
 * 不硬编码领域，只判断是否像垂直领域任务
 */
function detectVerticalDomain(taskContent: string): { isVertical: boolean; domain: string } {
  const lower = taskContent.toLowerCase();

  // 检测"做X"模式 - 这是垂直领域任务的典型特征
  const actionPatterns = [
    /做(一个|个)(.+?)(的|app|网站|系统|平台|工具|应用|游戏|$)/,
    /开发(一个|个)?(.+?)(系统|应用|平台|工具|游戏|$)/,
    /构建(一个|个)?(.+?)(系统|应用|平台|工具|$)/,
    /build (a |an )?(.+?)(app|website|system|tool|platform|game|$)/i,
    /create (a |an )?(.+?)(app|website|system|tool|platform|game|$)/i,
  ];

  for (const pattern of actionPatterns) {
    const match = taskContent.match(pattern);
    if (match && match[2]) {
      const extracted = match[2].trim();
      // 如果提取的内容有意义，认为是垂直领域任务
      if (extracted.length > 1) {
        return { isVertical: true, domain: extracted };
      }
    }
  }

  // 检测是否包含"系统"、"平台"、"应用"等大词
  const systemKeywords = ['系统', '平台', '应用', 'system', 'platform', 'app'];
  if (systemKeywords.some(kw => lower.includes(kw))) {
    return { isVertical: true, domain: '待分析' };
  }

  return { isVertical: false, domain: '' };
}

/**
 * 根据任务内容生成头脑风暴问题
 */
function generateBrainstormQuestions(taskContent: string, taskTitle: string): BrainstormQuestion[] {
  const questions: BrainstormQuestion[] = [];
  const content = taskContent.toLowerCase();

  questions.push(createCoreObjectiveQuestion());
  questions.push(createUserValueQuestion());

  if (content.includes('架构') || content.includes('系统') || content.includes('集成') || content.includes('多个')) {
    questions.push(createComplexityQuestion());
  }

  if (content.includes('技术') || content.includes('框架') || content.includes('库')) {
    questions.push(createTechConstraintsQuestion());
  }

  questions.push(createRisksQuestion());
  questions.push(createAcceptanceQuestion());
  questions.push(createPriorityQuestion());
  questions.push(createQualityQuestion());
  questions.push(createExecutionModeQuestion());
  questions.push(createE2ETestsQuestion());

  return questions;
}

function createCoreObjectiveQuestion(): BrainstormQuestion {
  return {
    id: 'core_objective',
    question: '这个任务的核心目标是什么？想要解决什么问题？',
    header: '核心目标',
    options: [
      { label: '实现新功能', description: '添加新的功能特性，扩展系统能力' },
      { label: '修复问题', description: '修复 Bug 或解决已知问题' },
      { label: '重构优化', description: '改进代码结构、性能或可维护性' },
      { label: '技术探索', description: '探索新技术方案，验证可行性' }
    ],
    multiSelect: false,
    why: '明确核心目标有助于选择正确的实现策略和质量标准'
  };
}

function createUserValueQuestion(): BrainstormQuestion {
  return {
    id: 'user_value',
    question: '这个任务为用户带来什么价值？最终用户是谁？',
    header: '用户价值',
    options: [
      { label: '开发者', description: '主要用户是开发者，需要清晰的 API 和文档' },
      { label: '终端用户', description: '主要用户是终端用户，需要良好的用户体验' },
      { label: '运维人员', description: '主要用户是运维，需要稳定性和可观测性' },
      { label: '内部团队', description: '主要用户是内部团队，需要高效协作支持' }
    ],
    multiSelect: false,
    why: '了解目标用户有助于设计合适的接口和交互方式'
  };
}

function createComplexityQuestion(): BrainstormQuestion {
  return {
    id: 'complexity',
    question: '这个任务的实现复杂度如何？需要哪些关键组件？',
    header: '复杂度',
    options: [
      { label: '简单', description: '单一功能，少量代码修改' },
      { label: '中等', description: '需要多个组件协作，有依赖关系' },
      { label: '复杂', description: '涉及架构调整，需要仔细规划' },
      { label: '非常复杂', description: '大型重构或新系统，需要分阶段实施' }
    ],
    multiSelect: false,
    why: '复杂度评估有助于决定是否需要分阶段实施和额外的设计审查'
  };
}

function createTechConstraintsQuestion(): BrainstormQuestion {
  return {
    id: 'tech_constraints',
    question: '有哪些技术约束或偏好？需要使用/避免什么技术？',
    header: '技术约束',
    options: [
      { label: '使用现有技术栈', description: '复用项目已有的技术选择' },
      { label: '引入新技术', description: '需要引入新的库或框架' },
      { label: '保持技术中立', description: '不引入新依赖，使用原生方案' },
      { label: '需要技术调研', description: '技术选型不确定，需要先调研' }
    ],
    multiSelect: false,
    why: '技术约束影响实现方案和后续维护成本'
  };
}

function createRisksQuestion(): BrainstormQuestion {
  return {
    id: 'risks',
    question: '这个任务可能面临哪些风险或挑战？',
    header: '风险',
    options: [
      { label: '技术风险', description: '技术实现存在不确定性' },
      { label: '时间风险', description: '需要在短时间内完成' },
      { label: '兼容性风险', description: '可能影响现有功能' },
      { label: '无明显风险', description: '任务清晰，风险可控' }
    ],
    multiSelect: true,
    why: '识别风险有助于提前规划应对策略'
  };
}

function createAcceptanceQuestion(): BrainstormQuestion {
  return {
    id: 'acceptance',
    question: '如何判断任务完成？有哪些验收标准？',
    header: '验收标准',
    options: [
      { label: '功能完整', description: '所有功能按预期工作' },
      { label: '测试覆盖', description: '有足够的测试覆盖' },
      { label: '性能达标', description: '满足性能要求' },
      { label: '文档完善', description: '有完整的使用文档' }
    ],
    multiSelect: true,
    why: '明确的验收标准有助于判断任务完成度'
  };
}

function createPriorityQuestion(): BrainstormQuestion {
  return {
    id: 'priority',
    question: '这个任务的优先级如何？是否需要 MVP 版本？',
    header: '优先级',
    options: [
      { label: '高优先级', description: '需要尽快完成，影响其他工作' },
      { label: '中优先级', description: '计划内任务，按正常节奏推进' },
      { label: '低优先级', description: '可延后处理，有更重要的任务' },
      { label: '需要 MVP', description: '先实现最小可用版本，再迭代' }
    ],
    multiSelect: false,
    why: '优先级决定资源分配和实施策略'
  };
}

function createQualityQuestion(): BrainstormQuestion {
  return {
    id: 'quality',
    question: '选择质量门禁级别（决定测试覆盖、Lint、安全扫描等要求）',
    header: '质量级别',
    options: [
      { label: 'strict', description: 'TDD + 80% 覆盖率 + 严格 Lint + 安全扫描 — 生产级代码' },
      { label: 'balanced (推荐)', description: '60% 覆盖率 + Lint + 安全扫描 — 日常开发' },
      { label: 'fast', description: '无质量门禁 — 快速原型/验证' }
    ],
    multiSelect: false,
    why: '质量级别影响任务拆分、测试要求和执行时间'
  };
}

function createExecutionModeQuestion(): BrainstormQuestion {
  return {
    id: 'execution_mode',
    question: '选择执行模式（控制 AI 执行过程中的审批节点）',
    header: '执行模式',
    options: [
      { label: '全自动执行 (推荐)', description: '全自动执行，无需人工审批，遇到阻塞自动 Meeting' },
      { label: 'confirm-key', description: '关键节点审批（计划、合并、部署）' },
      { label: 'confirm-all', description: '每个阶段都需人工确认' }
    ],
    multiSelect: false,
    why: '执行模式决定自动化程度和人工干预频率'
  };
}

function createE2ETestsQuestion(): BrainstormQuestion {
  return {
    id: 'e2e_tests',
    question: '是否启用端到端 (E2E) 测试？（适用于 Web/Mobile/GUI 项目，耗时较长）',
    header: 'E2E 测试',
    options: [
      { label: '启用 E2E 测试', description: '使用 Playwright/Cypress 等框架进行端到端测试' },
      { label: '不启用 (推荐)', description: '仅进行单元测试和集成测试，节省时间' }
    ],
    multiSelect: false,
    why: 'E2E 测试能验证完整用户流程，但增加执行时间'
  };
}

/**
 * 智能问题生成 — 使用 SmartQuestionAnalyzer + InteractiveQuestionGenerator
 */
async function generateSmartQuestions(taskContent: string, basePath: string): Promise<BrainstormQuestion[]> {
  try {
    const session = await buildSmartQuestionSession(taskContent, basePath);
    const questions = convertToBrainstormQuestions(session);
    questions.push(...generateDomainAnalysisQuestions(taskContent));
    return questions;
  } catch (error) {
    logger.warn(`智能问题生成失败，使用静态问题: ${error instanceof Error ? error.message : error}`);
    return generateBrainstormQuestions(taskContent, '');
  }
}

/**
 * 构建智能问题会话：解析任务 → 分析推断 → 生成问题
 */
export async function buildSmartQuestionSession(taskContent: string, basePath: string) {
  const parser = new TaskParser();
  const parsedTask = parser.parse(taskContent);

  const analyzer = new SmartQuestionAnalyzer(basePath);
  const analysisResult = await analyzer.analyze(taskContent, parsedTask);

  const inferenceMap = translateAnalyzerInferences(analysisResult.inferences);

  const questionGen = new InteractiveQuestionGenerator();
  questionGen.setInferences(inferenceMap);

  const session = questionGen.startSession(parsedTask);
  questionGen.addContextualQuestions(parsedTask, session.questions);
  return session;
}

/**
 * 将智能会话问题转换为 BrainstormQuestion[] 格式
 */
export function convertToBrainstormQuestions(session: { questions: Array<{ id: string; question: string; category: string; options?: Array<{ label: string; description?: string }>; type: string; priority?: number }>; skippedQuestionIds?: string[] }): BrainstormQuestion[] {
  return session.questions
    .filter(q => !session.skippedQuestionIds?.includes(q.id))
    .sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5))
    .map(q => ({
      id: q.id,
      question: q.question,
      header: q.category,
      options: (q.options || []).map(o => ({
        label: o.label,
        description: o.description || ''
      })),
      multiSelect: q.type === 'multiple',
      why: ''
    }));
}

/**
 * 领域分析问题 — 底层逻辑思考
 *
 * 从任务描述中提取：
 * 1. 核心领域实体及其关系
 * 2. 数据流转路径
 * 3. 关键不变量/约束
 * 4. 核心用户场景链路
 */
function generateDomainAnalysisQuestions(taskContent: string): BrainstormQuestion[] {
  const questions: BrainstormQuestion[] = [];

  questions.push(createDomainEntitiesQuestion(taskContent));
  questions.push(createDataFlowQuestion());
  questions.push(createInvariantsQuestion());
  questions.push(createCoreScenariosQuestion());

  return questions;
}

function createDomainEntitiesQuestion(taskContent: string): BrainstormQuestion {
  const entityHints = extractEntities(taskContent);
  if (entityHints.length > 0) {
    return {
      id: 'domain_entities',
      question: `从任务描述中识别到以下核心实体，请确认或补充：\n${entityHints.map(e => `  • ${e}`).join('\n')}`,
      header: '领域实体',
      options: [
        { label: '以上实体正确', description: '已覆盖核心领域实体，无需补充' },
        { label: '需要补充实体', description: '还有重要实体未被识别，我会在"其他"中补充' },
        { label: '需要调整实体', description: '部分实体不准确，需要修正' }
      ],
      multiSelect: false,
      why: '明确领域实体是设计数据模型和 API 的基础'
    };
  }
  return {
    id: 'domain_entities',
    question: '这个系统涉及哪些核心领域实体？它们之间是什么关系？（如 用户-订单-商品）',
    header: '领域实体',
    options: [
      { label: '单一实体', description: '系统围绕一个核心实体（如用户管理）' },
      { label: '2-3 个实体', description: '少量实体间有简单关系（如用户-文章）' },
      { label: '多实体复杂关系', description: '多个实体间有多对多等复杂关系' },
      { label: '我来说明', description: '在"其他"中描述具体实体' }
    ],
    multiSelect: false,
    why: '明确领域实体是设计数据模型和 API 的基础'
  };
}

function createDataFlowQuestion(): BrainstormQuestion {
  return {
    id: 'data_flow',
    question: '数据在系统中如何流转？（从输入到存储到输出）',
    header: '数据流',
    options: [
      { label: '用户输入 → 处理 → 存储 → 展示', description: '经典 CRUD 流程（如后台管理、博客）' },
      { label: '外部 API → 转换 → 存储 → 查询', description: '数据采集/聚合类系统' },
      { label: '事件触发 → 处理 → 通知/存储', description: '事件驱动型（如消息队列、Webhook）' },
      { label: '实时流处理', description: '数据持续流入，实时处理（如监控、聊天）' },
      { label: '我来说明', description: '在"其他"中描述具体数据流' }
    ],
    multiSelect: false,
    why: '数据流决定架构选型（请求驱动 vs 事件驱动 vs 流处理）'
  };
}

function createInvariantsQuestion(): BrainstormQuestion {
  return {
    id: 'invariants',
    question: '系统中存在哪些关键不变量或业务约束？（什么条件必须永远成立）',
    header: '不变量',
    options: [
      { label: '数据一致性', description: '如：余额不能为负、库存不能超卖、状态只能单向流转' },
      { label: '权限控制', description: '如：用户只能操作自己的数据、管理员才能访问后台' },
      { label: '唯一性约束', description: '如：用户名唯一、订单号不重复、同一时间只能有一个活跃会话' },
      { label: '无明显约束', description: '纯展示或简单计算，无严格不变量' }
    ],
    multiSelect: true,
    why: '不变量决定了哪些地方需要加锁、事务、校验和防御性编程'
  };
}

function createCoreScenariosQuestion(): BrainstormQuestion {
  return {
    id: 'core_scenarios',
    question: '从用户视角，核心操作链路是什么？（用户会走过的关键路径）',
    header: '场景链路',
    options: [
      { label: '注册→登录→使用→退出', description: '典型用户系统链路' },
      { label: '浏览→选择→下单→支付→确认', description: '电商/交易类链路' },
      { label: '创建→编辑→预览→发布', description: '内容管理类链路' },
      { label: '输入→处理→查看结果', description: '工具/计算类链路' },
      { label: '我来说明', description: '在"其他"中描述具体场景链路' }
    ],
    multiSelect: true,
    why: '核心场景链路决定了 MVP 的功能范围和优先级排序'
  };
}

/**
 * 从任务描述中提取可能的领域实体
 */
function extractEntities(taskContent: string): string[] {
  const entities: string[] = [];

  // 中文常见领域实体
  const zhPatterns: Array<{ pattern: RegExp; entity: string }> = [
    { pattern: /用户|账号|账户|注册|登录|权限|角色/gi, entity: '用户 (User)' },
    { pattern: /订单|交易|购买|支付|退款|结算/gi, entity: '订单 (Order)' },
    { pattern: /商品|产品|物品|库存|上架|下架/gi, entity: '商品 (Product)' },
    { pattern: /文章|帖子|内容|评论|标签|分类/gi, entity: '内容 (Content)' },
    { pattern: /任务|工单|项目|里程碑|迭代/gi, entity: '任务 (Task)' },
    { pattern: /消息|通知|推送|邮件|短信/gi, entity: '消息 (Message)' },
    { pattern: /文件|附件|图片|视频|媒体|上传/gi, entity: '文件 (File)' },
    { pattern: /配置|设置|参数|选项|规则/gi, entity: '配置 (Config)' },
    { pattern: /日志|记录|审计|追踪|监控/gi, entity: '日志 (Log)' },
    { pattern: /数据|报表|统计|分析|仪表盘|dashboard/gi, entity: '数据 (Data)' },
    { pattern: /API|接口|端点|路由|endpoint/gi, entity: 'API' },
    { pattern: /数据库|存储|缓存|表|collection/gi, entity: '存储 (Storage)' },
  ];

  const seen = new Set<string>();
  for (const { pattern, entity } of zhPatterns) {
    if (pattern.test(taskContent) && !seen.has(entity)) {
      entities.push(entity);
      seen.add(entity);
    }
  }

  return entities;
}