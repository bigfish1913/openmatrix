// src/cli/commands/meeting.ts
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import { ApprovalManager } from '../../orchestrator/approval-manager.js';
import { MeetingManager } from '../../orchestrator/meeting-manager.js';
import * as path from 'path';

export const meetingCommand = new Command('meeting')
  .description('查看和处理待确认的 Meeting')
  .argument('[meetingId]', 'Meeting ID (可选)')
  .option('-l, --list', '列出所有待处理 Meeting')
  .option('--action <action>', '操作类型: provide-info, skip, retry, modify, decide, cancel')
  .option('--info <info>', '提供的信息 (用于 provide-info)')
  .option('--message <message>', '备注信息')
  .option('--reason <reason>', '决策理由 (用于 decide)')
  .option('--new-plan <plan>', '新方案 (用于 modify)')
  .option('--skip-all', '跳过所有 Meeting')
  .action(async (meetingId: string | undefined, options) => {
    const basePath = process.cwd();
    const omPath = path.join(basePath, '.openmatrix');

    const stateManager = new StateManager(omPath);
    await stateManager.initialize();

    const approvalManager = new ApprovalManager(stateManager);
    const meetingManager = new MeetingManager(stateManager, approvalManager);

    try {
      // 获取所有 pending 的 meeting approvals
      const pendingApprovals = await stateManager.getApprovalsByStatus('pending');
      const meetingApprovals = pendingApprovals.filter(a => a.type === 'meeting');

      // 列出所有 Meeting
      if (options.list || (!meetingId && !options.skipAll)) {
        // 同时获取 MeetingManager 中的详细 Meeting 信息
        const pendingMeetings = await meetingManager.getPendingMeetings();

        if (meetingApprovals.length === 0 && pendingMeetings.length === 0) {
          console.log('✅ 没有待处理的 Meeting\n');
          const allApprovals = await stateManager.getApprovalsByStatus('approved');
          const resolvedMeetings = allApprovals.filter(a => a.type === 'meeting');
          console.log('当前状态:');
          console.log(`  - 已解决: ${resolvedMeetings.length}`);
          console.log(`  - 总计: ${resolvedMeetings.length}`);
          return;
        }

        console.log(`\n📋 待处理 Meeting (${meetingApprovals.length}个)\n`);

        meetingApprovals.forEach((meeting, index) => {
          const icon = meeting.title.includes('决策') ? '🤔' : '🔴';
          const shortTitle = meeting.title.slice(0, 40);
          console.log(`  [${index + 1}] ${icon} ${meeting.id} - ${shortTitle}`);
          console.log(`       任务: ${meeting.taskId}`);
          if (meeting.content) {
            const content = meeting.content.slice(0, 60).replace(/\n/g, ' ');
            console.log(`       详情: ${content}...`);
          }
          console.log('');
        });

        console.log('💡 提示: 使用 /om:meeting <id> 处理指定 Meeting');
        return;
      }

      // 批量跳过
      if (options.skipAll) {
        console.log(`\n⏭️  批量跳过 ${meetingApprovals.length} 个 Meeting...\n`);

        for (const meeting of meetingApprovals) {
          await approvalManager.processDecision({
            approvalId: meeting.id,
            decision: 'approve',
            comment: options.message || '批量跳过',
            decidedBy: 'user',
            decidedAt: new Date().toISOString()
          });

          // 尝试通过 MeetingManager 解决关联的 Meeting
          try {
            const parsed = JSON.parse(meeting.content || '{}');
            if (parsed.meetingId) {
              await meetingManager.cancelMeeting(parsed.meetingId, options.message || '批量跳过');
            }
          } catch {
            // content 可能不是 JSON，跳过 Meeting 更新
          }

          // 更新关联任务状态为 skipped
          const task = await stateManager.getTask(meeting.taskId);
          if (task) {
            await stateManager.updateTask(meeting.taskId, {
              status: 'completed',
              description: `[SKIPPED] ${task.description}`
            });
          }

          console.log(`  ✓ ${meeting.id} 已跳过`);
        }

        console.log('\n✅ 所有 Meeting 已处理');
        return;
      }

      // 处理指定 Meeting
      if (!meetingId) {
        console.log('❌ 请指定 Meeting ID 或使用 --list');
        return;
      }

      const meeting = meetingApprovals.find(m => m.id === meetingId);
      if (!meeting) {
        console.log(`❌ Meeting ${meetingId} 不存在或已处理`);
        return;
      }

      // 显示 Meeting 详情
      console.log(`\n📋 Meeting: ${meeting.id}`);
      console.log(`🎯 任务: ${meeting.taskId}`);
      console.log(`\n## 详情\n`);
      console.log(meeting.description || '无详细内容');
      console.log('');

      // 执行操作
      const action = options.action;
      if (!action) {
        console.log('💡 可用操作:');
        console.log('  --action provide-info --info "..."');
        console.log('  --action skip --message "..."');
        console.log('  --action retry');
        console.log('  --action modify --new-plan "..."');
        console.log('  --action decide --reason "..."');
        console.log('  --action cancel --message "..."');
        return;
      }

      // 解析关联的 Meeting ID
      let internalMeetingId: string | undefined;
      try {
        const parsed = JSON.parse(meeting.content || '{}');
        internalMeetingId = parsed.meetingId;
      } catch {
        // content 可能不是 JSON
      }

      switch (action) {
        case 'provide-info':
          if (!options.info) {
            console.log('❌ 请提供 --info 参数');
            return;
          }
          await approvalManager.processDecision({
            approvalId: meeting.id,
            decision: 'approve',
            comment: `提供信息: ${options.info}`,
            decidedBy: 'user',
            decidedAt: new Date().toISOString()
          });
          // 通过 MeetingManager 解决关联 Meeting
          if (internalMeetingId) {
            await meetingManager.resolveMeeting(internalMeetingId, `提供信息: ${options.info}`);
          }
          console.log('✅ 信息已记录，任务将恢复执行');
          break;

        case 'skip':
          await approvalManager.processDecision({
            approvalId: meeting.id,
            decision: 'approve',
            comment: options.message || '跳过此任务',
            decidedBy: 'user',
            decidedAt: new Date().toISOString()
          });
          if (internalMeetingId) {
            await meetingManager.cancelMeeting(internalMeetingId, options.message || '跳过');
          }
          // 标记任务为跳过
          const skipTask = await stateManager.getTask(meeting.taskId);
          if (skipTask) {
            await stateManager.updateTask(meeting.taskId, {
              status: 'completed',
              description: `[SKIPPED] ${skipTask.description}`
            });
          }
          console.log('⏭️  任务已跳过，下游任务可继续');
          break;

        case 'retry':
          await approvalManager.processDecision({
            approvalId: meeting.id,
            decision: 'reject',
            comment: '重新执行此任务',
            decidedBy: 'user',
            decidedAt: new Date().toISOString()
          });
          if (internalMeetingId) {
            await meetingManager.resolveMeeting(internalMeetingId, '重试任务');
          }
          // 重置任务状态
          await stateManager.updateTask(meeting.taskId, {
            status: 'retry_queue',
            error: undefined
          });
          console.log('🔄 任务已重置，将重新执行');
          break;

        case 'modify':
          if (!options.newPlan) {
            console.log('❌ 请提供 --new-plan 参数');
            return;
          }
          await approvalManager.processDecision({
            approvalId: meeting.id,
            decision: 'approve',
            comment: `修改方案: ${options.newPlan}`,
            decidedBy: 'user',
            decidedAt: new Date().toISOString()
          });
          if (internalMeetingId) {
            await meetingManager.resolveMeeting(internalMeetingId, `修改方案: ${options.newPlan}`);
          }
          // 更新任务描述
          const modifyTask = await stateManager.getTask(meeting.taskId);
          if (modifyTask) {
            await stateManager.updateTask(meeting.taskId, {
              status: 'pending',
              description: `${modifyTask.description}\n\n[MODIFIED] ${options.newPlan}`,
              error: undefined
            });
          }
          console.log('✅ 方案已修改，任务将重新执行');
          break;

        case 'decide':
          await approvalManager.processDecision({
            approvalId: meeting.id,
            decision: 'approve',
            comment: `决策: ${options.reason || '已做出决策'}`,
            decidedBy: 'user',
            decidedAt: new Date().toISOString()
          });
          if (internalMeetingId) {
            await meetingManager.resolveMeeting(internalMeetingId, `决策: ${options.reason || '已做出决策'}`);
          }
          console.log('✅ 决策已记录');
          break;

        case 'cancel':
          await approvalManager.processDecision({
            approvalId: meeting.id,
            decision: 'reject',
            comment: options.message || '取消此任务',
            decidedBy: 'user',
            decidedAt: new Date().toISOString()
          });
          if (internalMeetingId) {
            await meetingManager.cancelMeeting(internalMeetingId, options.message || '用户取消');
          }
          // 标记任务为失败
          await stateManager.updateTask(meeting.taskId, {
            status: 'failed',
            error: '用户取消'
          });
          console.log('❌ 任务已取消');
          break;

        default:
          console.log(`❌ 未知操作: ${action}`);
          console.log('可用: provide-info, skip, retry, modify, decide, cancel');
      }

    } catch (error) {
      console.error('❌ 处理失败:', error instanceof Error ? error.message : error);
    }
  });
