#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

try {
  // Get the package skills directory
  const packageDir = path.dirname(__dirname);
  const skillsDir = path.join(packageDir, 'skills');

  // Get user's .claude directory
  const claudeDir = path.join(os.homedir(), '.claude');
  const commandsDir = path.join(claudeDir, 'commands', 'om');

  // Create commands directory if it doesn't exist
  try {
    if (!fs.existsSync(commandsDir)) {
      fs.mkdirSync(commandsDir, { recursive: true });
    }
  } catch (mkdirErr) {
    console.log(`⚠️  Cannot create ${commandsDir}`);
    console.log(`   Please run: mkdir -p ${commandsDir}`);
    console.log(`   Then reinstall openmatrix.`);
    process.exit(0);
  }

  // Copy skill files
  if (fs.existsSync(skillsDir)) {
    const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));

    files.forEach(file => {
      const src = path.join(skillsDir, file);
      const dest = path.join(commandsDir, file);
      try {
        fs.copyFileSync(src, dest);
        console.log(`✓ Installed: om:${path.basename(file, '.md')}`);
      } catch (copyErr) {
        console.log(`⚠️  Skipped: om:${path.basename(file, '.md')} (permission denied)`);
      }
    });

    console.log(`\n✅ OpenMatrix skills installed to ${commandsDir}`);
  } else {
    console.log('Skills directory not found, skipping installation.');
  }
} catch (err) {
  console.log('OpenMatrix skills installation skipped:', err.message);
  console.log('\nTo install manually:');
  console.log('  mkdir -p ~/.claude/commands/om');
  console.log('  cp node_modules/openmatrix/skills/*.md ~/.claude/commands/om/');
}
