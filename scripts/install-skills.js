#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Change to home directory to avoid cwd issues
process.chdir(os.homedir());

// Get the package directories - use the path relative to this script
const scriptDir = __dirname;
const skillsDir = path.join(scriptDir, '..', 'skills');
const hooksDir = path.join(scriptDir, '..', 'scripts', 'hooks');

// Target directories for different AI coding tools
const targets = [
  {
    name: 'Claude Code',
    dir: path.join(os.homedir(), '.claude', 'commands', 'om'),
    parentDir: path.join(os.homedir(), '.claude', 'commands'),
    hooksDir: path.join(os.homedir(), '.claude', 'hooks'),
    isClaudeCode: true,
  },
  {
    name: 'OpenCode',
    dir: path.join(os.homedir(), '.config', 'opencode', 'commands', 'om'),
    isClaudeCode: false,
  },
];

// Check for MatrixCode installation
const matrixDir = path.join(os.homedir(), '.matrix');
const matrixSkillsDir = path.join(matrixDir, 'skills', 'om');

if (fs.existsSync(matrixDir)) {
  targets.push({
    name: 'MatrixCode',
    dir: matrixSkillsDir,
    isMatrixCode: true,
  });
}

if (!fs.existsSync(skillsDir)) {
  console.log('Skills directory not found, skipping installation.');
  process.exit(0);
}

// Get list of skill files from package
const skillFiles = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));

// Get list of hook files from package (if hooks directory exists)
const hookFiles = fs.existsSync(hooksDir)
  ? fs.readdirSync(hooksDir).filter(f => f.endsWith('.js') || f.endsWith('.py'))
  : [];

// Files to exclude from om/ subfolder (these go to parent directory)
const excludeFromSubfolder = ['om.md', 'openmatrix.md'];

for (const target of targets) {
  try {
    // Create commands directory if it doesn't exist
    if (!fs.existsSync(target.dir)) {
      fs.mkdirSync(target.dir, { recursive: true });
    }

    // Clean old files that no longer exist in source
    if (fs.existsSync(target.dir)) {
      const existingFiles = fs.readdirSync(target.dir).filter(f => f.endsWith('.md'));
      for (const existingFile of existingFiles) {
        if (!skillFiles.includes(existingFile)) {
          const oldFile = path.join(target.dir, existingFile);
          fs.unlinkSync(oldFile);
          console.log(`  🗑️  Removed old file: ${existingFile}`);
        }
      }
    }

    let installed = 0;
    let skipped = 0;

    // Copy skill files to om/ subfolder (excluding om.md and openmatrix.md)
    for (const file of skillFiles) {
      if (excludeFromSubfolder.includes(file)) continue;

      const src = path.join(skillsDir, file);
      const dest = path.join(target.dir, file);
      try {
        fs.copyFileSync(src, dest);
        installed++;
      } catch (copyErr) {
        console.log(`  ⚠️  Skipped: ${file} (${copyErr.message})`);
        skipped++;
      }
    }

    // For Claude Code: install om.md and openmatrix.md to parent directory
    if (target.isClaudeCode && target.parentDir) {
      // Ensure parent directory exists
      if (!fs.existsSync(target.parentDir)) {
        fs.mkdirSync(target.parentDir, { recursive: true });
      }

      // Copy om.md to parent (becomes /om skill)
      const omSrc = path.join(skillsDir, 'om.md');
      const omDest = path.join(target.parentDir, 'om.md');
      if (fs.existsSync(omSrc)) {
        try {
          fs.copyFileSync(omSrc, omDest);
          installed++;
        } catch (copyErr) {
          console.log(`  ⚠️  Skipped: om.md (${copyErr.message})`);
          skipped++;
        }
      }

      // Copy openmatrix.md to parent (becomes /openmatrix skill)
      const openmatrixSrc = path.join(skillsDir, 'openmatrix.md');
      const openmatrixDest = path.join(target.parentDir, 'openmatrix.md');
      if (fs.existsSync(openmatrixSrc)) {
        try {
          fs.copyFileSync(openmatrixSrc, openmatrixDest);
          installed++;
        } catch (copyErr) {
          console.log(`  ⚠️  Skipped: openmatrix.md (${copyErr.message})`);
          skipped++;
        }
      }
    }

    console.log(`✅ ${target.name}: ${installed} skills installed, ${skipped} skipped`);
    if (installed > 0) {
      console.log(`   Location: ${target.dir}`);
      if (target.isClaudeCode) {
        console.log(`   Parent: ${target.parentDir}`);
      }
    }
  } catch (err) {
    console.log(`⚠️  ${target.name}: skipped (${err.message})`);
    console.log(`   Please run: mkdir -p ${target.dir}`);
  }
}

// Install hooks for Claude Code
if (hookFiles.length > 0) {
  const claudeCodeTarget = targets.find(t => t.isClaudeCode);
  if (claudeCodeTarget && claudeCodeTarget.hooksDir) {
    try {
      // Create hooks directory if it doesn't exist
      if (!fs.existsSync(claudeCodeTarget.hooksDir)) {
        fs.mkdirSync(claudeCodeTarget.hooksDir, { recursive: true });
      }

      let hooksInstalled = 0;
      let hooksSkipped = 0;

      // Copy hook files
      for (const file of hookFiles) {
        const src = path.join(hooksDir, file);
        const dest = path.join(claudeCodeTarget.hooksDir, file);
        try {
          fs.copyFileSync(src, dest);
          hooksInstalled++;
        } catch (copyErr) {
          console.log(`  ⚠️  Hook skipped: ${file} (${copyErr.message})`);
          hooksSkipped++;
        }
      }

      if (hooksInstalled > 0) {
        console.log(`✅ Claude Code Hooks: ${hooksInstalled} hooks installed, ${hooksSkipped} skipped`);
        console.log(`   Location: ${claudeCodeTarget.hooksDir}`);
        console.log(`   Note: Add to ~/.claude/settings.json hooks.SessionStart to activate`);
      }
    } catch (err) {
      console.log(`⚠️  Claude Code Hooks: skipped (${err.message})`);
    }
  }
}

console.log('\n💡 Usage:');
console.log('   /om <task>         - Main entry point (AI routes to best workflow)');
console.log('   /om:start          - Standard workflow with quality gates');
console.log('   /om:feature        - Lightweight workflow for small tasks');
console.log('   /om:brainstorm     - Explore requirements before implementation');
console.log('   /openmatrix        - Direct development task routing');