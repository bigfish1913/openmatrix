// src/agents/impl/researcher-agent.ts
import type { Task, AgentType, AgentResult } from '../../types/index.js';

/**
 * Researcher Agent - 调研分析
 *
 * 职责：
 * - 搜索相关资料
 * - 分析技术方案
 * - 总结最佳实践
 * - 提供决策建议
 *
 * 支持动态领域感知，根据任务描述自动适配研究方向
 */
export class ResearcherAgent {
  readonly type: AgentType = 'researcher';
  readonly capabilities = ['search', 'analyze', 'summarize', 'recommend'];

  async execute(task: Task): Promise<AgentResult> {
    const startTime = Date.now();

    try {
      const prompt = this.buildDynamicResearchPrompt(task);

      return {
        runId: this.generateRunId(),
        taskId: task.id,
        agentType: 'researcher',
        status: 'completed',
        output: prompt,
        artifacts: [],
        needsApproval: false,
        duration: Date.now() - startTime,
        completedAt: new Date().toISOString()
      };

    } catch (error) {
      return {
        runId: this.generateRunId(),
        taskId: task.id,
        agentType: 'researcher',
        status: 'failed',
        output: '',
        artifacts: [],
        needsApproval: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        completedAt: new Date().toISOString()
      };
    }
  }

  /**
   * 构建动态领域感知的研究 Prompt
   */
  private buildDynamicResearchPrompt(task: Task): string {
    // 从任务描述中提取领域和角色信息
    const { domain, role, focus } = this.extractResearchContext(task.description);

    return `
# 调研任务

## 研究领域
${domain}

## 角色定位
${role}

## 研究方向
${focus}

## 原始任务描述
${task.description}

## 调研步骤

1. **搜索资料**
   - 使用 WebSearch 搜索领域核心概念
   - 搜索行业标准、最佳实践
   - 搜索主流技术方案和开源项目
   - 搜索常见挑战和解决方案

2. **分析整理**
   - 功能对比
   - 性能特点
   - 社区生态
   - 学习曲线
   - 适用场景

3. **总结发现**
   - 关键信息提炼
   - 优缺点分析
   - 决策建议

## 输出格式

\`\`\`markdown
# ${domain} 调研报告

## 核心发现

[3-5 个关键发现，每个用一句话概括]

1. ...
2. ...
3. ...

## 详细分析

### 发现 1: [标题]
- **描述**: ...
- **关键点**:
  - ...
- **注意事项**: ...

### 发现 2: [标题]
...

## 行业最佳实践

1. ...
2. ...
3. ...

## 关键决策点

[用户需要做出的关键决策]

1. **决策 1**: [决策描述]
   - 选项 A: ... (适用场景)
   - 选项 B: ... (适用场景)
   - 建议: ...

2. **决策 2**: ...

## 推荐方案

**首选方案**: ...

**理由**:
1. ...
2. ...

**备选方案**: ...

## 参考资料

1. [标题](链接)
2. [标题](链接)
\`\`\`

## 开始调研

请使用 WebSearch 和 WebFetch 工具搜索相关信息。
至少搜索 5 个相关关键词，覆盖官方文档、社区讨论、技术博客等维度。
`;
  }

  /**
   * 从任务描述中提取研究上下文
   */
  private extractResearchContext(description: string): { domain: string; role: string; focus: string } {
    const lower = description.toLowerCase();

    // 领域关键词映射
    const domainMap: Array<{ keywords: string[]; domain: string; aspects: string[] }> = [
      {
        keywords: ['游戏', 'game', 'gamedev', 'unity', 'unreal'],
        domain: '游戏开发',
        aspects: ['游戏类型', '目标平台', '技术架构', '美术风格', '盈利模式']
      },
      {
        keywords: ['网站', 'website', 'web app', '门户'],
        domain: 'Web 网站开发',
        aspects: ['功能需求', '用户体验', '技术栈', 'SEO', '性能优化']
      },
      {
        keywords: ['app', '移动应用', 'ios', 'android', 'flutter'],
        domain: '移动应用开发',
        aspects: ['平台选择', '用户界面', '性能优化', '发布流程', '用户增长']
      },
      {
        keywords: ['支付', 'payment', 'stripe', '支付宝'],
        domain: '支付系统',
        aspects: ['支付方式', '安全合规', '风控策略', '对账结算', '国际化']
      },
      {
        keywords: ['电商', 'ecommerce', 'shop', '商城'],
        domain: '电商系统',
        aspects: ['商品管理', '购物流程', '库存物流', '营销工具', '数据分析']
      },
      {
        keywords: ['社交', 'social', 'community', '论坛'],
        domain: '社交平台',
        aspects: ['用户关系', '内容互动', '实时通讯', '内容审核', '推荐算法']
      },
      {
        keywords: ['安全', 'security', 'auth', '认证', '加密'],
        domain: '安全领域',
        aspects: ['威胁模型', '认证授权', '数据保护', '审计监控', '合规要求']
      },
      {
        keywords: ['后台', 'admin', 'dashboard', 'cms', '管理'],
        domain: '后台管理系统',
        aspects: ['权限模型', '数据看板', '工作流程', 'API 设计', '多租户']
      },
      {
        keywords: ['ai', '人工智能', 'ml', '机器学习', '大模型', 'llm'],
        domain: 'AI/机器学习',
        aspects: ['模型选择', '数据处理', '训练部署', '性能优化', '伦理合规']
      },
      {
        keywords: ['区块链', 'blockchain', 'web3', 'defi', 'nft'],
        domain: '区块链',
        aspects: ['链选择', '智能合约', '安全审计', '性能扩展', '合规监管']
      },
      {
        keywords: ['音视频', 'streaming', '直播', 'rtc', 'webrtc'],
        domain: '音视频',
        aspects: ['编解码', '传输协议', '延迟优化', '存储分发', '实时互动']
      }
    ];

    // 查找匹配的领域
    for (const { keywords, domain, aspects } of domainMap) {
      if (keywords.some(kw => lower.includes(kw))) {
        return {
          domain,
          role: `${domain}专家`,
          focus: `请重点调研以下方面: ${aspects.join('、')}`
        };
      }
    }

    // 通用领域：尝试从"做X"模式提取
    const actionPatterns = [
      /做(一个|个)(.+?)(的|app|网站|系统|平台|工具|应用|$)/,
      /开发(一个|个)?(.+?)(系统|应用|平台|工具|$)/,
      /构建(一个|个)?(.+?)(系统|应用|平台|工具|$)/,
      /build (a |an )?(.+?)(app|website|system|tool|platform|$)/i,
    ];

    for (const pattern of actionPatterns) {
      const match = description.match(pattern);
      if (match && match[2]) {
        const extracted = match[2].trim();
        return {
          domain: extracted,
          role: `${extracted}领域专家`,
          focus: `请调研 ${extracted} 的核心概念、技术方案、最佳实践、常见挑战`
        };
      }
    }

    // 默认：使用原始描述
    return {
      domain: '项目开发',
      role: '技术顾问',
      focus: '请调研相关技术方案、最佳实践、实现路径'
    };
  }

  private generateRunId(): string {
    return `researcher-${Date.now().toString(36)}`;
  }
}