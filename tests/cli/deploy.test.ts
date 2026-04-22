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
import type { EnvironmentInfo, DeployOption, DeployMethod, DevCommands, BuildTool } from '../../src/types/index.js';

// ---------- Helpers ----------

function createEnvironmentInfo(overrides: Partial<EnvironmentInfo> = {}): EnvironmentInfo {
  return {
    projectName: 'test-project',
    projectType: 'typescript',
    projectRoot: '/test/project',
    timestamp: new Date().toISOString(),
    buildTools: [
      { type: 'npm', commands: ['build', 'test', 'start'], configFile: 'package.json', isDefault: true }
    ],
    deployOptions: [
      { method: 'docker', command: 'docker build -t test .', configFile: 'Dockerfile', recommended: true, description: 'Docker deployment' }
    ],
    devCommands: {
      setup: ['npm install'],
      build: ['npm run build'],
      test: ['npm run test'],
      dev: ['npm run dev'],
      start: ['npm run start']
    },
    summary: {
      hasBuildTool: true,
      hasCIConfig: false,
      hasDeployOption: true,
      buildToolCount: 1,
      deployOptionCount: 1
    },
    ...overrides
  };
}

function createDeployOption(overrides: Partial<DeployOption> = {}): DeployOption {
  return {
    method: 'docker',
    command: 'docker build -t test . && docker run test',
    configFile: 'Dockerfile',
    recommended: true,
    description: 'Docker container deployment',
    ...overrides
  };
}

function createDevCommands(overrides: Partial<DevCommands> = {}): DevCommands {
  return {
    setup: ['npm install'],
    build: ['npm run build'],
    test: ['npm run test'],
    dev: ['npm run dev'],
    start: ['npm run start'],
    ...overrides
  };
}

// ---------- Tests ----------

describe('deploy helper functions', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ======== getDeployMethodLabel ========

  describe('getDeployMethodLabel', () => {
    it('returns a label for every DeployMethod', () => {
      const methods: DeployMethod[] = [
        'docker', 'docker-compose', 'kubernetes', 'helm',
        'npm', 'make', 'script', 'github-pages',
        'vercel', 'netlify', 'aws', 'gcp', 'azure',
        'heroku', 'unknown'
      ];
      for (const method of methods) {
        const label = getDeployMethodLabel(method);
        expect(label).toBeDefined();
        expect(typeof label).toBe('string');
        expect(label.length).toBeGreaterThan(0);
      }
    });

    it('includes well-known method labels', () => {
      expect(getDeployMethodLabel('docker')).toContain('Docker');
      expect(getDeployMethodLabel('kubernetes')).toContain('Kubernetes');
      expect(getDeployMethodLabel('npm')).toContain('npm');
    });

    it('returns consistent labels', () => {
      const a = getDeployMethodLabel('docker');
      const b = getDeployMethodLabel('docker');
      expect(a).toBe(b);
    });

    it('returns unknown label for unknown method', () => {
      const label = getDeployMethodLabel('unknown');
      expect(label).toContain('未知');
    });
  });

  // ======== displayEnvironmentInfo ========

  describe('displayEnvironmentInfo', () => {
    it('displays project name and type', () => {
      const info = createEnvironmentInfo();
      displayEnvironmentInfo(info);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('test-project');
      expect(joined).toContain('TypeScript');
    });

    it('displays project root', () => {
      const info = createEnvironmentInfo();
      displayEnvironmentInfo(info);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('/test/project');
    });

    it('displays timestamp', () => {
      const info = createEnvironmentInfo({ timestamp: '2025-01-15T10:30:00.000Z' });
      displayEnvironmentInfo(info);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('检测时间');
    });

    it('displays summary counts', () => {
      const info = createEnvironmentInfo({
        summary: {
          hasBuildTool: true,
          hasCIConfig: true,
          hasDeployOption: true,
          buildToolCount: 3,
          deployOptionCount: 2
        }
      });
      displayEnvironmentInfo(info);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('3');
      expect(joined).toContain('2');
    });
  });

  // ======== displayDeployOptions ========

  describe('displayDeployOptions', () => {
    it('displays header', () => {
      displayDeployOptions([]);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('部署选项'));
    });

    it('displays message when no deploy options', () => {
      displayDeployOptions([]);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('未检测到');
    });

    it('displays each deploy option', () => {
      const options = [
        createDeployOption({ method: 'docker', command: 'docker build -t test .' }),
        createDeployOption({ method: 'npm', command: 'npm run deploy' }),
      ];
      displayDeployOptions(options);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('docker');
      expect(joined).toContain('npm');
    });

    it('shows recommended indicator', () => {
      const options = [createDeployOption({ recommended: true })];
      displayDeployOptions(options);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('推荐');
    });

    it('shows command for each option', () => {
      const options = [createDeployOption({ command: 'docker build -t test .' })];
      displayDeployOptions(options);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('docker build');
    });
  });

  // ======== displayDevCommands ========

  describe('displayDevCommands', () => {
    it('displays header', () => {
      const commands = createDevCommands();
      displayDevCommands(commands);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('开发命令'));
    });

    it('displays setup commands', () => {
      const commands = createDevCommands({ setup: ['npm install', 'npm run setup'] });
      displayDevCommands(commands);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('npm install');
    });

    it('displays build commands', () => {
      const commands = createDevCommands({ build: ['npm run build'] });
      displayDevCommands(commands);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('npm run build');
    });

    it('displays test commands', () => {
      const commands = createDevCommands({ test: ['npm run test'] });
      displayDevCommands(commands);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('npm run test');
    });

    it('displays optional lint commands', () => {
      const commands = createDevCommands({ lint: ['npm run lint'] });
      displayDevCommands(commands);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      expect(joined).toContain('npm run lint');
    });

    it('does not display undefined lint commands', () => {
      const commands = createDevCommands();
      displayDevCommands(commands);
      const calls = (console.log as ReturnType<typeof vi.fn>).mock.calls.flat();
      const joined = calls.join('\n');
      // lint is optional, should not appear if undefined
      expect(joined).not.toContain('Lint');
    });
  });

  // ======== formatDeployCommand ========

  describe('formatDeployCommand', () => {
    it('returns command when present', () => {
      const option = createDeployOption({ command: 'docker build -t test .' });
      const result = formatDeployCommand(option);
      expect(result).toBe('docker build -t test .');
    });

    it('returns placeholder when command missing', () => {
      const option = createDeployOption({ method: 'docker', command: undefined });
      const result = formatDeployCommand(option);
      expect(result).toContain('docker');
    });

    it('returns appropriate placeholder for npm', () => {
      const option = createDeployOption({ method: 'npm', command: undefined });
      const result = formatDeployCommand(option);
      expect(result).toContain('npm');
    });

    it('returns appropriate placeholder for kubernetes', () => {
      const option = createDeployOption({ method: 'kubernetes', command: undefined });
      const result = formatDeployCommand(option);
      expect(result).toContain('kubectl');
    });
  });

  // ======== generateDeployCommands ========

  describe('generateDeployCommands', () => {
    it('generates commands for all options when no method specified', () => {
      const info = createEnvironmentInfo({
        deployOptions: [
          createDeployOption({ method: 'docker', command: 'docker build .' }),
          createDeployOption({ method: 'npm', command: 'npm run deploy' }),
        ]
      });
      const result = generateDeployCommands(info, undefined);
      expect(result.length).toBe(2);
    });

    it('filters by deploy method', () => {
      const info = createEnvironmentInfo({
        deployOptions: [
          createDeployOption({ method: 'docker', command: 'docker build .' }),
          createDeployOption({ method: 'npm', command: 'npm run deploy' }),
        ]
      });
      const result = generateDeployCommands(info, 'docker');
      expect(result.length).toBe(1);
      expect(result[0].method).toBe('docker');
    });

    it('returns empty array when no matching method', () => {
      const info = createEnvironmentInfo({
        deployOptions: [createDeployOption({ method: 'docker' })]
      });
      const result = generateDeployCommands(info, 'kubernetes');
      expect(result.length).toBe(0);
    });

    it('returns empty array when no deploy options', () => {
      const info = createEnvironmentInfo({ deployOptions: [] });
      const result = generateDeployCommands(info, undefined);
      expect(result.length).toBe(0);
    });

    it('includes dry-run indicator', () => {
      const info = createEnvironmentInfo({
        deployOptions: [createDeployOption({ method: 'docker', command: 'docker build .' })]
      });
      const result = generateDeployCommands(info, undefined, true);
      expect(result[0].dryRun).toBe(true);
    });

    it('generates JSON output format', () => {
      const info = createEnvironmentInfo({
        deployOptions: [createDeployOption({ method: 'docker', command: 'docker build .' })]
      });
      const result = generateDeployCommands(info, undefined, false);
      expect(result[0]).toHaveProperty('method');
      expect(result[0]).toHaveProperty('command');
      expect(result[0]).toHaveProperty('description');
    });
  });

  // ======== selectDeployOption ========

  describe('selectDeployOption', () => {
    it('returns recommended option when available', () => {
      const options = [
        createDeployOption({ method: 'docker', recommended: true }),
        createDeployOption({ method: 'npm', recommended: false }),
      ];
      const result = selectDeployOption(options);
      expect(result?.method).toBe('docker');
    });

    it('returns first option when no recommended', () => {
      const options = [
        createDeployOption({ method: 'docker', recommended: false }),
        createDeployOption({ method: 'npm', recommended: false }),
      ];
      const result = selectDeployOption(options);
      expect(result?.method).toBe('docker');
    });

    it('returns undefined when no options', () => {
      const result = selectDeployOption([]);
      expect(result).toBeUndefined();
    });

    it('can select by method', () => {
      const options = [
        createDeployOption({ method: 'docker' }),
        createDeployOption({ method: 'npm' }),
      ];
      const result = selectDeployOption(options, 'npm');
      expect(result?.method).toBe('npm');
    });

    it('returns undefined when method not found', () => {
      const options = [createDeployOption({ method: 'docker' })];
      const result = selectDeployOption(options, 'kubernetes');
      expect(result).toBeUndefined();
    });
  });

  // ======== Integration-like Tests ========

  describe('deploy output format', () => {
    it('generates valid JSON for --json output', () => {
      const info = createEnvironmentInfo();
      const commands = generateDeployCommands(info, undefined, false);
      const jsonOutput = JSON.stringify({ deployCommands: commands }, null, 2);
      expect(() => JSON.parse(jsonOutput)).not.toThrow();
    });

    it('includes all required fields in JSON output', () => {
      const info = createEnvironmentInfo({
        deployOptions: [
          createDeployOption({
            method: 'docker',
            command: 'docker build -t test .',
            configFile: 'Dockerfile',
            description: 'Docker deployment'
          })
        ]
      });
      const commands = generateDeployCommands(info, undefined, false);
      expect(commands[0]).toHaveProperty('method');
      expect(commands[0]).toHaveProperty('command');
      expect(commands[0]).toHaveProperty('configFile');
      expect(commands[0]).toHaveProperty('description');
      expect(commands[0]).toHaveProperty('dryRun');
    });

    it('supports multiple deploy methods selection', () => {
      const info = createEnvironmentInfo({
        deployOptions: [
          createDeployOption({ method: 'docker' }),
          createDeployOption({ method: 'docker-compose' }),
          createDeployOption({ method: 'npm' }),
        ]
      });
      // Filter by docker-like methods
      const dockerMethods: DeployMethod[] = ['docker', 'docker-compose'];
      const filtered = info.deployOptions.filter(o => dockerMethods.includes(o.method));
      expect(filtered.length).toBe(2);
    });
  });
});