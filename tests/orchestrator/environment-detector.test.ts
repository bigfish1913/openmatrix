// tests/orchestrator/environment-detector.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnvironmentDetector, DEFAULT_ENVIRONMENT_DETECTOR_CONFIG } from '../../src/orchestrator/environment-detector.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('EnvironmentDetector', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary test directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'env-detector-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('detectProjectType', () => {
    it('should detect TypeScript project', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          devDependencies: { typescript: '^5.0.0' }
        })
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('typescript');
    });

    it('should detect Node.js project', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test-project' })
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('nodejs');
    });

    it('should detect Python project by pyproject.toml', async () => {
      await fs.writeFile(path.join(tempDir, 'pyproject.toml'), '');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('python');
    });

    it('should detect Python project by requirements.txt', async () => {
      await fs.writeFile(path.join(tempDir, 'requirements.txt'), 'flask==2.0.0');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('python');
    });

    it('should detect Go project', async () => {
      await fs.writeFile(path.join(tempDir, 'go.mod'), 'module test');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('go');
    });

    it('should detect Rust project', async () => {
      await fs.writeFile(path.join(tempDir, 'Cargo.toml'), '[package]\nname = "test"');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('rust');
    });

    it('should detect Java project by pom.xml', async () => {
      await fs.writeFile(path.join(tempDir, 'pom.xml'), '<project></project>');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('java');
    });

    it('should detect Java project by build.gradle', async () => {
      await fs.writeFile(path.join(tempDir, 'build.gradle'), '');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('java');
    });

    it('should detect C# project by .sln file', async () => {
      await fs.writeFile(path.join(tempDir, 'Test.sln'), '');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('csharp');
    });

    it('should detect C/C++ project by CMakeLists.txt', async () => {
      await fs.writeFile(path.join(tempDir, 'CMakeLists.txt'), '');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('cpp');
    });

    it('should detect C/C++ project by Makefile', async () => {
      await fs.writeFile(path.join(tempDir, 'Makefile'), 'all:\n\techo "build"');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('cpp');
    });

    it('should detect PHP project', async () => {
      await fs.writeFile(path.join(tempDir, 'composer.json'), '{}');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('php');
    });

    it('should detect Dart project', async () => {
      await fs.writeFile(path.join(tempDir, 'pubspec.yaml'), 'name: test');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('dart');
    });

    it('should return unknown for unrecognized project', async () => {
      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('unknown');
    });
  });

  describe('detectBuildTools', () => {
    it('should detect npm scripts from package.json', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          scripts: {
            build: 'tsc',
            test: 'vitest',
            start: 'node dist/index.js',
            lint: 'eslint src/'
          }
        })
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.buildTools.some(t => t.type === 'npm')).toBe(true);
      const npmTool = result.buildTools.find(t => t.type === 'npm');
      expect(npmTool?.commands).toContain('build');
      expect(npmTool?.commands).toContain('test');
      expect(npmTool?.commands).toContain('start');
      expect(npmTool?.commands).toContain('lint');
    });

    it('should detect Makefile build commands', async () => {
      await fs.writeFile(
        path.join(tempDir, 'Makefile'),
        `build:
\techo "building"
test:
\techo "testing"
clean:
\techo "cleaning"`
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.buildTools.some(t => t.type === 'make')).toBe(true);
      const makeTool = result.buildTools.find(t => t.type === 'make');
      expect(makeTool?.commands).toContain('build');
      expect(makeTool?.commands).toContain('test');
      expect(makeTool?.commands).toContain('clean');
    });

    it('should detect Docker with Dockerfile', async () => {
      await fs.writeFile(
        path.join(tempDir, 'Dockerfile'),
        `FROM node:18
WORKDIR /app
COPY . .
RUN npm install
CMD ["npm", "start"]`
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.buildTools.some(t => t.type === 'docker')).toBe(true);
      const dockerTool = result.buildTools.find(t => t.type === 'docker');
      expect(dockerTool?.configFile).toBe('Dockerfile');
    });

    it('should detect Docker with docker-compose.yml', async () => {
      await fs.writeFile(
        path.join(tempDir, 'docker-compose.yml'),
        `version: '3'
services:
  app:
    build: .`
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.buildTools.some(t => t.type === 'docker')).toBe(true);
      const dockerTool = result.buildTools.find(t => t.type === 'docker');
      expect(dockerTool?.configFile).toBe('docker-compose.yml');
    });

    it('should detect multiple build tools', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          scripts: { build: 'tsc', test: 'vitest' }
        })
      );
      await fs.writeFile(path.join(tempDir, 'Dockerfile'), 'FROM node:18');
      await fs.writeFile(path.join(tempDir, 'Makefile'), 'deploy:\n\techo "deploy"');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.buildTools.length).toBeGreaterThanOrEqual(3);
      expect(result.buildTools.some(t => t.type === 'npm')).toBe(true);
      expect(result.buildTools.some(t => t.type === 'docker')).toBe(true);
      expect(result.buildTools.some(t => t.type === 'make')).toBe(true);
    });

    it('should detect gradle for Java project', async () => {
      await fs.writeFile(path.join(tempDir, 'build.gradle'), 'apply plugin: "java"');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.buildTools.some(t => t.type === 'gradle')).toBe(true);
    });

    it('should detect maven for Java project', async () => {
      await fs.writeFile(path.join(tempDir, 'pom.xml'), '<project></project>');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.buildTools.some(t => t.type === 'maven')).toBe(true);
    });

    it('should detect cargo for Rust project', async () => {
      await fs.writeFile(path.join(tempDir, 'Cargo.toml'), '[package]\nname = "test"');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.buildTools.some(t => t.type === 'cargo')).toBe(true);
    });

    it('should detect go build tool for Go project', async () => {
      await fs.writeFile(path.join(tempDir, 'go.mod'), 'module test');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.buildTools.some(t => t.type === 'go')).toBe(true);
    });

    it('should detect pip for Python project', async () => {
      await fs.writeFile(path.join(tempDir, 'requirements.txt'), 'flask==2.0.0');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.buildTools.some(t => t.type === 'pip')).toBe(true);
    });

    it('should return empty array for project without build tools', async () => {
      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.buildTools).toEqual([]);
    });
  });

  describe('detectCIConfig', () => {
    it('should detect GitHub Actions', async () => {
      await fs.mkdir(path.join(tempDir, '.github', 'workflows'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.github', 'workflows', 'ci.yml'),
        `name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest`
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.ciConfig).toBeDefined();
      expect(result.ciConfig?.platform).toBe('github-actions');
      expect(result.ciConfig?.configFiles).toContain('.github/workflows/ci.yml');
    });

    it('should detect GitLab CI', async () => {
      await fs.writeFile(
        path.join(tempDir, '.gitlab-ci.yml'),
        `stages:
  - build
  - test`
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.ciConfig).toBeDefined();
      expect(result.ciConfig?.platform).toBe('gitlab-ci');
      expect(result.ciConfig?.configFiles).toContain('.gitlab-ci.yml');
    });

    it('should detect Jenkins', async () => {
      await fs.writeFile(
        path.join(tempDir, 'Jenkinsfile'),
        `pipeline {
  agent any
  stages {
    stage('Build') { steps { sh 'make build' } }
  }
}`
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.ciConfig).toBeDefined();
      expect(result.ciConfig?.platform).toBe('jenkins');
      expect(result.ciConfig?.configFiles).toContain('Jenkinsfile');
    });

    it('should detect CircleCI', async () => {
      await fs.mkdir(path.join(tempDir, '.circleci'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, '.circleci', 'config.yml'),
        `version: 2.1
jobs:
  build:
    docker:
      - image: circleci/node:18`
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.ciConfig).toBeDefined();
      expect(result.ciConfig?.platform).toBe('circleci');
      expect(result.ciConfig?.configFiles).toContain('.circleci/config.yml');
    });

    it('should return undefined for project without CI config', async () => {
      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.ciConfig).toBeUndefined();
    });
  });

  describe('detectDeployConfig', () => {
    it('should detect Docker deployment', async () => {
      await fs.writeFile(path.join(tempDir, 'Dockerfile'), 'FROM node:18');
      await fs.writeFile(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }));

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.deployOptions.some(d => d.method === 'docker')).toBe(true);
    });

    it('should detect docker-compose deployment', async () => {
      await fs.writeFile(
        path.join(tempDir, 'docker-compose.yml'),
        `version: '3'
services:
  app:
    build: .`
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.deployOptions.some(d => d.method === 'docker-compose')).toBe(true);
    });

    it('should detect Makefile deployment commands', async () => {
      await fs.writeFile(
        path.join(tempDir, 'Makefile'),
        `deploy:
\techo "deploying"
deploy-prod:
\techo "deploying to prod"`
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.deployOptions.some(d => d.method === 'make')).toBe(true);
    });

    it('should detect npm deployment scripts', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          scripts: {
            deploy: 'npm run build && npm publish',
            'deploy:prod': 'npm run deploy -- --prod'
          }
        })
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.deployOptions.some(d => d.method === 'npm')).toBe(true);
    });

    it('should detect Kubernetes deployment', async () => {
      await fs.mkdir(path.join(tempDir, 'k8s'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'k8s', 'deployment.yaml'),
        `apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp`
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.deployOptions.some(d => d.method === 'kubernetes')).toBe(true);
    });

    it('should detect Helm deployment', async () => {
      await fs.mkdir(path.join(tempDir, 'helm'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'helm', 'Chart.yaml'),
        `name: myapp
version: 1.0.0`
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.deployOptions.some(d => d.method === 'helm')).toBe(true);
    });

    it('should return empty array for project without deploy config', async () => {
      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.deployOptions).toEqual([]);
    });
  });

  describe('detectDevCommands', () => {
    it('should extract dev commands from package.json', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          scripts: {
            dev: 'vite',
            start: 'node dist/index.js',
            build: 'tsc',
            test: 'vitest',
            lint: 'eslint'
          }
        })
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.devCommands.setup).toContain('npm install');
      expect(result.devCommands.build).toContain('npm run build');
      expect(result.devCommands.test).toContain('npm run test');
      expect(result.devCommands.dev).toContain('npm run dev');
      expect(result.devCommands.start).toContain('npm run start');
    });

    it('should use yarn when yarn.lock exists', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          scripts: { build: 'tsc', test: 'vitest' }
        })
      );
      await fs.writeFile(path.join(tempDir, 'yarn.lock'), '');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.devCommands.setup).toContain('yarn install');
      expect(result.devCommands.build).toContain('yarn build');
    });

    it('should use pnpm when pnpm-lock.yaml exists', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          scripts: { build: 'tsc', test: 'vitest' }
        })
      );
      await fs.writeFile(path.join(tempDir, 'pnpm-lock.yaml'), '');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.devCommands.setup).toContain('pnpm install');
      expect(result.devCommands.build).toContain('pnpm run build');
    });

    it('should extract make commands for non-Node projects', async () => {
      await fs.writeFile(
        path.join(tempDir, 'Makefile'),
        `build:
\techo "build"
test:
\techo "test"
dev:
\techo "dev"`
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.devCommands.build).toContain('make build');
      expect(result.devCommands.test).toContain('make test');
      expect(result.devCommands.dev).toContain('make dev');
    });

    it('should provide python commands for Python project', async () => {
      await fs.writeFile(path.join(tempDir, 'requirements.txt'), 'flask==2.0.0');
      await fs.mkdir(path.join(tempDir, 'tests'));

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.devCommands.setup).toContain('pip install -r requirements.txt');
      expect(result.devCommands.test).toBeDefined();
    });

    it('should provide go commands for Go project', async () => {
      await fs.writeFile(path.join(tempDir, 'go.mod'), 'module test');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.devCommands.setup).toContain('go mod download');
      expect(result.devCommands.build).toContain('go build');
      expect(result.devCommands.test).toContain('go test ./...');
    });

    it('should provide cargo commands for Rust project', async () => {
      await fs.writeFile(path.join(tempDir, 'Cargo.toml'), '[package]\nname = "test"');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.devCommands.setup).toContain('cargo fetch');
      expect(result.devCommands.build).toContain('cargo build');
      expect(result.devCommands.test).toContain('cargo test');
    });
  });

  describe('getProjectName', () => {
    it('should get project name from package.json', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'my-awesome-project' })
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectName).toBe('my-awesome-project');
    });

    it('should get project name from pyproject.toml', async () => {
      await fs.writeFile(
        path.join(tempDir, 'pyproject.toml'),
        `[project]
name = "python-project"`
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectName).toBe('python-project');
    });

    it('should get project name from go.mod', async () => {
      await fs.writeFile(path.join(tempDir, 'go.mod'), 'module go-project');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectName).toBe('go-project');
    });

    it('should fallback to directory name if no config', async () => {
      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectName).toBe(path.basename(tempDir));
    });
  });

  describe('summary generation', () => {
    it('should generate correct summary', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test',
          scripts: { build: 'tsc', test: 'vitest' }
        })
      );
      await fs.writeFile(path.join(tempDir, 'Dockerfile'), 'FROM node:18');
      await fs.mkdir(path.join(tempDir, '.github', 'workflows'), { recursive: true });
      await fs.writeFile(path.join(tempDir, '.github', 'workflows', 'ci.yml'), 'name: CI');

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.summary.hasBuildTool).toBe(true);
      expect(result.summary.hasCIConfig).toBe(true);
      expect(result.summary.hasDeployOption).toBe(true);
      expect(result.summary.buildToolCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('empty project', () => {
    it('should handle empty project directory', async () => {
      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      expect(result.projectType).toBe('unknown');
      expect(result.buildTools).toEqual([]);
      expect(result.ciConfig).toBeUndefined();
      expect(result.deployOptions).toEqual([]);
      expect(result.summary.hasBuildTool).toBe(false);
      expect(result.summary.hasCIConfig).toBe(false);
      expect(result.summary.hasDeployOption).toBe(false);
    });
  });

  describe('config options', () => {
    it('should use custom config for scanning', async () => {
      await fs.mkdir(path.join(tempDir, 'custom'));
      await fs.writeFile(
        path.join(tempDir, 'custom', 'package.json'),
        JSON.stringify({ name: 'test', scripts: { build: 'tsc' } })
      );

      const detector = new EnvironmentDetector(tempDir, {
        scanDirs: ['custom']
      });
      const result = await detector.detect();

      expect(result.buildTools.some(t => t.type === 'npm')).toBe(true);
    });

    it('should respect excludeDirs', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'main', scripts: { build: 'tsc' } })
      );
      await fs.mkdir(path.join(tempDir, 'ignored'));
      await fs.writeFile(
        path.join(tempDir, 'ignored', 'Makefile'),
        'build:\n\techo "build"'
      );

      const detector = new EnvironmentDetector(tempDir, {
        scanDirs: ['', 'ignored'],
        excludeDirs: ['ignored']
      });
      const result = await detector.detect();

      // Makefile should not be detected because 'ignored' is excluded
      expect(result.buildTools.some(t => t.type === 'make')).toBe(false);
    });
  });

  describe('toJSON output', () => {
    it('should return valid JSON string', async () => {
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({ name: 'test', scripts: { build: 'tsc' } })
      );

      const detector = new EnvironmentDetector(tempDir);
      const result = await detector.detect();

      const json = detector.toJSON(result);
      expect(() => JSON.parse(json)).not.toThrow();

      const parsed = JSON.parse(json);
      expect(parsed.projectName).toBe('test');
      expect(parsed.projectType).toBe('nodejs');
    });
  });

  describe('DEFAULT_ENVIRONMENT_DETECTOR_CONFIG', () => {
    it('should have default configuration values', () => {
      expect(DEFAULT_ENVIRONMENT_DETECTOR_CONFIG.scanDirs).toBeDefined();
      expect(DEFAULT_ENVIRONMENT_DETECTOR_CONFIG.excludeDirs).toBeDefined();
      expect(Array.isArray(DEFAULT_ENVIRONMENT_DETECTOR_CONFIG.scanDirs)).toBe(true);
      expect(Array.isArray(DEFAULT_ENVIRONMENT_DETECTOR_CONFIG.excludeDirs)).toBe(true);
    });
  });
});