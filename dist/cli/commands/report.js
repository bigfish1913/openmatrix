"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportCommand = void 0;
// src/cli/commands/report.ts
const commander_1 = require("commander");
const state_manager_js_1 = require("../../storage/state-manager.js");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
exports.reportCommand = new commander_1.Command('report')
    .description('生成任务执行报告')
    .option('-f, --format <format>', '输出格式 (markdown/json)', 'markdown')
    .option('-o, --output <path>', '输出文件路径')
    .action(async (options) => {
    const basePath = process.cwd();
    const omPath = `${basePath}/.openmatrix`;
    const stateManager = new state_manager_js_1.StateManager(omPath);
    await stateManager.initialize();
    const state = await stateManager.getState();
    const tasks = await stateManager.listTasks();
    const approvals = await stateManager.getAllApprovals();
    // 统计数据
    const stats = {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        failed: tasks.filter(t => t.status === 'failed').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        pending: tasks.filter(t => t.status === 'pending').length,
        blocked: tasks.filter(t => t.status === 'blocked').length
    };
    // 计算总耗时
    const totalDuration = tasks
        .filter(t => t.phases?.accept?.duration)
        .reduce((sum, t) => sum + (t.phases?.accept?.duration || 0), 0);
    // 生成报告
    let report;
    if (options.format === 'json') {
        report = JSON.stringify({
            runId: state.runId,
            status: state.status,
            startedAt: state.startedAt,
            statistics: stats,
            totalDuration,
            tasks: tasks.map(t => ({
                id: t.id,
                title: t.title,
                status: t.status,
                priority: t.priority,
                duration: t.phases?.accept?.duration || 0,
                error: t.error
            })),
            approvals: approvals.map(a => ({
                id: a.id,
                type: a.type,
                status: a.status,
                decision: a.decision
            }))
        }, null, 2);
    }
    else {
        report = generateMarkdownReport(state, tasks, approvals, stats, totalDuration);
    }
    // 输出
    if (options.output) {
        const outputPath = path.resolve(basePath, options.output);
        await fs.writeFile(outputPath, report, 'utf-8');
        console.log(`\n📄 报告已保存: ${outputPath}`);
    }
    else {
        console.log('\n' + report);
    }
});
function generateMarkdownReport(state, tasks, approvals, stats, totalDuration) {
    const duration = Math.round(totalDuration / 1000 / 60); // 转为分钟
    return `
📊 OpenMatrix 执行报告
=====================

🆔 Run ID: ${state.runId}
📅 时间: ${state.startedAt}
⏱️ 总耗时: ${duration} 分钟
📈 状态: ${state.status}

## 📊 任务统计

| 状态 | 数量 | 占比 |
|------|------|------|
| ✅ 完成 | ${stats.completed} | ${stats.total > 0 ? Math.round(stats.completed / stats.total * 100) : 0}% |
| ❌ 失败 | ${stats.failed} | ${stats.total > 0 ? Math.round(stats.failed / stats.total * 100) : 0}% |
| 🔄 进行中 | ${stats.inProgress} | ${stats.total > 0 ? Math.round(stats.inProgress / stats.total * 100) : 0}% |
| 🔴 阻塞 | ${stats.blocked} | ${stats.total > 0 ? Math.round(stats.blocked / stats.total * 100) : 0}% |
| ⏳ 待处理 | ${stats.pending} | ${stats.total > 0 ? Math.round(stats.pending / stats.total * 100) : 0}% |

## 📋 任务详情

### ✅ 已完成
${tasks
        .filter(t => t.status === 'completed')
        .map(t => `- ${t.id}: ${t.title}`)
        .join('\n') || '_无_'}

### ❌ 失败
${tasks
        .filter(t => t.status === 'failed')
        .map(t => `- ${t.id}: ${t.title}\n  原因: ${t.error || '未知'}`)
        .join('\n') || '_无_'}

### 🔴 阻塞
${tasks
        .filter(t => t.status === 'blocked')
        .map(t => `- ${t.id}: ${t.title}\n  原因: ${t.error || '未知'}`)
        .join('\n') || '_无_'}

## 🔔 审批记录

| ID | 类型 | 决策 | 状态 |
|----|------|------|------|
${approvals.length > 0
        ? approvals.map(a => `| ${a.id} | ${a.type} | ${a.decision || '-'} | ${a.status} |`).join('\n')
        : '| _无_ | | | |'}

---
报告生成时间: ${new Date().toISOString()}
`.trim();
}
