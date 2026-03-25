#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const status_js_1 = require("./commands/status.js");
const program = new commander_1.Command();
program
    .name('openmatrix')
    .description('AI Agent Task Orchestration System')
    .version('1.0.0');
program.addCommand(status_js_1.statusCommand);
program.parse();
