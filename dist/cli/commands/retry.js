"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryCommand = void 0;
// src/cli/commands/retry.ts
const commander_1 = require("commander");
const state_manager_js_1 = require("../../storage/state-manager.js");
const retry_manager_js_1 = require("../../orchestrator/retry-manager.js");
exports.retryCommand = new commander_1.Command('retry')
    .description('重试失败的任务')
    .argument('[taskId]', '任务ID')
    .option('--all', '重试所有失败任务')
    .option('--reset', '重置重试计数')
    .action(async (taskId, options) => {
    const basePath = process.cwd();
    const omPath = `${basePath}/.openmatrix`;
    const stateManager = new state_manager_js_1.StateManager(omPath);
    await stateManager.initialize();
    const retryManager = new retry_manager_js_1.RetryManager({
        maxRetries: 3,
        backoff: 'exponential',
        baseDelay: 10000
    });
    // 如果没有提供任务ID，列出失败任务
    if (!taskId && !options.all) {
        const tasks = await stateManager.listTasks();
        const failed = tasks.filter(t => t.status === 'failed');
        if (failed.length === 0) {
            console.log('✅ 没有失败的任务');
            return;
        }
        console.log('❌ 失败任务列表:\n');
        failed.forEach((task, i) => {
            console.log(`  [${i + 1}] ${task.id}: ${task.title}`);
            console.log(`      失败原因: ${task.error || '未知'}`);
            console.log(`      重试次数: ${task.retryCount}/3`);
            console.log(`      失败时间: ${task.updatedAt}`);
        });
        console.log('\n💡 使用 openmatrix retry <ID> 重试指定任务');
        console.log('   使用 openmatrix retry --all 重试所有任务');
        return;
    }
    // 重试任务
    if (options.all) {
        const tasks = await stateManager.listTasks();
        const failed = tasks.filter(t => t.status === 'failed');
        console.log(`🔄 重试 ${failed.length} 个失败任务...\n`);
        for (const task of failed) {
            await retryTask(stateManager, retryManager, task.id, options.reset);
            console.log(`  ✅ ${task.id}: ${task.title}`);
        }
    }
    else if (taskId) {
        const task = await stateManager.getTask(taskId);
        if (!task) {
            console.log(`❌ 任务 ${taskId} 不存在`);
            return;
        }
        if (task.status !== 'failed') {
            console.log(`❌ 任务 ${taskId} 状态不是失败`);
            return;
        }
        console.log(`🔄 重试任务 ${taskId}...\n`);
        await retryTask(stateManager, retryManager, taskId, options.reset);
        console.log(`  ✅ ${task.title}`);
    }
    console.log('\n💡 使用 /om:resume 继续执行');
});
async function retryTask(stateManager, retryManager, taskId, reset) {
    const task = await stateManager.getTask(taskId);
    if (!task)
        return;
    const newRetryCount = reset ? 0 : task.retryCount + 1;
    await stateManager.updateTask(taskId, {
        status: 'pending',
        retryCount: newRetryCount,
        error: null
    });
    retryManager.addToQueue(taskId, 'manual retry');
}
