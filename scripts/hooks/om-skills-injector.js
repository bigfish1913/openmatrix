#!/usr/bin/env node
/**
 * OpenMatrix Skills Injector Hook
 *
 * This hook runs at SessionStart and injects the skills list with descriptions
 * into the Claude session context.
 *
 * Location: ~/.claude/hooks/om-skills-injector.js
 * Config: Add to SessionStart hooks in ~/.claude/settings.json
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// Skills directories to scan
const SKILLS_DIRS = [
  path.join(os.homedir(), '.claude', 'commands', 'om'),      // OpenMatrix skills (om:*)
  path.join(os.homedir(), '.claude', 'commands'),            // Root commands (om, openmatrix)
];

// Files to exclude
const EXCLUDE_FILES = ['om.md', 'openmatrix.md', 'openmatrix-overview.md'];

// Skills to highlight (most commonly used)
const HIGHLIGHT_SKILLS = ['start', 'feature', 'debug', 'deploy', 'test', 'status'];

/**
 * Extract frontmatter from markdown file
 */
function extractFrontmatter(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    // Handle both \n and \r\n line endings
    const normalizedContent = content.replace(/\r\n/g, '\n');
    const match = normalizedContent.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return null;

    const frontmatter = {};
    match[1].split('\n').forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();
        // Remove quotes
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        frontmatter[key] = value;
      }
    });

    return frontmatter;
  } catch (e) {
    return null;
  }
}

/**
 * Get all skills from directories
 */
function getSkills() {
  const skills = [];

  for (const dir of SKILLS_DIRS) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      if (EXCLUDE_FILES.includes(file)) continue;

      const filePath = path.join(dir, file);
      const frontmatter = extractFrontmatter(filePath);

      if (frontmatter && frontmatter.name) {
        const skillName = frontmatter.name;
        const description = frontmatter.description || '';
        const priority = frontmatter.priority || 'normal';

        skills.push({
          name: skillName,
          description: description,
          priority: priority,
          file: file
        });
      }
    }
  }

  // Sort by priority (critical > high > normal > low)
  const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
  skills.sort((a, b) => {
    const pa = priorityOrder[a.priority] || 2;
    const pb = priorityOrder[b.priority] || 2;
    if (pa !== pb) return pa - pb;
    return a.name.localeCompare(b.name);
  });

  return skills;
}

/**
 * Format skills list for injection
 */
function formatSkillsContext(skills) {
  const lines = [];

  lines.push('<system-reminder>');
  lines.push('以下 OpenMatrix 技能可用于 Skill 工具：');
  lines.push('');

  // Group by prefix
  const omSkills = skills.filter(s => s.name.startsWith('om:'));
  const otherSkills = skills.filter(s => !s.name.startsWith('om:'));

  // Format om:* skills
  if (omSkills.length > 0) {
    // Highlight commonly used skills first
    const highlighted = [];
    const regular = [];

    for (const skill of omSkills) {
      const baseName = skill.name.replace('om:', '');
      if (HIGHLIGHT_SKILLS.includes(baseName)) {
        highlighted.push(skill);
      } else {
        regular.push(skill);
      }
    }

    // Show highlighted skills with full description
    if (highlighted.length > 0) {
      lines.push('## 常用技能');
      for (const skill of highlighted) {
        if (skill.description) {
          lines.push(`- **${skill.name}**: ${skill.description}`);
        } else {
          lines.push(`- **${skill.name}**`);
        }
      }
      lines.push('');
    }

    // Show other skills
    if (regular.length > 0) {
      lines.push('## 其他技能');
      for (const skill of regular) {
        if (skill.description) {
          // Truncate long descriptions
          const desc = skill.description.length > 100
            ? skill.description.slice(0, 100) + '...'
            : skill.description;
          lines.push(`- ${skill.name}: ${desc}`);
        } else {
          lines.push(`- ${skill.name}`);
        }
      }
      lines.push('');
    }
  }

  // Show other skills
  if (otherSkills.length > 0) {
    lines.push('## 基础入口');
    for (const skill of otherSkills) {
      if (skill.description) {
        lines.push(`- **${skill.name}**: ${skill.description}`);
      } else {
        lines.push(`- **${skill.name}**`);
      }
    }
    lines.push('');
  }

  lines.push('使用 Skill 工具调用技能，例如: Skill({skill: "om:start", args: "实现登录功能"})');
  lines.push('</system-reminder>');

  return lines.join('\n');
}

// Main execution
try {
  const skills = getSkills();
  const context = formatSkillsContext(skills);

  const output = {
    context: context
  };

  console.log(JSON.stringify(output));
} catch (e) {
  // On error, output empty context
  console.log(JSON.stringify({ context: '' }));
}