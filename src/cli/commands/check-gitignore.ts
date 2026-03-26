// src/cli/commands/check-gitignore.ts
import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

/**
 * 项目类型对应的 gitignore 条目
 */
const GITIGNORE_TEMPLATES: Record<string, string[]> = {
  nodejs: [
    'node_modules/',
    'dist/',
    'build/',
    '.npm/',
    '*.log',
    'npm-debug.log*',
    'yarn-debug.log*',
    'yarn-error.log*'
  ],
  typescript: [
    '*.tsbuildinfo',
    '.tsbuildinfo'
  ],
  python: [
    '__pycache__/',
    '*.py[cod]',
    '*$py.class',
    '.venv/',
    'venv/',
    'ENV/',
    '.pytest_cache/',
    '.mypy_cache/',
    '*.egg-info/',
    'dist/',
    'build/'
  ],
  java: [
    'target/',
    '.gradle/',
    'build/',
    '*.class',
    '*.jar',
    '*.war'
  ],
  go: [
    'vendor/',
    'bin/',
    '*.exe',
    '*.exe~',
    '*.dll',
    '*.so',
    '*.dylib'
  ],
  rust: [
    'target/',
    'Cargo.lock'
  ],
  dotnet: [
    'bin/',
    'obj/',
    '*.nupkg',
    '*.snupkg'
  ],
  php: [
    'vendor/',
    'composer.lock'
  ],
  dart: [
    '.dart_tool/',
    '.packages',
    'build/',
    '.pub/',
    'pubspec.lock'
  ],
  common: [
    '.env',
    '.env.local',
    '.env.*.local',
    '.DS_Store',
    'Thumbs.db',
    '*.swp',
    '*.swo',
    '*~',
    '.idea/',
    '.vscode/',
    '*.iml'
  ]
};

/**
 * 根据项目类型检测需要的 gitignore 条目
 */
async function detectProjectType(projectRoot: string): Promise<string[]> {
  const types: string[] = [];

  // 检查 package.json
  try {
    const packageJsonPath = path.join(projectRoot, 'package.json');
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);

    types.push('nodejs');

    // 检查 TypeScript
    if (pkg.devDependencies?.typescript || pkg.dependencies?.typescript) {
      types.push('typescript');
    }
  } catch {
    // 不是 Node.js 项目
  }

  // 检查 Python
  try {
    await fs.access(path.join(projectRoot, 'pyproject.toml'));
    types.push('python');
  } catch {}
  try {
    await fs.access(path.join(projectRoot, 'requirements.txt'));
    if (!types.includes('python')) types.push('python');
  } catch {}

  // 检查 Java
  try {
    await fs.access(path.join(projectRoot, 'pom.xml'));
    types.push('java');
  } catch {}
  try {
    await fs.access(path.join(projectRoot, 'build.gradle'));
    if (!types.includes('java')) types.push('java');
  } catch {}

  // 检查 Go
  try {
    await fs.access(path.join(projectRoot, 'go.mod'));
    types.push('go');
  } catch {}

  // 检查 Rust
  try {
    await fs.access(path.join(projectRoot, 'Cargo.toml'));
    types.push('rust');
  } catch {}

  // 检查 .NET
  try {
    const files = await fs.readdir(projectRoot);
    if (files.some(f => f.endsWith('.sln') || f.endsWith('.csproj'))) {
      types.push('dotnet');
    }
  } catch {}

  // 检查 PHP
  try {
    await fs.access(path.join(projectRoot, 'composer.json'));
    types.push('php');
  } catch {}

  // 检查 Dart
  try {
    await fs.access(path.join(projectRoot, 'pubspec.yaml'));
    types.push('dart');
  } catch {}

  // 始终添加通用条目
  types.push('common');

  return types;
}

/**
 * 获取所有需要的 gitignore 条目
 */
function getRequiredEntries(projectTypes: string[]): Set<string> {
  const entries = new Set<string>();
  for (const type of projectTypes) {
    const template = GITIGNORE_TEMPLATES[type];
    if (template) {
      for (const entry of template) {
        entries.add(entry);
      }
    }
  }
  return entries;
}

/**
 * 解析现有 gitignore 内容
 */
function parseGitignore(content: string): Set<string> {
  const entries = new Set<string>();
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // 跳过注释和空行
    if (trimmed && !trimmed.startsWith('#')) {
      entries.add(trimmed);
    }
  }

  return entries;
}

export const checkGitignoreCommand = new Command('check-gitignore')
  .description('检查并自动补充 .gitignore 文件')
  .option('--json', '输出 JSON 格式')
  .option('--dry-run', '仅显示会添加的内容，不实际修改')
  .action(async (options) => {
    const projectRoot = process.cwd();
    const gitignorePath = path.join(projectRoot, '.gitignore');

    try {
      // 检测项目类型
      const projectTypes = await detectProjectType(projectRoot);
      const requiredEntries = getRequiredEntries(projectTypes);

      // 读取现有 gitignore
      let existingEntries = new Set<string>();
      let exists = false;

      try {
        const content = await fs.readFile(gitignorePath, 'utf-8');
        existingEntries = parseGitignore(content);
        exists = true;
      } catch {
        // 文件不存在
      }

      // 计算缺失的条目
      const missingEntries: string[] = [];
      for (const entry of requiredEntries) {
        if (!existingEntries.has(entry)) {
          missingEntries.push(entry);
        }
      }

      // JSON 输出
      if (options.json) {
        console.log(JSON.stringify({
          exists,
          projectTypes,
          missingEntries,
          totalRequired: requiredEntries.size,
          totalExisting: existingEntries.size
        }, null, 2));
        return;
      }

      // 没有缺失条目
      if (missingEntries.length === 0) {
        console.log(chalk.green('✅ .gitignore 已完善，无需修改\n'));
        return;
      }

      // Dry run 模式
      if (options.dryRun) {
        console.log(chalk.cyan('🔍 检测到以下缺失条目:\n'));
        for (const entry of missingEntries) {
          console.log(chalk.gray(`  + ${entry}`));
        }
        return;
      }

      // 自动补充
      const newContent = generateGitignoreContent(missingEntries);

      if (exists) {
        // 追加到现有文件
        await fs.appendFile(gitignorePath, `\n${newContent}`);
        console.log(chalk.green(`✅ 已向 .gitignore 添加 ${missingEntries.length} 个条目:\n`));
      } else {
        // 创建新文件
        await fs.writeFile(gitignorePath, newContent);
        console.log(chalk.green(`✅ 已创建 .gitignore，包含 ${missingEntries.length} 个条目:\n`));
      }

      for (const entry of missingEntries) {
        console.log(chalk.gray(`  + ${entry}`));
      }
      console.log();

    } catch (error) {
      if (options.json) {
        console.log(JSON.stringify({ error: String(error) }));
      } else {
        console.error(chalk.red('❌ 检查失败:'), error);
      }
      process.exit(1);
    }
  });

/**
 * 生成 gitignore 内容
 */
function generateGitignoreContent(entries: string[]): string {
  const timestamp = new Date().toISOString().split('T')[0];

  // 按类型分组
  const groups: Record<string, string[]> = {
    'Dependencies': [],
    'Build': [],
    'Environment': [],
    'IDE': [],
    'OS': [],
    'Other': []
  };

  for (const entry of entries) {
    if (entry.includes('node_modules') || entry.includes('vendor') || entry.includes('.venv')) {
      groups['Dependencies'].push(entry);
    } else if (entry.includes('dist') || entry.includes('build') || entry.includes('target')) {
      groups['Build'].push(entry);
    } else if (entry.includes('.env')) {
      groups['Environment'].push(entry);
    } else if (entry.includes('.idea') || entry.includes('.vscode') || entry.includes('.iml')) {
      groups['IDE'].push(entry);
    } else if (entry.includes('.DS_Store') || entry.includes('Thumbs.db')) {
      groups['OS'].push(entry);
    } else {
      groups['Other'].push(entry);
    }
  }

  let content = `\n# Auto-generated by OpenMatrix (${timestamp})\n`;

  for (const [group, items] of Object.entries(groups)) {
    if (items.length > 0) {
      content += `\n# ${group}\n`;
      for (const item of items) {
        content += `${item}\n`;
      }
    }
  }

  return content;
}