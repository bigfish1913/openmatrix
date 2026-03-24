#!/usr/bin/env node
import { Command } from 'commander';
import { statusCommand } from './commands/status.js';

const program = new Command();

program
  .name('openmatrix')
  .description('AI Agent Task Orchestration System')
  .version('1.0.0');

program.addCommand(statusCommand);

program.parse();
