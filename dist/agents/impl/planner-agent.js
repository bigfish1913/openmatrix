"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlannerAgent = void 0;
// src/agents/impl/planner-agent.ts
const base_agent_js_1 = require("../base-agent.js");
const state_manager_js_1 = require("../../storage/state-manager.js");
const task_planner_js_1 = require("../../orchestrator/task-planner.js");
class PlannerAgent extends base_agent_js_1.BaseAgent {
    type = 'planner';
    capabilities = ['task-breakdown', 'dependency-analysis', 'complexity-estimation'];
    description = 'Plans and breaks down complex tasks into sub-tasks';
    constructor(id) {
        super(id, 'planner');
    }
    async execute(taskId, context) {
        const startTime = Date.now();
        const runId = this.generateRunId();
        try {
            // 1. Get the task from context
            const task = await this.getTask(context.workspaceRoot, taskId);
            if (!task) {
                return {
                    runId,
                    taskId,
                    agentType: 'planner',
                    status: 'failed',
                    output: 'Task not found',
                    artifacts: [],
                    needsApproval: false,
                    error: 'Task not found',
                    duration: Date.now() - startTime
                };
            }
            // 2. Parse task description
            const parser = new TaskParser();
            const parsedTask = parser.parse(task.description);
            // 3. Use TaskPlanner to break down
            const planner = new task_planner_js_1.TaskPlanner();
            const breakdowns = planner.breakdown(parsedTask, context.config);
            // 4. Create sub-tasks in state
            const stateManager = new state_manager_js_1.StateManager(context.workspaceRoot);
            for (const breakdown of breakdowns) {
                await stateManager.createTask({
                    title: breakdown.title,
                    description: breakdown.description,
                    priority: breakdown.priority,
                    timeout: 300,
                    dependencies: breakdown.dependencies,
                    assignedAgent: breakdown.assignedAgent
                });
            }
            // 5. Generate result
            const endTime = Date.now();
            return {
                runId,
                taskId,
                agentType: 'planner',
                status: 'completed',
                output: `Successfully broke down task into ${breakdowns.length} sub-tasks`,
                artifacts: [], // Task IDs will be in state
                needsApproval: false,
                duration: endTime - startTime
            };
        }
        catch (error) {
            return {
                runId,
                taskId,
                agentType: 'planner',
                status: 'failed',
                output: error instanceof Error ? error.message : 'Unknown error',
                artifacts: [],
                needsApproval: false,
                error: error.message,
                duration: Date.now() - startTime
            };
        }
    }
    validate(taskId, context) {
        // Planner agent requires task description
        return !!context.taskDescription;
    }
    report() {
        return {
            agentId: this.id,
            agentType: 'planner',
            taskId: 'taskId',
            status: 'completed',
            summary: 'Task breakdown agent',
            artifacts: [],
            errors: [],
            duration: 0
        };
    }
    generateRunId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).slice(2, 6);
        return `planner-${timestamp}-${random}`;
    }
}
exports.PlannerAgent = PlannerAgent;
