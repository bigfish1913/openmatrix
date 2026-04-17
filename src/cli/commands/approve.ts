// src/cli/commands/approve.ts
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import { ApprovalManager } from '../../orchestrator/approval-manager.js';
import { logger } from '../../utils/logger.js';

export const approveCommand = new Command('approve')
  .description('审批待处理项')
  .argument('[approvalId]', '审批ID')
  .option('-d, --decision <decision>', '决策 (approve/modify/reject)')
  .option('-c, --comment <comment>', '备注说明')
  .option('--json', '输出 JSON 格式 (供 Skill 解析)')
  .action(async (approvalId: string | undefined, options) => {
    const basePath = process.cwd();
    const omPath = `${basePath}/.openmatrix`;

    const stateManager = new StateManager(omPath);
    await stateManager.initialize();

    const approvalManager = new ApprovalManager(stateManager);

    // 如果没有提供审批ID，列出所有待审批
    if (!approvalId) {
      const pendingApprovals = await approvalManager.getPendingApprovals();

      if (pendingApprovals.length === 0) {
        if (options.json) {
          logger.info(JSON.stringify({ status: 'empty', pending: [] }));
        } else {
          logger.info('✅ 没有待处理的审批');
        }
        return;
      }

      if (options.json) {
        logger.info(JSON.stringify({ status: 'pending', pending: pendingApprovals }));
      } else {
        logger.info('📋 待处理审批:\n');
        pendingApprovals.forEach((approval, i) => {
          const typeEmoji = {
            plan: '📋',
            merge: '🔀',
            deploy: '🚀',
            meeting: '🔴',
            custom: '📝'
          };
          const emoji = typeEmoji[approval.type] || '📝';
          logger.info(`  [${i + 1}] ${emoji} ${approval.id}: ${approval.title}`);
          logger.info(`      类型: ${approval.type} | 任务: ${approval.taskId}`);
        });

        logger.info('\n💡 使用 openmatrix approve <ID> 处理审批');
      }
      return;
    }

    // 获取审批
    const approval = await approvalManager.getApproval(approvalId);
    if (!approval) {
      logger.info(`❌ 审批 ${approvalId} 不存在`);
      return;
    }

    if (approval.status !== 'pending') {
      logger.info(`❌ 审批 ${approvalId} 已处理`);
      logger.info(`   状态: ${approval.status}`);
      logger.info(`   决策: ${approval.decision}`);
      return;
    }

    // 如果没有提供决策，显示审批内容
    if (!options.decision) {
      logger.info(`\n📋 审批详情\n`);
      logger.info(`ID: ${approval.id}`);
      logger.info(`类型: ${approval.type}`);
      logger.info(`任务: ${approval.taskId}`);
      logger.info(`\n${approval.content}\n`);

      logger.info('选项:');
      approval.options.forEach(opt => {
        logger.info(`  ${opt.key}: ${opt.label}`);
      });

      logger.info('\n💡 使用 openmatrix approve <ID> -d <decision>');
      return;
    }

    // 处理决策
    const validDecisions = ['approve', 'modify', 'reject'];
    if (!validDecisions.includes(options.decision)) {
      logger.info(`❌ 无效决策: ${options.decision}`);
      logger.info(`   有效选项: ${validDecisions.join(', ')}`);
      return;
    }

    await approvalManager.processDecision({
      approvalId,
      decision: options.decision,
      comment: options.comment,
      decidedBy: 'user',
      decidedAt: new Date().toISOString()
    });

    const statusEmoji = options.decision === 'approve' ? '✅' : '❌';
    logger.info(`\n${statusEmoji} 审批已处理: ${options.decision}`);

    if (options.decision === 'approve') {
      logger.info('\n💡 使用 /om:resume 继续执行任务');
    }
  });
