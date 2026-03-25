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
export declare class QuestionGenerator {
    generate(parsedTask: ParsedTask): Question[];
    private needsTechStackQuestion;
    private createTechStackQuestion;
    private createPriorityQuestion;
    private createConstraintConfirmation;
    private createDeliverableConfirmation;
    private createTestQuestion;
}
