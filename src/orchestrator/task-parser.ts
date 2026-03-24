// src/orchestrator/task-parser.ts
import type { ParsedTask } from '../types/index.js';

export class TaskParser {
  parse(content: string): ParsedTask {
    const title = this.extractTitle(content);
    const goals = this.extractSection(content, '目标');
    const constraints = this.extractSection(content, '约束');
    const deliverables = this.extractSection(content, '交付物');
    const description = this.extractDescription(content);

    return {
      title,
      description,
      goals,
      constraints,
      deliverables,
      rawContent: content
    };
  }

  private extractTitle(content: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : 'Untitled Task';
  }

  private extractDescription(content: string): string {
    // Remove title and sections, get first paragraph
    let desc = content
      .replace(/^#\s+.+$/m, '')
      .replace(/^##\s+.+$/gm, '')
      .replace(/^- .+$/gm, '')
      .trim();

    // Get first non-empty line
    const lines = desc.split('\n').filter(l => l.trim());
    return lines.length > 0 ? lines[0].trim() : '';
  }

  private extractSection(content: string, sectionName: string): string[] {
    // Split content into lines and find the section
    const lines = content.split('\n');
    const items: string[] = [];
    let inSection = false;

    for (const line of lines) {
      // Check if we're entering the target section
      if (line.match(new RegExp(`^##\\s+${sectionName}\\s*$`))) {
        inSection = true;
        continue;
      }

      // Check if we've hit another section
      if (line.match(/^##\s+/)) {
        if (inSection) break; // Exit if we were in the target section
        continue;
      }

      // Extract list items if we're in the target section
      if (inSection) {
        const itemMatch = line.match(/^-\s+(.+)$/);
        if (itemMatch) {
          items.push(itemMatch[1].trim());
        }
      }
    }

    return items;
  }
}
