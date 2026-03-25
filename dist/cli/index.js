#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const status_js_1 = require("./commands/status.js");
const start_js_1 = require("./commands/start.js");
const approve_js_1 = require("./commands/approve.js");
const resume_js_1 = require("./commands/resume.js");
const retry_js_1 = require("./commands/retry.js");
const report_js_1 = require("./commands/report.js");
const program = new commander_1.Command();
program
    .name('openmatrix')
    .description('AI Agent Task Orchestration System - 多 Agent 任务编排系统')
    .version('0.1.0');
// 添加命令
program.addCommand(status_js_1.statusCommand);
program.addCommand(start_js_1.startCommand);
program.addCommand(approve_js_1.approveCommand);
program.addCommand(resume_js_1.resumeCommand);
program.addCommand(retry_js_1.retryCommand);
program.addCommand(report_js_1.reportCommand);
// 默认帮助
program.parse();
