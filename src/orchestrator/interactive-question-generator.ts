// src/orchestrator/interactive-question-generator.ts
import type { ParsedTask } from '../types/index.js';

/**
 * 交互式问题 - 支持多轮追问
 */
export interface InteractiveQuestion {
  id: string;
  question: string;
  type: 'single' | 'multiple' | 'text' | 'confirm';
  options?: QuestionOption[];
  required: boolean;
  /** 追问条件 - 根据回答触发 */
  followUpCondition?: {
    /** 触发追问的选项 key */
    triggerKeys: string[];
    /** 追问问题 */
    followUpQuestions: InteractiveQuestion[];
  };
  /** 问题分类 */
  category: 'objective' | 'technical' | 'scope' | 'quality' | 'constraint' | 'risk';
  /** 优先级 (1-7, 1 最高) */
  priority: number;
}

export interface QuestionOption {
  key: string;
  label: string;
  description?: string;
}

export interface QuestionAnswer {
  questionId: string;
  selectedKeys: string[];
  textValue?: string;
}

export interface QuestionSession {
  sessionId: string;
  taskId: string;
  questions: InteractiveQuestion[];
  answers: QuestionAnswer[];
  currentQuestionIndex: number;
  status: 'pending' | 'in_progress' | 'completed';
  createdAt: string;
  completedAt?: string;
  /** 推断值 (由 SmartQuestionAnalyzer 提供) */
  inferences?: Map<string, { answer: string | string[]; reason: string }>;
  /** 已跳过的问题 (使用推断值) */
  skippedQuestionIds?: string[];
}

/**
 * InteractiveQuestionGenerator - 交互式问题生成器
 *
 * 特性:
 * 1. 多轮追问 - 根据回答动态生成新问题
 * 2. 优先级排序 - 按重要性顺序提问
 * 3. 条件分支 - 不同回答触发不同追问
 * 4. 交互友好 - 支持单步/批量回答
 * 5. 智能推断 - 支持预设推断值，跳过不必要的问题
 */
export class InteractiveQuestionGenerator {
  private session: QuestionSession | null = null;
  /** 推断值 */
  private inferences: Map<string, { answer: string | string[]; reason: string }> = new Map();
  /** 需要跳过的问题 ID */
  private skippedQuestionIds: Set<string> = new Set();

  /**
   * 设置推断值 (来自 SmartQuestionAnalyzer)
   */
  setInferences(inferences: Map<string, { answer: string | string[]; reason: string }>): void {
    this.inferences = inferences;
    // 高置信度的推断值可以跳过问题
    for (const [questionId] of inferences) {
      this.skippedQuestionIds.add(questionId);
    }
  }

  /**
   * 获取推断值
   */
  getInference(questionId: string): { answer: string | string[]; reason: string } | undefined {
    return this.inferences.get(questionId);
  }

  /**
   * 检查问题是否被跳过 (使用推断值)
   */
  isQuestionSkipped(questionId: string): boolean {
    return this.skippedQuestionIds.has(questionId);
  }

  /**
   * 获取所有跳过的问题及其推断值
   */
  getSkippedQuestions(): Array<{ questionId: string; answer: string | string[]; reason: string }> {
    const result: Array<{ questionId: string; answer: string | string[]; reason: string }> = [];
    for (const questionId of this.skippedQuestionIds) {
      const inference = this.inferences.get(questionId);
      if (inference) {
        result.push({ questionId, ...inference });
      }
    }
    return result;
  }

  /**
   * 开始新的问答会话
   */
  startSession(parsedTask: ParsedTask): QuestionSession {
    const allQuestions = this.generateBaseQuestions(parsedTask);

    // 过滤掉已跳过的问题 (使用推断值)
    const questionsToAsk = allQuestions.filter(q => !this.skippedQuestionIds.has(q.id));

    // 为跳过的问题创建答案
    const skippedAnswers: QuestionAnswer[] = [];
    for (const question of allQuestions) {
      if (this.skippedQuestionIds.has(question.id)) {
        const inference = this.inferences.get(question.id);
        if (inference) {
          const answer: QuestionAnswer = {
            questionId: question.id,
            selectedKeys: Array.isArray(inference.answer) ? inference.answer : [inference.answer]
          };
          skippedAnswers.push(answer);
        }
      }
    }

    this.session = {
      sessionId: `qs-${Date.now().toString(36)}`,
      taskId: parsedTask.title,
      questions: questionsToAsk.sort((a, b) => a.priority - b.priority),
      answers: skippedAnswers, // 预填充跳过问题的答案
      currentQuestionIndex: 0,
      status: 'in_progress',
      createdAt: new Date().toISOString(),
      inferences: this.inferences,
      skippedQuestionIds: Array.from(this.skippedQuestionIds)
    };

    return this.session;
  }

  /**
   * 获取当前问题
   */
  getCurrentQuestion(): InteractiveQuestion | null {
    if (!this.session || this.session.status !== 'in_progress') {
      return null;
    }
    return this.session.questions[this.session.currentQuestionIndex] || null;
  }

  /**
   * 获取下一个问题 (支持交互式逐个提问)
   */
  getNextQuestion(): InteractiveQuestion | null {
    if (!this.session || this.session.status !== 'in_progress') {
      return null;
    }

    // 检查是否有追问
    const lastAnswer = this.session.answers[this.session.answers.length - 1];
    if (lastAnswer) {
      const lastQuestion = this.session.questions.find(q => q.id === lastAnswer.questionId);
      if (lastQuestion?.followUpCondition) {
        const shouldFollowUp = lastQuestion.followUpCondition.triggerKeys.some(
          key => lastAnswer.selectedKeys.includes(key)
        );
        if (shouldFollowUp) {
          // 插入追问到队列
          const followUps = lastQuestion.followUpCondition.followUpQuestions;
          const insertIndex = this.session.currentQuestionIndex + 1;
          this.session.questions.splice(insertIndex, 0, ...followUps);
        }
      }
    }

    this.session.currentQuestionIndex++;

    if (this.session.currentQuestionIndex >= this.session.questions.length) {
      this.session.status = 'completed';
      this.session.completedAt = new Date().toISOString();
      return null;
    }

    return this.session.questions[this.session.currentQuestionIndex];
  }

  /**
   * 回答当前问题
   */
  answerCurrentQuestion(answer: QuestionAnswer): InteractiveQuestion | null {
    if (!this.session) {
      throw new Error('No active session');
    }

    // 记录答案
    this.session.answers.push(answer);

    // 获取下一个问题
    return this.getNextQuestion();
  }

  /**
   * 批量回答问题
   */
  answerMultiple(answers: QuestionAnswer[]): QuestionSession {
    if (!this.session) {
      throw new Error('No active session');
    }

    for (const answer of answers) {
      this.session.answers.push(answer);
    }

    // 处理追问
    for (const answer of answers) {
      const question = this.session.questions.find(q => q.id === answer.questionId);
      if (question?.followUpCondition) {
        const shouldFollowUp = question.followUpCondition.triggerKeys.some(
          key => answer.selectedKeys.includes(key)
        );
        if (shouldFollowUp) {
          this.session.questions.push(...question.followUpCondition.followUpQuestions);
        }
      }
    }

    this.session.status = 'completed';
    this.session.completedAt = new Date().toISOString();

    return this.session;
  }

  /**
   * 获取会话状态
   */
  getSession(): QuestionSession | null {
    return this.session;
  }

  /**
   * 获取所有问题和答案的摘要
   */
  getSummary(): string {
    if (!this.session) {
      return 'No active session';
    }

    const lines: string[] = ['## 问题回答摘要\n'];

    for (const answer of this.session.answers) {
      const question = this.session.questions.find(q => q.id === answer.questionId);
      if (question) {
        const answerText = answer.textValue ||
          answer.selectedKeys.map(k => {
            const opt = question.options?.find(o => o.key === k);
            return opt?.label || k;
          }).join(', ');

        lines.push(`**${question.question}**`);
        lines.push(`> ${answerText}\n`);
      }
    }

    return lines.join('\n');
  }

  /**
   * 生成基础问题集
   */
  private generateBaseQuestions(task: ParsedTask): InteractiveQuestion[] {
    const questions: InteractiveQuestion[] = [];

    // 1. 任务目标
    questions.push({
      id: 'objective',
      question: '这个任务的核心目标是什么？想要解决什么问题？',
      type: 'single',
      required: true,
      category: 'objective',
      priority: 1,
      options: [
        { key: 'new_feature', label: '实现新功能', description: '添加新的功能特性，扩展系统能力' },
        { key: 'bug_fix', label: '修复问题', description: '修复 Bug 或解决已知问题' },
        { key: 'refactor', label: '重构优化', description: '改进代码结构、性能或可维护性' },
        { key: 'other', label: '其他', description: '其他类型任务' }
      ],
      followUpCondition: {
        triggerKeys: ['other'],
        followUpQuestions: [
          {
            id: 'objective_other_detail',
            question: '请详细描述任务目标:',
            type: 'text',
            required: true,
            category: 'objective',
            priority: 1.5
          }
        ]
      }
    });

    // 2. 质量级别
    questions.push({
      id: 'quality_level',
      question: '选择质量门禁级别（决定测试覆盖、Lint、安全扫描等要求）',
      type: 'single',
      required: true,
      category: 'quality',
      priority: 2,
      options: [
        { key: 'strict', label: 'strict', description: 'TDD + 80% 覆盖率 + 严格 Lint + 安全扫描 — 生产级代码' },
        { key: 'balanced', label: 'balanced (推荐)', description: '60% 覆盖率 + Lint + 安全扫描 — 日常开发' },
        { key: 'fast', label: 'fast', description: '无质量门禁 — 快速原型/验证' }
      ]
    });

    // 3. 技术栈
    questions.push({
      id: 'tech_stack',
      question: '使用什么技术栈？',
      type: 'multiple',
      required: true,
      category: 'technical',
      priority: 3,
      options: [
        { key: 'typescript', label: 'TypeScript', description: '类型安全的 JavaScript' },
        { key: 'javascript', label: 'JavaScript', description: '标准 JavaScript' },
        { key: 'react', label: 'React', description: 'React 前端框架' },
        { key: 'vue', label: 'Vue', description: 'Vue 前端框架' },
        { key: 'node', label: 'Node.js', description: 'Node.js 后端' },
        { key: 'python', label: 'Python', description: 'Python 语言' },
        { key: 'other', label: '其他', description: '其他技术栈' }
      ],
      followUpCondition: {
        triggerKeys: ['other'],
        followUpQuestions: [
          {
            id: 'tech_stack_other_detail',
            question: '请描述使用的技术栈:',
            type: 'text',
            required: true,
            category: 'technical',
            priority: 3.5
          }
        ]
      }
    });

    // 4. 执行模式
    questions.push({
      id: 'execution_mode',
      question: '选择执行模式（控制 AI 执行过程中的审批节点）',
      type: 'single',
      required: true,
      category: 'quality',
      priority: 4,
      options: [
        { key: 'auto', label: 'auto (推荐)', description: '全自动执行，无需人工审批，遇到阻塞自动 Meeting' },
        { key: 'confirm-key', label: 'confirm-key', description: '关键节点审批（计划、合并、部署）' },
        { key: 'confirm-all', label: 'confirm-all', description: '每个阶段都需人工确认' }
      ]
    });

    // 5. 测试覆盖率
    questions.push({
      id: 'test_coverage',
      question: '测试覆盖率要求？',
      type: 'single',
      required: true,
      category: 'quality',
      priority: 5,
      options: [
        { key: 'high', label: '>80% (严格)', description: '完整单元测试和集成测试' },
        { key: 'medium', label: '>60% (标准)', description: '核心功能测试' },
        { key: 'low', label: '>40% (基础)', description: '关键路径测试' },
        { key: 'none', label: '无要求', description: '不需要测试' }
      ]
    });

    // 6. 文档要求
    questions.push({
      id: 'documentation_level',
      question: '需要什么级别的文档？',
      type: 'single',
      required: true,
      category: 'quality',
      priority: 6,
      options: [
        { key: 'full', label: '完整文档', description: 'API + 使用指南 + 架构' },
        { key: 'basic', label: '基础文档', description: 'README + API' },
        { key: 'minimal', label: '最小文档', description: '仅 README' },
        { key: 'none', label: '无需文档', description: '不生成文档' }
      ]
    });

    // 7. E2E 测试
    questions.push({
      id: 'e2e_tests',
      question: '是否需要端到端 (E2E) 测试？（适用于 Web/Mobile/GUI 项目，耗时较长）',
      type: 'single',
      required: false,
      category: 'quality',
      priority: 7,
      options: [
        { key: 'functional', label: '功能测试 (推荐)', description: '验证业务流程正确性，无需浏览器可视化，速度快' },
        { key: 'visual', label: '视觉验证', description: '需要浏览器可视化验证，可检查页面样式和布局' },
        { key: 'false', label: '不需要', description: '仅进行单元测试和集成测试，节省时间' }
      ]
    });

    // 8. 风险评估
    questions.push({
      id: 'risks',
      question: '这个任务可能面临哪些风险或挑战？',
      type: 'multiple',
      required: true,
      category: 'risk',
      priority: 8,
      options: [
        { key: 'technical', label: '技术风险', description: '技术实现存在不确定性' },
        { key: 'time', label: '时间风险', description: '需要在短时间内完成' },
        { key: 'compatibility', label: '兼容性风险', description: '可能影响现有功能' },
        { key: 'none', label: '无明显风险', description: '任务清晰，风险可控' }
      ]
    });

    // 9. 验收标准
    questions.push({
      id: 'acceptance',
      question: '如何判断任务完成？有哪些验收标准？',
      type: 'multiple',
      required: true,
      category: 'scope',
      priority: 9,
      options: [
        { key: 'functional', label: '功能完整', description: '所有功能按预期工作' },
        { key: 'tested', label: '测试覆盖', description: '有足够的测试覆盖' },
        { key: 'performance', label: '性能达标', description: '满足性能要求' },
        { key: 'documented', label: '文档完善', description: '有完整的使用文档' }
      ]
    });

    return questions;
  }

  /**
   * 根据任务内容动态添加问题
   */
  addContextualQuestions(task: ParsedTask, questions: InteractiveQuestion[]): InteractiveQuestion[] {
    // 如果有多个目标，询问优先级
    if (task.goals.length > 1) {
      questions.push({
        id: 'goal_priority',
        question: '以下目标中，哪些是核心必须完成的？（可多选）',
        type: 'multiple',
        required: true,
        category: 'scope',
        priority: 1.5,
        options: task.goals.map((goal, index) => ({
          key: `goal_${index}`,
          label: goal.slice(0, 50) + (goal.length > 50 ? '...' : '')
        }))
      });
    }

    // 如果有约束条件，确认是否遵循
    if (task.constraints.length > 0) {
      questions.push({
        id: 'constraints_confirm',
        question: '请确认约束条件:',
        type: 'confirm',
        required: true,
        category: 'constraint',
        priority: 3.5,
        options: [
          { key: 'confirm', label: '确认遵循所有约束', description: '按照约束条件执行' },
          { key: 'modify', label: '需要调整约束', description: '部分约束需要修改' },
          { key: 'ignore', label: '忽略约束', description: '不遵循约束条件' }
        ]
      });
    }

    return questions;
  }
}
