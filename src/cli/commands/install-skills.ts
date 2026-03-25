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
    } catch (err: any) {
      console.error('❌ Cannot create directory:', commandsDir);
      console.error('   Error:', err.message);
      process.exit(1);
    }

    // Get skill files
    const files = fs.readdirSync(skillsDir).filter(f => f.endsWith('.md'));

    if (files.length === 0) {
      console.error('❌ No skill files found in:', skillsDir);
      process.exit(1);
    }

    console.log(`📋 Found ${files.length} skill files\n`);

    let installed = 0;
    let skipped = 0;
    let failed = 0;

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
      } catch (err: any) {
        console.log(`  ❌ Failed: ${file} (${err.message})`);
        failed++;
      }
    });

    console.log('\n' + '─'.repeat(50));
    console.log(`📊 Summary:`);
    console.log(`   ✅ Installed: ${installed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`\n📁 Location: ${commandsDir}`);

    if (installed > 0) {
      console.log('\n🎉 Skills installed successfully!');
      console.log('   Try: /om:start <your task>');
    }

    if (failed > 0) {
      process.exit(1);
    }
  });
