import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileStore } from '../../src/storage/file-store.js';
import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
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

  it('should check file existence', async () => {
    await store.writeJson('exists.json', { data: 1 });
    expect(await store.exists('exists.json')).toBe(true);
    expect(await store.exists('not-exists.json')).toBe(false);
  });

  it('should write and read markdown file', async () => {
    const content = '# Test\n\nThis is a test.';
    await store.writeMarkdown('test.md', content);
    const result = await store.readMarkdown('test.md');
    expect(result).toBe(content);
  });

  it('should list files in directory', async () => {
    await store.writeJson('dir/a.json', { a: 1 });
    await store.writeJson('dir/b.json', { b: 2 });
    const files = await store.listFiles('dir');
    expect(files).toHaveLength(2);
    expect(files).toContain('a.json');
    expect(files).toContain('b.json');
  });
});
