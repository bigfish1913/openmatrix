"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskParser = void 0;
class TaskParser {
    parse(content) {
        const title = this.extractTitle(content);
        const goals = this.extractSection(content, '目标');
        const constraints = this.extractSection(content, '约束');
        const deliverables = this.extractSection(content, '交付物');
        const description = this.extractDescription(content);
        return {
            title,
            description,
            goals: [...new Set(goals)], // 去重
            constraints: [...new Set(constraints)], // 去重
            deliverables: [...new Set(deliverables)], // 去重
            rawContent: content
        };
    }
    extractTitle(content) {
        const match = content.match(/^#\s+(.+)$/m);
        return match ? match[1].trim() : 'Untitled Task';
    }
    extractDescription(content) {
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
    extractSection(content, sectionName) {
        // Split content into lines and find the section
        const lines = content.split('\n');
        const items = [];
        let inSection = false;
        for (const line of lines) {
            // Check if we're entering the target section
            if (line.match(new RegExp(`^##\\s+${sectionName}\\s*$`))) {
                inSection = true;
                continue;
            }
            // Check if we've hit another section
            if (line.match(/^##\s+/)) {
                if (inSection)
                    break; // Exit if we were in the target section
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
exports.TaskParser = TaskParser;
