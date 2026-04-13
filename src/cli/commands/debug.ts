// src/cli/commands/debug.ts
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { DebugManager } from '../../orchestrator/debug-manager.js';

export const debugCommand = new Command('debug')
  .description('系统化调试 - 诊断并修复问题')
  .argument('[description]', '问题描述')
  .option('--task <taskId>', '调试指定的失败任务')
  .option('--diagnose-only', '仅诊断，不执行修复')
  .option('--json', '输出 JSON 格式')
  .option('--list', '列出最近的调试会话')
  .action(async (description: string | undefined, options) => {
    const basePath = process.cwd();
    const omPath = `${basePath}/.openmatrix`;

    // 初始化 .openmatrix 目录（如果不存在）
    if (!fs.existsSync(omPath)) {
      console.log('❌ .openmatrix 目录不存在，请先运行: openmatrix start --init-only');
      return;
    }

    const debugManager = new DebugManager(omPath);

    // 列出最近的调试会话
    if (options.list) {
      const sessions = debugManager.listRecent();
      if (sessions.length === 0) {
        console.log('📋 没有调试记录');
        return;
      }

      console.log('📋 最近的调试会话:\n');
      sessions.forEach(s => {
        console.log(`  ${s.id}  ${s.status}  ${s.description}`);
        console.log(`       ${s.createdAt}`);
      });
      return;
    }

    // 如果没有描述也没有任务 ID，提示用户
    if (!description && !options.task) {
      console.log('🔍 系统化调试 - 诊断并修复问题\n');
      console.log('用法:');
      console.log('  openmatrix debug <问题描述>           描述问题开始调试');
      console.log('  openmatrix debug --task TASK-XXX       调试指定失败任务');
      console.log('  openmatrix debug --diagnose-only       仅诊断不修复');
      console.log('  openmatrix debug --list                列出最近调试记录');
      console.log('  openmatrix debug --json                输出 JSON 格式\n');
      console.log('示例:');
      console.log('  openmatrix debug "API 返回 500 错误"');
      console.log('  openmatrix debug --task TASK-003');
      console.log('  openmatrix debug "测试失败" --diagnose-only');
      return;
    }

    // 初始化调试会话
    const result = await debugManager.initialize({
      description,
      taskId: options.task,
      diagnoseOnly: options.diagnoseOnly
    });

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // 展示诊断信息
    console.log('\n🔍 调试会话已初始化');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`会话 ID:    ${result.sessionId}`);
    console.log(`状态:       ${result.status}`);
    console.log(`问题类型:   ${result.problemType}`);
    console.log(`问题描述:   ${result.report.description}`);
    if (result.report.relatedTaskId) {
      console.log(`关联任务:   ${result.report.relatedTaskId}`);
    }
    if (result.report.errorInfo?.message) {
      console.log(`错误信息:   ${result.report.errorInfo.message}`);
    }
    if (result.report.relatedFiles && result.report.relatedFiles.length > 0) {
      console.log(`相关文件:   ${result.report.relatedFiles.join(', ')}`);
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 下一步:');
    console.log('   使用 /om:debug 进入系统化调试流程');
    console.log('   或使用 openmatrix debug --list 查看所有调试记录');
  });
