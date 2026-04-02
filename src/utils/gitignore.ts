// src/utils/gitignore.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 获取 git 仓库根目录（支持 .git 在父级目录的情况）
 */
async function getGitRoot(basePath: string): Promise<string> {
  try {
    const { stdout } = await execAsync('git rev-parse --show-toplevel', { cwd: basePath });
    return stdout.trim();
  } catch {
    return basePath;
  }
}

// ============ 项目类型检测 ============

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
    'yarn-error.log*',
  ],
  typescript: [
    '*.tsbuildinfo',
  ],
  python: [
    '__pycache__/',
    '*.py[cod]',
    '.venv/',
    'venv/',
    '.pytest_cache/',
    '.mypy_cache/',
    '*.egg-info/',
  ],
  java: [
    'target/',
    '.gradle/',
    '*.class',
    '*.jar',
  ],
  go: [
    'vendor/',
    'bin/',
    '*.exe',
    '*.dll',
    '*.so',
    '*.dylib',
  ],
  rust: [
    'target/',
    'Cargo.lock',
  ],
  dotnet: [
    'bin/',
    'obj/',
    '*.nupkg',
  ],
  vue: [
    '.nuxt/',
    '.output/',
    '.vite/',
  ],
  react: [
    '.next/',
  ],
  common: [
    '.env',
    '.env.local',
    '.env.*.local',
    '.DS_Store',
    'Thumbs.db',
    '*.swp',
    '*~',
    '.idea/',
    '.vscode/',
    '*.iml',
  ],
  openmatrix: [
    '.openmatrix/',
  ],
};

/**
 * 根据项目文件检测项目类型
 */
async function detectProjectTypes(projectRoot: string): Promise<string[]> {
  const types: string[] = [];

  // 检查 package.json → nodejs + 可能的框架
  try {
    const content = await fs.readFile(path.join(projectRoot, 'package.json'), 'utf-8');
    const pkg = JSON.parse(content);
    types.push('nodejs');

    if (pkg.devDependencies?.typescript || pkg.dependencies?.typescript) {
      types.push('typescript');
    }
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (allDeps['nuxt'] || allDeps['@nuxt/content']) types.push('vue');
    if (allDeps['next'] || allDeps['@next/react']) types.push('react');
  } catch { /* not node */ }

  // 检查 Python
  try { await fs.access(path.join(projectRoot, 'pyproject.toml')); types.push('python'); } catch {}
  try { await fs.access(path.join(projectRoot, 'requirements.txt')); if (!types.includes('python')) types.push('python'); } catch {}

  // 检查 Java
  try { await fs.access(path.join(projectRoot, 'pom.xml')); types.push('java'); } catch {}
  try { await fs.access(path.join(projectRoot, 'build.gradle')); if (!types.includes('java')) types.push('java'); } catch {}

  // 检查 Go
  try { await fs.access(path.join(projectRoot, 'go.mod')); types.push('go'); } catch {}

  // 检查 Rust
  try { await fs.access(path.join(projectRoot, 'Cargo.toml')); types.push('rust'); } catch {}

  // 检查 .NET
  try {
    const files = await fs.readdir(projectRoot);
    if (files.some(f => f.endsWith('.sln') || f.endsWith('.csproj'))) types.push('dotnet');
  } catch {}

  types.push('common');
  types.push('openmatrix');
  return types;
}

// ============ Gitignore 操作 ============

/**
 * 检查 gitignore 内容中是否已包含指定模式
 */
function hasGitignoreEntry(content: string, pattern: string): boolean {
  const patternBase = pattern.replace(/\/$/, '');
  return content.split('\n').some(line => {
    const trimmed = line.trim();
    return trimmed === patternBase ||
           trimmed === `${patternBase}/` ||
           trimmed === `/${patternBase}` ||
           trimmed === `/${patternBase}/`;
  });
}

/**
 * 根据项目类型收集所有需要的 gitignore 条目
 */
function collectRequiredEntries(projectTypes: string[]): string[] {
  const seen = new Set<string>();
  const entries: string[] = [];
  for (const type of projectTypes) {
    const template = GITIGNORE_TEMPLATES[type];
    if (template) {
      for (const entry of template) {
        if (!seen.has(entry)) {
          seen.add(entry);
          entries.push(entry);
        }
      }
    }
  }
  return entries;
}

/**
 * 确保 .gitignore 包含当前项目需要的所有忽略条目
 *
 * 自动检测项目类型（Node.js/Python/Java/Go/Rust/.NET/Vue/React），
 * 补充对应的 node_modules、dist、.venv、target 等忽略规则。
 *
 * @param basePath 项目目录（可以是 git 仓库的子目录）
 */
export async function ensureOpenmatrixGitignore(basePath: string): Promise<void> {
  const gitRoot = await getGitRoot(basePath);
  const gitignorePath = path.join(gitRoot, '.gitignore');

  // 读取现有内容
  let content = '';
  try {
    content = await fs.readFile(gitignorePath, 'utf-8');
  } catch {
    // 文件不存在
  }

  // 检测项目类型并收集需要的条目
  const projectTypes = await detectProjectTypes(gitRoot);
  const requiredEntries = collectRequiredEntries(projectTypes);

  // 筛选缺失的条目
  const missingEntries = requiredEntries.filter(e => !hasGitignoreEntry(content, e));

  if (missingEntries.length === 0) return;

  // 按类型分组追加
  const timestamp = new Date().toISOString().split('T')[0];
  const groups: Record<string, string[]> = {
    'Dependencies': [],
    'Build Output': [],
    'Environment': [],
    'IDE / Editor': [],
    'OS Files': [],
    'OpenMatrix': [],
    'Other': [],
  };

  for (const entry of missingEntries) {
    if (entry.includes('node_modules') || entry.includes('vendor') || entry.includes('.venv') || entry.includes('packages')) {
      groups['Dependencies'].push(entry);
    } else if (entry.includes('dist') || entry.includes('build') || entry.includes('target') || entry.includes('bin') || entry.includes('obj') || entry.includes('.output') || entry.includes('.next') || entry.includes('.nuxt')) {
      groups['Build Output'].push(entry);
    } else if (entry.includes('.env')) {
      groups['Environment'].push(entry);
    } else if (entry.includes('.idea') || entry.includes('.vscode') || entry.includes('.vite') || entry.includes('.iml')) {
      groups['IDE / Editor'].push(entry);
    } else if (entry.includes('.openmatrix')) {
      groups['OpenMatrix'].push(entry);
    } else if (entry.includes('.DS_Store') || entry.includes('Thumbs.db')) {
      groups['OS Files'].push(entry);
    } else {
      groups['Other'].push(entry);
    }
  }

  let addition = (content && !content.endsWith('\n') ? '\n' : '') +
    `\n# Auto-generated by OpenMatrix (${timestamp})\n`;

  for (const [group, items] of Object.entries(groups)) {
    if (items.length > 0) {
      addition += `\n# ${group}\n`;
      addition += items.join('\n') + '\n';
    }
  }

  await fs.writeFile(gitignorePath, content + addition, 'utf-8');
}
