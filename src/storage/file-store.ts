import { readFile, writeFile, mkdir, readdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { constants } from 'fs';

export class FileStore {
  constructor(private basePath: string) {}

  async ensureDir(path: string): Promise<void> {
    const fullPath = join(this.basePath, path);
    await mkdir(fullPath, { recursive: true });
  }

  async writeJson<T>(path: string, data: T): Promise<void> {
    const fullPath = join(this.basePath, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async readJson<T>(path: string): Promise<T | null> {
    const fullPath = join(this.basePath, path);
    try {
      const content = await readFile(fullPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async writeMarkdown(path: string, content: string): Promise<void> {
    const fullPath = join(this.basePath, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
  }

  async readMarkdown(path: string): Promise<string | null> {
    const fullPath = join(this.basePath, path);
    try {
      return await readFile(fullPath, 'utf-8');
    } catch {
      return null;
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
    } catch {
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
    } catch {
      return [];
    }
  }
}
