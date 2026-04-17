// tests/cli/check.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  displayProjectInfo,
  displaySummary,
  getCategoryLabels,
  displaySuggestionsByPriority,
  displayPriorityGroup,
  displayHints,
} from '../../src/cli/commands/check.js';
import type { UpgradeSuggestion, UpgradeCategory, UpgradePriority, ProjectType, DetectionResult } from '../../src/orchestrator/upgrade-detector.js';

// ---------- Helpers ----------

function createSuggestion(overrides: Partial<UpgradeSuggestion> = {}): UpgradeSuggestion {
  return {
    id: 'SUG-001',
    category: 'bug',
    priority: 'high',
    title: 'Test suggestion',
    description: 'A test suggestion',
    location: { file: 'src/test.ts', line: 10 },
    suggestion: 'Fix this',
    autoFixable: false,
    impact: 'Medium',
    effort: 'small',
    ...overrides,
  };
}

function createSummary(overrides: Partial<DetectionResult['summary']> = {}): DetectionResult['summary'] {
  const byCategory = {} as Record<UpgradeCategory, number>;
  const categories: UpgradeCategory[] = ['bug', 'quality', 'capability', 'ux', 'style', 'security', 'common', 'prompt', 'skill', 'agent'];
  for (const cat of categories) {
    byCategory[cat] = 0;
  }
  byCategory['bug'] = 2;
  byCategory['security'] = 1;

  const byPriority = {} as Record<UpgradePriority, number>;
  byPriority['critical'] = 0;
  byPriority['high'] = 1;
  byPriority['medium'] = 2;
  byPriority['low'] = 0;

  return {
    total: 3,
    byCategory,
    byPriority,
    autoFixable: 1,
    ...overrides,
  };
}

// ---------- Tests ----------

describe('check helper functions', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ======== getCategoryLabels ========

  describe('getCategoryLabels', () => {
    it('returns a label for every UpgradeCategory', () => {
      const labels = getCategoryLabels();
      const categories: UpgradeCategory[] = ['bug', 'quality', 'capability', 'ux', 'style', 'security', 'common', 'prompt', 'skill', 'agent'];
      for (const cat of categories) {
        expect(labels[cat]).toBeDefined();
        expect(typeof labels[cat]).toBe('string');
        expect(labels[cat].length).toBeGreaterThan(0);
      }
    });

    it('includes well-known category labels', () => {
      const labels = getCategoryLabels();
      expect(labels.bug).toContain('代码缺陷');
      expect(labels.security).toContain('安全问题');
      expect(labels.quality).toContain('代码质量');
    });

    it('returns the same result on each call (pure function)', () => {
      const a = getCategoryLabels();
      const b = getCategoryLabels();
      expect(a).toEqual(b);
    });
  });

  // ======== displayProjectInfo ========

  describe('displayProjectInfo', () => {
    it('displays project name and type', () => {
      displayProjectInfo('my-project', 'typescript', new Date().toISOString());
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('my-project');
      expect(joined).toContain('TypeScript');
    });

    it('displays formatted timestamp', () => {
      const timestamp = '2025-01-15T10:30:00.000Z';
      displayProjectInfo('test', 'nodejs', timestamp);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      // Should show localized date string
      expect(joined).toContain('扫描时间');
    });

    it('handles all project types', () => {
      const types: ProjectType[] = ['openmatrix', 'ai-project', 'nodejs', 'typescript', 'python', 'go', 'rust', 'java', 'csharp', 'cpp', 'php', 'dart', 'unknown'];
      for (const type of types) {
        vi.clearAllMocks();
        vi.spyOn(console, 'log').mockImplementation(() => {});
        displayProjectInfo('test', type, new Date().toISOString());
        expect(console.log).toHaveBeenCalled();
      }
    });
  });

  // ======== displaySummary ========

  describe('displaySummary', () => {
    it('displays total and autoFixable counts', () => {
      const summary = createSummary();
      displaySummary(summary);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('3');
      expect(joined).toContain('1');
    });

    it('shows categories with count > 0', () => {
      const summary = createSummary();
      displaySummary(summary);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('代码缺陷');
      expect(joined).toContain('安全问题');
    });

    it('displays header', () => {
      displaySummary(createSummary());
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('检测摘要'));
    });
  });

  // ======== displayHints ========

  describe('displayHints', () => {
    it('displays interactive and auto mode hints', () => {
      displayHints();
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('--interactive');
      expect(joined).toContain('--auto');
    });

    it('displays tips header', () => {
      displayHints();
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('提示'));
    });
  });

  // ======== displaySuggestionsByPriority ========

  describe('displaySuggestionsByPriority', () => {
    it('displays header', () => {
      displaySuggestionsByPriority([]);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('改进建议'));
    });

    it('displays nothing when empty suggestions', () => {
      displaySuggestionsByPriority([]);
      // Should show header but no priority groups
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).not.toContain('关键问题');
      expect(joined).not.toContain('高优先级');
    });

    it('groups suggestions by priority', () => {
      const suggestions = [
        createSuggestion({ id: 'S1', priority: 'critical', title: 'Critical issue' }),
        createSuggestion({ id: 'S2', priority: 'high', title: 'High issue' }),
        createSuggestion({ id: 'S3', priority: 'medium', title: 'Medium issue' }),
        createSuggestion({ id: 'S4', priority: 'low', title: 'Low issue' }),
      ];
      displaySuggestionsByPriority(suggestions);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('关键问题');
      expect(joined).toContain('高优先级');
      expect(joined).toContain('中优先级');
      expect(joined).toContain('低优先级');
    });

    it('only shows groups that have items', () => {
      const suggestions = [
        createSuggestion({ id: 'S1', priority: 'critical', title: 'Critical issue' }),
      ];
      displaySuggestionsByPriority(suggestions);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('关键问题');
      expect(joined).not.toContain('高优先级');
    });
  });

  // ======== displayPriorityGroup ========

  describe('displayPriorityGroup', () => {
    it('displays all items when no maxDisplay', () => {
      const items = [
        createSuggestion({ id: 'S1', title: 'First' }),
        createSuggestion({ id: 'S2', title: 'Second' }),
        createSuggestion({ id: 'S3', title: 'Third' }),
      ];
      displayPriorityGroup(items, 'Test Group', (s: string) => s, 'X', undefined);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('First');
      expect(joined).toContain('Second');
      expect(joined).toContain('Third');
    });

    it('limits display when maxDisplay is set', () => {
      const items = [
        createSuggestion({ id: 'S1', title: 'First' }),
        createSuggestion({ id: 'S2', title: 'Second' }),
        createSuggestion({ id: 'S3', title: 'Third' }),
      ];
      displayPriorityGroup(items, 'Limited Group', (s: string) => s, 'X', 2);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('First');
      expect(joined).toContain('Second');
      expect(joined).not.toContain('Third');
    });

    it('shows overflow message when items exceed maxDisplay', () => {
      const items = Array.from({ length: 15 }, (_, i) =>
        createSuggestion({ id: `S${i}`, title: `Item ${i}` })
      );
      displayPriorityGroup(items, 'Big Group', (s: string) => s, 'X', 10);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('还有');
    });

    it('shows label in output', () => {
      displayPriorityGroup([createSuggestion()], 'My Label', (s: string) => s, 'X', undefined);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('My Label'));
    });

    it('handles empty items array', () => {
      displayPriorityGroup([], 'Empty', (s: string) => s, 'X', undefined);
      // Should not throw
      expect(console.log).toHaveBeenCalled();
    });

    it('shows auto-fixable indicator when applicable', () => {
      const items = [createSuggestion({ autoFixable: true, title: 'Auto-fix' })];
      displayPriorityGroup(items, 'Group', (s: string) => s, 'X', undefined);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('可自动修复');
    });
  });
});
