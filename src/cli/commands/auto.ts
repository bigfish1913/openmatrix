// src/cli/commands/auto.ts
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

export const autoCommand = new Command('auto')
  .description('全自动执行任务 - 无阻塞，bypass permissions')
  .argument('[input]', '任务文件路径或描述')
  .option('-q, --quality <level>', '质量级别 (strict|balanced|fast)', 'strict')
  .option('--json', '输出 JSON 格式 (供 Skill 解析)')
  .action(async (input: string | undefined, options) => {
    const basePath = process.cwd();
    const omPath = path.join(basePath, '.openmatrix');

    // 确保目录存在
    await fs.mkdir(omPath, { recursive: true });
    await fs.mkdir(path.join(omPath, 'tasks'), { recursive: true });
    await fs.mkdir(path.join(omPath, 'approvals'), { recursive: true });

    // 确保 .openmatrix 被 git 忽略
    await ensureOpenmatrixGitignore(basePath);

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

    // 验证质量级别
    const qualityLevel = options.quality as string;
    if (!['strict', 'balanced', 'fast'].includes(qualityLevel)) {
      if (options.json) {
        console.log(JSON.stringify({
          status: 'error',
          message: `无效的质量级别: ${qualityLevel}`,
          hint: '可选值: strict, balanced, fast'
        }));
      } else {
        console.log(`❌ 无效的质量级别: ${qualityLevel}`);
        console.log('   可选值: strict, balanced, fast');
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
          console.log('   用法: openmatrix auto <task.md>');
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

    // 获取质量配置（在 breakdown 之前，因为需要传入）
    const qualityConfig = QUALITY_PRESETS[qualityLevel] as QualityConfig;

    // 拆解任务
    if (!options.json) {
      console.log('\n🔧 拆解任务...');
    }
    const planner = new TaskPlanner();
    const subTasks = planner.breakdown(parsedTask, {}, qualityConfig);

    // 创建任务到状态管理器，并建立 ID 映射
    // TaskPlanner 生成的 taskId 和 StateManager 创建的 id 不同，
    // 需要映射后才能正确设置 dependencies
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

    // auto 模式: 空审批点数组 = bypass permissions
    const approvalPoints: string[] = [];

    // 更新状态
    await stateManager.updateState({
      status: 'running',
      currentPhase: 'execution',
      config: {
        ...state.config,
        approvalPoints: approvalPoints as ('plan' | 'merge' | 'deploy')[],
        quality: qualityConfig
      }
    });

    // 创建执行器并获取第一批任务
    const approvalManager = new ApprovalManager(stateManager);
    const executor = new OrchestratorExecutor(stateManager, approvalManager, {
      maxConcurrent: state.config.maxConcurrentAgents,
      taskTimeout: state.config.timeout * 1000
    });

    // 设置自动模式和 RunId
    const phaseExecutor = executor.getPhaseExecutor();
    if (phaseExecutor) {
      phaseExecutor.setRunId(state.runId);
      phaseExecutor.setAutoMode(true);
    }

    const result = await executor.step();

    if (options.json) {
      // JSON 输出供 Skill 解析
      console.log(JSON.stringify({
        status: result.status,
        message: result.message,
        mode: 'auto',
        quality: qualityLevel,
        bypassPermissions: true,
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

      console.log(`\n🚀 全自动执行模式`);
      console.log(`   质量级别: ${qualityLevel}`);
      console.log(`   审批点: 无 (bypass permissions)`);
      console.log('\n⏳ 开始执行...');
      console.log('   使用 /om:status 查看进度');
    }
  });
