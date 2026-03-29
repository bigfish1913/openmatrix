// src/cli/commands/research.ts
import { Command } from 'commander';
import { ensureOpenmatrixGitignore } from '../../utils/gitignore.js';
import type { ResearchAgentConfig, ResearchSession } from '../../types/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * CLI 选项接口
 */
interface ResearchOptions {
  json?: boolean;
  confirm?: boolean;
  complete?: boolean;
  results?: string;
}

/**
 * 生成并行研究 Agent 配置
 */
function generateAgents(topic: string, domain: string, aspects: string[]): ResearchAgentConfig[] {
  return [
    {
      role: 'domain_researcher',
      focus: `搜索 ${domain} 领域的核心概念、行业标准、最佳实践。关键词: ${aspects.slice(0, 4).join(', ')}`,
      status: 'pending' as const
    },
    {
      role: 'tech_explorer',
      focus: `搜索 ${domain} 的主流技术方案、开源项目、技术栈选择、架构模式`,
      status: 'pending' as const
    },
    {
      role: 'scenario_analyst',
      focus: `结合用户具体需求 "${topic}"，分析实际应用场景、常见挑战、经验教训`,
      status: 'pending' as const
    }
  ];
}

export const researchCommand = new Command('research')
  .description('领域调研和问题探索 - 为后续任务提供知识基础')
  .argument('[topic]', '研究主题')
  .option('--json', '输出 JSON 格式 (供 Skill 解析)')
  .option('--confirm', '确认进入深度研究 (从 Skill 传入)')
  .option('--complete', '标记研究完成，生成报告和任务上下文')
  .option('--results <json>', '研究结果 JSON (从 Skill 传入)')
  .action(async (topic: string | undefined, options: ResearchOptions) => {
    const basePath = process.cwd();
    const omPath = path.join(basePath, '.openmatrix');
    const researchPath = path.join(omPath, 'research');
    const knowledgePath = path.join(researchPath, 'knowledge');

    // 确保目录存在
    await fs.mkdir(omPath, { recursive: true });
    await fs.mkdir(researchPath, { recursive: true });
    await fs.mkdir(knowledgePath, { recursive: true });

    // 确保 .openmatrix 被 git 忽略
    await ensureOpenmatrixGitignore(basePath);

    const sessionPath = path.join(researchPath, 'session.json');

    // ========== --complete 模式: 研究完成，汇总结果 ==========
    if (options.complete) {
      try {
        const sessionData = await fs.readFile(sessionPath, 'utf-8');
        const session: ResearchSession = JSON.parse(sessionData);

        // 如果传入了结果，合并
        if (options.results) {
          try {
            const results = JSON.parse(options.results);
            if (results.agents) session.agents = results.agents;
            if (results.report) session.report = results.report;
            if (results.knowledge) session.knowledge = [...session.knowledge, ...results.knowledge];
            if (results.context) session.context = results.context;
            if (results.domainQuestions) session.domainQuestions = results.domainQuestions;
            if (results.answers) session.answers = { ...session.answers, ...results.answers };
          } catch {
            // 忽略解析错误
          }
        }

        session.status = 'completed';
        session.completedAt = new Date().toISOString();

        await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));

        // 写入研究报告
        if (session.report) {
          await fs.writeFile(
            path.join(researchPath, 'RESEARCH.md'),
            session.report,
            'utf-8'
          );
        }

        // 写入知识条目
        for (let i = 0; i < session.knowledge.length; i++) {
          await fs.writeFile(
            path.join(knowledgePath, `finding-${i + 1}.md`),
            session.knowledge[i],
            'utf-8'
          );
        }

        // 写入任务上下文 (供 start 使用)
        const taskContext = session.context || { goals: [], constraints: [], deliverables: [] };
        await fs.writeFile(
          path.join(researchPath, 'context.json'),
          JSON.stringify({
            topic: session.topic,
            domain: session.domain,
            ...taskContext,
            reportPath: '.openmatrix/research/RESEARCH.md',
            knowledgePath: '.openmatrix/research/knowledge/'
          }, null, 2),
          'utf-8'
        );

        if (options.json) {
          console.log(JSON.stringify({
            status: 'completed',
            message: '研究完成',
            topic: session.topic,
            domain: session.domain,
            report: session.report,
            knowledge: session.knowledge,
            context: taskContext,
            reportPath: '.openmatrix/research/RESEARCH.md',
            hint: '研究结果已保存，可以使用 /om:start 开始执行任务'
          }));
        } else {
          console.log('研究完成!');
          console.log(`   主题: ${session.topic}`);
          console.log(`   领域: ${session.domain}`);
          console.log(`   知识条目: ${session.knowledge.length} 个`);
          console.log('\n使用 /om:start 基于研究结果开始任务');
        }
        return;
      } catch {
        if (options.json) {
          console.log(JSON.stringify({ status: 'error', message: '没有进行中的研究会话' }));
        } else {
          console.log('没有进行中的研究会话');
          console.log('   使用 openmatrix research <topic> 开始新的研究');
        }
        return;
      }
    }

    // ========== --confirm 模式: 用户确认后进入深度研究 ==========
    if (options.confirm) {
      try {
        const sessionData = await fs.readFile(sessionPath, 'utf-8');
        const session: ResearchSession = JSON.parse(sessionData);

        if (session.status !== 'preview') {
          if (options.json) {
            console.log(JSON.stringify({ status: 'error', message: `当前状态为 ${session.status}，无法确认` }));
          } else {
            console.log(`当前状态为 ${session.status}，无法确认`);
          }
          return;
        }

        // 生成研究 Agent
        const agents = generateAgents(session.topic, session.domain, session.aspects);
        session.status = 'researching';
        session.agents = agents;

        await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));

        if (options.json) {
          console.log(JSON.stringify({
            status: 'researching',
            message: '开始深度研究',
            topic: session.topic,
            domain: session.domain,
            aspects: session.aspects,
            agents: agents.map(a => ({ role: a.role, focus: a.focus, status: a.status })),
            hint: '使用 Agent 工具并行执行研究'
          }));
        } else {
          console.log('\n开始深度研究...\n');
          console.log(`  主题: ${session.topic}`);
          console.log(`  领域: ${session.domain}`);
          console.log('\n研究 Agent:');
          agents.forEach((a, i) => {
            console.log(`  ${i + 1}. [${a.role}] ${a.focus}`);
          });
        }
        return;
      } catch {
        if (options.json) {
          console.log(JSON.stringify({ status: 'error', message: '没有待确认的研究会话' }));
        } else {
          console.log('没有待确认的研究会话');
        }
        return;
      }
    }

    // ========== 初始模式: 创建会话，等待 AI 分析 ==========
    let researchTopic = topic;
    if (!researchTopic) {
      const defaultPath = path.join(basePath, 'RESEARCH.md');
      try {
        const content = await fs.readFile(defaultPath, 'utf-8');
        const lines = content.split('\n');
        for (const line of lines) {
          const match = line.match(/^#\s+(.+)$/);
          if (match) {
            researchTopic = match[1].trim();
            break;
          }
        }
        if (!researchTopic) researchTopic = content.slice(0, 100).trim();
        if (!options.json) console.log(`读取研究文件: ${defaultPath}`);
      } catch {
        if (options.json) {
          console.log(JSON.stringify({ status: 'error', message: '请提供研究主题' }));
        } else {
          console.log('请提供研究主题');
          console.log('   用法: openmatrix research <topic>');
          console.log('   或创建 RESEARCH.md 文件');
        }
        return;
      }
    }

    // 创建初始会话 - 领域信息由 Agent 分析后更新
    const session: ResearchSession = {
      status: 'initialized',
      topic: researchTopic,
      domain: '',
      aspects: [],
      estimatedQuestions: 0,
      agents: [],
      domainQuestions: [],
      answers: {},
      knowledge: [],
      createdAt: new Date().toISOString()
    };

    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));

    if (options.json) {
      console.log(JSON.stringify({
        status: 'initialized',
        message: '研究会话已创建，需要 AI 分析领域',
        topic: researchTopic,
        hint: '请使用 Agent 分析主题，识别领域和调研方向，然后更新会话并展示给用户确认'
      }));
    } else {
      console.log(`\n研究主题: ${researchTopic}`);
      console.log('使用 /om:research 技能启动 AI 分析');
    }
  });
