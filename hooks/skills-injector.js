#!/usr/bin/env node
/**
 * OpenMatrix Skills Injector - SessionStart Hook
 *
 * This hook runs at session start and injects the skills list with descriptions
 * into the Claude session context.
 *
 * Automatically registered via hooks/hooks.json in the plugin system.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// Get plugin root from environment variable (set by Claude Code)
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT ||
  path.join(os.homedir(), '.claude', 'plugins', 'cache', 'claude-plugins-official', 'openmatrix');

// Skills directory in plugin
const SKILLS_DIR = path.join(PLUGIN_ROOT, 'skills');

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
 * Get all skills from directory
 */
function getSkills() {
  const skills = [];

  if (!fs.existsSync(SKILLS_DIR)) {
    return skills;
  }

  const skillDirs = fs.readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const skillDir of skillDirs) {
    const skillFile = path.join(SKILLS_DIR, skillDir, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;

    const frontmatter = extractFrontmatter(skillFile);
    if (frontmatter && frontmatter.name) {
      skills.push({
        name: frontmatter.name,
        description: frontmatter.description || '',
        priority: frontmatter.priority || 'normal',
        dir: skillDir
      });
    }
  }

  // Sort by priority
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
 * Read the om entry skill content
 */
function getOmEntryContent() {
  const omSkillFile = path.join(SKILLS_DIR, 'om', 'SKILL.md');
  if (fs.existsSync(omSkillFile)) {
    return fs.readFileSync(omSkillFile, 'utf-8');
  }
  return null;
}

/**
 * Escape string for JSON embedding
 */
function escapeForJson(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Format skills list for injection
 */
function formatSkillsContext(skills) {
  const lines = [];

  lines.push('以下 OpenMatrix 技能可用于 Skill 工具：');
  lines.push('');

  // Group by prefix
  const omSkills = skills.filter(s => s.name.startsWith('om:'));
  const otherSkills = skills.filter(s => !s.name.startsWith('om:'));

  // Format om:* skills
  if (omSkills.length > 0) {
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

    if (regular.length > 0) {
      lines.push('## 其他技能');
      for (const skill of regular) {
        if (skill.description) {
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

  return lines.join('\n');
}

// Main execution
try {
  const skills = getSkills();
  const skillsContext = formatSkillsContext(skills);

  // Build the full injection context
  const fullContext = `<EXTREMELY_IMPORTANT>
你已安装 OpenMatrix 插件。

**OpenMatrix 是 AI Agent 任务编排系统，集成了 Claude Code Skills。**

## 核心入口

- \`/om <任务>\` - 默认入口，AI 自动路由到最佳流程
- \`/om:start\` - 标准流程，质量门禁，完整追踪
- \`/om:feature\` - 轻量流程，小需求快速迭代
- \`/om:brainstorm\` - 澄清需求，设计方案
- \`/om:auto\` - 全自动执行，无交互无审批

${skillsContext}

**重要：如果有哪怕 1% 的可能性某个技能适用，你必须调用 Skill 工具检查。**

调用方式：Skill({skill: "om:start", args: "任务描述"})
</EXTREMELY_IMPORTANT>`;

  const escapedContext = escapeForJson(fullContext);

  // Output in Claude Code format
  const output = {
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: escapedContext
    }
  };

  console.log(JSON.stringify(output));
} catch (e) {
  // On error, output empty context
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "SessionStart",
      additionalContext: ""
    }
  }));
}