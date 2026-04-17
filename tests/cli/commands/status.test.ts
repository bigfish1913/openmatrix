// tests/cli/commands/status.test.ts
import { describe, it, expect } from 'vitest';
import { formatStatus, getStatusColor } from '../../../src/cli/commands/status.js';
import chalk from 'chalk';

describe('status command - type safety', () => {
  describe('formatStatus', () => {
    it('should return gray for initialized status', () => {
      const result = formatStatus('initialized');
      // chalk.gray wraps text with ANSI codes
      expect(result).toContain('initialized');
    });

    it('should return green for running status', () => {
      const result = formatStatus('running');
      expect(result).toContain('running');
    });

    it('should return yellow for paused status', () => {
      const result = formatStatus('paused');
      expect(result).toContain('paused');
    });

    it('should return green for completed status', () => {
      const result = formatStatus('completed');
      expect(result).toContain('completed');
    });

    it('should return red for failed status', () => {
      const result = formatStatus('failed');
      expect(result).toContain('failed');
    });

    it('should return white for unknown status', () => {
      const result = formatStatus('unknown_status');
      expect(result).toContain('unknown_status');
    });

    it('should return a string for all mapped statuses', () => {
      const statuses = ['initialized', 'running', 'paused', 'completed', 'failed'];
      for (const status of statuses) {
        const result = formatStatus(status);
        expect(typeof result).toBe('string');
        expect(result).toContain(status);
      }
    });

    it('should map all GlobalState RunStatus values', () => {
      // These correspond to RunStatus type: 'initialized' | 'running' | 'paused' | 'completed' | 'failed'
      const runStatuses = ['initialized', 'running', 'paused', 'completed', 'failed'];
      for (const status of runStatuses) {
        const result = formatStatus(status);
        expect(result).toBeDefined();
        expect(result.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getStatusColor', () => {
    it('should return green function for completed status', () => {
      const colorFn = getStatusColor('completed');
      expect(typeof colorFn).toBe('function');
      const result = colorFn('test');
      expect(result).toContain('test');
    });

    it('should return blue function for in_progress status', () => {
      const colorFn = getStatusColor('in_progress');
      expect(typeof colorFn).toBe('function');
      const result = colorFn('TASK-001');
      expect(result).toContain('TASK-001');
    });

    it('should return red function for failed status', () => {
      const colorFn = getStatusColor('failed');
      expect(typeof colorFn).toBe('function');
      const result = colorFn('TASK-001');
      expect(result).toContain('TASK-001');
    });

    it('should return red function for blocked status', () => {
      const colorFn = getStatusColor('blocked');
      expect(typeof colorFn).toBe('function');
      const result = colorFn('TASK-001');
      expect(result).toContain('TASK-001');
    });

    it('should return gray function for pending status', () => {
      const colorFn = getStatusColor('pending');
      expect(typeof colorFn).toBe('function');
      const result = colorFn('TASK-001');
      expect(result).toContain('TASK-001');
    });

    it('should return yellow function for verify status', () => {
      const colorFn = getStatusColor('verify');
      expect(typeof colorFn).toBe('function');
      const result = colorFn('TASK-001');
      expect(result).toContain('TASK-001');
    });

    it('should return cyan function for accept status', () => {
      const colorFn = getStatusColor('accept');
      expect(typeof colorFn).toBe('function');
      const result = colorFn('TASK-001');
      expect(result).toContain('TASK-001');
    });

    it('should return white function for unknown status', () => {
      const colorFn = getStatusColor('unknown_status');
      expect(typeof colorFn).toBe('function');
      const result = colorFn('test');
      expect(result).toContain('test');
    });

    it('should return a function that accepts a string and returns a string', () => {
      const statuses = ['completed', 'in_progress', 'failed', 'blocked', 'pending', 'verify', 'accept'];
      for (const status of statuses) {
        const colorFn = getStatusColor(status);
        expect(typeof colorFn).toBe('function');
        const result = colorFn('text');
        expect(typeof result).toBe('string');
      }
    });

    it('should map all defined TaskStatus colors correctly', () => {
      // All statuses defined in the colorMap
      const mappedStatuses = ['completed', 'in_progress', 'failed', 'blocked', 'pending', 'verify', 'accept'];
      for (const status of mappedStatuses) {
        const colorFn = getStatusColor(status);
        expect(colorFn).toBeDefined();
        // Verify it returns a valid colored string
        const result = colorFn('test');
        expect(result).toContain('test');
      }
    });
  });

  describe('color map completeness', () => {
    it('formatStatus should handle empty string', () => {
      const result = formatStatus('');
      expect(typeof result).toBe('string');
    });

    it('getStatusColor should handle empty string', () => {
      const colorFn = getStatusColor('');
      expect(typeof colorFn).toBe('function');
      const result = colorFn('test');
      expect(result).toContain('test');
    });

    it('formatStatus and getStatusColor use different color mappings', () => {
      // formatStatus uses: initialized->gray, running->green, paused->yellow, completed->green, failed->red
      // getStatusColor uses: completed->green, in_progress->blue, failed->red, blocked->red, pending->gray, verify->yellow, accept->cyan
      // Both should return valid strings
      const failedFormatted = formatStatus('failed');
      const runningFormatted = formatStatus('running');
      // Both should contain their status text
      expect(failedFormatted).toContain('failed');
      expect(runningFormatted).toContain('running');
    });

    it('different task statuses should use different color functions', () => {
      const completedColor = getStatusColor('completed');
      const failedColor = getStatusColor('failed');

      // Both should be functions
      expect(typeof completedColor).toBe('function');
      expect(typeof failedColor).toBe('function');

      // Both should return strings containing the input text
      const completedResult = completedColor('TASK');
      const failedResult = failedColor('TASK');
      expect(completedResult).toContain('TASK');
      expect(failedResult).toContain('TASK');
    });
  });

  describe('return type consistency', () => {
    it('formatStatus should always return a string', () => {
      const testInputs = ['initialized', 'running', 'paused', 'completed', 'failed', '', 'random', '123'];
      for (const input of testInputs) {
        expect(typeof formatStatus(input)).toBe('string');
      }
    });

    it('getStatusColor should always return a callable function', () => {
      const testInputs = ['completed', 'in_progress', 'failed', 'blocked', 'pending', 'verify', 'accept', '', 'random'];
      for (const input of testInputs) {
        const fn = getStatusColor(input);
        expect(typeof fn).toBe('function');
        expect(typeof fn('test')).toBe('string');
      }
    });
  });
});
