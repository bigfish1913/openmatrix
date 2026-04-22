// tests/cli/deploy.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  displayEnvironmentInfo,
  displayDeployOptions,
  displayDevCommands,
  getDeployMethodLabel,
  formatDeployCommand,
  generateDeployCommands,
  selectDeployOption,
} from '../../src/cli/commands/deploy.js';
import type { EnvironmentInfo, DeployOption, DeployMethod, DevCommands } from '../../src/types/index.js';

function makeEnvInfo(overrides: Partial<EnvironmentInfo> = {}): EnvironmentInfo {
  return {
    projectName: 'test-project',
    projectType: 'typescript',
    projectRoot: '/test/project',
    timestamp: new Date().toISOString(),
    buildTools: [{ type: 'npm', commands: ['build', 'test'], configFile: 'package.json', isDefault: true }],
    deployOptions: [
      { method: 'docker', command: 'docker build -t test .', configFile: 'Dockerfile', recommended: true, description: 'Docker' }
    ],
    devCommands: {
      setup: ['npm install'],
      build: ['npm run build'],
      test: ['npm run test'],
      dev: ['npm run dev'],
      start: ['npm run start']
    },
    summary: { hasBuildTool: true, hasCIConfig: false, hasDeployOption: true, buildToolCount: 1, deployOptionCount: 1 },
    ...overrides
  };
}

function makeDeployOption(overrides: Partial<DeployOption> = {}): DeployOption {
  return { method: 'docker', command: 'docker build -t test .', configFile: 'Dockerfile', recommended: true, description: 'Docker', ...overrides };
}

describe('deploy helper functions', () => {
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  describe('getDeployMethodLabel', () => {
    it('returns label for every DeployMethod', () => {
      const methods: DeployMethod[] = ['docker', 'docker-compose', 'kubernetes', 'helm', 'npm', 'make', 'script', 'github-pages', 'vercel', 'netlify', 'aws', 'gcp', 'azure', 'heroku', 'unknown'];
      for (const m of methods) {
        expect(typeof getDeployMethodLabel(m)).toBe('string');
        expect(getDeployMethodLabel(m).length).toBeGreaterThan(0);
      }
    });

    it('includes well-known labels', () => {
      expect(getDeployMethodLabel('docker')).toContain('Docker');
      expect(getDeployMethodLabel('kubernetes')).toContain('Kubernetes');
      expect(getDeployMethodLabel('npm')).toContain('npm');
    });

    it('returns unknown label for unknown method', () => {
      expect(getDeployMethodLabel('unknown')).toContain('未知');
    });
  });

  describe('displayEnvironmentInfo', () => {
    it('displays project name and type', () => {
      displayEnvironmentInfo(makeEnvInfo());
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join('\n');
      expect(output).toContain('test-project');
    });

    it('displays project root', () => {
      displayEnvironmentInfo(makeEnvInfo());
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join('\n');
      expect(output).toContain('/test/project');
    });

    it('displays summary counts', () => {
      displayEnvironmentInfo(makeEnvInfo({ summary: { hasBuildTool: true, hasCIConfig: true, hasDeployOption: true, buildToolCount: 3, deployOptionCount: 2 } }));
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join('\n');
      expect(output).toContain('3');
      expect(output).toContain('2');
    });
  });

  describe('displayDeployOptions', () => {
    it('displays header', () => {
      displayDeployOptions([]);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('部署'));
    });

    it('shows message when no options', () => {
      displayDeployOptions([]);
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join('\n');
      expect(output).toContain('未检测到');
    });

    it('displays each option method', () => {
      displayDeployOptions([makeDeployOption({ method: 'docker' }), makeDeployOption({ method: 'npm', command: 'npm run deploy' })]);
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join('\n');
      expect(output).toContain('Docker');
      expect(output).toContain('npm');
    });
  });

  describe('displayDevCommands', () => {
    it('displays setup commands', () => {
      displayDevCommands({ setup: ['npm install'], build: ['npm run build'], test: ['npm test'], dev: [], start: [] });
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join('\n');
      expect(output).toContain('npm install');
    });

    it('displays lint when present', () => {
      displayDevCommands({ setup: [], build: [], test: [], dev: [], start: [], lint: ['npm run lint'] });
      const output = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat().join('\n');
      expect(output).toContain('npm run lint');
    });
  });

  describe('formatDeployCommand', () => {
    it('returns command when present', () => {
      expect(formatDeployCommand(makeDeployOption({ command: 'docker build -t test .' }))).toBe('docker build -t test .');
    });

    it('returns placeholder when command missing', () => {
      const result = formatDeployCommand(makeDeployOption({ method: 'docker', command: undefined }));
      expect(result).toContain('docker');
    });

    it('returns kubectl placeholder for kubernetes', () => {
      expect(formatDeployCommand(makeDeployOption({ method: 'kubernetes', command: undefined }))).toContain('kubectl');
    });
  });

  describe('generateDeployCommands', () => {
    it('returns all options when no method specified', () => {
      const info = makeEnvInfo({ deployOptions: [makeDeployOption({ method: 'docker' }), makeDeployOption({ method: 'npm', command: 'npm run deploy' })] });
      expect(generateDeployCommands(info, undefined).length).toBe(2);
    });

    it('filters by method', () => {
      const info = makeEnvInfo({ deployOptions: [makeDeployOption({ method: 'docker' }), makeDeployOption({ method: 'npm', command: 'npm run deploy' })] });
      const result = generateDeployCommands(info, 'docker');
      expect(result.length).toBe(1);
      expect(result[0].method).toBe('docker');
    });

    it('returns empty when no match', () => {
      const info = makeEnvInfo({ deployOptions: [makeDeployOption({ method: 'docker' })] });
      expect(generateDeployCommands(info, 'kubernetes').length).toBe(0);
    });

    it('sets dryRun flag', () => {
      const info = makeEnvInfo();
      expect(generateDeployCommands(info, undefined, true)[0].dryRun).toBe(true);
    });

    it('includes required fields', () => {
      const result = generateDeployCommands(makeEnvInfo(), undefined, false);
      expect(result[0]).toHaveProperty('method');
      expect(result[0]).toHaveProperty('command');
      expect(result[0]).toHaveProperty('dryRun');
    });
  });

  describe('selectDeployOption', () => {
    it('returns recommended option', () => {
      const options = [makeDeployOption({ method: 'docker', recommended: true }), makeDeployOption({ method: 'npm', recommended: false, command: 'npm run deploy' })];
      expect(selectDeployOption(options)?.method).toBe('docker');
    });

    it('returns first when none recommended', () => {
      const options = [makeDeployOption({ method: 'docker', recommended: false }), makeDeployOption({ method: 'npm', recommended: false, command: 'npm run deploy' })];
      expect(selectDeployOption(options)?.method).toBe('docker');
    });

    it('returns undefined for empty array', () => {
      expect(selectDeployOption([])).toBeUndefined();
    });

    it('selects by method', () => {
      const options = [makeDeployOption({ method: 'docker' }), makeDeployOption({ method: 'npm', command: 'npm run deploy' })];
      expect(selectDeployOption(options, 'npm')?.method).toBe('npm');
    });

    it('returns undefined when method not found', () => {
      expect(selectDeployOption([makeDeployOption({ method: 'docker' })], 'kubernetes')).toBeUndefined();
    });
  });

  describe('JSON output format', () => {
    it('generates valid JSON from deploy commands', () => {
      const commands = generateDeployCommands(makeEnvInfo(), undefined, false);
      expect(() => JSON.parse(JSON.stringify({ deployCommands: commands }))).not.toThrow();
    });

    it('no recommendations field in raw output', () => {
      const commands = generateDeployCommands(makeEnvInfo(), undefined, false);
      const output = JSON.stringify({ deployCommands: commands });
      expect(output).not.toContain('recommendations');
    });
  });
});
