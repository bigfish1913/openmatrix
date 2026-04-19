// tests/cli/brainstorm.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  handleCompleteMode,
  mergeSessionResults,
  outputCompleteResult,
  outputSessionNotFound,
  loadTaskContent,
  loadTaskFromDefaultFile,
  loadTaskFromSpecifiedFile,
  extractTaskTitle,
  createNewSession,
  outputNewSession,
  outputNewSessionJson,
  outputNewSessionText,
  buildSmartQuestionSession,
  convertToBrainstormQuestions,
} from '../../src/cli/commands/brainstorm.js';
import type { BrainstormResult, BrainstormOptions } from '../../src/cli/commands/brainstorm.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// ---------- Logger Mock ----------
const { loggerMock } = vi.hoisted(() => ({
  loggerMock: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: loggerMock
}));

// ---------- Helpers ----------

function createMockSession(overrides: Partial<BrainstormResult> = {}): BrainstormResult {
  return {
    status: 'brainstorming',
    taskInput: '# Test Task\nSome task description',
    taskTitle: 'Test Task',
    questions: [],
    answers: {},
    insights: ['Insight 1'],
    designNotes: ['Note 1'],
    suggestResearch: undefined,
    ...overrides,
  };
}

let tempDir: string;

// ---------- Tests ----------

describe('brainstorm helper functions', () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brainstorm-test-'));
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // ======== extractTaskTitle ========

  describe('extractTaskTitle', () => {
    it('extracts title from first markdown h1 heading', () => {
      const content = '# My Task Title\nSome description';
      expect(extractTaskTitle(content)).toBe('My Task Title');
    });

    it('extracts title from h1 in the middle of content', () => {
      const content = 'Some intro\n## Sub heading\n# Real Title\nMore text';
      expect(extractTaskTitle(content)).toBe('Real Title');
    });

    it('trims whitespace from title', () => {
      const content = '#   Spaced Title   \nContent';
      expect(extractTaskTitle(content)).toBe('Spaced Title');
    });

    it('returns default when no h1 heading exists', () => {
      const content = 'Just some text\n## Sub only';
      expect(extractTaskTitle(content)).toBe('未命名任务');
    });

    it('returns default for empty content', () => {
      expect(extractTaskTitle('')).toBe('未命名任务');
    });

    it('does not match h2 or h3 headings', () => {
      const content = '## H2 Title\n### H3 Title';
      expect(extractTaskTitle(content)).toBe('未命名任务');
    });
  });

  // ======== mergeSessionResults ========

  describe('mergeSessionResults', () => {
    it('merges answers, insights, and designNotes from valid JSON', () => {
      const session = createMockSession({ answers: { q1: 'a1' }, insights: ['i1'], designNotes: ['d1'] });
      const resultsJson = JSON.stringify({ answers: { q2: 'a2' }, insights: ['i2'], designNotes: ['d2'] });
      mergeSessionResults(session, resultsJson);
      expect(session.answers).toEqual({ q1: 'a1', q2: 'a2' });
      expect(session.insights).toEqual(['i1', 'i2']);
      expect(session.designNotes).toEqual(['d1', 'd2']);
    });

    it('does nothing when resultsJson is undefined', () => {
      const session = createMockSession();
      mergeSessionResults(session, undefined);
      expect(session.answers).toEqual({});
      expect(session.insights).toEqual(['Insight 1']);
    });

    it('does nothing when resultsJson is empty string', () => {
      const session = createMockSession();
      mergeSessionResults(session, '');
      // empty string is falsy, function returns early
      expect(session.answers).toEqual({});
    });

    it('silently ignores invalid JSON', () => {
      const session = createMockSession();
      mergeSessionResults(session, 'not-valid-json');
      expect(session.answers).toEqual({});
    });

    it('handles missing insights/designNotes in results', () => {
      const session = createMockSession();
      const resultsJson = JSON.stringify({ answers: { q1: 'a1' } });
      mergeSessionResults(session, resultsJson);
      expect(session.answers).toEqual({ q1: 'a1' });
      expect(session.insights).toEqual(['Insight 1']);
      expect(session.designNotes).toEqual(['Note 1']);
    });

    it('overrides existing answers with new values', () => {
      const session = createMockSession({ answers: { q1: 'old' } });
      const resultsJson = JSON.stringify({ answers: { q1: 'new' } });
      mergeSessionResults(session, resultsJson);
      expect(session.answers.q1).toBe('new');
    });
  });

  // ======== outputCompleteResult ========

  describe('outputCompleteResult', () => {
    it('outputs JSON when jsonMode is true', () => {
      const session = createMockSession();
      outputCompleteResult(session, true);
      expect(loggerMock.info).toHaveBeenCalled();
      const output = loggerMock.info.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.status).toBe('ready_to_start');
      expect(parsed.taskTitle).toBe('Test Task');
      expect(parsed.hint).toContain('start');
    });

    it('outputs text when jsonMode is false', () => {
      const session = createMockSession();
      outputCompleteResult(session, false);
      expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('头脑风暴完成'));
    });

    it('outputs text when jsonMode is undefined', () => {
      const session = createMockSession();
      outputCompleteResult(session);
      expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('头脑风暴完成'));
    });
  });

  // ======== outputSessionNotFound ========

  describe('outputSessionNotFound', () => {
    it('outputs JSON error when jsonMode is true', () => {
      outputSessionNotFound(true);
      const output = loggerMock.info.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.status).toBe('error');
      expect(parsed.message).toContain('没有进行中的头脑风暴会话');
    });

    it('outputs text error when jsonMode is false', () => {
      outputSessionNotFound(false);
      expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('没有进行中的头脑风暴会话'));
    });

    it('outputs text error when jsonMode is undefined', () => {
      outputSessionNotFound();
      expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('没有进行中的头脑风暴会话'));
    });
  });

  // ======== loadTaskFromDefaultFile ========

  describe('loadTaskFromDefaultFile', () => {
    it('reads TASK.md from basePath', async () => {
      await fs.writeFile(path.join(tempDir, 'TASK.md'), '# Default Task\nContent');
      const result = await loadTaskFromDefaultFile(tempDir, true);
      expect(result).toBe('# Default Task\nContent');
    });

    it('returns null and prints JSON error when file not found and jsonMode true', async () => {
      const result = await loadTaskFromDefaultFile(tempDir, true);
      expect(result).toBeNull();
      const output = loggerMock.info.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.status).toBe('error');
    });

    it('returns null and prints text error when file not found and jsonMode false', async () => {
      const result = await loadTaskFromDefaultFile(tempDir, false);
      expect(result).toBeNull();
      expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('请提供任务文件路径或描述'));
    });

    it('prints file path in text mode when file exists', async () => {
      await fs.writeFile(path.join(tempDir, 'TASK.md'), 'task content');
      await loadTaskFromDefaultFile(tempDir, false);
      expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('读取任务文件'));
    });

    it('does not print file path in json mode when file exists', async () => {
      await fs.writeFile(path.join(tempDir, 'TASK.md'), 'task content');
      await loadTaskFromDefaultFile(tempDir, true);
      expect(loggerMock.info).not.toHaveBeenCalledWith(expect.stringContaining('读取任务文件'));
    });
  });

  // ======== loadTaskFromSpecifiedFile ========

  describe('loadTaskFromSpecifiedFile', () => {
    it('reads the specified file', async () => {
      const filePath = path.join(tempDir, 'my-task.md');
      await fs.writeFile(filePath, '# My Task\nContent');
      const result = await loadTaskFromSpecifiedFile(filePath, 'my-task.md', true);
      expect(result).toBe('# My Task\nContent');
    });

    it('returns null with JSON error when file not found and jsonMode true', async () => {
      const result = await loadTaskFromSpecifiedFile(path.join(tempDir, 'nonexistent.md'), 'nonexistent.md', true);
      expect(result).toBeNull();
      const output = loggerMock.info.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.status).toBe('error');
      expect(parsed.message).toContain('无法读取文件');
    });

    it('returns null with text error when file not found and jsonMode false', async () => {
      const result = await loadTaskFromSpecifiedFile(path.join(tempDir, 'nonexistent.md'), 'nonexistent.md', false);
      expect(result).toBeNull();
      expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('无法读取文件'));
    });

    it('prints file name in text mode when file exists', async () => {
      const filePath = path.join(tempDir, 'task.md');
      await fs.writeFile(filePath, 'content');
      await loadTaskFromSpecifiedFile(filePath, 'task.md', false);
      expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('读取任务文件'));
    });
  });

  // ======== loadTaskContent ========

  describe('loadTaskContent', () => {
    const opts: BrainstormOptions = {};

    it('returns input directly when input is a non-file string', async () => {
      const result = await loadTaskContent('plain task description', tempDir, opts);
      expect(result).toBe('plain task description');
    });

    it('returns input directly when input is a non-md extension', async () => {
      const result = await loadTaskContent('some description text', tempDir, opts);
      expect(result).toBe('some description text');
    });

    it('loads from default file when input is undefined', async () => {
      await fs.writeFile(path.join(tempDir, 'TASK.md'), '# Default');
      const result = await loadTaskContent(undefined, tempDir, opts);
      expect(result).toBe('# Default');
    });

    it('returns null when input is undefined and no default file', async () => {
      const result = await loadTaskContent(undefined, tempDir, opts);
      expect(result).toBeNull();
    });

    it('loads from specified .md file', async () => {
      const filePath = path.join(tempDir, 'custom.md');
      await fs.writeFile(filePath, '# Custom Task');
      const result = await loadTaskContent(filePath, tempDir, opts);
      expect(result).toBe('# Custom Task');
    });

    it('returns null when specified .md file does not exist', async () => {
      const filePath = path.join(tempDir, 'missing.md');
      const result = await loadTaskContent(filePath, tempDir, opts);
      expect(result).toBeNull();
    });
  });

  // ======== handleCompleteMode ========

  describe('handleCompleteMode', () => {
    it('reads session file, updates status, and outputs JSON result', async () => {
      const brainstormPath = path.join(tempDir, 'session.json');
      const session = createMockSession();
      await fs.writeFile(brainstormPath, JSON.stringify(session));

      await handleCompleteMode(brainstormPath, { json: true });
      const output = loggerMock.info.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.status).toBe('ready_to_start');
      expect(parsed.taskTitle).toBe('Test Task');
    });

    it('persists updated session to disk', async () => {
      const brainstormPath = path.join(tempDir, 'session.json');
      const session = createMockSession();
      await fs.writeFile(brainstormPath, JSON.stringify(session));

      await handleCompleteMode(brainstormPath, {});
      const saved = JSON.parse(await fs.readFile(brainstormPath, 'utf-8'));
      expect(saved.status).toBe('ready_to_start');
    });

    it('outputs error when session file does not exist (json mode)', async () => {
      const brainstormPath = path.join(tempDir, 'no-session.json');
      await handleCompleteMode(brainstormPath, { json: true });
      const output = loggerMock.info.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.status).toBe('error');
    });

    it('outputs text error when session file does not exist (text mode)', async () => {
      const brainstormPath = path.join(tempDir, 'no-session.json');
      await handleCompleteMode(brainstormPath, {});
      expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('没有进行中的头脑风暴会话'));
    });

    it('merges results when provided', async () => {
      const brainstormPath = path.join(tempDir, 'session.json');
      const session = createMockSession({ answers: {} });
      await fs.writeFile(brainstormPath, JSON.stringify(session));

      const results = JSON.stringify({ answers: { q1: 'a1' }, insights: ['new insight'], designNotes: [] });
      await handleCompleteMode(brainstormPath, { results });

      const saved = JSON.parse(await fs.readFile(brainstormPath, 'utf-8'));
      expect(saved.answers.q1).toBe('a1');
      expect(saved.insights).toContain('new insight');
    });
  });

  // ======== outputNewSessionJson ========

  describe('outputNewSessionJson', () => {
    it('outputs JSON with questions and status', () => {
      const questions = [{ id: 'q1', question: 'What?', header: 'H1', options: [{ label: 'A', description: 'a' }], multiSelect: false, why: '' }];
      outputNewSessionJson('Title', questions, { isVertical: false, domain: '' });
      const output = loggerMock.info.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.status).toBe('brainstorming');
      expect(parsed.taskTitle).toBe('Title');
      expect(parsed.questions).toHaveLength(1);
      expect(parsed.questions[0].id).toBe('q1');
    });

    it('includes suggestResearch when vertical domain detected', () => {
      outputNewSessionJson('Title', [], { isVertical: true, domain: 'Game Dev' });
      const output = loggerMock.info.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.suggestResearch).toBe('Game Dev');
      expect(parsed.researchHint).toBeDefined();
    });

    it('does not include suggestResearch when no vertical domain', () => {
      outputNewSessionJson('Title', [], { isVertical: false, domain: '' });
      const output = loggerMock.info.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.suggestResearch).toBeUndefined();
    });
  });

  // ======== outputNewSessionText ========

  describe('outputNewSessionText', () => {
    it('outputs text with task title and questions', () => {
      const questions = [{ id: 'q1', question: 'What is it?', header: 'H', options: [], multiSelect: false, why: '' }];
      outputNewSessionText('My Task', questions, { isVertical: false, domain: '' });
      expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('头脑风暴'));
      expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('My Task'));
    });

    it('shows vertical domain detection when detected', () => {
      outputNewSessionText('My Task', [], { isVertical: true, domain: 'Game' });
      expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('检测到垂直领域'));
    });

    it('does not show vertical domain when not detected', () => {
      outputNewSessionText('My Task', [], { isVertical: false, domain: '' });
      const allCalls = loggerMock.info.mock.calls.flat().join(' ');
      expect(allCalls).not.toContain('检测到垂直领域');
    });
  });

  // ======== outputNewSession ========

  describe('outputNewSession', () => {
    it('delegates to outputNewSessionJson when jsonMode is true', () => {
      outputNewSession('Title', [], { isVertical: false, domain: '' }, true);
      const output = loggerMock.info.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.status).toBe('brainstorming');
    });

    it('delegates to outputNewSessionText when jsonMode is false', () => {
      outputNewSession('Title', [], { isVertical: false, domain: '' }, false);
      expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('头脑风暴'));
    });

    it('defaults to text output when jsonMode is undefined', () => {
      outputNewSession('Title', [], { isVertical: false, domain: '' });
      expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('头脑风暴'));
    });
  });

  // ======== convertToBrainstormQuestions ========

  describe('convertToBrainstormQuestions', () => {
    it('converts session questions to brainstorm format', () => {
      const session = {
        questions: [
          { id: 'q1', question: 'What?', category: 'objective', options: [{ label: 'A', description: 'Option A' }], type: 'single', priority: 1 },
          { id: 'q2', question: 'How?', category: 'technical', options: [{ label: 'B' }], type: 'multiple', priority: 2 },
        ],
      };
      const result = convertToBrainstormQuestions(session);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('q1');
      expect(result[0].header).toBe('objective');
      expect(result[0].multiSelect).toBe(false);
      expect(result[1].multiSelect).toBe(true);
    });

    it('sorts by priority ascending', () => {
      const session = {
        questions: [
          { id: 'q3', question: 'Low', category: 'risk', type: 'single', priority: 5 },
          { id: 'q1', question: 'High', category: 'objective', type: 'single', priority: 1 },
          { id: 'q2', question: 'Mid', category: 'technical', type: 'single', priority: 3 },
        ],
      };
      const result = convertToBrainstormQuestions(session);
      expect(result[0].id).toBe('q1');
      expect(result[1].id).toBe('q2');
      expect(result[2].id).toBe('q3');
    });

    it('filters out skipped questions', () => {
      const session = {
        questions: [
          { id: 'q1', question: 'A', category: 'obj', type: 'single', priority: 1 },
          { id: 'q2', question: 'B', category: 'tech', type: 'single', priority: 2 },
        ],
        skippedQuestionIds: ['q2'],
      };
      const result = convertToBrainstormQuestions(session);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('q1');
    });

    it('handles questions without options', () => {
      const session = {
        questions: [
          { id: 'q1', question: 'No opts?', category: 'obj', type: 'single', priority: 1 },
        ],
      };
      const result = convertToBrainstormQuestions(session);
      expect(result[0].options).toEqual([]);
    });

    it('handles questions without priority (defaults to 5)', () => {
      const session = {
        questions: [
          { id: 'q1', question: 'A', category: 'obj', type: 'single' },
          { id: 'q2', question: 'B', category: 'tech', type: 'single', priority: 1 },
        ],
      };
      const result = convertToBrainstormQuestions(session);
      expect(result[0].id).toBe('q2');
      expect(result[1].id).toBe('q1');
    });

    it('returns empty array for empty questions', () => {
      const result = convertToBrainstormQuestions({ questions: [] });
      expect(result).toEqual([]);
    });
  });

  // ======== buildSmartQuestionSession ========

  describe('buildSmartQuestionSession', () => {
    it('constructs session from task content', async () => {
      const result = await buildSmartQuestionSession('# Build a web app\nCreate an API', tempDir);
      expect(result).toBeDefined();
      expect(result.questions).toBeDefined();
      expect(Array.isArray(result.questions)).toBe(true);
    });

    it('produces questions with expected structure', async () => {
      const result = await buildSmartQuestionSession('# Task\nSome description', tempDir);
      if (result.questions.length > 0) {
        const q = result.questions[0];
        expect(q).toHaveProperty('id');
        expect(q).toHaveProperty('question');
        expect(q).toHaveProperty('type');
      }
    });
  });

  // ======== createNewSession ========

  describe('createNewSession', () => {
    it('creates session file and outputs in json mode', async () => {
      const brainstormPath = path.join(tempDir, 'session.json');
      await createNewSession('# Test Task\nDescription', tempDir, brainstormPath, { json: true });

      const saved = JSON.parse(await fs.readFile(brainstormPath, 'utf-8'));
      expect(saved.taskTitle).toBe('Test Task');
      expect(saved.status).toBe('brainstorming');

      const output = loggerMock.info.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.status).toBe('brainstorming');
      expect(parsed.taskTitle).toBe('Test Task');
    });

    it('creates session file and outputs in text mode', async () => {
      const brainstormPath = path.join(tempDir, 'session.json');
      await createNewSession('# Test Task\nDescription', tempDir, brainstormPath, {});

      const saved = JSON.parse(await fs.readFile(brainstormPath, 'utf-8'));
      expect(saved.taskTitle).toBe('Test Task');

      expect(loggerMock.info).toHaveBeenCalledWith(expect.stringContaining('头脑风暴'));
    });

    it('detects vertical domain for system tasks', async () => {
      const brainstormPath = path.join(tempDir, 'session.json');
      await createNewSession('构建一个任务管理系统', tempDir, brainstormPath, { json: true });

      const saved = JSON.parse(await fs.readFile(brainstormPath, 'utf-8'));
      expect(saved.suggestResearch).toBeDefined();
    });

    it('uses default title for content without h1', async () => {
      const brainstormPath = path.join(tempDir, 'session.json');
      await createNewSession('plain text without heading', tempDir, brainstormPath, { json: true });

      const saved = JSON.parse(await fs.readFile(brainstormPath, 'utf-8'));
      expect(saved.taskTitle).toBe('未命名任务');
    });
  });
});
