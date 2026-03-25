"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileStore = void 0;
const promises_1 = require("fs/promises");
const path_1 = require("path");
const fs_1 = require("fs");
class FileStore {
    basePath;
    constructor(basePath) {
        this.basePath = basePath;
    }
    async ensureDir(path) {
        const fullPath = (0, path_1.join)(this.basePath, path);
        await (0, promises_1.mkdir)(fullPath, { recursive: true });
    }
    async writeJson(path, data) {
        const fullPath = (0, path_1.join)(this.basePath, path);
        await (0, promises_1.mkdir)((0, path_1.dirname)(fullPath), { recursive: true });
        await (0, promises_1.writeFile)(fullPath, JSON.stringify(data, null, 2), 'utf-8');
    }
    async readJson(path) {
        const fullPath = (0, path_1.join)(this.basePath, path);
        try {
            const content = await (0, promises_1.readFile)(fullPath, 'utf-8');
            return JSON.parse(content);
        }
        catch {
            return null;
        }
    }
    async writeMarkdown(path, content) {
        const fullPath = (0, path_1.join)(this.basePath, path);
        await (0, promises_1.mkdir)((0, path_1.dirname)(fullPath), { recursive: true });
        await (0, promises_1.writeFile)(fullPath, content, 'utf-8');
    }
    async readMarkdown(path) {
        const fullPath = (0, path_1.join)(this.basePath, path);
        try {
            return await (0, promises_1.readFile)(fullPath, 'utf-8');
        }
        catch {
            return null;
        }
    }
    async exists(path) {
        const fullPath = (0, path_1.join)(this.basePath, path);
        try {
            await (0, promises_1.access)(fullPath, fs_1.constants.F_OK);
            return true;
        }
        catch {
            return false;
        }
    }
    async listFiles(dir) {
        const fullPath = (0, path_1.join)(this.basePath, dir);
        try {
            const files = await (0, promises_1.readdir)(fullPath, { withFileTypes: true });
            return files
                .filter((f) => f.isFile())
                .map((f) => f.name);
        }
        catch {
            return [];
        }
    }
    async listDirs(dir) {
        const fullPath = (0, path_1.join)(this.basePath, dir);
        try {
            const files = await (0, promises_1.readdir)(fullPath, { withFileTypes: true });
            return files
                .filter((f) => f.isDirectory())
                .map((f) => f.name);
        }
        catch {
            return [];
        }
    }
}
exports.FileStore = FileStore;
