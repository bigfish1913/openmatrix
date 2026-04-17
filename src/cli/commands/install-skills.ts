#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const installSkillsCommand = new Command('install-skills')
  .description('Install OpenMatrix skills to ~/.claude/commands/om/')
  .option('-f, --force', 'Force overwrite existing skills', false)
  .action((options) => {
    const skillsDir = path.join(__dirname, '..', '..', '..', 'skills');
    const claudeDir = path.join(os.homedir(), '.claude');
    const commandsDir = path.join(claudeDir, 'commands', 'om');

    console.log('📦 OpenMatrix Skills Installer\n');

    // Check if skills directory exists
    if (!fs.existsSync(skillsDir)) {
      console.error('❌ Skills directory not found:', skillsDir);
      console.error('   Make sure openmatrix is installed correctly.');
      process.exit(1);
    }

    // Create commands directory
    try {
      if (!fs.existsSync(commandsDir)) {
        fs.mkdirSync(commandsDir, { recursive: true });
        console.log('📁 Created directory:', commandsDir);
      }
    } catch (err: unknown) {
      console.error('❌ Cannot create directory:', commandsDir);
      console.error('   Error:', err instanceof Error ? err.message : String(err));
      process.exit(1);
    }

    // Get skill files (excluding om.md and openmatrix.md which are handled separately)
    const files = fs.readdirSync(skillsDir).filter(f =>
      f.endsWith('.md') && f !== 'om.md' && f !== 'openmatrix.md'
    );

    if (files.length === 0) {
      console.error('❌ No skill files found in:', skillsDir);
      process.exit(1);
    }

    console.log(`📋 Found ${files.length} skill files\n`);

    let installed = 0;
    let skipped = 0;
    let failed = 0;

    // Install skill files to ~/.claude/commands/om/
    files.forEach(file => {
      const src = path.join(skillsDir, file);
      const dest = path.join(commandsDir, file);

      try {
        // Check if file exists and not forcing
        if (fs.existsSync(dest) && !options.force) {
          console.log(`  ⏭️  Skipped: ${file} (already exists)`);
          skipped++;
          return;
        }

        fs.copyFileSync(src, dest);
        const skillName = path.basename(file, '.md');
        console.log(`  ✅ Installed: /om:${skillName}`);
        installed++;
      } catch (err: unknown) {
        console.log(`  ❌ Failed: ${file} (${err instanceof Error ? err.message : String(err)})`);
        failed++;
      }
    });

    // Install default /om command to ~/.claude/commands/om.md
    const omSrc = path.join(skillsDir, 'om.md');
    const omDest = path.join(claudeDir, 'commands', 'om.md');

    if (fs.existsSync(omSrc)) {
      try {
        if (fs.existsSync(omDest) && !options.force) {
          console.log(`  ⏭️  Skipped: om.md (already exists)`);
          skipped++;
        } else {
          fs.copyFileSync(omSrc, omDest);
          console.log(`  ✅ Installed: /om (default entry)`);
          installed++;
        }
      } catch (err: unknown) {
        console.log(`  ❌ Failed: om.md (${err instanceof Error ? err.message : String(err)})`);
        failed++;
      }
    }

    // Install auto-detection instructions
    const autoSrc = path.join(skillsDir, 'openmatrix.md');
    const autoDest = path.join(claudeDir, 'commands', 'openmatrix.md');

    if (fs.existsSync(autoSrc)) {
      try {
        if (fs.existsSync(autoDest) && !options.force) {
          console.log(`  ⏭️  Skipped: openmatrix.md (already exists)`);
          skipped++;
        } else {
          fs.copyFileSync(autoSrc, autoDest);
          console.log(`  ✅ Installed: /om:openmatrix (auto-detection)`);
          installed++;
        }
      } catch (err: unknown) {
        console.log(`  ❌ Failed: openmatrix.md (${err instanceof Error ? err.message : String(err)})`);
        failed++;
      }
    }

    console.log('\n' + '─'.repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   ✅ Installed: ${installed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`\n📁 Skills: ${commandsDir}`);
    console.log(`📁 Default: ${omDest}`);

    if (installed > 0) {
      console.log('\n🎉 Skills installed successfully!');
      console.log('   Try: /om <your task>');
      console.log('   Or:  /om:start <your task>');
      console.log('\n💡 Auto-detection enabled!');
      console.log('   Type task descriptions directly:');
      console.log('   - "实现用户登录功能" → auto invokes /om:start');
      console.log('   - "fix the login bug" → auto invokes /om:start');
    }

    if (failed > 0) {
      process.exit(1);
    }
  });
