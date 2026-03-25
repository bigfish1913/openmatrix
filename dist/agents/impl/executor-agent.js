"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutorAgent = void 0;
// src/agents/impl/executor-agent.ts
const base_agent_js_1 = require("../base-agent.js");
const child_process_1 = require("child_process");
class ExecutorAgent extends base_agent_js_1.BaseAgent {
    type = 'executor';
    capabilities = ['command-execution', 'file-operations', 'safe-commands'];
    description = 'Executes commands safely';
    constructor(id) {
        super(id, 'executor');
    }
    async execute(taskId, context) {
        const startTime = Date.now();
        const runId = this.generateRunId();
        try {
            // 1. Parse commands from task description
            const commands = this.parseCommands(context.taskDescription || '');
            // 2. Execute commands
            const results = await this.executeCommands(commands, context.workspaceRoot);
            // 3. Generate result
            const endTime = Date.now();
            return {
                runId,
                taskId,
                agentType: 'executor',
                status: 'completed',
                output: `Successfully executed ${results.length} commands`,
                artifacts: results.map(r => r.outputFile).filter(Boolean),
                needsApproval: false,
                duration: endTime - startTime
            };
        }
        catch (error) {
            return {
                runId,
                taskId,
                agentType: 'executor',
                status: 'failed',
                output: error instanceof Error ? error.message : 'Unknown error',
                artifacts: [],
                needsApproval: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                duration: Date.now() - startTime
            };
        }
    }
    validate(taskId, context) {
        return !!context.taskDescription;
    }
    report() {
        return {
            agentId: this.id,
            agentType: 'executor',
            taskId: '',
            status: 'idle',
            summary: 'Command execution agent',
            artifacts: [],
            errors: [],
            duration: 0
        };
    }
    generateRunId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).slice(2, 6);
        return `executor-${timestamp}-${random}`;
    }
    parseCommands(description) {
        const commands = [];
        const lines = description.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('command:') || trimmed.startsWith('cmd:') || trimmed.startsWith('run:')) {
                const cleanCommand = trimmed
                    .replace(/^(command:|cmd:|run:)\s*/, '')
                    .replace(/`/g, '')
                    .trim();
                if (cleanCommand) {
                    commands.push(cleanCommand);
                }
            }
        }
        return commands;
    }
    async executeCommands(commands, workspaceRoot) {
        const results = [];
        for (const cmd of commands) {
            const isSafe = this.isSafeCommand(cmd);
            if (!isSafe) {
                throw new Error(`Unsafe command detected: ${cmd}`);
            }
            const result = await this.runCommand(cmd, workspaceRoot);
            results.push(result);
        }
        return results;
    }
    async runCommand(cmd, cwd) {
        return new Promise((resolve, reject) => {
            const timeout = 30000;
            (0, child_process_1.exec)(cmd, { cwd, timeout }, (error, stdout, stderr) => {
                if (error) {
                    resolve({
                        command: cmd,
                        output: stderr || error.message
                    });
                }
                else {
                    resolve({
                        command: cmd,
                        output: stdout
                    });
                }
            });
            setTimeout(() => {
                reject(new Error(`Command timed out: ${cmd}`));
            }, timeout);
        });
    }
    isSafeCommand(cmd) {
        const safeCommands = ['npm', 'npx', 'git', 'ls', 'cat', 'mkdir', 'rm', 'node'];
        const lowerCmd = cmd.toLowerCase();
        return safeCommands.some(safe => lowerCmd.startsWith(safe));
    }
}
exports.ExecutorAgent = ExecutorAgent;
