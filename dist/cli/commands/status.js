"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusCommand = void 0;
const commander_1 = require("commander");
const state_manager_js_1 = require("../../storage/state-manager.js");
const chalk_1 = __importDefault(require("chalk"));
exports.statusCommand = new commander_1.Command('status')
    .description('Show current execution status')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
    const manager = new state_manager_js_1.StateManager('.openmatrix');
    try {
        await manager.initialize();
        const state = await manager.getState();
        const tasks = await manager.listTasks();
        if (options.json) {
            console.log(JSON.stringify({ state, tasks }, null, 2));
            return;
        }
        // Human readable output
        console.log(chalk_1.default.bold('\n📊 OpenMatrix Status\n'));
        console.log(`  Run ID: ${chalk_1.default.cyan(state.runId)}`);
        console.log(`  Status: ${formatStatus(state.status)}`);
        console.log(`  Phase:  ${chalk_1.default.yellow(state.currentPhase)}`);
        console.log(`  Started: ${state.startedAt}\n`);
        console.log(chalk_1.default.bold('📈 Statistics'));
        console.log(`  Total: ${state.statistics.totalTasks}`);
        console.log(`  ✅ Completed: ${chalk_1.default.green(state.statistics.completed)}`);
        console.log(`  🔄 In Progress: ${chalk_1.default.blue(state.statistics.inProgress)}`);
        console.log(`  ⏳ Pending: ${chalk_1.default.gray(state.statistics.pending)}`);
        console.log(`  ❌ Failed: ${chalk_1.default.red(state.statistics.failed)}\n`);
        if (tasks.length > 0) {
            console.log(chalk_1.default.bold('📋 Tasks'));
            for (const task of tasks) {
                const status = formatTaskStatus(task.status);
                console.log(`  ${status} ${task.id}: ${task.title}`);
            }
            console.log();
        }
    }
    catch (error) {
        console.error(chalk_1.default.red('Error:'), error);
        process.exit(1);
    }
});
function formatStatus(status) {
    const colors = {
        initialized: 'gray',
        running: 'green',
        paused: 'yellow',
        completed: 'green',
        failed: 'red'
    };
    const color = colors[status] || 'white';
    return chalk_1.default[color](status);
}
function formatTaskStatus(status) {
    const icons = {
        pending: '⏳',
        scheduled: '📅',
        in_progress: '🔄',
        blocked: '🚫',
        completed: '✅',
        failed: '❌'
    };
    return icons[status] || '❓';
}
