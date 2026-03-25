"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resumeCommand = void 0;
// src/cli/commands/resume.ts
const commander_1 = require("commander");
const state_manager_js_1 = require("../../storage/state-manager.js");
exports.resumeCommand = new commander_1.Command('resume')
    .description('恢复中断或暂停的任务')
    .argument('[taskId]', '任务ID')
    .option('--all', '恢复所有可恢复任务')
    .action(async (taskId, options) => {
    const basePath = process.cwd();
    const omPath = `${basePath}/.openmatrix`;
    const stateManager = new state_manager_js_1.StateManager(omPath);
    await stateManager.initialize();
    const state = await stateManager.getState();
    // 检查状态
    if (state.status === 'completed') {
        console.log('✅ 所有任务已完成');
        return;
    }
    // 如果没有提供任务ID，列出可恢复任务
    if (!taskId && !options.all) {
        const tasks = await stateManager.listTasks();
        const resumable = tasks.filter(t => t.status === 'in_progress' ||
            t.status === 'blocked' ||
            t.status === 'waiting' ||
            t.status === 'retry_queue');
        if (resumable.length === 0) {
            console.log('✅ 没有需要恢复的任务');
            return;
        }
        console.log('🔄 可恢复任务:\n');
        const statusEmoji = {
            in_progress: '⏸️',
            blocked: '🔴',
            waiting: '⏳',
            retry_queue: '🔄'
        };
        resumable.forEach((task, i) => {
            const emoji = statusEmoji[task.status] || '❓';
            console.log(`  [${i + 1}] ${emoji} ${task.id}: ${task.title}`);
            console.log(`      状态: ${task.status} | 优先级: ${task.priority}`);
        });
        console.log('\n💡 使用 openmatrix resume <ID> 恢复指定任务');
        console.log('   使用 openmatrix resume --all 恢复所有任务');
        return;
    }
    // 恢复任务
    if (options.all) {
        const tasks = await stateManager.listTasks();
        const resumable = tasks.filter(t => t.status === 'in_progress' ||
            t.status === 'blocked' ||
            t.status === 'waiting' ||
            t.status === 'retry_queue');
        console.log(`🔄 恢复 ${resumable.length} 个任务...\n`);
        for (const task of resumable) {
            await resumeTask(stateManager, task.id);
            console.log(`  ✅ ${task.id}: ${task.title}`);
        }
    }
    else if (taskId) {
        const task = await stateManager.getTask(taskId);
        if (!task) {
            console.log(`❌ 任务 ${taskId} 不存在`);
            return;
        }
        console.log(`🔄 恢复任务 ${taskId}...\n`);
        await resumeTask(stateManager, taskId);
        console.log(`  ✅ ${task.title}`);
    }
    // 更新全局状态
    await stateManager.updateState({
        status: 'running',
        currentPhase: 'execution'
    });
    console.log('\n✅ 任务已恢复');
    console.log('💡 使用 /om:status 查看执行进度');
});
async function resumeTask(stateManager, taskId) {
    const task = await stateManager.getTask(taskId);
    if (!task)
        return;
    // 根据状态决定恢复方式
    switch (task.status) {
        case 'in_progress':
            // 中断的任务，继续执行
            break;
        case 'blocked':
            // 阻塞的任务，检查是否已解决
            await stateManager.updateTask(taskId, { status: 'pending' });
            break;
        case 'waiting':
            // 等待中的任务，检查是否已确认
            break;
        case 'retry_queue':
            // 重试队列，重置为 pending
            await stateManager.updateTask(taskId, {
                status: 'pending',
                retryCount: task.retryCount + 1
            });
            break;
    }
}
