// src/cli/commands/approve.ts
import { Command } from 'commander';
import { StateManager } from '../../storage/state-manager.js';
import { ApprovalManager } from '../../orchestrator/approval-manager.js';

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
          console.log(JSON.stringify({ status: 'empty', pending: [] }));
        } else {
          console.log('✅ 没有待处理的审批');
        }
        return;
      }

      if (options.json) {
        console.log(JSON.stringify({ status: 'pending', pending: pendingApprovals }));
      } else {
        console.log('📋 待处理审批:\n');
        pendingApprovals.forEach((approval, i) => {
          const typeEmoji = {
            plan: '📋',
            merge: '🔀',
            deploy: '🚀',
            meeting: '🔴',
            custom: '📝'
          };
          const emoji = typeEmoji[approval.type] || '📝';
          console.log(`  [${i + 1}] ${emoji} ${approval.id}: ${approval.title}`);
          console.log(`      类型: ${approval.type} | 任务: ${approval.taskId}`);
        });

        console.log('\n💡 使用 openmatrix approve <ID> 处理审批');
      }
      return;
    }

    // 获取审批
    const approval = await approvalManager.getApproval(approvalId);
    if (!approval) {
      console.log(`❌ 审批 ${approvalId} 不存在`);
      return;
    }

    if (approval.status !== 'pending') {
      console.log(`❌ 审批 ${approvalId} 已处理`);
      console.log(`   状态: ${approval.status}`);
      console.log(`   决策: ${approval.decision}`);
      return;
    }

    // 如果没有提供决策，显示审批内容
    if (!options.decision) {
      console.log(`\n📋 审批详情\n`);
      console.log(`ID: ${approval.id}`);
      console.log(`类型: ${approval.type}`);
      console.log(`任务: ${approval.taskId}`);
      console.log(`\n${approval.content}\n`);

      console.log('选项:');
      approval.options.forEach(opt => {
        console.log(`  ${opt.key}: ${opt.label}`);
      });

      console.log('\n💡 使用 openmatrix approve <ID> -d <decision>');
      return;
    }

    // 处理决策
    const validDecisions = ['approve', 'modify', 'reject'];
    if (!validDecisions.includes(options.decision)) {
      console.log(`❌ 无效决策: ${options.decision}`);
      console.log(`   有效选项: ${validDecisions.join(', ')}`);
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
    console.log(`\n${statusEmoji} 审批已处理: ${options.decision}`);

    if (options.decision === 'approve') {
      console.log('\n💡 使用 /om:resume 继续执行任务');
    }
  });
