// src/cli/commands/brainstorm.ts
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import { ensureOpenmatrixGitignore } from '../../utils/gitignore.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * CLI 选项接口
 */
interface BrainstormOptions {
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
interface BrainstormResult {
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

    // 确保 .openmatrix 被 git 忽略
    await ensureOpenmatrixGitignore(basePath);

    const stateManager = new StateManager(omPath);
    await stateManager.initialize();

    const brainstormPath = path.join(omPath, 'brainstorm', 'session.json');

    // --complete 模式：头脑风暴完成，输出 start 所需信息
    if (options.complete) {
      try {
        const sessionData = await fs.readFile(brainstormPath, 'utf-8');
        const session: BrainstormResult = JSON.parse(sessionData);

        // 更新状态
        session.status = 'ready_to_start';

        // 如果传入了结果，合并
        if (options.results) {
          try {
            const results = JSON.parse(options.results);
            session.answers = { ...session.answers, ...results.answers };
            session.insights = [...session.insights, ...(results.insights || [])];
            session.designNotes = [...session.designNotes, ...(results.designNotes || [])];
          } catch {
            // 忽略解析错误
          }
        }

        await fs.writeFile(brainstormPath, JSON.stringify(session, null, 2));

        if (options.json) {
          console.log(JSON.stringify({
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
          console.log('✅ 头脑风暴完成!');
          console.log(`   任务: ${session.taskTitle}`);
          console.log('\n📋 收集的洞察:');
          session.insights.forEach((insight, i) => {
            console.log(`   ${i + 1}. ${insight}`);
          });
          console.log('\n📝 设计要点:');
          session.designNotes.forEach((note, i) => {
            console.log(`   ${i + 1}. ${note}`);
          });
          console.log('\n🚀 使用 /om:start 开始执行任务');
        }
        return;
      } catch {
        if (options.json) {
          console.log(JSON.stringify({
            status: 'error',
            message: '没有进行中的头脑风暴会话'
          }));
        } else {
          console.log('❌ 没有进行中的头脑风暴会话');
          console.log('   使用 openmatrix brainstorm <task> 开始新的头脑风暴');
        }
        return;
      }
    }

    // 获取任务内容
    let taskContent = input;
    if (!taskContent) {
      const defaultPath = path.join(basePath, 'TASK.md');
      try {
        taskContent = await fs.readFile(defaultPath, 'utf-8');
        if (!options.json) {
          console.log(`📄 读取任务文件: ${defaultPath}`);
        }
      } catch {
        if (options.json) {
          console.log(JSON.stringify({
            status: 'error',
            message: '请提供任务文件路径或描述'
          }));
        } else {
          console.log('❌ 请提供任务文件路径或描述');
          console.log('   用法: openmatrix brainstorm <task.md>');
          console.log('   或创建 TASK.md 文件');
        }
        return;
      }
    } else if (taskContent.endsWith('.md')) {
      try {
        taskContent = await fs.readFile(taskContent, 'utf-8');
        if (!options.json) {
          console.log(`📄 读取任务文件: ${input}`);
        }
      } catch {
        if (options.json) {
          console.log(JSON.stringify({
            status: 'error',
            message: `无法读取文件: ${input}`
          }));
        } else {
          console.log(`❌ 无法读取文件: ${input}`);
        }
        return;
      }
    }

    // 从任务内容提取标题
    const lines = taskContent.split('\n');
    let taskTitle = '未命名任务';
    for (const line of lines) {
      const match = line.match(/^#\s+(.+)$/);
      if (match) {
        taskTitle = match[1].trim();
        break;
      }
    }

    // 生成头脑风暴问题
    const questions: BrainstormQuestion[] = generateBrainstormQuestions(taskContent, taskTitle);

    // 检测是否涉及垂直领域
    const domainDetection = detectVerticalDomain(taskContent);

    // 创建会话
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

    if (options.json) {
      // JSON 输出供 Skill 解析
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

      // 如果检测到垂直领域，添加建议
      if (domainDetection.isVertical) {
        output.suggestResearch = domainDetection.domain;
        output.researchHint = `检测到垂直领域「${domainDetection.domain}」，建议先进行领域调研`;
      }

      console.log(JSON.stringify(output));
    } else {
      console.log('\n🧠 开始头脑风暴...\n');
      console.log(`📋 任务: ${taskTitle}\n`);

      if (domainDetection.isVertical) {
        console.log(`🔍 检测到垂直领域: ${domainDetection.domain}`);
        console.log('   建议使用 /om:research 进行领域调研\n');
      }

      console.log('需要探索以下问题:');
      questions.forEach((q, i) => {
        console.log(`  ${i + 1}. ${q.question}`);
      });
      console.log('\n💡 使用 /om:brainstorm 技能进行交互式问答');
    }
  });

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

  // 问题 1: 核心目标
  questions.push({
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
  });

  // 问题 2: 用户价值
  questions.push({
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
  });

  // 问题 3: 实现复杂度 - 如果任务内容包含复杂关键词
  if (content.includes('架构') || content.includes('系统') || content.includes('集成') || content.includes('多个')) {
    questions.push({
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
    });
  }

  // 问题 4: 技术约束 - 如果涉及技术选型
  if (content.includes('技术') || content.includes('框架') || content.includes('库')) {
    questions.push({
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
    });
  }

  // 问题 5: 风险评估
  questions.push({
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
  });

  // 问题 6: 验收标准
  questions.push({
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
  });

  // 问题 7: 实现优先级
  questions.push({
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
  });

  return questions;
}