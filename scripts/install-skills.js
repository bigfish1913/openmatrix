#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Get the package skills directory
const packageDir = path.dirname(__dirname);
const skillsDir = path.join(packageDir, 'skills');

// Get user's .claude directory
const claudeDir = path.join(os.homedir(), '.claude');
const commandsDir = path.join(claudeDir, 'commands', 'om');

// Create commands directory if it doesn't exist
if (!fs.existsSync(commandsDir)) {
  fs.mkdirSync(commandsDir, { recursive: true });
}

// Copy skill files
if (fs.existsSync(skillsDir)) {
  const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));

  files.forEach(file => {
    const src = path.join(skillsDir, file);
    const dest = path.join(commandsDir, file);
    fs.copyFileSync(src, dest);
    console.log(`✓ Installed: om:${path.basename(file, '.md')}`);
  });

  console.log(`\n✅ OpenMatrix skills installed to ${commandsDir}`);
  console.log('\nAvailable commands:');
  console.log('  /om:status  - 查看任务状态');
  console.log('  /om:start   - 启动新任务');
  console.log('  /om:approve - 审批关键节点');
  console.log('  /om:resume  - 恢复暂停任务');
  console.log('  /om:retry   - 重试失败任务');
  console.log('  /om:report  - 生成执行报告');
} else {
  console.log('Skills directory not found, skipping installation.');
}
