// src/cli/commands/test.ts
/**
 * Test 命令 - 项目测试状况扫描
 *
 * 功能：
 * - 检测测试框架
 * - 扫描测试文件和源文件
 * - 发现测试覆盖缺失
 * - 运行测试验证
 *
 * 模块依赖: types → cli/commands/test → test/context-analyzer
 */
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import type { TestScanResult, TestFrameworkInfo } from '../../types/index.js';

// 从 context-analyzer 模块导入核心函数
import {
  detectTestFrameworks,
  detectProjectType,
  scanTestFiles,
  scanSourceFiles,
  scanDirectory,
  inferSourceFile,
  inferFileType,
  extractExports,
  hasCorrespondingTest,
  inferTestTypes,
  detectFrontend,
  detectTestStyle,
  detectCoverageReport,
  performFullScan
} from '../../test/context-analyzer.js';

// 重导出函数（保持向后兼容）
export {
  detectTestFrameworks,
  detectProjectType,
  scanTestFiles,
  scanSourceFiles,
  scanDirectory,
  inferSourceFile,
  inferFileType,
  extractExports,
  hasCorrespondingTest,
  inferTestTypes,
  detectFrontend,
  detectTestStyle,
  detectCoverageReport
};

/**
 * 执行测试扫描（CLI 入口）
 */
export function performScan(projectRoot: string, target?: string): TestScanResult {
  return performFullScan(projectRoot, target);
}

/**
 * 运行测试验证
 */
async function runTests(projectRoot: string, frameworks: TestFrameworkInfo[]): Promise<{
  success: boolean;
  output: string;
  coverage?: number;
}> {
  const primaryFramework = frameworks.find(f => f.isPrimary) || frameworks[0];

  if (!primaryFramework || primaryFramework.framework === 'unknown') {
    return {
      success: false,
      output: 'No test framework detected'
    };
  }

  const testCommand = primaryFramework.commands.test;
  if (!testCommand) {
    return {
      success: false,
      output: 'No test command available'
    };
  }

  try {
    const { spawn } = await import('child_process');
    const parts = testCommand.split(' ');
    const command = parts[0];
    const args = parts.slice(1);

    return new Promise((resolve) => {
      let output = '';
      const proc = spawn(command, args, {
        cwd: projectRoot,
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        let coverage: number | undefined;
        const coverageMatch = output.match(/All files[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*([\d.]+)%/);
        if (coverageMatch) {
          coverage = parseFloat(coverageMatch[1]);
        }

        resolve({
          success: code === 0,
          output,
          coverage
        });
      });

      proc.on('error', (err) => {
        resolve({
          success: false,
          output: `Failed to run tests: ${err.message}`
        });
      });
    });
  } catch {
    return {
      success: false,
      output: 'Failed to spawn test process'
    };
  }
}

export const testCommand = new Command('test')
  .description('扫描项目测试状况 - 检测框架、扫描文件、发现缺失')
  .argument('[target]', '扫描目标目录或文件')
  .option('--json', '输出 JSON 格式')
  .option('--verify', '扫描后运行测试验证')
  .action(async (target: string | undefined, options) => {
    const projectRoot = process.cwd();

    if (!fs.existsSync(projectRoot)) {
      console.log('❌ 项目目录不存在');
      return;
    }

    const result = performScan(projectRoot, target);

    if (options.verify) {
      console.log('🔍 执行测试验证...\n');
      const verifyResult = await runTests(projectRoot, result.frameworks);
      result.coverageReport = {
        total: verifyResult.coverage || 0,
        files: []
      };

      if (!options.json) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`测试验证: ${verifyResult.success ? '✅ 通过' : '❌ 失败'}`);
        if (verifyResult.coverage) {
          console.log(`覆盖率: ${verifyResult.coverage}%`);
        }
        if (!verifyResult.success) {
          console.log('\n错误输出:');
          console.log(verifyResult.output.slice(0, 500));
        }
      }
    }

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    // 格式化输出
    console.log('\n🔍 测试扫描结果');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`扫描时间:   ${result.timestamp}`);
    console.log(`项目类型:   ${result.projectType}`);
    console.log(`前端项目:   ${result.isFrontend ? '是' : '否'}`);
    console.log(`UI组件:     ${result.hasUIComponents ? '有' : '无'}`);

    console.log('\n📊 测试框架:');
    for (const framework of result.frameworks) {
      const primary = framework.isPrimary ? ' (主要)' : '';
      console.log(`  - ${framework.framework}${primary}`);
      if (framework.version) console.log(`    版本: ${framework.version}`);
      if (framework.configFile) console.log(`    配置: ${framework.configFile}`);
      console.log(`    支持类型: ${framework.supportedTypes.join(', ')}`);
    }

    console.log('\n📁 文件统计:');
    console.log(`  现有测试: ${result.existingTests.length} 个`);
    console.log(`  未覆盖源: ${result.uncoveredSources.length} 个`);

    if (result.coverageReport) {
      console.log(`\n📈 覆盖率: ${result.coverageReport.total}%`);
    }

    if (result.testStyle) {
      console.log('\n📝 测试风格:');
      console.log(`  命名约定: ${result.testStyle.namingConvention}`);
      console.log(`  断言库:   ${result.testStyle.assertionLibrary}`);
      console.log(`  TypeScript: ${result.testStyle.usesTypeScript ? '是' : '否'}`);
    }

    if (result.uncoveredSources.length > 0) {
      console.log('\n⚠️  未覆盖的源文件:');
      for (const source of result.uncoveredSources.slice(0, 10)) {
        console.log(`  - ${source.path} (${source.fileType})`);
        if (source.exports.length > 0) {
          console.log(`    导出: ${source.exports.slice(0, 3).join(', ')}`);
        }
      }
      if (result.uncoveredSources.length > 10) {
        console.log(`  ... 还有 ${result.uncoveredSources.length - 10} 个文件`);
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 下一步:');
    console.log('   使用 /om:test 进入测试生成流程');
    console.log('   或使用 openmatrix test --verify 运行测试验证');
  });