// src/cli/commands/start.ts
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import { TaskParser } from '../../orchestrator/task-parser.js';
import { TaskPlanner } from '../../orchestrator/task-planner.js';
import { ApprovalManager } from '../../orchestrator/approval-manager.js';
import { OrchestratorExecutor } from '../../orchestrator/executor.js';
import type { TaskPriority } from '../../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export const startCommand = new Command('start')
  .description('启动新的任务执行周期')
  .argument('[input]', '任务文件路径或描述')
  .option('-c, --config <path>', '配置文件路径')
  .option('--skip-questions', '跳过澄清问题')
  .option('--mode <mode>', '执行模式 (confirm-all|confirm-key|auto)')
  .option('--json', '输出 JSON 格式 (供 Skill 解析)')
  .action(async (input: string | undefined, options) => {
    const basePath = process.cwd();
    const omPath = path.join(basePath, '.openmatrix');

    // 确保目录存在
    await fs.mkdir(omPath, { recursive: true });
    await fs.mkdir(path.join(omPath, 'tasks'), { recursive: true });
    await fs.mkdir(path.join(omPath, 'approvals'), { recursive: true });

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

    // 获取任务内容
    let taskContent = input;
    if (!taskContent) {
      // 尝试读取默认任务文件
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
    // auto 模式: 空数组，不暂停任何审批点
    // confirm-key 模式: 仅在关键节点暂停
    // confirm-all 模式: 每个阶段都暂停
    switch (executionMode) {
      case 'confirm-all':
        approvalPoints = ['plan', 'phase', 'merge', 'deploy'];
        break;
      case 'confirm-key':
        approvalPoints = ['plan', 'merge', 'deploy'];
        break;
      case 'auto':
        approvalPoints = []; // 全自动模式：无任何审批点
        break;
      default:
        approvalPoints = ['plan', 'merge'];
    }

    // 更新状态
    await stateManager.updateState({
      status: 'running',
      currentPhase: 'execution',
      config: {
        ...state.config,
        approvalPoints: approvalPoints as ('plan' | 'merge' | 'deploy')[]
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
          }))
        }));
      } else {
        console.log(`\n📋 生成 ${subTasks.length} 个子任务:\n`);
        subTasks.forEach((task, i) => {
          console.log(`  ${i + 1}. ${task.title} (${task.priority})`);
        });
        console.log(`\n🎯 执行模式: ${executionMode}`);
        console.log(`   审批点: ${approvalPoints.join(', ')}`);
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

    // 设置 PhaseExecutor 的自动模式
    const phaseExecutor = executor.getPhaseExecutor();
    if (phaseExecutor && executionMode === 'auto') {
      phaseExecutor.setAutoMode(true);
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
        }))
      }));
    } else {
      console.log(`\n📋 生成 ${subTasks.length} 个子任务:\n`);
      subTasks.forEach((task, i) => {
        console.log(`  ${i + 1}. ${task.title} (${task.priority})`);
      });

      console.log(`\n🎯 执行模式: ${executionMode}`);
      console.log(`   审批点: ${approvalPoints.length > 0 ? approvalPoints.join(', ') : '无 (全自动)'}`);
      console.log('\n🚀 开始执行...');
      console.log('   使用 /om:status 查看进度');
    }
  });
