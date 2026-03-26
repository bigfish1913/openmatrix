// tests/orchestrator/smart-question-analyzer.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SmartQuestionAnalyzer } from '../../src/orchestrator/smart-question-analyzer.js';
import * as fs from 'fs';
import * as path from 'path';

describe('SmartQuestionAnalyzer', () => {
  let analyzer: SmartQuestionAnalyzer;

  beforeEach(() => {
    analyzer = new SmartQuestionAnalyzer(process.cwd());
  });

  describe('analyze', () => {
    it('should infer strict quality level for new feature', async () => {
      const result = await analyzer.analyze('实现用户登录功能');

      const qualityInference = result.inferences.find(i => i.questionId === 'quality_level');
      expect(qualityInference).toBeDefined();
      expect(qualityInference?.inferredAnswer).toBe('strict');
      expect(qualityInference?.confidence).toBe('medium');
    });

    it('should infer balanced quality level for bug fix', async () => {
      const result = await analyzer.analyze('修复登录页面的 bug');

      const qualityInference = result.inferences.find(i => i.questionId === 'quality_level');
      expect(qualityInference).toBeDefined();
      expect(qualityInference?.inferredAnswer).toBe('balanced');
      expect(qualityInference?.confidence).toBe('high');
    });

    it('should infer fast quality level for prototype', async () => {
      const result = await analyzer.analyze('快速创建一个原型验证概念');

      const qualityInference = result.inferences.find(i => i.questionId === 'quality_level');
      expect(qualityInference).toBeDefined();
      expect(qualityInference?.inferredAnswer).toBe('fast');
      expect(qualityInference?.confidence).toBe('high');
    });

    it('should infer tech stack from task description', async () => {
      const result = await analyzer.analyze('使用 TypeScript 和 React 实现用户管理');

      const techInference = result.inferences.find(i => i.questionId === 'tech_stack');
      expect(techInference).toBeDefined();
      expect(techInference?.inferredAnswer).toContain('typescript');
      expect(techInference?.inferredAnswer).toContain('react');
    });

    it('should infer Python tech stack', async () => {
      const result = await analyzer.analyze('用 Python 写一个爬虫');

      const techInference = result.inferences.find(i => i.questionId === 'tech_stack');
      expect(techInference).toBeDefined();
      expect(techInference?.inferredAnswer).toContain('python');
    });

    it('should infer doc level for bug fix as none', async () => {
      const result = await analyzer.analyze('修复登录验证的 bug');

      const docInference = result.inferences.find(i => i.questionId === 'doc_level');
      expect(docInference).toBeDefined();
      expect(docInference?.inferredAnswer).toBe('none');
      expect(docInference?.confidence).toBe('high');
    });

    it('should infer basic doc level for new feature', async () => {
      const result = await analyzer.analyze('实现用户注册功能');

      const docInference = result.inferences.find(i => i.questionId === 'doc_level');
      expect(docInference).toBeDefined();
      expect(docInference?.inferredAnswer).toBe('basic');
    });

    it('should infer full doc level for API/Module', async () => {
      const result = await analyzer.analyze('开发一个 SDK 模块');

      const docInference = result.inferences.find(i => i.questionId === 'doc_level');
      expect(docInference).toBeDefined();
      expect(docInference?.inferredAnswer).toBe('full');
    });

    it('should identify questions to ask for low confidence inferences', async () => {
      const result = await analyzer.analyze('做一些改动');

      // 模糊任务应该有需要确认的问题
      expect(result.questionsToAsk.length).toBeGreaterThan(0);
    });

    it('should return project context', async () => {
      const result = await analyzer.analyze('实现功能');

      expect(result.projectContext).toBeDefined();
      expect(result.projectContext.projectType).toBeDefined();
    });
  });

  describe('getProjectContext', () => {
    it('should detect TypeScript project', async () => {
      const context = await analyzer.getProjectContext();

      // 当前项目是 TypeScript
      expect(context.projectType).toBe('typescript');
    });

    it('should detect package manager', async () => {
      const context = await analyzer.getProjectContext();

      // 当前项目使用 npm
      expect(context.packageManager).toBe('npm');
    });

    it('should detect frameworks', async () => {
      const context = await analyzer.getProjectContext();

      // 应该检测到框架列表
      expect(Array.isArray(context.frameworks)).toBe(true);
    });
  });

  describe('generateSummary', () => {
    it('should generate human-readable summary', async () => {
      const result = await analyzer.analyze('实现用户登录功能');
      const summary = analyzer.generateSummary(result);

      expect(summary).toContain('推断结果');
      expect(summary).toContain('quality_level');
    });
  });

  describe('inference confidence', () => {
    it('should return high confidence for clear bug fix task', async () => {
      const result = await analyzer.analyze('修复用户登录验证的 bug');

      const qualityInference = result.inferences.find(i => i.questionId === 'quality_level');
      expect(qualityInference?.confidence).toBe('high');
    });

    it('should return high confidence for prototype task', async () => {
      const result = await analyzer.analyze('创建一个 POC 验证方案');

      const qualityInference = result.inferences.find(i => i.questionId === 'quality_level');
      expect(qualityInference?.confidence).toBe('high');
    });
  });
});