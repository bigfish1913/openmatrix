import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import { ProgressReporter } from '../../utils/progress-reporter.js';
import chalk from 'chalk';

export const statusCommand = new Command('status')
  .description('Show current execution status')
  .option('--json', 'Output as JSON')
  .option('--graph', 'Show dependency graph')
  .option('--detailed', 'Show detailed task info')
  .action(async (options) => {
    const manager = new StateManager('.openmatrix');
    const reporter = new ProgressReporter({ width: 30 });

    try {
      await manager.initialize();
      const state = await manager.getState();
      const tasks = await manager.listTasks();

      if (options.json) {
        console.log(JSON.stringify({ state, tasks }, null, 2));
        return;
      }

      // Header
      console.log(chalk.bold('\n📊 OpenMatrix Status'));
      console.log('━'.repeat(42));
      console.log(`\n  Run ID: ${chalk.cyan(state.runId)}`);
      console.log(`  Status: ${formatStatus(state.status)}`);
      console.log(`  Phase:  ${chalk.yellow(state.currentPhase)}`);
      console.log(`  Started: ${state.startedAt}\n`);

      // Progress visualization
      if (state.statistics.totalTasks > 0) {
        console.log(reporter.renderStatistics({
          total: state.statistics.totalTasks,
          completed: state.statistics.completed,
          inProgress: state.statistics.inProgress,
          pending: state.statistics.pending,
          failed: state.statistics.failed
        }));
      }

      // Dependency graph
      if (options.graph && tasks.length > 0) {
        console.log('\n📊 Task Dependency Graph');
        console.log('━'.repeat(42));
        console.log(reporter.renderDependencyGraph(tasks));
        console.log();
      }

      // Detailed task list
      if (options.detailed && tasks.length > 0) {
        console.log('\n📋 Task Details');
        console.log('━'.repeat(42));
        for (const task of tasks) {
          console.log(reporter.renderTaskCard(task));
          console.log();
        }
      } else if (tasks.length > 0) {
        // Simple task list
        console.log(chalk.bold('\n📋 Tasks'));
        for (const task of tasks) {
          const icon = reporter.getStatusIcon(task.status);
          console.log(`  ${icon} ${task.id}: ${task.title}`);
        }
        console.log();
      }

      // Quick tips
      console.log(chalk.gray('💡 Tips:'));
      console.log(chalk.gray('   --graph    Show dependency graph'));
      console.log(chalk.gray('   --detailed Show detailed task info'));
      console.log(chalk.gray('   --json     Output as JSON'));
      console.log();
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
