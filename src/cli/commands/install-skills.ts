#!/usr/bin/env node
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const installSkillsCommand = new Command('install-skills')
  .description('Install OpenMatrix skills to ~/.claude/commands/om/ and ~/.matrix/skills/om/ (if MatrixCode detected)')
  .option('-f, --force', 'Force overwrite existing skills', false)
  .action((options) => {
    const skillsDir = path.join(__dirname, '..', '..', '..', 'skills');
    const claudeDir = path.join(os.homedir(), '.claude');
    const claudeCommandsDir = path.join(claudeDir, 'commands', 'om');

    // Check for MatrixCode installation
    const matrixDir = path.join(os.homedir(), '.matrix');
    const matrixSkillsDir = path.join(matrixDir, 'skills', 'om');
    const hasMatrixCode = fs.existsSync(matrixDir);

    console.log('📦 OpenMatrix Skills Installer\n');

    // Check if skills directory exists
    if (!fs.existsSync(skillsDir)) {
      console.error('❌ Skills directory not found:', skillsDir);
      console.error('   Make sure openmatrix is installed correctly.');
      process.exit(1);
    }

    // Define target directories
    const targets = [
      { name: 'Claude Code', dir: claudeCommandsDir, enabled: true },
      { name: 'MatrixCode', dir: matrixSkillsDir, enabled: hasMatrixCode },
    ];

    // Get skill files
    const files = fs.readdirSync(skillsDir).filter(f =>
      f.endsWith('.md') && f !== 'om.md' && f !== 'openmatrix.md'
    );

    if (files.length === 0) {
      console.error('❌ No skill files found in:', skillsDir);
      process.exit(1);
    }

    console.log(`📋 Found ${files.length} skill files\n`);

    let totalInstalled = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    // Install to each target
    for (const target of targets) {
      if (!target.enabled) {
        console.log(`⏭️  ${target.name}: skipped (not installed)`);
        continue;
      }

      console.log(`\n🔧 Installing to ${target.name}...`);

      try {
        if (!fs.existsSync(target.dir)) {
          fs.mkdirSync(target.dir, { recursive: true });
          console.log(`📁 Created directory: ${target.dir}`);
        }
      } catch (err: unknown) {
        console.error(`❌ Cannot create directory: ${target.dir}`);
        console.error(`   Error: ${err instanceof Error ? err.message : String(err)}`);
        continue;
      }

      let installed = 0;
      let skipped = 0;
      let failed = 0;

      // Install skill files
      files.forEach(file => {
        const src = path.join(skillsDir, file);
        const dest = path.join(target.dir, file);

        try {
          if (fs.existsSync(dest) && !options.force) {
            skipped++;
            return;
          }

          fs.copyFileSync(src, dest);
          installed++;
        } catch (err: unknown) {
          console.log(`  ❌ Failed: ${file} (${err instanceof Error ? err.message : String(err)})`);
          failed++;
        }
      });

      // Install om.md to parent directory for Claude Code
      if (target.name === 'Claude Code') {
        const omSrc = path.join(skillsDir, 'om.md');
        const omDest = path.join(claudeDir, 'commands', 'om.md');

        if (fs.existsSync(omSrc)) {
          try {
            if (fs.existsSync(omDest) && !options.force) {
              skipped++;
            } else {
              fs.copyFileSync(omSrc, omDest);
              installed++;
            }
          } catch (err: unknown) {
            failed++;
          }
        }

        // Install openmatrix.md (auto-detection)
        const autoSrc = path.join(skillsDir, 'openmatrix.md');
        const autoDest = path.join(claudeDir, 'commands', 'openmatrix.md');

        if (fs.existsSync(autoSrc)) {
          try {
            if (fs.existsSync(autoDest) && !options.force) {
              skipped++;
            } else {
              fs.copyFileSync(autoSrc, autoDest);
              installed++;
            }
          } catch (err: unknown) {
            failed++;
          }
        }
      }

      // Install SKILL.md for MatrixCode (skill package manifest)
      if (target.name === 'MatrixCode') {
        const skillManifestSrc = path.join(skillsDir, 'SKILL.md');
        const skillManifestDest = path.join(target.dir, 'SKILL.md');

        if (fs.existsSync(skillManifestSrc)) {
          try {
            if (fs.existsSync(skillManifestDest) && !options.force) {
              skipped++;
            } else {
              fs.copyFileSync(skillManifestSrc, skillManifestDest);
              installed++;
            }
          } catch (err: unknown) {
            failed++;
          }
        }
      }

      console.log(`   ✅ Installed: ${installed}`);
      console.log(`   ⏭️  Skipped: ${skipped}`);
      if (failed > 0) {
        console.log(`   ❌ Failed: ${failed}`);
      }

      totalInstalled += installed;
      totalSkipped += skipped;
      totalFailed += failed;
    }

    console.log('\n' + '─'.repeat(50));
    console.log(`📊 Total Summary:`);
    console.log(`   ✅ Installed: ${totalInstalled}`);
    console.log(`   ⏭️  Skipped: ${totalSkipped}`);
    console.log(`   ❌ Failed: ${totalFailed}`);

    console.log('\n📁 Installation locations:');
    for (const target of targets) {
      if (target.enabled) {
        console.log(`   ${target.name}: ${target.dir}`);
      }
    }

    if (totalInstalled > 0) {
      console.log('\n🎉 Skills installed successfully!');
      console.log('   Try: /om <your task>');
      console.log('   Or:  /om:start <your task>');
    }

    if (hasMatrixCode) {
      console.log('\n✅ MatrixCode detected! Skills also installed to ~/.matrix/skills/om/');
    }

    if (totalFailed > 0) {
      process.exit(1);
    }
  });
