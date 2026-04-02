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

/**
 * 确保指定目录被 git 忽略
 * @param basePath 项目目录（可以是 git 仓库的子目录）
 * @param ignorePattern 要忽略的模式 (默认 .openmatrix/)
 */
export async function ensureGitignore(
  basePath: string,
  ignorePattern: string = '.openmatrix/'
): Promise<void> {
  // 写入到 git 根目录的 .gitignore
  const gitRoot = await getGitRoot(basePath);
  const gitignorePath = path.join(gitRoot, '.gitignore');

  try {
    const content = await fs.readFile(gitignorePath, 'utf-8');

    // 检查是否已经包含该模式
    const lines = content.split('\n');
    const patternBase = ignorePattern.replace(/\/$/, '');
    const hasPattern = lines.some(line => {
      const trimmed = line.trim();
      return trimmed === patternBase ||
             trimmed === `${patternBase}/` ||
             trimmed === `/${patternBase}` ||
             trimmed === `/${patternBase}/`;
    });

    if (!hasPattern) {
      // 添加模式到 .gitignore
      const newContent = content.endsWith('\n')
        ? `${content}${ignorePattern}\n`
        : `${content}\n\n# Auto-added by OpenMatrix\n${ignorePattern}\n`;
      await fs.writeFile(gitignorePath, newContent);
    }
  } catch {
    // .gitignore 不存在，创建一个新的
    await fs.writeFile(gitignorePath, `# OpenMatrix state\n${ignorePattern}\n`);
  }
}

/**
 * 确保 .openmatrix 目录被 git 忽略
 */
export async function ensureOpenmatrixGitignore(basePath: string): Promise<void> {
  await ensureGitignore(basePath, '.openmatrix/');
}