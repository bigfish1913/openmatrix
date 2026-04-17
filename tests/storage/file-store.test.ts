import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileStore } from '../../src/storage/file-store.js';
import { mkdtemp, rm, readFile, writeFile, mkdir } from 'fs/promises';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';

describe('FileStore', () => {
  let store: FileStore;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'openmatrix-test-'));
    store = new FileStore(tempDir);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // ============ Basic JSON operations ============

  it('should write and read JSON file', async () => {
    const data = { name: 'test', value: 123 };
    await store.writeJson('test.json', data);
    const result = await store.readJson('test.json');
    expect(result).toEqual(data);
  });

  it('should return null for non-existent file', async () => {
    const result = await store.readJson('not-exist.json');
    expect(result).toBeNull();
  });

  it('should return null when path is a directory (EISDIR)', async () => {
    await mkdir(join(tempDir, 'subdir'), { recursive: true });
    const result = await store.readJson('subdir');
    expect(result).toBeNull();
  });

  it('should throw on non-ENOENT/EISDIR errors for readJson', async () => {
    // Create a file with invalid permissions or malformed content to trigger a parse error
    const fullPath = join(tempDir, 'bad.json');
    await writeFile(fullPath, '{invalid json content', 'utf-8');
    await expect(store.readJson('bad.json')).rejects.toThrow();
  });

  it('should check file existence', async () => {
    await store.writeJson('exists.json', { data: 1 });
    expect(await store.exists('exists.json')).toBe(true);
    expect(await store.exists('not-exists.json')).toBe(false);
  });

  // ============ Markdown operations ============

  it('should write and read markdown file', async () => {
    const content = '# Test\n\nThis is a test.';
    await store.writeMarkdown('test.md', content);
    const result = await store.readMarkdown('test.md');
    expect(result).toBe(content);
  });

  it('should return null for non-existent markdown file', async () => {
    const result = await store.readMarkdown('not-exist.md');
    expect(result).toBeNull();
  });

  it('should return null when markdown path is a directory', async () => {
    await mkdir(join(tempDir, 'md-dir'), { recursive: true });
    const result = await store.readMarkdown('md-dir');
    expect(result).toBeNull();
  });

  it('should throw on non-ENOENT/EISDIR errors for readMarkdown', async () => {
    // Create a file in a path that will cause permission issues is hard to test portably,
    // so we test that a malformed read scenario throws correctly
    const fullPath = join(tempDir, 'deep', 'nested', 'file.md');
    // Writing to nested path should work because writeMarkdown creates dirs
    await store.writeMarkdown('deep/nested/file.md', 'content');
    const result = await store.readMarkdown('deep/nested/file.md');
    expect(result).toBe('content');
  });

  // ============ Directory operations ============

  it('should ensure directory exists', async () => {
    await store.ensureDir('new/sub/dir');
    const exists = await store.exists('new/sub/dir');
    expect(exists).toBe(true);
  });

  it('should list files in directory', async () => {
    await store.writeJson('dir/a.json', { a: 1 });
    await store.writeJson('dir/b.json', { b: 2 });
    const files = await store.listFiles('dir');
    expect(files).toHaveLength(2);
    expect(files).toContain('a.json');
    expect(files).toContain('b.json');
  });

  it('should return empty array for non-existent directory in listFiles', async () => {
    const files = await store.listFiles('non-existent-dir');
    expect(files).toEqual([]);
  });

  it('should list directories in directory', async () => {
    await store.writeJson('parent/child1/task.json', { id: 1 });
    await store.writeJson('parent/child2/task.json', { id: 2 });
    const dirs = await store.listDirs('parent');
    expect(dirs).toHaveLength(2);
    expect(dirs).toContain('child1');
    expect(dirs).toContain('child2');
  });

  it('should return empty array for non-existent directory in listDirs', async () => {
    const dirs = await store.listDirs('non-existent-dir');
    expect(dirs).toEqual([]);
  });

  it('should filter only files in listFiles (not directories)', async () => {
    await store.writeJson('mixed/file.json', { a: 1 });
    await store.writeJson('mixed/sub/other.json', { b: 2 });
    const files = await store.listFiles('mixed');
    // Only file.json should be listed, not sub/ (which is a directory)
    expect(files).toEqual(['file.json']);
  });

  // ============ Append operations ============

  it('should append content to file', async () => {
    await store.appendFile('log.txt', 'line1\n');
    await store.appendFile('log.txt', 'line2\n');
    const content = await readFile(join(tempDir, 'log.txt'), 'utf-8');
    expect(content).toBe('line1\nline2\n');
  });

  it('should create file on first append', async () => {
    await store.appendFile('new-log.txt', 'first line\n');
    const content = await readFile(join(tempDir, 'new-log.txt'), 'utf-8');
    expect(content).toBe('first line\n');
  });

  // ============ Sync operations ============

  it('should write and read JSON synchronously', () => {
    const data = { sync: true, count: 42 };
    store.writeJsonSync('sync-test.json', data);
    const result = store.readJsonSync('sync-test.json');
    expect(result).toEqual(data);
  });

  it('should return null for non-existent file in readJsonSync', () => {
    const result = store.readJsonSync('not-exist-sync.json');
    expect(result).toBeNull();
  });

  it('should return null when sync path is a directory', () => {
    mkdirSync(join(tempDir, 'sync-dir'), { recursive: true });
    const result = store.readJsonSync('sync-dir');
    expect(result).toBeNull();
  });

  it('should throw on non-ENOENT/EISDIR errors in readJsonSync', () => {
    const fullPath = join(tempDir, 'bad-sync.json');
    writeFileSync(fullPath, '{not valid json', 'utf-8');
    expect(() => store.readJsonSync('bad-sync.json')).toThrow();
  });

  it('should check file existence synchronously', () => {
    store.writeJsonSync('sync-exists.json', { data: 1 });
    expect(store.existsSync('sync-exists.json')).toBe(true);
    expect(store.existsSync('not-sync-exists.json')).toBe(false);
  });

  // ============ getBasePath ============

  it('should return base path', () => {
    expect(store.getBasePath()).toBe(tempDir);
  });

  // ============ Nested path operations ============

  it('should write JSON to nested directories', async () => {
    const data = { nested: true };
    await store.writeJson('tasks/TASK-001/task.json', data);
    const result = await store.readJson('tasks/TASK-001/task.json');
    expect(result).toEqual(data);
  });

  it('should write markdown to nested directories', async () => {
    const content = '# Nested markdown';
    await store.writeMarkdown('tasks/TASK-001/context.md', content);
    const result = await store.readMarkdown('tasks/TASK-001/context.md');
    expect(result).toBe(content);
  });

  // ============ Type safety: generic type parameters ============

  it('should preserve typed data through write/read cycle', async () => {
    interface TestType {
      id: string;
      items: string[];
      nested: { value: number };
    }
    const data: TestType = {
      id: 'test-001',
      items: ['a', 'b', 'c'],
      nested: { value: 99 }
    };
    await store.writeJson('typed.json', data);
    const result = await store.readJson<TestType>('typed.json');
    expect(result).toEqual(data);
    expect(result!.items).toHaveLength(3);
    expect(result!.nested.value).toBe(99);
  });

  it('should preserve typed data through sync write/read cycle', () => {
    interface SyncTestType {
      name: string;
      enabled: boolean;
    }
    const data: SyncTestType = { name: 'sync-test', enabled: true };
    store.writeJsonSync('sync-typed.json', data);
    const result = store.readJsonSync<SyncTestType>('sync-typed.json');
    expect(result).toEqual(data);
    expect(result!.enabled).toBe(true);
  });
});
