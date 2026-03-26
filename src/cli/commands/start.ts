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

    // 构建任务内容
    let taskContent = input;

    // 如果提供了 --title 和 --description，构建任务内容
    if (options.title || options.description) {
      const title = options.title || '未命名任务';
      const description = options.description || '';
      const techStack = options.techStack ? `\n\n技术栈: ${options.techStack}` : '';
      const docs = options.docs ? `\n文档要求: ${options.docs}` : '';

      taskContent = `# ${title}\n\n${description}${techStack}${docs}`;
    }

    // 如果没有任务内容，尝试读取默认文件
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
          console.log('   用法: openmatrix start <task.md>');
          console.log('   或创建 TASK.md 文件');
          console.log('   或使用 --title 和 --description 选项');
        }
        return;
      }
    } else if (taskContent.endsWith('.md')) {
      // 读取文件
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

    // 解析任务
    if (!options.json) {
      console.log('\n🔍 解析任务...');
    }
    const parser = new TaskParser();
    const parsedTask = parser.parse(taskContent);

    if (!options.json) {
      console.log(`\n📋 任务: ${parsedTask.title}`);
      console.log(`   目标: ${parsedTask.goals.join(', ')}`);
    }

    // 拆解任务
    if (!options.json) {
      console.log('\n🔧 拆解任务...');
    }
    const planner = new TaskPlanner();
    const subTasks = planner.breakdown(parsedTask, {});

    // 创建任务到状态管理器
    for (const subTask of subTasks) {
      await stateManager.createTask({
        title: subTask.title,
        description: subTask.description,
        priority: subTask.priority as TaskPriority,
        timeout: subTask.estimatedComplexity === 'high' ? 300000 :
                 subTask.estimatedComplexity === 'medium' ? 180000 : 120000,
        dependencies: subTask.dependencies,
        assignedAgent: subTask.assignedAgent
      });
    }

    // 确定执行模式
    const executionMode = options.mode || 'confirm-key';
    let approvalPoints: string[] = [];

    // 根据模式设置审批点
    switch (executionMode) {
      case 'confirm-all':
        approvalPoints = ['plan', 'phase', 'merge', 'deploy'];
        break;
      case 'confirm-key':
        approvalPoints = ['plan', 'merge', 'deploy'];
        break;
      case 'auto':
        approvalPoints = [];
        break;
      default:
        approvalPoints = ['plan', 'merge'];
    }

    // 处理质量配置
    let qualityConfig: QualityConfig | undefined;
    if (options.quality) {
      const qualityLevel = options.quality.toLowerCase();
      if (['strict', 'balanced', 'fast'].includes(qualityLevel)) {
        qualityConfig = QUALITY_PRESETS[qualityLevel];
      }
    }

    // 更新状态
    await stateManager.updateState({
      status: 'running',
      currentPhase: 'execution',
      config: {
        ...state.config,
        approvalPoints: approvalPoints as ('plan' | 'merge' | 'deploy')[],
        quality: qualityConfig || state.config.quality
      }
    });

    // 创建审批请求（如果有审批点）
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
          tasks: subTasks.map((t, i) => ({
            index: i + 1,
            title: t.title,
            priority: t.priority
          })),
          // 额外信息供 Skill 使用
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
        console.log(`   审批点: ${approvalPoints.join(', ')}`);
        if (options.quality) {
          console.log(`   质量级别: ${options.quality}`);
        }
        if (options.techStack) {
          console.log(`   技术栈: ${options.techStack}`);
        }
        console.log(`\n⏸️  等待计划审批`);
        console.log(`   审批ID: ${approval.id}`);
        console.log(`   使用 /om:approve ${approval.id} 审批`);
      }
      return;
    }

    // 创建执行器并获取第一批任务
    const executor = new OrchestratorExecutor(stateManager, approvalManager, {
      maxConcurrent: state.config.maxConcurrentAgents,
      taskTimeout: state.config.timeout * 1000
    });

    // 设置 PhaseExecutor 的自动模式和 RunId
    const phaseExecutor = executor.getPhaseExecutor();
    if (phaseExecutor) {
      phaseExecutor.setRunId(state.runId);
      if (executionMode === 'auto') {
        phaseExecutor.setAutoMode(true);
      }
    }

    const result = await executor.step();

    if (options.json) {
      // JSON 输出供 Skill 解析
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
        // 额外信息供 Skill 使用
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
      console.log(`   审批点: ${approvalPoints.length > 0 ? approvalPoints.join(', ') : '无 (全自动)'}`);
      if (options.quality) {
        console.log(`   质量级别: ${options.quality}`);
      }
      if (options.techStack) {
        console.log(`   技术栈: ${options.techStack}`);
      }
      console.log('\n🚀 开始执行...');
      console.log('   使用 /om:status 查看进度');
    }
  });