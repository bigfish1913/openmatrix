// src/orchestrator/debug-reporter.ts
import * as fs from 'fs';
import * as path from 'path';
import type { DebugSession, DiagnosisReport } from '../types/index.js';

/**
 * 生成和保存诊断报告
 */
export class DebugReporter {
  private debugDir: string;

  constructor(basePath: string) {
    this.debugDir = path.join(basePath, 'debug');
    this.ensureDir();
  }

  /**
   * 生成诊断报告文件
   */
  async generateReport(session: DebugSession): Promise<string> {
    const report = session.report;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${report.id}-report-${timestamp}.md`;
    const filePath = path.join(this.debugDir, fileName);

    const content = this.formatReport(session);
    fs.writeFileSync(filePath, content, 'utf-8');

    return filePath;
  }

  /**
   * 格式化报告内容为 Markdown
   */
  private formatReport(session: DebugSession): string {
    const { report, fixResult, verifyResult } = session;

    let md = `# Debug Report\n\n`;
    md += `**会话 ID**: ${session.id}\n`;
    md += `**日期**: ${session.createdAt}\n`;
    md += `**状态**: ${session.status}\n`;
    if (session.completedAt) {
      md += `**完成时间**: ${session.completedAt}\n`;
    }
    md += `\n---\n\n`;

    // 问题描述
    md += `## 问题描述\n\n${report.description}\n\n`;

    // 问题类型
    md += `## 问题类型\n\n\`${report.problemType}\`\n\n`;
    if (report.relatedTaskId) {
      md += `**关联任务**: ${report.relatedTaskId}\n\n`;
    }

    // 诊断结果
    md += `## 诊断结果\n\n`;
    md += `### 根因\n\n${report.rootCause}\n\n`;

    if (report.errorInfo) {
      md += `### 错误信息\n\n`;
      md += `\`\`\`\n${report.errorInfo.message}\n\`\`\`\n\n`;
      if (report.errorInfo.stack) {
        md += `### 错误栈\n\n\`\`\`\n${report.errorInfo.stack}\n\`\`\`\n\n`;
      }
    }

    // 影响范围
    if (report.impactScope.length > 0) {
      md += `### 影响范围\n\n`;
      report.impactScope.forEach((item: string) => { md += `- ${item}\n`; });
      md += `\n`;
    }

    // 相关文件
    if (report.relatedFiles && report.relatedFiles.length > 0) {
      md += `### 相关文件\n\n`;
      report.relatedFiles.forEach((file: string) => { md += `- \`${file}\`\n`; });
      md += `\n`;
    }

    // 修复建议
    md += `## 修复建议\n\n${report.suggestedFix}\n\n`;

    // 修复操作
    if (fixResult) {
      md += `## 修复操作\n\n`;
      if (fixResult.success) {
        md += `✅ 修复成功\n\n`;
      } else {
        md += `❌ 修复未完全生效\n\n`;
      }

      if (fixResult.modifiedFiles.length > 0) {
        md += `### 修改文件\n\n`;
        fixResult.modifiedFiles.forEach((file: string) => { md += `- \`${file}\`\n`; });
        md += `\n`;
      }

      if (fixResult.operations.length > 0) {
        md += `### 执行操作\n\n`;
        fixResult.operations.forEach((op: string) => { md += `- ${op}\n`; });
        md += `\n`;
      }
    }

    // 验证结果
    if (verifyResult) {
      md += `## 验证结果\n\n`;
      if (verifyResult.passed) {
        md += `✅ 验证通过\n\n`;
      } else {
        md += `❌ 验证未通过\n\n`;
      }
      md += `${verifyResult.details}\n\n`;
    }

    // 重试信息
    if (session.retryCount > 0) {
      md += `## 重试信息\n\n已尝试 ${session.retryCount} 次修复\n\n`;
      if (session.retryCount >= 3) {
        md += `⚠️ **已尝试 3 次以上修复，建议暂停并质疑架构**\n\n`;
      }
    }

    return md;
  }

  /**
   * 列出所有诊断报告
   */
  listReports(): { id: string; path: string; createdAt: string }[] {
    if (!fs.existsSync(this.debugDir)) return [];

    const files = fs.readdirSync(this.debugDir)
      .filter(f => f.endsWith('-report.md') || f.includes('-report-'))
      .sort()
      .reverse();

    return files.map(f => ({
      id: f.split('-')[0],
      path: path.join(this.debugDir, f),
      createdAt: f
    }));
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.debugDir)) {
      fs.mkdirSync(this.debugDir, { recursive: true });
    }
  }
}
