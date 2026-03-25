"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoderAgent = void 0;
// src/agents/impl/coder-agent.ts
const base_agent_js_1 = require("../base-agent.js");
const state_manager_js_1 = require("../../storage/state-manager.js");
class CoderAgent extends base_agent_js_1.BaseAgent {
    type = 'coder';
    capabilities = ['code-generation', 'refactoring', 'bug-fixing', 'file-operations'];
    description = 'Writes and modifies code files';
    constructor(id) {
        super(id, 'coder');
    }
    async execute(taskId, context) {
        const startTime = Date.now();
        const runId = this.generateRunId();
        const stateManager = new state_manager_js_1.StateManager(context.workspaceRoot);
        try {
            // 1. Get task
            const task = await stateManager.getTask(taskId);
            if (!task) {
                return {
                    runId,
                    taskId,
                    agentType: 'coder',
                    status: 'failed',
                    output: 'Task not found',
                    artifacts: [],
                    needsApproval: false,
                    error: 'Task not found',
                    duration: Date.now() - startTime
                };
            }
            // 2. Read relevant files
            const filesToRead = await this.readRelevantFiles(task.description, context.workspaceRoot);
            // 3. Call Claude API to generate code
            const prompt = this.buildPrompt(taskId, context);
            // Placeholder: actual API call would go here
            const response = { output: 'Code generated', files: [] };
            // 4. Process response and apply changes
            const artifacts = await this.applyChanges(response, context.workspaceRoot);
            // 5. Update task status
            await stateManager.updateTask(taskId, {
                status: 'completed',
                updatedAt: new Date().toISOString()
            });
            const endTime = Date.now();
            return {
                runId,
                taskId,
                agentType: 'coder',
                status: 'completed',
                output: response.output,
                artifacts,
                needsApproval: false,
                duration: endTime - startTime
            };
        }
        catch (error) {
            return {
                runId,
                taskId,
                agentType: 'coder',
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
            agentType: 'coder',
            taskId: '',
            status: 'idle',
            summary: 'Code generation agent',
            artifacts: [],
            errors: [],
            duration: 0
        };
    }
    buildPrompt(taskId, context) {
        return `You are a code generation agent. Task: ${taskId}`;
    }
    generateRunId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).slice(2, 6);
        return `coder-${timestamp}-${random}`;
    }
    async readRelevantFiles(description, workspaceRoot) {
        const files = [];
        // Extract file paths from task description
        const filePathRegex = /(?:read|write|edit|apply)\s*`?file:\s*`([^`]+)`/gm;
        const matches = description.matchAll(new RegExp(filePathRegex, 'g'));
        for (const match of matches || []) {
            files.push(match[1]);
        }
        return files;
    }
    async applyChanges(response, workspaceRoot) {
        const artifacts = [];
        // Placeholder for applying changes
        return artifacts;
    }
}
exports.CoderAgent = CoderAgent;
