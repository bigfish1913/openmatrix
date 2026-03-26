#!/usr/bin/env node
import { Command } from 'commander';
import { statusCommand } from './commands/status.js';
import { startCommand } from './commands/start.js';
import { approveCommand } from './commands/approve.js';
import { resumeCommand } from './commands/resume.js';
import { retryCommand } from './commands/retry.js';
import { reportCommand } from './commands/report.js';
import { meetingCommand } from './commands/meeting.js';
import { autoCommand } from './commands/auto.js';
import { installSkillsCommand } from './commands/install-skills.js';
import { checkCommand } from './commands/check.js';

const program = new Command();

program
  .name('openmatrix')
  .description('AI Agent Task Orchestration System - 多 Agent 任务编排系统')
  .version('0.1.0');

// 添加命令
program.addCommand(statusCommand);
program.addCommand(startCommand);
program.addCommand(approveCommand);
program.addCommand(resumeCommand);
program.addCommand(retryCommand);
program.addCommand(reportCommand);
program.addCommand(meetingCommand);
program.addCommand(autoCommand);
program.addCommand(installSkillsCommand);
program.addCommand(checkCommand);

// 默认帮助
program.parse();
