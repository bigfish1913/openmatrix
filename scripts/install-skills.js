#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Change to home directory to avoid cwd issues
process.chdir(os.homedir());

try {
  // Get the package skills directory - use the path relative to this script
  const scriptDir = __dirname;
  const skillsDir = path.join(scriptDir, '..', 'skills');

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
        console.log(`⚠️  Skipped: om:${path.basename(file, '.md')} (${copyErr.message})`);
      }
    });

    console.log(`\n✅ OpenMatrix skills installed to ${commandsDir}`);
  } else {
    console.log('Skills directory not found, skipping installation.');
  }
} catch (err) {
  console.log('OpenMatrix skills installation skipped:', err.message);
}
