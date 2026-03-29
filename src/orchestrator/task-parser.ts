// src/orchestrator/task-parser.ts
import type { ParsedTask } from '../types/index.js';

export class TaskParser {
  parse(content: string): ParsedTask {
    const title = this.extractTitle(content);
    const goals = this.extractSection(content, '目标');
    const constraints = this.extractSection(content, '约束');
    const deliverables = this.extractSection(content, '交付物');
    const description = this.extractDescription(content);

    // Fallback: 当 markdown section 未提取到 goals 时，智能提取
    const finalGoals = goals.length > 0
      ? goals
      : this.extractGoalsFromPlainText(content, title);

    // Fallback: 当无 deliverables 时，从 goals 推断
    const finalDeliverables = deliverables.length > 0
      ? deliverables
      : finalGoals.map(g => `${g} 的实现`);

    return {
      title,
      description: description || (finalGoals.length > 0 ? finalGoals[0] : title),
      goals: [...new Set(finalGoals)],
      constraints: [...new Set(constraints)],
      deliverables: [...new Set(finalDeliverables)],
      rawContent: content
    };
  }

  private extractTitle(content: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : 'Untitled Task';
  }

  private extractDescription(content: string): string {
    // Remove title line
    let desc = content.replace(/^#\s+.+$/m, '').trim();

    // Remove section headers
    desc = desc.replace(/^##\s+.+$/gm, '').trim();

    // Get first non-empty, non-list line as description
    const lines = desc.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const trimmed = line.trim();
      // Skip list items, section headers
      if (/^[-*]\s+/.test(trimmed)) continue;
      if (/^\d+\.\s+/.test(trimmed)) continue;
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
    return '';
  }

  private extractSection(content: string, sectionName: string): string[] {
    const lines = content.split('\n');
    const items: string[] = [];
    let inSection = false;

    for (const line of lines) {
      if (line.match(new RegExp(`^##\\s+${sectionName}\\s*$`))) {
        inSection = true;
        continue;
      }

      if (line.match(/^##\s+/)) {
        if (inSection) break;
        continue;
      }

      if (inSection) {
        const itemMatch = line.match(/^-\s+(.+)$/);
        if (itemMatch) {
          items.push(itemMatch[1].trim());
        }
      }
    }

    return items;
  }

  /**
   * 从纯文本中智能提取 goals
   *
   * 策略优先级:
   * 1. 有序列表 (1. xxx, 2. xxx)
   * 2. 无序列表 (- xxx, * xxx)
   * 3. 分号/换行分隔的多行描述
   * 4. 将标题作为唯一 goal
   */
  private extractGoalsFromPlainText(content: string, title: string): string[] {
    const goals: string[] = [];
    const cleanContent = content
      .replace(/^#\s+.+$/m, '')     // 去标题
      .replace(/^##\s+.+$/gm, '')   // 去section标题
      .trim();

    // 策略1: 有序列表 (1. xxx, 2. xxx, ...)
    const orderedItems = this.extractOrderedItems(cleanContent);
    if (orderedItems.length > 0) {
      return orderedItems;
    }

    // 策略2: 无序列表 (- xxx, * xxx)
    const unorderedItems = this.extractUnorderedItems(cleanContent);
    if (unorderedItems.length > 0) {
      return unorderedItems;
    }

    // 策略3: 多行文本，按句号/分号拆分为多个 goal
    const sentences = this.extractSentences(cleanContent);
    if (sentences.length > 1) {
      return sentences;
    }

    // 策略4: 单个句子作为唯一 goal
    if (sentences.length === 1 && sentences[0].length > 0) {
      return sentences;
    }

    // 策略5: 将标题作为唯一 goal
    if (title && title !== 'Untitled Task') {
      return [title];
    }

    return goals;
  }

  /**
   * 提取有序列表项
   */
  private extractOrderedItems(text: string): string[] {
    const items: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const match = line.trim().match(/^\d+[.、)\s]+(.+)$/);
      if (match) {
        const item = match[1].trim();
        if (item.length > 0) {
          items.push(item);
        }
      }
    }

    return items;
  }

  /**
   * 提取无序列表项
   */
  private extractUnorderedItems(text: string): string[] {
    const items: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const match = line.trim().match(/^[-*]\s+(.+)$/);
      if (match) {
        const item = match[1].trim();
        if (item.length > 0) {
          items.push(item);
        }
      }
    }

    return items;
  }

  /**
   * 从文本中提取句子作为 goals
   */
  private extractSentences(text: string): string[] {
    if (!text || text.trim().length === 0) return [];

    // 按中文句号、英文句号、分号拆分
    const sentences = text
      .split(/[。；\n]/)
      .map(s => s.replace(/[.;]/g, '').trim())
      .filter(s => s.length > 2); // 过滤太短的片段

    return sentences;
  }
}
