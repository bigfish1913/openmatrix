"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewerAgent = void 0;
/**
 * Reviewer Agent - 代码审查
 *
 * 职责：
 * - 代码质量审查
 * - 安全性检查
 * - 性能评估
 * - 最佳实践建议
 */
class ReviewerAgent {
    type = 'reviewer';
    capabilities = ['review', 'audit', 'security', 'performance'];
    async execute(task) {
        const startTime = Date.now();
        try {
            const prompt = this.buildReviewerPrompt(task);
            return {
                runId: this.generateRunId(),
                taskId: task.id,
                agentType: 'reviewer',
                status: 'completed',
                output: prompt,
                artifacts: [],
                needsApproval: true, // 审查结果需要确认
                duration: Date.now() - startTime,
                completedAt: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                runId: this.generateRunId(),
                taskId: task.id,
                agentType: 'reviewer',
                status: 'failed',
                output: '',
                artifacts: [],
                needsApproval: false,
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - startTime,
                completedAt: new Date().toISOString()
            };
        }
    }
    buildReviewerPrompt(task) {
        return `
# 代码审查

## 审查范围

${task.description}

## 审查清单

### 1. 代码质量

- [ ] 代码可读性
- [ ] 命名规范
- [ ] 函数复杂度
- [ ] 重复代码
- [ ] 注释质量

### 2. 安全性

- [ ] 输入验证
- [ ] SQL 注入
- [ ] XSS 攻击
- [ ] 敏感数据暴露
- [ ] 权限控制

### 3. 性能

- [ ] 算法效率
- [ ] 数据库查询
- [ ] 内存使用
- [ ] 缓存策略

### 4. 最佳实践

- [ ] 设计模式
- [ ] 错误处理
- [ ] 日志记录
- [ ] 测试覆盖

## 输出格式

\`\`\`markdown
# 审查报告

## 总体评价
[✅ 通过 / ⚠️ 需修改 / ❌ 拒绝]

## 问题列表

### 严重 (必须修复)
1. [文件:行号] 问题描述
   - 建议: 修复建议

### 警告 (建议修复)
1. [文件:行号] 问题描述

### 建议 (可选优化)
1. 优化建议

## 总结
[审查总结]
\`\`\`

## 开始审查

请检查相关代码文件并提供审查意见。
`;
    }
    generateRunId() {
        return `reviewer-${Date.now().toString(36)}`;
    }
}
exports.ReviewerAgent = ReviewerAgent;
