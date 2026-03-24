import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import chalk from 'chalk';

export const statusCommand = new Command('status')
  .description('Show current execution status')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const manager = new StateManager('.openmatrix');

    try {
      await manager.initialize();
      const state = await manager.getState();
      const tasks = await manager.listTasks();

      if (options.json) {
        console.log(JSON.stringify({ state, tasks }, null, 2));
        return;
      }

      // Human readable output
      console.log(chalk.bold('\n📊 OpenMatrix Status\n'));
      console.log(`  Run ID: ${chalk.cyan(state.runId)}`);
      console.log(`  Status: ${formatStatus(state.status)}`);
      console.log(`  Phase:  ${chalk.yellow(state.currentPhase)}`);
      console.log(`  Started: ${state.startedAt}\n`);

      console.log(chalk.bold('📈 Statistics'));
      console.log(`  Total: ${state.statistics.totalTasks}`);
      console.log(`  ✅ Completed: ${chalk.green(state.statistics.completed)}`);
      console.log(`  🔄 In Progress: ${chalk.blue(state.statistics.inProgress)}`);
      console.log(`  ⏳ Pending: ${chalk.gray(state.statistics.pending)}`);
      console.log(`  ❌ Failed: ${chalk.red(state.statistics.failed)}\n`);

      if (tasks.length > 0) {
        console.log(chalk.bold('📋 Tasks'));
        for (const task of tasks) {
          const status = formatTaskStatus(task.status);
          console.log(`  ${status} ${task.id}: ${task.title}`);
        }
        console.log();
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  });

function formatStatus(status: string): string {
  const colors: Record<string, string> = {
    initialized: 'gray',
    running: 'green',
    paused: 'yellow',
    completed: 'green',
    failed: 'red'
  };
  const color = colors[status] || 'white';
  return (chalk as any)[color](status);
}

function formatTaskStatus(status: string): string {
  const icons: Record<string, string> = {
    pending: '⏳',
    scheduled: '📅',
    in_progress: '🔄',
    blocked: '🚫',
    completed: '✅',
    failed: '❌'
  };
  return icons[status] || '❓';
}
