import { readFile, writeFile, mkdir, readdir, access, appendFile as fsAppendFile } from 'fs/promises';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { constants } from 'fs';
import { logError } from '../utils/error-handler.js';

export class FileStore {
  constructor(private basePath: string) {}

  getBasePath(): string {
    return this.basePath;
  }

  async ensureDir(path: string): Promise<void> {
    const fullPath = join(this.basePath, path);
    await mkdir(fullPath, { recursive: true });
  }

  async writeJson<T>(path: string, data: T): Promise<void> {
    const fullPath = join(this.basePath, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async writeMarkdown(path: string, content: string): Promise<void> {
    const fullPath = join(this.basePath, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
  }

  /**
   * 原子追加写入（使用 O_APPEND flag，内核保证追加原子性）
   */
  async appendFile(filePath: string, content: string): Promise<void> {
    const fullPath = join(this.basePath, filePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await fsAppendFile(fullPath, content, 'utf-8');
  }

  /**
   * 读取 JSON 文件
   * @returns 文件内容，如果文件不存在则返回 null；其他错误会抛出异常
   */
  async readJson<T>(path: string): Promise<T | null> {
    const fullPath = join(this.basePath, path);
    try {
      const content = await readFile(fullPath, 'utf-8');
      return JSON.parse(content);
    } catch (error: unknown) {
      // 只隐藏"文件不存在"错误，其他错误（权限、磁盘等）抛出以便调用者处理
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT' || nodeError.code === 'EISDIR') {
        return null;
      }
      throw error;
    }
  }

  /**
   * 读取 Markdown 文件
   * @returns 文件内容，如果文件不存在则返回 null；其他错误会抛出异常
   */
  async readMarkdown(path: string): Promise<string | null> {
    const fullPath = join(this.basePath, path);
    try {
      return await readFile(fullPath, 'utf-8');
    } catch (error: unknown) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT' || nodeError.code === 'EISDIR') {
        return null;
      }
      throw error;
    }
  }

  async exists(path: string): Promise<boolean> {
    const fullPath = join(this.basePath, path);
    try {
      await access(fullPath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  async listFiles(dir: string): Promise<string[]> {
    const fullPath = join(this.basePath, dir);
    try {
      const files = await readdir(fullPath, { withFileTypes: true });
      return files
        .filter((f) => f.isFile())
        .map((f) => f.name);
    } catch (error) {
      logError(error, { operation: 'listFiles', file: fullPath });
      return [];
    }
  }

  async listDirs(dir: string): Promise<string[]> {
    const fullPath = join(this.basePath, dir);
    try {
      const files = await readdir(fullPath, { withFileTypes: true });
      return files
        .filter((f) => f.isDirectory())
        .map((f) => f.name);
    } catch (error) {
      logError(error, { operation: 'listDirs', file: fullPath });
      return [];
    }
  }

  // ============ 同步方法（用于构造器等场景）============

  /**
   * 同步写入 JSON 文件
   */
  writeJsonSync<T>(path: string, data: T): void {
    const fullPath = join(this.basePath, path);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * 同步读取 JSON 文件
   * @returns 文件内容，如果文件不存在则返回 null
   */
  readJsonSync<T>(path: string): T | null {
    const fullPath = join(this.basePath, path);
    try {
      const content = readFileSync(fullPath, 'utf-8');
      return JSON.parse(content);
    } catch (error: unknown) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT' || nodeError.code === 'EISDIR') {
        return null;
      }
      throw error;
    }
  }

  /**
   * 同步检查文件是否存在
   */
  existsSync(path: string): boolean {
    const fullPath = join(this.basePath, path);
    return existsSync(fullPath);
  }
}
