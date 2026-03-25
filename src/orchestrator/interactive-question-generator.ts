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
}

/**
 * InteractiveQuestionGenerator - 交互式问题生成器
 *
 * 特性:
 * 1. 多轮追问 - 根据回答动态生成新问题
 * 2. 优先级排序 - 按重要性顺序提问
 * 3. 条件分支 - 不同回答触发不同追问
 * 4. 交互友好 - 支持单步/批量回答
 */
export class InteractiveQuestionGenerator {
  private session: QuestionSession | null = null;

  /**
   * 开始新的问答会话
   */
  startSession(parsedTask: ParsedTask): QuestionSession {
    const baseQuestions = this.generateBaseQuestions(parsedTask);

    this.session = {
      sessionId: `qs-${Date.now().toString(36)}`,
      taskId: parsedTask.title,
      questions: baseQuestions.sort((a, b) => a.priority - b.priority),
      answers: [],
      currentQuestionIndex: 0,
      status: 'in_progress',
      createdAt: new Date().toISOString()
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

    // 1. 核心目标
    questions.push({
      id: 'objective',
      question: '这个任务的主要目标是什么？',
      type: 'single',
      required: true,
      category: 'objective',
      priority: 1,
      options: [
        { key: 'new_feature', label: '实现新功能', description: '添加新的功能特性' },
        { key: 'bug_fix', label: '修复 Bug', description: '修复已知问题' },
        { key: 'refactor', label: '重构优化', description: '改进代码结构或性能' },
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

    // 2. 技术栈
    questions.push({
      id: 'tech_stack',
      question: '使用什么技术栈？',
      type: 'multiple',
      required: true,
      category: 'technical',
      priority: 2,
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
            priority: 2.5
          }
        ]
      }
    });

    // 3. 数据存储
    questions.push({
      id: 'data_storage',
      question: '需要什么类型的存储？',
      type: 'single',
      required: true,
      category: 'technical',
      priority: 3,
      options: [
        { key: 'postgresql', label: 'PostgreSQL', description: '关系型数据库' },
        { key: 'mongodb', label: 'MongoDB', description: '文档数据库' },
        { key: 'sqlite', label: 'SQLite', description: '本地数据库' },
        { key: 'none', label: '无需存储', description: '不需要数据持久化' }
      ]
    });

    // 4. 认证方式
    questions.push({
      id: 'auth_method',
      question: '需要用户认证吗？',
      type: 'single',
      required: true,
      category: 'technical',
      priority: 4,
      options: [
        { key: 'jwt', label: 'JWT Token', description: '无状态认证' },
        { key: 'oauth', label: 'OAuth 2.0', description: '第三方授权' },
        { key: 'session', label: 'Session Cookie', description: '传统会话' },
        { key: 'none', label: '无需认证', description: '无用户系统' }
      ]
    });

    // 5. API 风格
    questions.push({
      id: 'api_style',
      question: 'API 采用什么风格？',
      type: 'single',
      required: true,
      category: 'technical',
      priority: 5,
      options: [
        { key: 'rest', label: 'RESTful', description: 'REST API' },
        { key: 'graphql', label: 'GraphQL', description: 'GraphQL API' },
        { key: 'grpc', label: 'gRPC', description: '高性能 RPC' },
        { key: 'mixed', label: '混合', description: '多种风格混合' }
      ]
    });

    // 6. 测试要求
    questions.push({
      id: 'test_coverage',
      question: '测试覆盖率要求？',
      type: 'single',
      required: true,
      category: 'quality',
      priority: 6,
      options: [
        { key: 'high', label: '>80% (严格)', description: '完整单元测试和集成测试' },
        { key: 'medium', label: '>60% (标准)', description: '核心功能测试' },
        { key: 'low', label: '>40% (基础)', description: '关键路径测试' },
        { key: 'none', label: '无要求', description: '不需要测试' }
      ]
    });

    // 7. 文档要求
    questions.push({
      id: 'doc_level',
      question: '需要什么级别的文档？',
      type: 'single',
      required: true,
      category: 'quality',
      priority: 7,
      options: [
        { key: 'full', label: '完整文档', description: 'API + 使用指南 + 架构' },
        { key: 'basic', label: '基础文档', description: 'README + API' },
        { key: 'minimal', label: '最小文档', description: '仅 README' },
        { key: 'none', label: '无需文档', description: '不生成文档' }
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
