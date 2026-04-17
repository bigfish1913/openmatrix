// src/cli/commands/analyze.ts
import { Command } from 'commander';
import { SmartQuestionAnalyzer, type AnalysisResult } from '../../orchestrator/smart-question-analyzer.js';
import { logger } from '../../utils/logger.js';

/**
 * CLI 选项接口
 */
interface AnalyzeOptions {
  json?: boolean;
}

export const analyzeCommand = new Command('analyze')
  .description('智能分析任务，推断配置，返回需要确认的问题列表')
  .argument('[task]', '任务描述')
  .option('--json', '输出 JSON 格式')
  .action(async (task: string | undefined, options: AnalyzeOptions) => {
    const analyzer = new SmartQuestionAnalyzer(process.cwd());

    if (!task) {
      if (options.json) {
        logger.info(JSON.stringify({
          status: 'error',
          message: '请提供任务描述'
        }));
      } else {
        logger.info('❌ 请提供任务描述');
        logger.info('   用法: openmatrix analyze "实现用户登录功能"');
      }
      return;
    }

    try {
      const result = await analyzer.analyze(task);

      if (options.json) {
        // 输出 JSON 格式 (供 Skill 解析)
        const output: AnalysisResult = result;
        logger.info(JSON.stringify(output, null, 2));
      } else {
        // 输出人类可读格式
        logger.info('\n' + analyzer.generateSummary(result));
      }
    } catch (error) {
      if (options.json) {
        logger.info(JSON.stringify({
          status: 'error',
          message: error instanceof Error ? error.message : '分析失败'
        }));
      } else {
        logger.info('❌ 分析失败: ' + (error instanceof Error ? error.message : '未知错误'));
      }
    }
  });