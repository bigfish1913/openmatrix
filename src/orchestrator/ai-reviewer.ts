// src/orchestrator/ai-reviewer.ts
import type { Task } from '../types/index.js';

/**
 * AI Reviewer 验收报告
 */
export interface ReviewReport {
  taskId: string;
  overallStatus: 'approved' | 'needs_changes' | 'rejected';
  categories: ReviewCategory[];
  issues: ReviewIssue[];
  suggestions: string[];
  summary: string;
  reviewedAt: string;
}

export interface ReviewCategory {
  name: string;
  status: 'pass' | 'warning' | 'fail';
  score: number; // 0-100
  details: string[];
}

export interface ReviewIssue {
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  file?: string;
  line?: number;
  description: string;
  suggestion?: string;
}

/**
 * AIReviewer - AI 代码审查器
 *
 * 在 Accept Phase 执行完整的代码审查:
 * 1. 代码质量评估
 * 2. 安全性检查
 * 3. 性能评估
 * 4. 最佳实践验证
 * 5. 测试覆盖检查
 */
export class AIReviewer {
  /**
   * 生成 AI Review 提示词
   */
  buildReviewPrompt(task: Task): string {
    return `# AI Code Review - 验收阶段

## 任务信息
- Task ID: ${task.id}
- 标题: ${task.title}
- 描述: ${task.description}

## 审查范围

请对本次任务的所有代码变更进行完整审查。

## 审查清单

### 1. 代码质量 (Code Quality)
- [ ] 代码可读性: 命名清晰、结构合理
- [ ] 函数复杂度: 单一职责、适当长度
- [ ] 代码复用: 避免重复、抽取公共逻辑
- [ ] 注释质量: 关键逻辑有注释、复杂代码有说明
- [ ] 错误处理: 异常情况有处理、错误信息清晰

### 2. 安全性 (Security)
- [ ] 输入验证: 用户输入有校验
- [ ] SQL 注入: 数据库查询使用参数化
- [ ] XSS 攻击: 输出有转义
- [ ] 敏感数据: 密码/密钥不明文存储
- [ ] 权限控制: 敏感操作有权限检查

### 3. 性能 (Performance)
- [ ] 算法效率: 时间复杂度合理
- [ ] 数据库查询: 避免 N+1、使用索引
- [ ] 内存使用: 无内存泄漏、大对象及时释放
- [ ] 缓存策略: 适当使用缓存
- [ ] 异步处理: 耗时操作使用异步

### 4. 最佳实践 (Best Practices)
- [ ] 设计模式: 合理使用设计模式
- [ ] 依赖注入: 避免硬编码依赖
- [ ] 配置管理: 配置与代码分离
- [ ] 日志记录: 关键操作有日志
- [ ] 测试友好: 代码易于测试

### 5. 测试覆盖 (Test Coverage)
- [ ] 单元测试: 核心逻辑有测试
- [ ] 边界情况: 边界值有测试
- [ ] 异常路径: 错误情况有测试
- [ ] 测试质量: 测试有意义、不是为测试而测试

## 输出格式

在 \`.openmatrix/tasks/${task.id}/artifacts/\` 目录下创建:

### ai-review-report.md

\`\`\`markdown
# AI Review 报告

## 任务信息
- Task ID: ${task.id}
- 审查时间: [当前时间]

## 总体评价
[✅ 通过 / ⚠️ 需要修改 / ❌ 拒绝]

## 分类评估

### 1. 代码质量
- 评分: [0-100]
- 状态: ✅ / ⚠️ / ❌
- 详情:
  - [具体评价1]
  - [具体评价2]

### 2. 安全性
- 评分: [0-100]
- 状态: ✅ / ⚠️ / ❌
- 详情:
  - [具体评价1]
  - [具体评价2]

### 3. 性能
- 评分: [0-100]
- 状态: ✅ / ⚠️ / ❌
- 详情:
  - [具体评价1]
  - [具体评价2]

### 4. 最佳实践
- 评分: [0-100]
- 状态: ✅ / ⚠️ / ❌
- 详情:
  - [具体评价1]
  - [具体评价2]

### 5. 测试覆盖
- 评分: [0-100]
- 状态: ✅ / ⚠️ / ❌
- 详情:
  - [具体评价1]
  - [具体评价2]

## 问题列表

### 严重 (Critical) - 必须修复
1. [文件:行号] 问题描述
   - 建议: 修复建议

### 重要 (Major) - 强烈建议修复
1. [文件:行号] 问题描述
   - 建议: 修复建议

### 次要 (Minor) - 可选优化
1. [文件:行号] 问题描述

### 建议 (Suggestion) - 改进建议
1. [改进建议]

## 总结
[审查总结和最终建议]
\`\`\`

## 最终输出

根据审查结果，输出以下之一:

**通过:**
\`\`\`
AI_REVIEW_APPROVED
\`\`\`

**需要修改:**
\`\`\`
AI_REVIEW_NEEDS_CHANGES
需要修复的问题:
1. [Critical/Major 问题描述]
\`\`\`

**拒绝:**
\`\`\`
AI_REVIEW_REJECTED
拒绝原因:
1. [严重问题描述]
\`\`\`

## 审查原则

1. **平衡** - 不要过于严苛，也不要过于宽松
2. **实用** - 关注真正重要的问题
3. **建设性** - 提供具体的改进建议
4. **上下文** - 考虑项目的实际情况和约束
5. **渐进** - 允许代码渐进式改进，不要求完美
`;
  }

  /**
   * 解析 AI Review 结果
   */
  parseReviewResult(output: string): ReviewReport {
    const lines = output.split('\n');
    const issues: ReviewIssue[] = [];
    const categories: ReviewCategory[] = [];
    const suggestions: string[] = [];

    let overallStatus: 'approved' | 'needs_changes' | 'rejected' = 'approved';

    // 检查最终状态
    if (output.includes('AI_REVIEW_APPROVED')) {
      overallStatus = 'approved';
    } else if (output.includes('AI_REVIEW_REJECTED')) {
      overallStatus = 'rejected';
    } else if (output.includes('AI_REVIEW_NEEDS_CHANGES')) {
      overallStatus = 'needs_changes';
    }

    // 解析问题
    const criticalSection = output.match(/### 严重[\s\S]*?(?=###|$)/);
    const majorSection = output.match(/### 重要[\s\S]*?(?=###|$)/);
    const minorSection = output.match(/### 次要[\s\S]*?(?=###|$)/);
    const suggestionSection = output.match(/### 建议[\s\S]*?(?=##|$)/);

    if (criticalSection) {
      const items = criticalSection[0].match(/^\d+\..*$/gm) || [];
      items.forEach(item => {
        issues.push({
          severity: 'critical',
          description: item.replace(/^\d+\.\s*/, '').trim()
        });
      });
    }

    if (majorSection) {
      const items = majorSection[0].match(/^\d+\..*$/gm) || [];
      items.forEach(item => {
        issues.push({
          severity: 'major',
          description: item.replace(/^\d+\.\s*/, '').trim()
        });
      });
    }

    if (minorSection) {
      const items = minorSection[0].match(/^\d+\..*$/gm) || [];
      items.forEach(item => {
        issues.push({
          severity: 'minor',
          description: item.replace(/^\d+\.\s*/, '').trim()
        });
      });
    }

    if (suggestionSection) {
      const items = suggestionSection[0].match(/^\d+\..*$/gm) || [];
      items.forEach(item => {
        suggestions.push(item.replace(/^\d+\.\s*/, '').trim());
      });
    }

    // 解析分类评分
    const categoryPatterns = [
      { name: '代码质量', pattern: /### 1\. 代码质量[\s\S]*?- 评分:\s*(\d+)/ },
      { name: '安全性', pattern: /### 2\. 安全性[\s\S]*?- 评分:\s*(\d+)/ },
      { name: '性能', pattern: /### 3\. 性能[\s\S]*?- 评分:\s*(\d+)/ },
      { name: '最佳实践', pattern: /### 4\. 最佳实践[\s\S]*?- 评分:\s*(\d+)/ },
      { name: '测试覆盖', pattern: /### 5\. 测试覆盖[\s\S]*?- 评分:\s*(\d+)/ }
    ];

    for (const { name, pattern } of categoryPatterns) {
      const match = output.match(pattern);
      if (match) {
        const score = parseInt(match[1], 10);
        categories.push({
          name,
          score,
          status: score >= 80 ? 'pass' : score >= 60 ? 'warning' : 'fail',
          details: []
        });
      }
    }

    // 提取总结
    const summaryMatch = output.match(/## 总结\s*([\s\S]*?)(?=```|$)/);
    const summary = summaryMatch ? summaryMatch[1].trim() : '';

    return {
      taskId: '',
      overallStatus,
      categories,
      issues,
      suggestions,
      summary,
      reviewedAt: new Date().toISOString()
    };
  }

  /**
   * 生成验收阶段提示词 (包含 AI Review)
   */
  buildAcceptPrompt(task: Task): string {
    const reviewPrompt = this.buildReviewPrompt(task);

    return `# 验收阶段 (Accept Phase)

## 任务信息
- ID: ${task.id}
- 标题: ${task.title}
- 描述: ${task.description}

## 验收流程

### 1. AI Code Review
执行完整的代码审查:

${reviewPrompt}

### 2. 功能验证
- 确认功能按需求实现
- 检查边界情况处理
- 验证错误处理

### 3. 文档检查
- README 是否更新
- API 文档是否完整
- 注释是否充分

### 4. 最终确认
- 所有测试通过
- AI Review 通过
- 文档已更新
- 可以合并

## 输出要求

在 \`.openmatrix/tasks/${task.id}/artifacts/\` 目录下创建:
- \`accept-report.md\` - 验收报告
- \`ai-review-report.md\` - AI 审查报告

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
`;
  }
}
