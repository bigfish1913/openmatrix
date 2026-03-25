"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutorAgent = void 0;
/**
 * Executor Agent - 命令执行
 *
 * 职责：
 * - 执行构建命令
 * - 运行测试
 * - 部署应用
 * - 清理环境
 *
 * 安全约束：
 * - 不执行危险命令
 * - 不暴露敏感信息
 * - 验证命令参数
 * - 记录执行日志
 */
class ExecutorAgent {
    type = 'executor';
    capabilities = ['build', 'test', 'deploy', 'clean', 'run'];
    // 禁止执行的命令模式
    FORBIDDEN_PATTERNS = [
        /rm\s+-rf\s+\//, // rm -rf /
        /rm\s+-rf\s+~/, // rm -rf ~
        /:\(\)\{.*;\};/, // Fork bomb
        />\s*\/dev\/sd/, // 写入磁盘
        /dd\s+if=.*of=\/dev/, // dd 写入设备
        /mkfs/, // 格式化
        /shutdown/, // 关机
        /reboot/, // 重启
        /init\s+0/, // 关机
    ];
    async execute(task) {
        const startTime = Date.now();
        try {
            // 安全检查
            this.validateTask(task);
            const prompt = this.buildExecutorPrompt(task);
            return {
                runId: this.generateRunId(),
                taskId: task.id,
                agentType: 'executor',
                status: 'completed',
                output: prompt,
                artifacts: [],
                needsApproval: this.needsApproval(task),
                duration: Date.now() - startTime,
                completedAt: new Date().toISOString()
            };
        }
        catch (error) {
            return {
                runId: this.generateRunId(),
                taskId: task.id,
                agentType: 'executor',
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
    /**
     * 验证任务安全性
     */
    validateTask(task) {
        const content = task.description.toLowerCase();
        for (const pattern of this.FORBIDDEN_PATTERNS) {
            if (pattern.test(content)) {
                throw new Error(`安全限制: 检测到禁止执行的命令模式`);
            }
        }
    }
    /**
     * 判断是否需要审批
     */
    needsApproval(task) {
        const approvalKeywords = ['deploy', 'publish', 'release', 'production'];
        const content = task.description.toLowerCase();
        return approvalKeywords.some(kw => content.includes(kw));
    }
    buildExecutorPrompt(task) {
        return `
# 执行任务

## 执行内容

${task.description}

## 安全约束

⚠️ **重要安全规则**

1. **禁止执行**
   - 删除系统文件的命令
   - 格式化磁盘的命令
   - 关机/重启命令
   - 任意代码注入

2. **执行前确认**
   - 检查命令参数
   - 确认目标路径
   - 备份重要数据

3. **执行后验证**
   - 检查执行结果
   - 验证预期效果
   - 记录执行日志

## 执行步骤

1. **环境检查**
   \`\`\`bash
   # 检查当前环境
   pwd
   node --version
   npm --version
   \`\`\`

2. **执行命令**
   \`\`\`bash
   # 在此执行任务中的命令
   \`\`\`

3. **验证结果**
   \`\`\`bash
   # 检查执行结果
   \`\`\`

## 输出格式

\`\`\`markdown
# 执行报告

## 命令
\`\`\`bash
[执行的命令]
\`\`\`

## 输出
\`\`\`
[命令输出]
\`\`\`

## 状态
[✅ 成功 / ❌ 失败]

## 耗时
X 秒

## 错误 (如有)
[错误信息]
\`\`\`

## 开始执行

请按步骤执行命令并记录结果。
`;
    }
    generateRunId() {
        return `executor-${Date.now().toString(36)}`;
    }
}
exports.ExecutorAgent = ExecutorAgent;
