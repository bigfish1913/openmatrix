// src/orchestrator/question-generator.ts
import type { ParsedTask } from '../types/index.js';

export interface Question {
  id: string;
  question: string;
  type: 'single' | 'multiple' | 'text';
  options?: QuestionOption[];
  required: boolean;
}

export interface QuestionOption {
  key: string;
  label: string;
  description?: string;
}

export class QuestionGenerator {
  generate(parsedTask: ParsedTask): Question[] {
    const questions: Question[] = [];

    // 1. 技术栈选择
    if (this.needsTechStackQuestion(parsedTask)) {
      questions.push(this.createTechStackQuestion());
    }

    // 2. 优先级确认
    if (parsedTask.goals.length > 1) {
      questions.push(this.createPriorityQuestion(parsedTask.goals));
    }

    // 3. 约束条件确认
    if (parsedTask.constraints.length > 0) {
      questions.push(this.createConstraintConfirmation(parsedTask.constraints));
    }

    // 4. 交付物确认
    if (parsedTask.deliverables.length > 0) {
      questions.push(this.createDeliverableConfirmation(parsedTask.deliverables));
    }

    // 5. 测试要求
    questions.push(this.createTestQuestion());

    return questions;
  }

  private needsTechStackQuestion(task: ParsedTask): boolean {
    // 如果任务描述中没有明确提到技术栈，则需要询问
    const techKeywords = ['TypeScript', 'JavaScript', 'React', 'Vue', 'Node', 'Python'];
    const content = task.rawContent.toLowerCase();
    return !techKeywords.some(kw => content.includes(kw.toLowerCase()));
  }

  private createTechStackQuestion(): Question {
    return {
      id: 'tech_stack',
      question: '请选择项目使用的主要技术栈？',
      type: 'multiple',
      required: true,
      options: [
        { key: 'typescript', label: 'TypeScript', description: '类型安全的 JavaScript 超集' },
        { key: 'javascript', label: 'JavaScript', description: '标准 JavaScript' },
        { key: 'react', label: 'React', description: 'React 前端框架' },
        { key: 'vue', label: 'Vue', description: 'Vue 前端框架' },
        { key: 'node', label: 'Node.js', description: 'Node.js 后端运行时' },
        { key: 'python', label: 'Python', description: 'Python 语言' }
      ]
    };
  }

  private createPriorityQuestion(goals: string[]): Question {
    return {
      id: 'priority',
      question: '以下目标中，哪些是核心必须完成的？（可多选）',
      type: 'multiple',
      required: true,
      options: goals.map((goal, index) => ({
        key: `goal_${index}`,
        label: goal
      }))
    };
  }

  private createConstraintConfirmation(constraints: string[]): Question {
    return {
      id: 'constraints_confirm',
      question: '请确认以下约束条件是否正确？',
      type: 'single',
      required: true,
      options: [
        { key: 'confirm', label: '确认正确', description: '所有约束条件都符合预期' },
        { key: 'modify', label: '需要修改', description: '部分约束需要调整' },
        { key: 'ignore', label: '忽略约束', description: '不遵循这些约束条件' }
      ]
    };
  }

  private createDeliverableConfirmation(deliverables: string[]): Question {
    return {
      id: 'deliverables_confirm',
      question: `需要生成以下 ${deliverables.length} 个交付物，是否确认？`,
      type: 'single',
      required: true,
      options: [
        { key: 'confirm', label: '确认', description: '生成所有列出的交付物' },
        { key: 'partial', label: '部分生成', description: '只生成部分交付物' },
        { key: 'custom', label: '自定义', description: '添加或删除某些交付物' }
      ]
    };
  }

  private createTestQuestion(): Question {
    return {
      id: 'test_requirement',
      question: '测试覆盖率要求？',
      type: 'single',
      required: false,
      options: [
        { key: 'high', label: '高 (>80%)', description: '完整的单元测试和集成测试' },
        { key: 'medium', label: '中 (50-80%)', description: '核心功能的测试' },
        { key: 'low', label: '低 (<50%)', description: '仅关键路径测试' },
        { key: 'none', label: '不需要', description: '不生成测试代码' }
      ]
    };
  }
}
