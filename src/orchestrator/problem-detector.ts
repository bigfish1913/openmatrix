// src/orchestrator/problem-detector.ts
import type { ProblemType } from '../types/index.js';

export interface ProblemDetectionConfig {
  description?: string;
  taskId?: string;
  taskError?: string | null;
}

/**
 * 判断问题类型的检测器
 */
export class ProblemDetector {
  /**
   * 根据配置判断问题类型
   */
  async detect(config: ProblemDetectionConfig): Promise<ProblemType> {
    // 有任务 ID 且任务失败
    if (config.taskId && config.taskError) {
      return 'task_failure';
    }

    // 根据描述判断
    if (config.description) {
      const desc = config.description.toLowerCase();

      // 环境相关关键词
      const envKeywords = [
        '依赖', '安装', '环境', '配置', 'npm install', 'node_modules',
        'env', 'environment', 'dependency', 'install', 'config',
        'path', '版本', 'version', '权限', 'permission'
      ];

      // 项目代码相关关键词
      const projectKeywords = [
        '接口', 'api', '函数', 'function', '返回', 'response',
        '数据', 'data', '逻辑', 'logic', '页面', 'page',
        '组件', 'component', '样式', 'style', '渲染', 'render'
      ];

      // 系统/OpenMatrix 相关关键词
      const systemKeywords = [
        'openmatrix', 'cli', '命令', 'command', '状态', 'state',
        '任务', 'task', '编排', 'orchestrat', 'agent', '技能', 'skill'
      ];

      const hasEnvKeyword = envKeywords.some(kw => desc.includes(kw));
      const hasProjectKeyword = projectKeywords.some(kw => desc.includes(kw));
      const hasSystemKeyword = systemKeywords.some(kw => desc.includes(kw));

      // 优先级：环境 > 项目 > 系统
      if (hasEnvKeyword) return 'environment';
      if (hasProjectKeyword) return 'project_bug';
      if (hasSystemKeyword) return 'system_bug';
    }

    // 默认：系统 bug
    return 'system_bug';
  }
}
