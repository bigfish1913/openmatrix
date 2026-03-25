"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRunner = void 0;
// src/agents/agent-runner.ts
const child_process_1 = require("child_process");
class AgentRunner {
    options;
    activeAgents = new Map();
    constructor(options = {}) {
        this.options = options;
    }
    /**
     * Run an agent in a subprocess
     */
    async run(agent, task) {
        const runId = this.generateRunId();
        return new Promise((resolve, reject) => {
            // Create the agent process
            const agentProcess = (0, child_process_1.spawn)('node', [
                '--experimental-speculation-warnings', '0', // Import agent module
                '--input-type', 'module',
                '--loader', 'tsx',
                path.join(process.cwd(), 'dist', 'agents', 'runner.js'),
                path.join(process.cwd(), 'dist', 'agents', `${agent.type}-agent.js`),
            ], {
                stdio: ['inherit'],
                cwd: process.cwd(),
                env: {
                    ...process.env,
                    AGENT_RUN_ID: runId,
                    TASK_ID: task.id,
                    TASK_DATA: JSON.stringify({
                        id: task.id,
                        title: task.title,
                        description: task.description,
                    })
                }
            });
            // Handle timeout
            const timeout = this.options.timeout || 120000;
            const timeoutId = setTimeout(() => {
                agentProcess.kill();
                reject(new Error(`Agent ${agent.type} timed out`));
            }, timeout);
        });
    }
    /**
     * Get status of all active agents
     */
    getActiveAgents() {
        return Array.from(this.activeAgents.keys());
    }
    /**
     * Kill a specific agent process
     */
    killAgent(runId) {
        const process = this.activeAgents.get(runId);
        if (process) {
            process.kill();
            this.activeAgents.delete(runId);
        }
    }
    /**
     * Kill all active agents
     */
    killAll() {
        for (const process of this.activeAgents.values()) {
            process.kill();
        }
        this.activeAgents.clear();
    }
    generateRunId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).slice(2, 8);
        return `agent-run-${timestamp}-${random}`;
    }
}
exports.AgentRunner = AgentRunner;
