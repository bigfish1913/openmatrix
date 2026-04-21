// src/orchestrator/meeting-manager.ts
import { StateManager } from '../storage/state-manager.js';
import { ApprovalManager } from './approval-manager.js';
import type { Task, Approval, Meeting, MeetingStatus, MeetingType, AmbiguityReport, AmbiguitySeverity } from '../types/index.js';

// Meeting 类型已在 types/index.ts 中定义，这里不再重复定义

/**
 * MeetingManager - Meeting 管理器
 *
 * 功能:
 * 1. 创建和管理 Meeting
 * 2. 跟踪 Meeting 状态流转
 * 3. 与审批流程集成
 * 4. 自动触发条件检测
 */
export class MeetingManager {
  private stateManager: StateManager;
  private approvalManager: ApprovalManager;

  constructor(
    stateManager: StateManager,
    approvalManager: ApprovalManager
  ) {
    this.stateManager = stateManager;
    this.approvalManager = approvalManager;
  }

  /**
   * 创建阻塞问题 Meeting
   */
  async createBlockingMeeting(
    taskId: string,
    blockingReason: string,
    impactScope: string[]
  ): Promise<{ meeting: Meeting; approval: Approval }> {
    const meetingId = `meeting-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    const meeting: Meeting = {
      id: meetingId,
      type: 'blocking',
      status: 'pending',
      taskId,
      title: `🔴 阻塞问题: ${blockingReason.slice(0, 50)}...`,
      description: `任务 ${taskId} 遇到阻塞问题，需要人工干预`,
      blockingReason,
      impactScope,
      participants: ['user'],
      createdAt: now
    };

    // 保存 Meeting
    await this.stateManager.saveMeeting(meeting);

    // 创建审批
    const approval = await this.approvalManager.createApproval({
      type: 'meeting',
      taskId,
      title: meeting.title,
      description: `
## 阻塞问题描述

**任务**: ${taskId}
**原因**: ${blockingReason}

## 影响范围

${impactScope.map(item => `- ${item}`).join('\n')}

## 需要的行动

请选择以下操作之一:

1. **提供信息** - 提供解决阻塞所需的信息
2. **跳过任务** - 标记任务为可选，跳过继续执行
3. **修改方案** - 调整任务方案或参数
4. **取消执行** - 停止整个执行流程
`,
      content: JSON.stringify({ meetingId, blockingReason, impactScope })
    });

    return { meeting, approval };
  }

  /**
   * 创建决策 Meeting
   */
  async createDecisionMeeting(
    taskId: string,
    decision: string,
    options: string[]
  ): Promise<{ meeting: Meeting; approval: Approval }> {
    const meetingId = `meeting-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    const meeting: Meeting = {
      id: meetingId,
      type: 'decision',
      status: 'pending',
      taskId,
      title: `🤔 需要决策: ${decision.slice(0, 50)}...`,
      description: `需要用户做出技术决策`,
      impactScope: [],
      participants: ['user'],
      createdAt: now
    };

    await this.stateManager.saveMeeting(meeting);

    const approval = await this.approvalManager.createApproval({
      type: 'meeting',
      taskId,
      title: meeting.title,
      description: `
## 决策点

**任务**: ${taskId}
**问题**: ${decision}

## 可选方案

${options.map((opt, i) => `${i + 1}. ${opt}`).join('\n')}

请在审批时提供您的选择。
`,
      content: JSON.stringify({ meetingId, decision, options })
    });

    return { meeting, approval };
  }

  /**
   * 获取严重程度对应的图标和标题前缀
   */
  private getSeverityPrefix(severity: AmbiguitySeverity): string {
    const prefixes: Record<AmbiguitySeverity, string> = {
      critical: '🔴 Critical',
      high: '🟠 High',
      medium: '🟡 Medium',
      low: '🟢 Low'
    };
    return prefixes[severity];
  }

  /**
   * 格式化歧义报告为 Markdown 描述
   */
  private formatAmbiguityReport(report: AmbiguityReport): string {
    const lines: string[] = [];

    lines.push('## 歧义检测结果');
    lines.push('');
    lines.push(`**检测阶段**: ${report.detectionPhase === 'pre_execution' ? '执行前' : '执行中'}`);
    lines.push(`**检测时间**: ${report.detectedAt}`);
    lines.push(`**歧义数量**: ${report.ambiguities.length}`);
    if (report.maxSeverity) {
      lines.push(`**最高严重程度**: ${this.getSeverityPrefix(report.maxSeverity)}`);
    }
    lines.push('');

    lines.push('## 歧义详情');
    lines.push('');

    for (const ambiguity of report.ambiguities) {
      const severityIcon = this.getSeverityPrefix(ambiguity.severity);
      lines.push(`### ${severityIcon} ${ambiguity.type}`);
      lines.push('');
      lines.push(`**描述**: ${ambiguity.description}`);
      lines.push('');

      if (ambiguity.impactScope.length > 0) {
        lines.push('**影响范围**:');
        for (const scope of ambiguity.impactScope) {
          lines.push(`- ${scope}`);
        }
        lines.push('');
      }

      if (ambiguity.possibleSolutions && ambiguity.possibleSolutions.length > 0) {
        lines.push('**可能的解决方案**:');
        for (let i = 0; i < ambiguity.possibleSolutions.length; i++) {
          lines.push(`${i + 1}. ${ambiguity.possibleSolutions[i]}`);
        }
        lines.push('');
      }

      if (ambiguity.relatedFiles && ambiguity.relatedFiles.length > 0) {
        lines.push(`**相关文件**: ${ambiguity.relatedFiles.join(', ')}`);
        lines.push('');
      }

      if (ambiguity.relatedTaskIds && ambiguity.relatedTaskIds.length > 0) {
        lines.push(`**相关任务**: ${ambiguity.relatedTaskIds.join(', ')}`);
        lines.push('');
      }
    }

    if (report.suggestedStrategy) {
      lines.push('## 建议处理策略');
      lines.push('');
      const strategyMap: Record<string, string> = {
        ask_immediate: '立即提问 (ask_immediate)',
        write_meeting: '写入 Meeting (write_meeting)',
        continue: '继续执行 (continue)'
      };
      lines.push(strategyMap[report.suggestedStrategy] || report.suggestedStrategy);
      lines.push('');
    }

    if (report.suggestedQuestions && report.suggestedQuestions.length > 0) {
      lines.push('## 建议的问题');
      lines.push('');
      for (let i = 0; i < report.suggestedQuestions.length; i++) {
        lines.push(`${i + 1}. ${report.suggestedQuestions[i]}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 创建歧义 Meeting
   */
  async createAmbiguityMeeting(
    taskId: string,
    ambiguityReport: AmbiguityReport
  ): Promise<{ meeting: Meeting; approval: Approval }> {
    const meetingId = `meeting-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    // 根据最高严重程度生成标题
    const severity = ambiguityReport.maxSeverity || 'medium';
    const severityPrefix = this.getSeverityPrefix(severity);
    const titleSummary = ambiguityReport.ambiguities[0]?.description.slice(0, 50) || '歧义检测';

    const meeting: Meeting = {
      id: meetingId,
      type: 'ambiguity',
      status: 'pending',
      taskId,
      title: `${severityPrefix}: ${titleSummary}...`,
      description: `任务 ${taskId} 检测到歧义，需要用户确认处理方式`,
      impactScope: ambiguityReport.ambiguities.flatMap(a => a.impactScope),
      participants: ['user'],
      createdAt: now,
      ambiguityReport,
      suggestedQuestions: ambiguityReport.suggestedQuestions
    };

    // 保存 Meeting
    await this.stateManager.saveMeeting(meeting);

    // 创建审批
    const approval = await this.approvalManager.createApproval({
      type: 'meeting',
      taskId,
      title: meeting.title,
      description: this.formatAmbiguityReport(ambiguityReport),
      content: JSON.stringify({ meetingId, ambiguityReport })
    });

    return { meeting, approval };
  }

  /**
   * 开始 Meeting
   */
  async startMeeting(meetingId: string): Promise<Meeting> {
    const meeting = await this.stateManager.getMeeting(meetingId);
    if (!meeting) {
      throw new Error(`Meeting ${meetingId} not found`);
    }

    const updatedMeeting: Meeting = {
      ...meeting,
      status: 'in_progress',
      startedAt: new Date().toISOString()
    };

    await this.stateManager.saveMeeting(updatedMeeting);
    return updatedMeeting;
  }

  /**
   * 解决 Meeting
   */
  async resolveMeeting(
    meetingId: string,
    resolution: string
  ): Promise<Meeting> {
    const meeting = await this.stateManager.getMeeting(meetingId);
    if (!meeting) {
      throw new Error(`Meeting ${meetingId} not found`);
    }

    const updatedMeeting: Meeting = {
      ...meeting,
      status: 'resolved',
      resolution,
      resolvedAt: new Date().toISOString()
    };

    await this.stateManager.saveMeeting(updatedMeeting);

    // 更新关联任务状态
    if (meeting.type === 'blocking') {
      // 将阻塞任务恢复到 pending，让调度器重新调度
      // 阻塞任务可能是 waiting 或 blocked 状态
      const task = await this.stateManager.getTask(meeting.taskId);
      if (task && (task.status === 'waiting' || task.status === 'blocked')) {
        await this.stateManager.updateTask(meeting.taskId, {
          status: 'pending',
          error: undefined
        });
      }
    }

    return updatedMeeting;
  }

  /**
   * 取消 Meeting
   */
  async cancelMeeting(meetingId: string, reason: string): Promise<Meeting> {
    const meeting = await this.stateManager.getMeeting(meetingId);
    if (!meeting) {
      throw new Error(`Meeting ${meetingId} not found`);
    }

    const updatedMeeting: Meeting = {
      ...meeting,
      status: 'cancelled',
      resolution: `Cancelled: ${reason}`,
      resolvedAt: new Date().toISOString()
    };

    await this.stateManager.saveMeeting(updatedMeeting);
    return updatedMeeting;
  }

  /**
   * 获取待处理的 Meeting
   */
  async getPendingMeetings(): Promise<Meeting[]> {
    return this.stateManager.getMeetingsByStatus('pending');
  }

  /**
   * 获取进行中的 Meeting
   */
  async getActiveMeetings(): Promise<Meeting[]> {
    return this.stateManager.getMeetingsByStatus('in_progress');
  }

  /**
   * 检查是否有阻塞的 Meeting
   */
  async hasBlockingMeetings(): Promise<boolean> {
    const pending = await this.getPendingMeetings();
    const active = await this.getActiveMeetings();
    return [...pending, ...active].some(m => m.type === 'blocking');
  }

  /**
   * 生成 Meeting 报告
   */
  generateMeetingReport(meeting: Meeting): string {
    const lines: string[] = [];

    lines.push(`# Meeting 报告: ${meeting.id}`);
    lines.push('');
    lines.push(`**类型**: ${meeting.type}`);
    lines.push(`**状态**: ${meeting.status}`);
    lines.push(`**任务**: ${meeting.taskId}`);
    lines.push(`**创建时间**: ${meeting.createdAt}`);
    lines.push('');

    if (meeting.blockingReason) {
      lines.push('## 阻塞原因');
      lines.push(meeting.blockingReason);
      lines.push('');
    }

    if (meeting.impactScope.length > 0) {
      lines.push('## 影响范围');
      for (const item of meeting.impactScope) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }

    if (meeting.resolution) {
      lines.push('## 解决方案');
      lines.push(meeting.resolution);
      lines.push('');
    }

    if (meeting.resolvedAt) {
      lines.push(`**解决时间**: ${meeting.resolvedAt}`);
    }

    return lines.join('\n');
  }
}
