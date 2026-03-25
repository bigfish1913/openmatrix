export declare class FileStore {
    private basePath;
    constructor(basePath: string);
    ensureDir(path: string): Promise<void>;
    writeJson<T>(path: string, data: T): Promise<void>;
    readJson<T>(path: string): Promise<T | null>;
    writeMarkdown(path: string, content: string): Promise<void>;
    readMarkdown(path: string): Promise<string | null>;
    exists(path: string): Promise<boolean>;
    listFiles(dir: string): Promise<string[]>;
    listDirs(dir: string): Promise<string[]>;
}
