"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskPlanner = void 0;
class TaskPlanner {
    /**
     * Break down a parsed task into sub-tasks
     */
    breakdown(parsedTask, answers) {
        const breakdowns = [];
        // 1. Create tasks for each goal
        for (let i = 0; i < parsedTask.goals.length; i++) {
            breakdowns.push({
                taskId: this.generateTaskId(),
                title: parsedTask.goals[i],
                description: `实现: ${parsedTask.goals[i]}`,
                priority: this.determinePriority(i),
                dependencies: [],
                estimatedComplexity: this.estimateComplexity(parsedTask.goals[i]),
                assignedAgent: this.determineAgent(parsedTask.goals[i])
            });
        }
        // 2. Create integration task if multiple deliverables
        if (parsedTask.deliverables.length > 1) {
            breakdowns.push({
                taskId: this.generateTaskId(),
                title: '集成测试',
                description: `验证所有交付物正确集成`,
                priority: 'P1',
                dependencies: parsedTask.deliverables,
                estimatedComplexity: 'medium',
                assignedAgent: 'tester'
            });
        }
        return breakdowns;
    }
    generateTaskId() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).slice(2, 4).toUpperCase();
        return `TASK-${timestamp}${rand}`;
    }
    determinePriority(goalIndex) {
        // First goal is highest priority
        if (goalIndex === 0)
            return 'P1';
        return 'P2';
    }
    estimateComplexity(goal) {
        if (goal.includes('测试'))
            return 'medium';
        if (goal.includes('实现') || goal.includes('开发'))
            return 'low';
        if (goal.includes('设计') || goal.includes('研究'))
            return 'high';
        return 'high';
    }
    determineAgent(goal) {
        if (goal.includes('测试'))
            return 'tester';
        if (goal.includes('实现') || goal.includes('开发'))
            return 'coder';
        if (goal.includes('设计') || goal.includes('研究'))
            return 'researcher';
        if (goal.includes('文档') || goal.includes('说明'))
            return 'executor';
        return 'executor';
    }
}
exports.TaskPlanner = TaskPlanner;
