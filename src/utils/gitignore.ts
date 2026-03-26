// src/utils/gitignore.ts
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * 确保指定目录被 git 忽略
 * @param basePath 项目根目录
 * @param ignorePattern 要忽略的模式 (默认 .openmatrix/)
 */
export async function ensureGitignore(
  basePath: string,
  ignorePattern: string = '.openmatrix/'
): Promise<void> {
  const gitignorePath = path.join(basePath, '.gitignore');

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