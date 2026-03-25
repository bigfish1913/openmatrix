// src/cli/commands/start.ts
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import { TaskParser } from '../../orchestrator/task-parser.js';
import { TaskPlanner } from '../../orchestrator/task-planner.js';
import { ApprovalManager } from '../../orchestrator/approval-manager.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export const startCommand = new Command('start')
  .description('启动新的任务执行周期')
  .argument('[input]', '任务文件路径或描述')
  .option('-c, --config <path>', '配置文件路径')
  .option('--skip-questions', '跳过澄清问题')
  .option('--mode <mode>', '执行模式 (confirm-all|confirm-key|auto)')
  .action(async (input: string | undefined, options) => {
    const basePath = process.cwd();
    const omPath = path.join(basePath, '.openmatrix');

    // 确保目录存在
    await fs.mkdir(omPath, { recursive: true });

    const stateManager = new StateManager(omPath);
    await stateManager.initialize();

    const state = await stateManager.getState();

    // 检查是否已有运行中的任务
    if (state.status === 'running') {
      console.log('⚠️  已有任务在执行中');
      console.log('   使用 /om:status 查看状态');
      console.log('   使用 /om:resume 恢复执行');
      return;
    }

    // 获取任务内容
    let taskContent = input;
    if (!taskContent) {
      // 尝试读取默认任务文件
      const defaultPath = path.join(basePath, 'TASK.md');
      try {
        taskContent = await fs.readFile(defaultPath, 'utf-8');
        console.log(`📄 读取任务文件: ${defaultPath}`);
      } catch {
        console.log('❌ 请提供任务文件路径或描述');
        console.log('   用法: openmatrix start <task.md>');
        console.log('   或创建 TASK.md 文件');
        return;
      }
    } else if (taskContent.endsWith('.md')) {
      // 读取文件
      try {
        taskContent = await fs.readFile(taskContent, 'utf-8');
        console.log(`📄 读取任务文件: ${input}`);
      } catch {
        console.log(`❌ 无法读取文件: ${input}`);
        return;
      }
    }

    // 解析任务
    console.log('\n🔍 解析任务...');
    const parser = new TaskParser();
    const parsedTask = parser.parse(taskContent);

    console.log(`\n📋 任务: ${parsedTask.title}`);
    console.log(`   目标: ${parsedTask.goals.join(', ')}`);

    // 拆解任务
    console.log('\n🔧 拆解任务...');
    const planner = new TaskPlanner();
    const subTasks = planner.breakdown(parsedTask, {});

    console.log(`\n📋 生成 ${subTasks.length} 个子任务:\n`);
    subTasks.forEach((task: any, i: number) => {
      console.log(`  ${i + 1}. ${task.title} (${task.priority})`);
    });

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

    console.log(`\n🎯 执行模式: ${executionMode}`);
    console.log(`   审批点: ${approvalPoints.length > 0 ? approvalPoints.join(', ') : '无 (全自动)'}`);

    // 创建审批请求（如果有审批点）
    if (approvalPoints.includes('plan')) {
      const approvalManager = new ApprovalManager(stateManager);
      const approval = await approvalManager.createPlanApproval(
        'plan-approval',
        `# 执行计划\n\n${subTasks.map((t: any, i: number) => `${i + 1}. ${t.title}`).join('\n')}`
      );

      console.log(`\n⏸️  等待计划审批`);
      console.log(`   审批ID: ${approval.id}`);
      console.log(`   使用 /om:approve ${approval.id} 审批`);

      // 更新状态
      await stateManager.updateState({
        status: 'paused' as any,
        currentPhase: 'planning',
        config: {
          ...state.config,
          approvalPoints: approvalPoints as any
        }
      });
    } else {
      // 自动执行，直接开始
      await stateManager.updateState({
        status: 'running' as any,
        currentPhase: 'execution',
        config: {
          ...state.config,
          approvalPoints: []
        }
      });

      console.log('\n🚀 开始自动执行...');
      console.log('   使用 /om:status 查看进度');
    }
  });
