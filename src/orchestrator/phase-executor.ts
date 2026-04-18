// src/orchestrator/phase-executor.ts
import { StateManager } from '../storage/state-manager.js';
import { ApprovalManager } from './approval-manager.js';
import { AgentRunner, type UserContext } from '../agents/agent-runner.js';
import type { SubagentTask } from '../types/index.js';
import { GitCommitManager } from './git-commit-manager.js';
import type { Task, AgentType, QualityConfig, QualityReport, QUALITY_PRESETS } from '../types/index.js';

export type Phase = 'develop' | 'verify' | 'accept' | 'tdd';

export interface PhaseResult {
  phase: Phase;
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
  artifacts: string[];
  nextPhase?: Phase;
  needsApproval: boolean;
  /** 质量报告 (verify 阶段产出) */
  qualityReport?: QualityReport;
}

export interface BuildTestResult {
  compile: boolean;
  staticAnalysis: boolean;
  dependencies: boolean;
  package: boolean;
  errors: string[];
}

/**
 * 质量门禁结果
 */
export interface QualityGateResult {
  passed: boolean;
  tests: { passed: number; failed: number; coverage: number };
  build: { success: boolean; errors: string[] };
  lint: { errors: number; warnings: number };
  security: { vulnerabilities: number };
  e2e: { passed: number; failed: number; skipped: number; duration: number };
  acceptance: { met: number; total: number };
}

/**
 * PhaseExecutor - 四阶段验证执行器 (增强版)
 *
 * 每个任务经历四个阶段 (TDD 模式):
 * 0. TDD - 先写测试 (可选)
 * 1. Develop - 开发实现
 * 2. Verify - 严格质量门禁 (测试/构建/Lint/安全/验收)
 * 3. Accept - 最终验收
 *
 * 质量级别:
 * - fast: 无质量门禁，最快
 * - balanced: 基础门禁 (60%覆盖率, Lint, 安全扫描)
 * - strict: 严格门禁 (TDD, 80%覆盖率, 严格Lint, 安全扫描)
 *
 * 在 auto 模式下 (isAutoMode=true):
 * - 阶段间自动流转，无需确认
 * - 质量门禁失败时暂停
 * - 仅在失败/异常时暂停
 */
export class PhaseExecutor {
  private stateManager: StateManager;
  private approvalManager: ApprovalManager;
  private agentRunner: AgentRunner;
  private gitCommitManager: GitCommitManager;
  private isAutoMode: boolean = false;
  private runId: string = '';
  private userContext: UserContext = {};
  private minTestCoverage: number = 60;
  /** 质量配置 */
  private qualityConfig: QualityConfig;

  /** 默认质量配置 (balanced) */
  private static DEFAULT_QUALITY: QualityConfig = {
    tdd: false,
    minCoverage: 60,
    strictLint: true,
    securityScan: true,
    e2eTests: false,
    level: 'balanced'
  };

  constructor(
    stateManager: StateManager,
    approvalManager: ApprovalManager
  ) {
    this.stateManager = stateManager;
    this.approvalManager = approvalManager;
    this.agentRunner = new AgentRunner(stateManager, approvalManager);
    this.gitCommitManager = new GitCommitManager();
    this.qualityConfig = PhaseExecutor.DEFAULT_QUALITY;
  }

  /**
   * 设置自动模式
   */
  setAutoMode(auto: boolean): void {
    this.isAutoMode = auto;
  }

  /**
   * 获取自动模式状态
   */
  getAutoMode(): boolean {
    return this.isAutoMode;
  }

  /**
   * 设置 Run ID (用于提交信息)
   */
  setRunId(runId: string): void {
    this.runId = runId;
  }

  /**
   * 设置质量配置
   */
  setQualityConfig(config: Partial<QualityConfig>): void {
    this.qualityConfig = { ...this.qualityConfig, ...config };
    if (config.minCoverage !== undefined) {
      this.minTestCoverage = config.minCoverage;
    }
  }

  /**
   * 获取质量配置
   */
  getQualityConfig(): QualityConfig {
    return this.qualityConfig;
  }

  /**
   * 设置质量级别预设
   */
  setQualityLevel(level: 'fast' | 'balanced' | 'strict'): void {
    const presets: Record<string, QualityConfig> = {
      fast: { tdd: false, minCoverage: 0, strictLint: false, securityScan: false, e2eTests: false, level: 'fast' },
      balanced: { tdd: false, minCoverage: 60, strictLint: true, securityScan: true, e2eTests: false, level: 'balanced' },
      strict: { tdd: true, minCoverage: 80, strictLint: true, securityScan: true, e2eTests: false, level: 'strict' }
    };
    this.qualityConfig = presets[level];
    this.minTestCoverage = this.qualityConfig.minCoverage;
  }

  /**
   * 设置用户上下文
   */
  setUserContext(context: UserContext): void {
    this.userContext = context;
    this.agentRunner.setUserContext(context);

    // 从用户上下文解析覆盖率要求
    if (context.testCoverage) {
      const match = context.testCoverage.match(/(\d+)/);
      if (match) {
        this.minTestCoverage = parseInt(match[1], 10);
      }
    }
  }

  /**
   * 设置最低测试覆盖率
   */
  setMinTestCoverage(coverage: number): void {
    this.minTestCoverage = coverage;
  }

  /**
   * 获取最低测试覆盖率
   */
  getMinTestCoverage(): number {
    return this.minTestCoverage;
  }

  /**
   * 设置是否启用自动提交
   */
  setAutoCommit(enabled: boolean): void {
    this.gitCommitManager.setEnabled(enabled);
  }

  /**
   * 获取 GitCommitManager 实例
   */
  getGitCommitManager(): GitCommitManager {
    return this.gitCommitManager;
  }

  /**
   * 获取任务当前阶段
   */
  getCurrentPhase(task: Task): Phase {
    // TDD 模式: 先写测试
    if (this.qualityConfig.tdd && task.phases.develop.status === 'pending') {
      // 检查是否已有测试文件
      return 'tdd';
    }
    if (task.phases.develop.status !== 'completed') return 'develop';
    if (task.phases.verify.status !== 'completed') return 'verify';
    return 'accept';
  }

  /**
   * 准备阶段执行的 Subagent 任务
   */
  async preparePhaseExecution(task: Task): Promise<SubagentTask | null> {
    const currentPhase = this.getCurrentPhase(task);

    switch (currentPhase) {
      case 'tdd':
        return this.prepareTDDPhase(task);
      case 'develop':
        return this.prepareDevelopPhase(task);
      case 'verify':
        return this.prepareVerifyPhase(task);
      case 'accept':
        return this.prepareAcceptPhase(task);
      default:
        return null;
    }
  }

  /**
   * 准备 TDD 阶段 - 先写测试
   */
  private async prepareTDDPhase(task: Task): Promise<SubagentTask> {
    const prompt = this.buildTDDPrompt(task);

    return {
      subagent_type: 'general-purpose',
      description: `tdd: write tests for ${task.title.slice(0, 30)}`,
      prompt,
      isolation: undefined,
      taskId: task.id,
      agentType: 'tester',
      timeout: task.timeout / 2,
      needsApproval: false
    };
  }

  /**
   * 准备开发阶段
   */
  private async prepareDevelopPhase(task: Task): Promise<SubagentTask> {
    const prompt = this.buildDevelopPrompt(task);

    return {
      subagent_type: this.agentRunner.mapAgentType(task.assignedAgent),
      description: `develop: ${task.title.slice(0, 40)}`,
      prompt,
      isolation: 'worktree',
      taskId: task.id,
      agentType: task.assignedAgent,
      timeout: task.timeout,
      needsApproval: false
    };
  }

  /**
   * 构建 TDD 阶段提示词 - 先写测试
   */
  private buildTDDPrompt(task: Task): string {
    const parts: string[] = [];

    parts.push(`# TDD 阶段 - 先写测试 (Test-First)

## 任务信息
- ID: ${task.id}
- 标题: ${task.title}
- 描述: ${task.description}

## TDD 目标
在编写实现代码之前，先编写测试用例。这确保:
1. 你理解需求
2. 代码可测试
3. 有明确的成功标准

## 验收标准 → 测试用例
${task.acceptanceCriteria?.map((c, i) => `${i + 1}. ${c}`).join('\n') || '根据任务描述生成测试用例'}

## 测试要求
1. **覆盖正常流程** - 主要功能路径
2. **覆盖边界情况** - 空值、极值、特殊字符
3. **覆盖异常处理** - 错误输入、网络失败
4. **AAA 模式** - Arrange, Act, Assert

## 测试框架
根据项目选择:
- TypeScript/JavaScript: Vitest, Jest
- Python: pytest
- Go: testing package`);

    // Auto 模式提示 - 不要停下来询问用户
    if (this.isAutoMode) {
      parts.push(`

## ⚠️ 全自动执行模式
**重要**: 此任务在全自动模式下执行，必须遵守以下规则:
- **不要停下来询问用户确认** - 直接创建测试文件
- **不要输出"继续..."或等待用户回复** - 完成后直接返回结果
- **不要询问"是否需要..."** - 根据验收标准自动生成测试
- 测试应该失败 (RED 阶段)，这是正确的
- 完成后直接输出结果，不要等待任何确认`);
    }

    parts.push(`

## 输出
1. 创建测试文件 (\`.test.ts\` 或 \`.spec.ts\`)
2. 测试应该**失败** (因为还没实现)
3. 输出测试文件路径

## 验证
运行 \`npm test\` 确认测试失败 (这是正确的!)

## ⚠️ Git 提交规范

**禁止执行 \`git commit\`**

所有代码提交必须通过 \`openmatrix complete\` 命令统一执行。测试文件创建完成后，只需返回结果摘要，**不要执行 git commit**。

## 输出格式
\`\`\`
TDD_TESTS_CREATED
测试文件: [路径]
测试用例数: [数量]
预期: 全部失败 (RED 阶段)
\`\`\`
`);
    return parts.join('\n');
  }

  /**
   * 准备验证阶段
   */
  private async prepareVerifyPhase(task: Task): Promise<SubagentTask> {
    const prompt = this.buildVerifyPrompt(task);

    return {
      subagent_type: 'general-purpose',
      description: `verify: ${task.title.slice(0, 40)}`,
      prompt,
      isolation: undefined, // 验证不需要隔离
      taskId: task.id,
      agentType: 'reviewer',
      timeout: task.timeout / 2, // 验证阶段时间较短
      needsApproval: false
    };
  }

  /**
   * 准备验收阶段
   */
  private async prepareAcceptPhase(task: Task): Promise<SubagentTask> {
    const prompt = this.buildAcceptPrompt(task);

    return {
      subagent_type: 'general-purpose',
      description: `accept: ${task.title.slice(0, 40)}`,
      prompt,
      isolation: undefined,
      taskId: task.id,
      agentType: 'reviewer',
      timeout: 60000, // 验收阶段固定 1 分钟
      needsApproval: true // 验收需要确认
    };
  }

  /**
   * 构建开发阶段提示词 (增强版: 注入验收标准和用户上下文)
   */
  private buildDevelopPrompt(task: Task): string {
    const parts: string[] = [];
    const isTDDMode = this.qualityConfig.tdd;

    parts.push(`# 开发阶段 (Develop Phase)${isTDDMode ? ' - TDD GREEN 阶段' : ''}

## 任务信息
- ID: ${task.id}
- 标题: ${task.title}
- 描述: ${task.description}
- 优先级: ${task.priority}
- 质量级别: ${this.qualityConfig.level}`);

    // Auto 模式提示 - 不要停下来询问用户
    if (this.isAutoMode) {
      parts.push(`

## ⚠️ 全自动执行模式
**重要**: 此任务在全自动模式下执行，必须遵守以下规则:
- **不要停下来询问用户确认** - 直接执行所有操作
- **不要输出"继续..."或等待用户回复** - 完成任务后直接返回结果
- **不要询问"是否需要..."** - 自动做出合理决策
- 如果遇到阻塞问题，记录到 Meeting 并继续执行其他任务
- 完成后直接输出结果，不要等待任何确认`);
    }

    // TDD 模式提示
    if (isTDDMode) {
      parts.push(`
## ⚠️ TDD 模式
你已经在上一步编写了测试。现在需要:
1. 编写最小代码使测试通过
2. 不要过度设计
3. 测试通过即可 (GREEN 阶段)`);
    }

    // 注入用户上下文
    if (this.userContext.objective) {
      parts.push(`
## 整体目标
${this.userContext.objective}`);
    }

    if (this.userContext.techStack && this.userContext.techStack.length > 0) {
      parts.push(`
## 技术栈要求
${this.userContext.techStack.map(t => `- ${t}`).join('\n')}`);
    }

    // 注入验收标准
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      parts.push(`
## 验收标准 (必须全部满足)
${task.acceptanceCriteria.map((c, i) => `${i + 1}. [ ] ${c}`).join('\n')}`);
    }

    parts.push(`
## 开发要求
1. 根据任务描述编写代码
2. 遵循项目代码规范
3. 编写必要的注释
4. 处理边界情况和错误
5. 确保代码可编译

## 编码规范 (SOLID + Clean Code)
- **S**ingle Responsibility: 每个函数只做一件事
- **O**pen/Closed: 对扩展开放，对修改关闭
- **L**iskov Substitution: 子类可替换父类
- **I**nterface Segregation: 接口要小而专注
- **D**ependency Inversion: 依赖抽象而非具体

## 代码质量标准
- 函数长度: < 30 行
- 参数数量: < 4 个
- 嵌套深度: < 3 层
- 圈复杂度: < 10

## 输出要求
完成后，在 \`.openmatrix/tasks/${task.id}/artifacts/\` 目录下创建:
- \`result.md\` - 实现说明
- \`changes.txt\` - 变更文件列表

## 完成检查清单
- [ ] 代码可编译
- [ ] 边界情况已处理
- [ ] 错误处理完善
- [ ] 无安全隐患
- [ ] 代码风格一致
- [ ] 验收标准全部满足
${isTDDMode ? '- [ ] 所有测试通过 (GREEN)' : ''}

## ⚠️ Git 提交规范

**禁止执行 \`git commit\`**

所有代码提交必须通过 \`openmatrix complete\` 命令统一执行，该命令会：
1. 使用正确的任务标题 (当前任务: ${task.title})
2. 自动生成规范的提交信息
3. 避免产生重复或无意义的提交

如果代码变更已完成，只需返回结果摘要，**不要执行 git commit**。
`);
    return parts.join('\n');
  }

  /**
   * 构建验证阶段提示词 (增强版: 严格质量门禁)
   */
  private buildVerifyPrompt(task: Task): string {
    const parts: string[] = [];
    const qc = this.qualityConfig;

    parts.push(`# 验证阶段 (Verify Phase) - 严格质量门禁

## 任务信息
- ID: ${task.id}
- 标题: ${task.title}
- 质量级别: ${qc.level}

## 🚨 质量门禁 (Quality Gates)

| 检查项 | 要求 | 失败后果 |
|--------|------|----------|
| 编译 | 无错误 | ❌ 阻止通过 |
| 测试 | 全部通过 | ❌ 阻止通过 |
| 覆盖率 | >= ${qc.minCoverage}% | ${qc.minCoverage > 0 ? '❌ 阻止通过' : '⚠️ 仅警告'} |
| Lint | ${qc.strictLint ? '无 error' : '无严重 error'} | ${qc.strictLint ? '❌ 阻止通过' : '⚠️ 仅警告'} |
| 安全 | 无高危漏洞 | ${qc.securityScan ? '❌ 阻止通过' : '⏭️ 跳过'} |
| E2E | 全部通过 | ${qc.e2eTests ? '❌ 阻止通过' : '⏭️ 跳过'} |
| 验收标准 | 全部满足 | ❌ 阻止通过 |`);

    // Auto 模式提示 - 不要停下来询问用户
    if (this.isAutoMode) {
      parts.push(`

## ⚠️ 全自动执行模式
**重要**: 此任务在全自动模式下执行，必须遵守以下规则:
- **不要停下来询问用户确认** - 直接执行所有验证命令
- **不要输出"继续..."或等待用户回复** - 完成验证后直接返回结果
- **不要询问"是否需要..."** - 根据质量门禁配置自动执行
- 如果质量门禁失败，记录失败原因并返回结果
- 完成后直接输出结果，不要等待任何确认`);
    }

    parts.push(`

## 自动化验证命令

### 1. 编译检查 (必须通过)
\`\`\`bash
npm run build
\`\`\`
**预期**: 无编译错误
**失败后果**: ❌ VERIFY_FAILED

### 2. 测试运行 (必须通过)
\`\`\`bash
npm test
\`\`\`
**预期**: 所有测试通过
**失败后果**: ❌ VERIFY_FAILED

### 3. 覆盖率检查
\`\`\`bash
npm test -- --coverage 2>/dev/null || npm run test:coverage 2>/dev/null || echo "Coverage check skipped"
\`\`\`
**最低覆盖率**: ${qc.minCoverage}%
**失败后果**: ${qc.minCoverage > 0 ? '❌ VERIFY_FAILED' : '⚠️ 警告'}

### 4. Lint 检查
\`\`\`bash
# 先检查是否有 lint 脚本
npm run lint 2>&1 || echo "EXIT_CODE: $?"
\`\`\`
**重要**: 如果 lint 命令返回非零退出码且有 errors，必须报告为 VERIFY_FAILED。
如果项目没有 lint 脚本（显示 "missing script"），标记为 ⏭️ Skipped。
**要求**: ${qc.strictLint ? '无 error' : '无严重 error'}
**失败后果**: ${qc.strictLint ? '❌ VERIFY_FAILED' : '⚠️ 警告'}

### 5. 安全扫描
${qc.securityScan ? `\`\`\`bash
npm audit --audit-level=high || echo "Security scan skipped"
\`\`\`
**要求**: 无 high/critical 漏洞
**失败后果**: ❌ VERIFY_FAILED` : '⏭️ 已禁用'}

### 6. E2E 测试 (端到端测试)
${qc.e2eTests ? `\`\`\`bash
# 首先检查 E2E 测试工具是否可用
# 不要直接运行测试 - 先检查工具是否存在

# 检查 Playwright
if command -v npx &> /dev/null && npx playwright --version 2>/dev/null; then
  echo "✅ Playwright available"
  npx playwright test
elif command -v npx &> /dev/null && npx cypress --version 2>/dev/null; then
  echo "✅ Cypress available"
  npx cypress run
# 检查移动端工具
elif command -v appium &> /dev/null; then
  echo "✅ Appium available"
  npx appium ...
elif command -v detox &> /dev/null; then
  echo "✅ Detox available"
  npx detox test
# 检查项目自定义脚本
elif npm run | grep -q "test:e2e"; then
  echo "✅ Using project e2e script"
  npm run test:e2e
else
  echo "⚠️ No E2E test tool found - skipping E2E tests"
  echo "Install Playwright: npm install -D @playwright/test"
  echo "Or Cypress: npm install -D cypress"
  exit 0
fi
\`\`\`
**要求**: 所有 E2E 测试通过（如果工具可用）
**失败后果**: ❌ VERIFY_FAILED (工具可用但未通过) / ⏭️ Skipped (工具不可用)` : '⏭️ 已禁用'}

### 7. 验收标准验证`);

    // 注入验收标准
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      parts.push(`
逐项检查以下标准:
${task.acceptanceCriteria.map((c, i) => `${i + 1}. [ ] ${c}`).join('\n')}
**失败后果**: ❌ VERIFY_FAILED`);
    } else {
      parts.push(`
⏭️ 无验收标准定义`);
    }

    // Gate 8: 真实运行验证
    parts.push(`

### 8. 🚀 真实运行验证 (Smoke Test)

**目的**: 确保代码不仅编译通过，还能实际运行。

#### 8a. 导入/模块验证
\`\`\`bash
# 检查模块是否可以被正确导入（无运行时依赖缺失）
node -e "
try {
  // 检查主要入口文件是否能被导入
  const fs = require('fs');
  const path = require('path');
  const pkg = require('./package.json');

  // 如果有 main 或 exports 字段，尝试导入
  const mainFile = pkg.main || pkg.exports?.['.']?.import || pkg.exports?.['.']?.require;
  if (mainFile && fs.existsSync(mainFile)) {
    require('./' + mainFile);
    console.log('✅ Main entry imported successfully');
  } else if (fs.existsSync('dist/index.js')) {
    require('./dist/index.js');
    console.log('✅ dist/index.js imported successfully');
  } else {
    console.log('⏭️ No main entry to import-test');
  }
} catch(e) {
  console.error('❌ Import failed:', e.message);
  process.exitCode = 1;
}
"
\`\`\`
**失败后果**: ❌ VERIFY_FAILED (运行时依赖缺失或导入错误)

#### 8b. 启动验证（如适用）
\`\`\`bash
# 检查是否有 start 脚本，如果有则做短暂启动测试
if npm run | grep -q "start"; then
  echo "Found start script, running smoke test..."
  timeout 10 npm start -- --smoke-test 2>/dev/null || \
  timeout 10 npm start &
  START_PID=$!
  sleep 5
  # 检查进程是否还在运行（启动没有崩溃）
  if kill -0 $START_PID 2>/dev/null; then
    echo "✅ Application started successfully"
    kill $START_PID 2>/dev/null
  else
    wait $START_PID
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
      echo "✅ Application ran and exited cleanly"
    else
      echo "❌ Application crashed with exit code $EXIT_CODE"
      exit 1
    fi
  fi
else
  echo "⏭️ No start script found - skipping startup test"
fi
\`\`\`
**失败后果**: ❌ VERIFY_FAILED (启动崩溃) / ⏭️ Skipped (无 start 脚本)

#### 8c. 功能冒烟测试
\`\`\`bash
# 如果有 smoketest 脚本，运行它
if npm run | grep -q "smoketest\\|smoke-test\\|test:smoke"; then
  npm run smoketest 2>/dev/null || npm run smoke-test 2>/dev/null || npm run test:smoke
else
  echo "⏭️ No smoke test script - skipping"
fi
\`\`\`
**失败后果**: ❌ VERIFY_FAILED / ⏭️ Skipped (无 smoke test 脚本)`);

    parts.push(`

## 📊 质量报告格式

在 \`.openmatrix/tasks/${task.id}/artifacts/\` 目录下创建 \`quality-report.json\`:

\`\`\`json
{
  "taskId": "${task.id}",
  "timestamp": "[ISO时间]",
  "tests": {
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "coverage": 0,
    "status": "pass|fail"
  },
  "build": {
    "success": true,
    "errors": [],
    "status": "pass|fail"
  },
  "lint": {
    "errors": 0,
    "warnings": 0,
    "status": "pass|fail|warning"
  },
  "security": {
    "vulnerabilities": [],
    "status": "pass|fail"
  },
  "e2e": {
    "passed": 0,
    "failed": 0,
    "skipped": 0,
    "duration": 0,
    "status": "pass|fail|skipped"
  },
  "acceptance": {
    "total": ${task.acceptanceCriteria?.length || 0},
    "met": 0,
    "details": [],
    "status": "pass|fail"
  },
  "overall": "pass|fail|warning"
}
\`\`\`

## 最终输出

✅ **所有门禁通过**:
\`\`\`
VERIFY_PASSED
Quality Score: [A/B/C/D/F]
- Tests: ✅ X/X passed, Y% coverage
- Build: ✅ Success
- Lint: ✅ No errors
- Security: ✅ No vulnerabilities
${qc.e2eTests ? '- E2E: ✅ X/X passed' : ''}
- Acceptance: ✅ N/M criteria met
\`\`\`

❌ **门禁失败**:
\`\`\`
VERIFY_FAILED
Failed Gates:
1. [检查项]: [失败原因]
2. [检查项]: [失败原因]

Fix Required:
1. [修复建议]
2. [修复建议]
\`\`\`

## ⚠️ 重要提示
- **不要跳过任何检查**
- **不要伪造通过结果**
- 如果项目没有某个脚本，标记为 "⏭️ Skipped" 而非 "❌ Failed"
- 所有检查结果必须基于实际命令输出
- **禁止执行 \`git commit\`** — 所有提交统一通过 \`openmatrix complete\` 执行

## 🔧 配置检查 (可选但推荐)
检查以下常见配置问题:
- **Vitest 配置**: 如果存在 \`e2e/\` 目录，确保 \`vite.config.ts\` 的 \`test.exclude\` 包含 \`e2e\`
- **测试框架冲突**: 确保 Vitest 不运行 Playwright/Cypress 测试文件
- 如果发现配置问题，记录到报告中但不要阻止通过
`);
    return parts.join('\n');
  }

  /**
   * 构建验收阶段提示词 (增强版: 验收标准检查)
   */
  private buildAcceptPrompt(task: Task): string {
    const parts: string[] = [];

    parts.push(`# 验收阶段 (Accept Phase)

## 任务信息
- ID: ${task.id}
- 标题: ${task.title}
- 描述: ${task.description}`);

    // Auto 模式提示 - 不要停下来询问用户
    if (this.isAutoMode) {
      parts.push(`

## ⚠️ 全自动执行模式
**重要**: 此任务在全自动模式下执行，必须遵守以下规则:
- **不要停下来询问用户确认** - 直接执行所有验收检查
- **不要输出"继续..."或等待用户回复** - 完成验收后直接返回结果
- **不要询问"是否通过..."** - 根据验收标准自动判断
- 如果验收标准全部满足，直接输出 ACCEPT_PASSED
- 完成后直接输出结果，不要等待任何确认`);
    }

    // 注入验收标准
    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 0) {
      parts.push(`

## 验收标准 (必须全部满足)
${task.acceptanceCriteria.map((c, i) => `${i + 1}. [ ] ${c}`).join('\n')}`);
    }

    parts.push(`
## 验收检查清单
- [ ] 功能演示/验证
- [ ] 测试报告 (verify-report.md 已生成)
- [ ] 代码审查通过
- [ ] **🚀 实际运行验证** (导入测试、启动测试)
- [ ] 文档已更新 (如需要)
- [ ] 所有验收标准已满足

## 验收流程

### 1. 检查验证阶段结果
读取 \`.openmatrix/tasks/${task.id}/artifacts/verify-report.md\`
确认所有检查项已通过

### 2. 验证验收标准
逐项检查验收标准是否满足

### 3. 🚀 实际运行验证 (Accept 阶段必须执行)

**目的**: Verify 阶段验证了编译和测试，Accept 阶段验证代码在实际使用中是否可用。

#### 3a. 运行时导入测试
\`\`\`bash
# 验证所有核心模块能被正确导入（无运行时错误）
node -e "
const modules = [
  // 根据任务实际产出的模块填入
  // 示例: './dist/index.js', './dist/core.js'
];
let failed = [];
for (const mod of modules) {
  try {
    require(mod);
    console.log('✅ Import OK:', mod);
  } catch(e) {
    console.error('❌ Import FAIL:', mod, e.message);
    failed.push(mod);
  }
}
if (failed.length > 0) {
  console.error('Failed imports:', failed.join(', '));
  process.exitCode = 1;
}
console.log('All module imports passed');
"
\`\`\`

#### 3b. CLI/入口测试 (如适用)
\`\`\`bash
# 如果项目提供 CLI 或 HTTP 服务，做基本调用测试
# CLI 示例:
if [ -f "dist/cli/index.js" ]; then
  node dist/cli/index.js --help && echo "✅ CLI runs" || echo "❌ CLI crashed"
fi

# HTTP 示例 (如果有 start 脚本):
# 启动 → 发送测试请求 → 验证响应 → 关闭
\`\`\`

#### 3c. 结果验证
- 如果导入/运行成功 → ✅ 继续验收
- 如果导入/运行失败但测试通过 → ❌ 标记为 ACCEPT_NEEDS_MODIFICATION，指出运行时错误
- 如果项目无 entry point（纯库/工具）→ ⏭️ 跳过，基于代码审查判断

### 4. 最终确认
- 确认代码可以合并
- 确认无遗留问题
- **确认代码能实际运行**（不是只编译通过）

## 输出要求
在 \`.openmatrix/tasks/${task.id}/artifacts/\` 目录下创建:
- \`accept-report.md\` - 验收报告

## 结果格式
如果验收通过，输出:
\`\`\`
ACCEPT_PASSED
\`\`\`

如果需要修改，输出:
\`\`\`
ACCEPT_NEEDS_MODIFICATION
修改建议:
1. [建议]
2. [建议]
\`\`\`

如果验收失败，输出:
\`\`\`
ACCEPT_FAILED
失败原因:
1. [原因]
\`\`\`

## ⚠️ Git 提交规范
**禁止执行 \`git commit\`** — 所有提交统一通过 \`openmatrix complete\` 执行，确保使用正确的任务标题。
`);
    return parts.join('\n');
  }

  /**
   * 处理阶段结果
   *
   * 在 auto 模式下:
   * - 自动进入下一阶段，needsApproval = false
   * - 仅在失败时暂停
   * - 自动提交代码 (如果启用)
   */
  async processPhaseResult(
    task: Task,
    phase: Phase,
    result: { success: boolean; output: string; error?: string }
  ): Promise<PhaseResult> {
    const now = new Date().toISOString();

    if (result.success) {
      // 更新阶段状态
      const updates: Partial<Task> = {
        phases: {
          ...task.phases,
          [phase]: {
            status: 'completed',
            duration: 0,
            completedAt: now
          }
        }
      };

      // 设置下一阶段
      let nextPhase: Phase | undefined;
      // auto 模式下不需要审批，仅在 accept 阶段且非 auto 模式时需要
      let needsApproval = false;

      if (phase === 'develop') {
        nextPhase = 'verify';
        updates.phases!.verify = {
          status: 'pending',
          duration: null,
          startedAt: now
        };
        updates.status = 'verify';
      } else if (phase === 'verify') {
        nextPhase = 'accept';
        updates.phases!.accept = {
          status: 'pending',
          duration: null,
          startedAt: now
        };
        updates.status = 'accept';
        // 仅在非 auto 模式下需要审批
        needsApproval = !this.isAutoMode;
      } else if (phase === 'accept') {
        updates.status = 'completed';
      }

      await this.stateManager.updateTask(task.id, updates);

      // 持久化 Phase 结果到磁盘
      await this.stateManager.savePhaseResult(task.id, phase, {
        success: true,
        output: result.output,
        phaseStatus: 'completed',
        completedAt: now
      });

      // 自动提交代码（始终尝试，不依赖 runId 是否为空）
      {
        try {
          const commitResult = await this.gitCommitManager.commit({
            taskId: task.id,
            taskTitle: task.title,
            runId: this.runId,
            phase,
            changes: [],
            impactScope: []
          });

          if (commitResult.success) {
            console.log(`✅ Git 提交成功: ${commitResult.commitHash}`);
          } else {
            const reason = commitResult.message || commitResult.error || 'Unknown reason';
            console.log(`⚠️ Git 提交跳过: ${reason}`);
          }
        } catch (error) {
          console.error(`❌ Git 提交失败: ${error}`);
        }
      }

      return {
        phase,
        success: true,
        output: result.output,
        duration: 0,
        artifacts: [],
        nextPhase,
        needsApproval
      };
    } else {
      // 阶段失败
      await this.stateManager.updateTask(task.id, {
        status: 'failed',
        error: result.error || `${phase} phase failed`
      });

      // 持久化失败结果
      await this.stateManager.savePhaseResult(task.id, phase, {
        success: false,
        error: result.error || `${phase} phase failed`,
        phaseStatus: 'failed',
        failedAt: now
      });

      return {
        phase,
        success: false,
        error: result.error,
        duration: 0,
        artifacts: [],
        // 失败时总是需要审批/确认
        needsApproval: true
      };
    }
  }

  /**
   * 检查 Build 测试结果
   */
  parseBuildTestResult(output: string): BuildTestResult {
    const result: BuildTestResult = {
      compile: false,
      staticAnalysis: false,
      dependencies: false,
      package: false,
      errors: []
    };

    // 解析编译结果
    if (output.includes('npm run build') && !output.includes('error')) {
      result.compile = true;
    }

    // 解析 lint 结果
    if (output.includes('npm run lint')) {
      result.staticAnalysis = !output.includes('error') && !output.includes('warning');
    } else {
      result.staticAnalysis = true; // 没有 lint 脚本视为通过
    }

    // 解析依赖检查
    if (output.includes('npm ci') || output.includes('npm install')) {
      result.dependencies = !output.includes('ERR!');
    }

    // 解析测试结果
    if (output.includes('npm test')) {
      result.package = output.includes('passed') || output.includes('PASS');
    }

    // 收集错误
    const errorLines = output.split('\n').filter(line =>
      line.toLowerCase().includes('error') ||
      line.toLowerCase().includes('failed') ||
      line.toLowerCase().includes('fail')
    );
    result.errors = errorLines;

    return result;
  }

  /**
   * 解析质量报告
   *
   * 策略：优先解析 JSON 格式，失败时使用正则表达式回退
   * 支持多种测试框架输出格式（Vitest, Jest, Mocha, Tape）
   */
  parseQualityReport(output: string): QualityGateResult {
    const result: QualityGateResult = {
      passed: false,
      tests: { passed: 0, failed: 0, coverage: -1 },  // -1 = coverage not measured
      build: { success: false, errors: [] },
      lint: { errors: 0, warnings: 0 },
      security: { vulnerabilities: 0 },
      e2e: { passed: 0, failed: 0, skipped: 0, duration: 0 },
      acceptance: { met: 0, total: 0 }
    };

    // 策略 1: 尝试解析 JSON 格式（质量门禁首选）
    const jsonMatch = output.match(/```(?:json)?\s*\{[\s\S]*?"tests":\s*\{[\s\S]*?\}[\s\S]*?\}\s*```/);
    if (jsonMatch) {
      try {
        const jsonStr = jsonMatch[0].replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
        const jsonReport = JSON.parse(jsonStr);

        // 解析 tests
        if (jsonReport.tests) {
          result.tests.passed = jsonReport.tests.passed ?? 0;
          result.tests.failed = jsonReport.tests.failed ?? 0;
          // -1 表示未测量覆盖率
          result.tests.coverage = jsonReport.tests.coverage ?? -1;
        }

        // 解析 build
        if (jsonReport.build) {
          result.build.success = jsonReport.build.success ?? false;
          result.build.errors = jsonReport.build.errors ?? [];
        }

        // 解析 lint
        if (jsonReport.lint) {
          result.lint.errors = jsonReport.lint.errors ?? 0;
          result.lint.warnings = jsonReport.lint.warnings ?? 0;
        }

        // 解析 security
        if (jsonReport.security) {
          result.security.vulnerabilities = jsonReport.security.vulnerabilities?.length ?? 0;
        }

        // 解析 e2e
        if (jsonReport.e2e) {
          result.e2e.passed = jsonReport.e2e.passed ?? 0;
          result.e2e.failed = jsonReport.e2e.failed ?? 0;
          result.e2e.skipped = jsonReport.e2e.skipped ?? 0;
          result.e2e.duration = jsonReport.e2e.duration ?? 0;
        }

        // 解析 acceptance
        if (jsonReport.acceptance) {
          result.acceptance.total = jsonReport.acceptance.total ?? 0;
          result.acceptance.met = jsonReport.acceptance.met ?? 0;
        }

        // 判断是否通过
        const qc = this.qualityConfig;
        const testsPassed = result.tests.failed === 0;
        // 覆盖率 -1 表示未测量（无覆盖率输出），跳过检查
        const coverageOk = result.tests.coverage < 0 || result.tests.coverage >= qc.minCoverage;
        const lintOk = qc.strictLint ? result.lint.errors === 0 : true;
        const buildOk = result.build.success;
        const e2eOk = qc.e2eTests ? result.e2e.failed === 0 : true;
        result.passed = testsPassed && coverageOk && lintOk && buildOk && e2eOk;

        return result;
      } catch (e) {
        console.debug('JSON report parse failed, falling back to regex:', e);
      }
    }

    // 策略 2: 正则表达式回退 - 支持多种测试框架输出格式
    // Vitest: "✓ 10 tests | 10 passed"
    // Jest: "Tests:       10 passed, 10 total"
    // Mocha: "10 passing"
    // Tape: "# tests 10\n# ok\n# pass 10"
    const testPatterns = [
      /✓\s*(\d+)\s*tests.*?\|\s*(\d+)\s*passed/i,  // Vitest
      /Tests?:\s*(\d+)\s*passed/i,                  // Jest
      /(\d+)\s*(?:passed|passing)/i,                // Mocha/Tape
    ];
    for (const pattern of testPatterns) {
      const match = output.match(pattern);
      if (match) {
        result.tests.passed = parseInt(match[1], 10);
        break;
      }
    }

    const failPatterns = [
      /✗\s*(\d+)\s*tests/i,                         // Vitest
      /Tests?:\s*(\d+)\s*failed/i,                  // Jest
      /(\d+)\s*(?:failed|failing)/i,                // Mocha/Tape
    ];
    for (const pattern of failPatterns) {
      const match = output.match(pattern);
      if (match) {
        result.tests.failed = parseInt(match[1], 10);
        break;
      }
    }

    const coverageMatch = output.match(/(?:coverage|covered).*?(\d+)%/i);
    if (coverageMatch) result.tests.coverage = parseInt(coverageMatch[1], 10);

    // 解析构建结果
    result.build.success = output.includes('VERIFY_PASSED') ||
                          (output.includes('npm run build') && !output.includes('error'));

    // 解析 Lint 结果 - 支持多种 ESLint 输出格式
    // 格式1: "✖ 137 problems (92 errors, 45 warnings)"
    const detailedMatch = output.match(/✖\s*\d+\s*problems?\s*\((\d+)\s*errors?,\s*(\d+)\s*warnings?\)/i);
    if (detailedMatch) {
      result.lint.errors = parseInt(detailedMatch[1], 10);
      result.lint.warnings = parseInt(detailedMatch[2], 10);
    } else {
      // 格式2: "X errors" 和 "Y warnings"
      const lintErrorMatch = output.match(/(\d+)\s*error/i);
      if (lintErrorMatch) result.lint.errors = parseInt(lintErrorMatch[1], 10);
      const lintWarnMatch = output.match(/(\d+)\s*warning/i);
      if (lintWarnMatch) result.lint.warnings = parseInt(lintWarnMatch[1], 10);
    }

    // 检测 Lint 是否实际执行并失败
    // ESLint 退出码非0时，输出中会包含 "✖" 或 "problems"
    const lintFailed = output.includes('✖') && output.includes('problems');
    if (lintFailed && result.lint.errors === 0) {
      // 尝试从问题总数中推断
      const problemsMatch = output.match(/✖\s*(\d+)\s*problems?/i);
      if (problemsMatch) {
        result.lint.errors = parseInt(problemsMatch[1], 10);
      }
    }

    // 解析安全漏洞
    const vulnMatch = output.match(/(\d+)\s*(?:vulnerabilities|vulnerable)/i);
    if (vulnMatch) result.security.vulnerabilities = parseInt(vulnMatch[1], 10);

    // 解析 E2E 测试结果
    const e2ePassedMatch = output.match(/(?:e2e|playwright|cypress|appium|detox).*?(\d+)\s*(?:passed|passing)/i);
    if (e2ePassedMatch) result.e2e.passed = parseInt(e2ePassedMatch[1], 10);
    const e2eFailedMatch = output.match(/(?:e2e|playwright|cypress|appium|detox).*?(\d+)\s*(?:failed|failing)/i);
    if (e2eFailedMatch) result.e2e.failed = parseInt(e2eFailedMatch[1], 10);
    const e2eSkippedMatch = output.match(/(?:e2e|playwright|cypress|appium|detox).*?(\d+)\s*skipped/i);
    if (e2eSkippedMatch) result.e2e.skipped = parseInt(e2eSkippedMatch[1], 10);
    const e2eDurationMatch = output.match(/(?:e2e|playwright|cypress|appium|detox).*?(\d+)\s*(?:ms|s|min)/i);
    if (e2eDurationMatch) result.e2e.duration = parseInt(e2eDurationMatch[1], 10);

    // 判断是否通过
    const qc = this.qualityConfig;
    const testsPassed = result.tests.failed === 0;
    // 覆盖率 -1 表示未测量（regex 回退路径下未匹配到覆盖率时保持 -1）
    const coverageOk = result.tests.coverage < 0 || result.tests.coverage >= qc.minCoverage;
    const lintOk = qc.strictLint ? result.lint.errors === 0 : true;
    const buildOk = result.build.success;
    const e2eOk = qc.e2eTests ? result.e2e.failed === 0 : true;

    result.passed = testsPassed && coverageOk && lintOk && buildOk && e2eOk;

    return result;
  }

  /**
   * 生成质量报告 JSON
   */
  generateQualityReport(task: Task, gateResult: QualityGateResult): QualityReport {
    const qc = this.qualityConfig;

    return {
      taskId: task.id,
      timestamp: new Date().toISOString(),
      tests: {
        passed: gateResult.tests.passed,
        failed: gateResult.tests.failed,
        skipped: 0,
        coverage: gateResult.tests.coverage,
        status: gateResult.tests.failed === 0 ? 'pass' : 'fail'
      },
      build: {
        success: gateResult.build.success,
        errors: gateResult.build.errors,
        status: gateResult.build.success ? 'pass' : 'fail'
      },
      lint: {
        errors: gateResult.lint.errors,
        warnings: gateResult.lint.warnings,
        status: qc.strictLint && gateResult.lint.errors > 0 ? 'fail' :
                gateResult.lint.warnings > 0 ? 'warning' : 'pass'
      },
      security: {
        vulnerabilities: [],
        status: gateResult.security.vulnerabilities === 0 ? 'pass' : 'fail'
      },
      e2e: {
        passed: gateResult.e2e.passed,
        failed: gateResult.e2e.failed,
        skipped: gateResult.e2e.skipped,
        duration: gateResult.e2e.duration,
        status: qc.e2eTests ? (gateResult.e2e.failed === 0 ? 'pass' : 'fail') : 'skipped'
      },
      acceptance: {
        total: task.acceptanceCriteria?.length || 0,
        met: gateResult.acceptance.met,
        details: [],
        status: gateResult.acceptance.met >= (task.acceptanceCriteria?.length || 0) ? 'pass' : 'fail'
      },
      overall: gateResult.passed ? 'pass' : 'fail'
    };
  }

  /**
   * 获取 AgentRunner 实例
   */
  getAgentRunner(): AgentRunner {
    return this.agentRunner;
  }
}
