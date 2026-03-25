"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TesterAgent = void 0;
/**
 * Tester Agent - 测试验证
 *
 * 职责：
 * - 编写单元测试
 * - 编写集成测试
 * - 执行测试用例
 * - 生成测试报告
 */
class TesterAgent {
    type = 'tester';
    capabilities = ['test', 'verify', 'coverage', 'report'];
    async execute(task) {
        const startTime = Date.now();
        try {
            const prompt = this.buildTesterPrompt(task);
            return {
                runId: this.generateRunId(),
                taskId: task.id,
                agentType: 'tester',
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
                agentType: 'tester',
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
    buildTesterPrompt(task) {
        return `
# 测试任务

## 测试目标

${task.description}

## 测试范围

### 1. 单元测试
- 测试各个函数/方法
- 覆盖边界情况
- 测试错误处理

### 2. 集成测试
- 测试模块间交互
- 测试 API 端点
- 测试数据流

### 3. 测试用例

| 场景 | 输入 | 预期输出 |
|-----|------|---------|
| 正常流程 | ... | ... |
| 边界情况 | ... | ... |
| 异常处理 | ... | ... |

## 执行步骤

1. 识别需要测试的代码
2. 编写测试用例
3. 运行测试
4. 生成报告

## 输出格式

\`\`\`markdown
# 测试报告

## 测试结果
- ✅ 通过: X
- ❌ 失败: Y
- ⏭️ 跳过: Z

## 覆盖率
- 语句: X%
- 分支: Y%
- 函数: Z%

## 失败用例 (如有)
1. [用例名]: [失败原因]
\`\`\`

## 开始测试

请运行 \`npm test\` 并分析结果。
`;
    }
    generateRunId() {
        return `tester-${Date.now().toString(36)}`;
    }
}
exports.TesterAgent = TesterAgent;
