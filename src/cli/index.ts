#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
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
import { checkGitignoreCommand } from './commands/check-gitignore.js';
import { analyzeCommand } from './commands/analyze.js';
import { brainstormCommand } from './commands/brainstorm.js';
import { researchCommand } from './commands/research.js';
import { debugCommand } from './commands/debug.js';
import { completeCommand } from './commands/complete.js';
import { stepCommand } from './commands/step.js';
import { deployCommand } from './commands/deploy.js';

// 读取 package.json 版本
let version = '0.0.0';
try {
  const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  version = packageJson.version;
} catch {
  // 忽略错误
}

const program = new Command();

program
  .name('openmatrix')
  .description('AI Agent Task Orchestration System - 多 Agent 任务编排系统')
  .version(version);

// 添加命令
program.addCommand(statusCommand);
program.addCommand(startCommand);
program.addCommand(approveCommand);
program.addCommand(resumeCommand);
program.addCommand(retryCommand);
program.addCommand(reportCommand);
program.addCommand(meetingCommand);
program.addCommand(autoCommand);
program.addCommand(completeCommand);
program.addCommand(stepCommand);
program.addCommand(installSkillsCommand);
program.addCommand(checkCommand);
program.addCommand(checkGitignoreCommand);
program.addCommand(analyzeCommand);
program.addCommand(brainstormCommand);
program.addCommand(researchCommand);
program.addCommand(debugCommand);
program.addCommand(deployCommand);

// 默认帮助
program.parse();
