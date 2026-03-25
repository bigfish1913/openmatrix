import type { ParsedTask } from '../types/index.js';
export declare class TaskParser {
    parse(content: string): ParsedTask;
    private extractTitle;
    private extractDescription;
    private extractSection;
}
