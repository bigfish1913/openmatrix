"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoderAgent = void 0;
/**
 * Coder Agent - 代码编写
 *
 * 职责：
 * - 根据任务描述编写代码
 * - 遵循项目代码规范
 * - 编写必要的注释
 * - 确保代码可编译
 */
class CoderAgent {
    type = 'coder';
    capabilities = ['code', 'refactor', 'debug', 'implement'];
    async execute(task) {
        const startTime = Date.now();
        try {
            const prompt = this.buildCoderPrompt(task);
            return {
                runId: this.generateRunId(),
                taskId: task.id,
                agentType: 'coder',
                status: 'completed',
                output: prompt,
                artifacts: [],
                needsApproval: false,
                duration: Date.now() - startTime,
                completedAt: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                runId: this.generateRunId(),
                taskId: task.id,
                agentType: 'coder',
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
    buildCoderPrompt(task) {
        return `
# 编码任务

## 任务描述

${task.description}

## 编码要求

1. **代码风格**
   - 遵循项目现有代码风格
   - 使用项目配置的 linter
   - 添加必要的类型定义

2. **最佳实践**
   - 单一职责原则
   - 避免重复代码
   - 合理的错误处理
   - 适当的注释

3. **安全性**
   - 验证输入参数
   - 避免注入攻击
   - 保护敏感数据

4. **可测试性**
   - 依赖注入
   - 纯函数优先
   - 可 mock 的接口

## 输出要求

请实现代码，确保：

- [ ] 代码可编译
- [ ] 遵循项目规范
- [ ] 添加必要的测试
- [ ] 更新相关文档

## 开始实现

请阅读相关代码文件，然后实现功能。
`;
    }
    generateRunId() {
        return `coder-${Date.now().toString(36)}`;
    }
}
exports.CoderAgent = CoderAgent;
