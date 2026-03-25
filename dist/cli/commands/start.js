"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.startCommand = void 0;
// src/cli/commands/start.ts
const commander_1 = require("commander");
const state_manager_js_1 = require("../../storage/state-manager.js");
const task_parser_js_1 = require("../../orchestrator/task-parser.js");
const task_planner_js_1 = require("../../orchestrator/task-planner.js");
const approval_manager_js_1 = require("../../orchestrator/approval-manager.js");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
exports.startCommand = new commander_1.Command('start')
    .description('启动新的任务执行周期')
    .argument('[input]', '任务文件路径或描述')
    .option('-c, --config <path>', '配置文件路径')
    .option('--skip-questions', '跳过澄清问题')
    .option('--mode <mode>', '执行模式 (confirm-all|confirm-key|auto)')
    .action(async (input, options) => {
    const basePath = process.cwd();
    const omPath = path.join(basePath, '.openmatrix');
    // 确保目录存在
    await fs.mkdir(omPath, { recursive: true });
    const stateManager = new state_manager_js_1.StateManager(omPath);
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
        }
        catch {
            console.log('❌ 请提供任务文件路径或描述');
            console.log('   用法: openmatrix start <task.md>');
            console.log('   或创建 TASK.md 文件');
            return;
        }
    }
    else if (taskContent.endsWith('.md')) {
        // 读取文件
        try {
            taskContent = await fs.readFile(taskContent, 'utf-8');
            console.log(`📄 读取任务文件: ${input}`);
        }
        catch {
            console.log(`❌ 无法读取文件: ${input}`);
            return;
        }
    }
    // 解析任务
    console.log('\n🔍 解析任务...');
    const parser = new task_parser_js_1.TaskParser();
    const parsedTask = parser.parse(taskContent);
    console.log(`\n📋 任务: ${parsedTask.title}`);
    console.log(`   目标: ${parsedTask.goals.join(', ')}`);
    // 拆解任务
    console.log('\n🔧 拆解任务...');
    const planner = new task_planner_js_1.TaskPlanner();
    const subTasks = planner.breakdown(parsedTask, {});
    console.log(`\n📋 生成 ${subTasks.length} 个子任务:\n`);
    subTasks.forEach((task, i) => {
        console.log(`  ${i + 1}. ${task.title} (${task.priority})`);
    });
    // 确定执行模式
    const executionMode = options.mode || 'confirm-key';
    let approvalPoints = [];
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
        const approvalManager = new approval_manager_js_1.ApprovalManager(stateManager);
        const approval = await approvalManager.createPlanApproval('plan-approval', `# 执行计划\n\n${subTasks.map((t, i) => `${i + 1}. ${t.title}`).join('\n')}`);
        console.log(`\n⏸️  等待计划审批`);
        console.log(`   审批ID: ${approval.id}`);
        console.log(`   使用 /om:approve ${approval.id} 审批`);
        // 更新状态
        await stateManager.updateState({
            status: 'paused',
            currentPhase: 'planning',
            config: {
                ...state.config,
                approvalPoints: approvalPoints
            }
        });
    }
    else {
        // 自动执行，直接开始
        await stateManager.updateState({
            status: 'running',
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
