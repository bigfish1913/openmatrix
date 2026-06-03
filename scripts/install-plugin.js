#!/usr/bin/env node
/**
 * OpenMatrix Plugin Installer
 *
 * Installs OpenMatrix as a Claude Code plugin with automatic hook registration.
 *
 * Installation locations:
 * - Skills: ~/.claude/plugins/cache/claude-plugins-official/openmatrix/skills/
 * - Hooks: ~/.claude/plugins/cache/claude-plugins-official/openmatrix/hooks/
 * - Plugin config: ~/.claude/plugins/cache/claude-plugins-official/openmatrix/.claude-plugin/
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Change to home directory to avoid cwd issues
process.chdir(os.homedir());

// Get the package directories
const scriptDir = __dirname;
const packageRoot = path.join(scriptDir, '..');
const skillsSourceDir = path.join(packageRoot, 'skills');
const hooksSourceDir = path.join(packageRoot, 'hooks');
const pluginConfigSourceDir = path.join(packageRoot, '.claude-plugin');

// Plugin installation target
const PLUGIN_TARGET = {
  name: 'Claude Code Plugin',
  baseDir: path.join(os.homedir(), '.claude', 'plugins', 'cache', 'claude-plugins-official', 'openmatrix'),
  versionDir: null,  // Will be set based on package.json version
};

// Legacy skills installation (for users not using plugin system)
const LEGACY_TARGETS = [
  {
    name: 'Claude Code (Legacy)',
    dir: path.join(os.homedir(), '.claude', 'commands', 'om'),
    parentDir: path.join(os.homedir(), '.claude', 'commands'),
    isClaudeCode: true,
  },
  {
    name: 'OpenCode',
    dir: path.join(os.homedir(), '.config', 'opencode', 'commands', 'om'),
    isClaudeCode: false,
  },
];

// Get version from package.json
function getVersion() {
  try {
    const packageJson = path.join(packageRoot, 'package.json');
    const content = fs.readFileSync(packageJson, 'utf-8');
    const pkg = JSON.parse(content);
    return pkg.version || '0.0.0';
  } catch (e) {
    return '0.0.0';
  }
}

// Ensure directory exists
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Copy directory recursively, but only copy skill directories (not flat .md files)
function copySkillsDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    // Skip flat .md files and non-skill directories
    if (entry.isFile() && entry.name.endsWith('.md')) {
      // Skip flat .md files in skills directory (these are for legacy mode)
      continue;
    }
    if (entry.name === 'review') {
      // Skip review directory (not a valid skill)
      continue;
    }

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      // Check if it's a valid skill directory (has SKILL.md)
      const skillFile = path.join(srcPath, 'SKILL.md');
      if (fs.existsSync(skillFile)) {
        ensureDir(destPath);
        fs.copyFileSync(skillFile, path.join(destPath, 'SKILL.md'));
      }
    }
  }
}

// Copy directory recursively (for hooks and .claude-plugin)
function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Install as Claude Code plugin
function installPlugin() {
  const version = getVersion();
  PLUGIN_TARGET.versionDir = path.join(PLUGIN_TARGET.baseDir, version);

  console.log('\n📦 Installing OpenMatrix as Claude Code Plugin...\n');
  console.log(`   Version: ${version}`);
  console.log(`   Target: ${PLUGIN_TARGET.versionDir}`);

  try {
    ensureDir(PLUGIN_TARGET.versionDir);

    // 1. Install plugin config (.claude-plugin/)
    if (fs.existsSync(pluginConfigSourceDir)) {
      const dest = path.join(PLUGIN_TARGET.versionDir, '.claude-plugin');
      copyDir(pluginConfigSourceDir, dest);
      console.log('   ✅ Plugin config installed');
    }

    // 2. Install hooks (hooks/)
    if (fs.existsSync(hooksSourceDir)) {
      const dest = path.join(PLUGIN_TARGET.versionDir, 'hooks');
      copyDir(hooksSourceDir, dest);
      console.log('   ✅ Hooks installed (auto-registered via hooks.json)');
    }

    // 3. Install skills (skills/) - only copy directories with SKILL.md
    if (fs.existsSync(skillsSourceDir)) {
      const dest = path.join(PLUGIN_TARGET.versionDir, 'skills');
      copySkillsDir(skillsSourceDir, dest);
      console.log('   ✅ Skills installed');
    }

    // 4. Update installed_plugins.json
    updateInstalledPlugins(version);

    console.log('\n✅ Plugin installation complete!');
    console.log('   Hooks will automatically run at SessionStart.');
    console.log('   No manual settings.json configuration needed.\n');

    return true;
  } catch (e) {
    console.log(`   ⚠️ Plugin installation failed: ${e.message}`);
    return false;
  }
}

// Update installed_plugins.json to register the plugin
function updateInstalledPlugins(version) {
  const pluginsFile = path.join(os.homedir(), '.claude', 'plugins', 'installed_plugins.json');

  try {
    let pluginsData = { version: 2, plugins: {} };

    if (fs.existsSync(pluginsFile)) {
      const content = fs.readFileSync(pluginsFile, 'utf-8');
      pluginsData = JSON.parse(content);
    }

    // Add or update openmatrix plugin
    pluginsData.plugins['openmatrix@claude-plugins-official'] = [
      {
        scope: 'user',
        installPath: PLUGIN_TARGET.versionDir,
        version: version,
        installedAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      }
    ];

    fs.writeFileSync(pluginsFile, JSON.stringify(pluginsData, null, 2));
    console.log('   ✅ Registered in installed_plugins.json');
  } catch (e) {
    console.log(`   ⚠️ Could not update installed_plugins.json: ${e.message}`);
  }
}

// Install legacy skills (for non-plugin users)
function installLegacySkills() {
  console.log('\n📦 Installing Legacy Skills...\n');

  // Get skill files (SKILL.md in subdirectories)
  const skillDirs = fs.existsSync(skillsSourceDir)
    ? fs.readdirSync(skillsSourceDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() && dirent.name !== 'review')
        .map(dirent => dirent.name)
    : [];

  for (const target of LEGACY_TARGETS) {
    try {
      ensureDir(target.dir);

      let installed = 0;

      // Copy each SKILL.md as {skill-name}.md
      for (const skillDir of skillDirs) {
        const skillFile = path.join(skillsSourceDir, skillDir, 'SKILL.md');
        if (!fs.existsSync(skillFile)) continue;

        // Use skill directory name as file name (e.g., start/SKILL.md -> start.md)
        const destFile = path.join(target.dir, `${skillDir}.md`);
        fs.copyFileSync(skillFile, destFile);
        installed++;
      }

      // For Claude Code: also copy om.md and openmatrix.md to parent directory
      if (target.isClaudeCode && target.parentDir) {
        ensureDir(target.parentDir);

        // Copy om/SKILL.md as om.md
        const omSrc = path.join(skillsSourceDir, 'om', 'SKILL.md');
        const omDest = path.join(target.parentDir, 'om.md');
        if (fs.existsSync(omSrc)) {
          fs.copyFileSync(omSrc, omDest);
          installed++;
        }

        // Copy openmatrix/SKILL.md as openmatrix.md
        const openmatrixSrc = path.join(skillsSourceDir, 'openmatrix', 'SKILL.md');
        const openmatrixDest = path.join(target.parentDir, 'openmatrix.md');
        if (fs.existsSync(openmatrixSrc)) {
          fs.copyFileSync(openmatrixSrc, openmatrixDest);
          installed++;
        }
      }

      console.log(`✅ ${target.name}: ${installed} skills installed`);
      console.log(`   Location: ${target.dir}`);
    } catch (e) {
      console.log(`⚠️ ${target.name}: skipped (${e.message})`);
    }
  }
}

// Main execution
console.log('╔════════════════════════════════════════════╗');
console.log('║     OpenMatrix Installer v' + getVersion() + '            ║');
console.log('╚════════════════════════════════════════════╝');

// Install as plugin first
const pluginSuccess = installPlugin();

// Also install legacy skills for backwards compatibility
installLegacySkills();

console.log('╔════════════════════════════════════════════╗');
console.log('║              Installation Summary           ║');
console.log('╠════════════════════════════════════════════╣');
console.log('║ Plugin Mode (Recommended):                 ║');
console.log('║   - Hooks auto-registered                  ║');
console.log('║   - Skills loaded on-demand                ║');
console.log('║   - No manual config needed                ║');
console.log('╠════════════════════════════════════════════╣');
console.log('║ Legacy Mode (Fallback):                    ║');
console.log('║   - Skills in ~/.claude/commands/om/       ║');
console.log('║   - Requires manual hook config            ║');
console.log('╚════════════════════════════════════════════╝');

console.log('\n💡 Usage:');
console.log('   /om <task>         - Main entry (AI routes to best workflow)');
console.log('   /om:start          - Standard workflow with quality gates');
console.log('   /om:feature        - Lightweight workflow for small tasks');
console.log('   /om:brainstorm     - Explore requirements before implementation');
console.log('   /om:debug          - Systematic debugging');
console.log('   /om:deploy         - Deployment assistant');
console.log('   /om:test           - Test generation and improvement');
console.log('\n📖 Docs: https://github.com/bigfish1913/openmatrix\n');