#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Change to home directory to avoid cwd issues
process.chdir(os.homedir());

// Get the package skills directory - use the path relative to this script
const scriptDir = __dirname;
const skillsDir = path.join(scriptDir, '..', 'skills');

// Target directories for different AI coding tools
const targets = [
  {
    name: 'Claude Code',
    dir: path.join(os.homedir(), '.claude', 'commands', 'om'),
  },
  {
    name: 'OpenCode',
    dir: path.join(os.homedir(), '.config', 'opencode', 'commands', 'om'),
  },
];

if (!fs.existsSync(skillsDir)) {
  console.log('Skills directory not found, skipping installation.');
  process.exit(0);
}

const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));

for (const target of targets) {
  try {
    // Create commands directory if it doesn't exist
    if (!fs.existsSync(target.dir)) {
      fs.mkdirSync(target.dir, { recursive: true });
    }

    let installed = 0;
    for (const file of files) {
      const src = path.join(skillsDir, file);
      const dest = path.join(target.dir, file);
      try {
        fs.copyFileSync(src, dest);
        installed++;
      } catch (copyErr) {
        console.log(`  ⚠️  Skipped: ${file} (${copyErr.message})`);
      }
    }

    console.log(`✅ ${target.name}: ${installed} skills installed to ${target.dir}`);
  } catch (err) {
    console.log(`⚠️  ${target.name}: skipped (${err.message})`);
    console.log(`   Please run: mkdir -p ${target.dir}`);
  }
}
