# 设计方案: om:debug 系统化调试指令

日期: 2026-04-13

## 核心目标
- 系统化诊断问题根因（不做根因调查，不许提修复方案）
- 支持多种场景：项目代码 bug、任务执行失败、系统 bug、环境问题
- 交互式确认修复，用户完全可控
- 可独立使用，不依赖任务流程

## 架构设计

```
用户输入 → 智能路由 → CLI 初始化 → 根因调查 → 模式分析 → 诊断报告
                                                        ↓
                                               用户确认修复策略
                                                        ↓
                                               实施修复 → 验证 → 报告
```

## 数据类型

- `ProblemType` - 问题类型：task_failure/project_bug/system_bug/environment
- `DiagnosisReport` - 诊断报告：根因、影响范围、修复建议
- `DebugStatus` - 调试会话状态
- `DebugSession` - 调试会话完整数据

## 技术方案
- 四阶段流程：根因调查 → 模式分析 → 假设验证 → 实施
- 借鉴 superpowers:systematic-debugging 的核心原则
- 新增 DebugManager、ProblemDetector、ContextCollector、DebugReporter
- Skill 定义：skills/debug.md，四阶段交互流程

## 约束与风险
- 诊断阶段不修改任何文件（只读操作）
- 修复必须单一操作，不能批量修复
- 所有修改必须通过 Git 记录
- 3 次修复失败后必须暂停，不能继续试错

## 验收标准
- `openmatrix debug` 命令可执行
- `openmatrix debug --task TASK-XXX` 诊断指定任务
- `openmatrix debug "错误描述"` 分析指定问题
- `openmatrix debug --diagnose-only` 仅诊断不修复
- Skill `/om:debug` 可调用
- 诊断报告写入 `.openmatrix/debug/` 目录
