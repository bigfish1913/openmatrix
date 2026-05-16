# OpenMatrix

<div align="center">

**你的代码没测试？OpenMatrix 自动帮你补，覆盖率 >80%**

*自动化 ≠ 牺牲质量 | 高质量 ≠ 手动操作*

[![npm version](https://img.shields.io/npm/v/openmatrix.svg?color=blue&label=npm)](https://www.npmjs.com/package/openmatrix)
[![npm downloads](https://img.shields.io/npm/dm/openmatrix.svg?color=green&label=downloads)](https://www.npmjs.com/package/openmatrix)
[![GitHub stars](https://img.shields.io/github/stars/bigfish1913/openmatrix.svg?style=social&label=Star)](https://github.com/bigfish1913/openmatrix/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Compatible-blue.svg)](https://claude.ai/code)

**[中文](README.md)** | **[English](README_EN.md)**

</div>

---

## 30秒演示

```
/om 实现用户登录功能

# 自动启动任务编排 → 选择质量级别 → 全自动执行 → 质量门禁 → AI验收 → 完成
```

> `/om` 是 `/om:start` 的快捷方式。直接输入任务描述即可自动触发。

---

## 三种质量模式

| 模式 | 覆盖率 | 测试 | Lint | 安全 | 适用场景 |
|:----:|:------:|:----:|:----:|:----:|---------|
| **strict** | >80% | TDD 先写测试 | 严格 | npm audit | 生产代码 |
| **balanced** | >60% | 后补测试 | 标准 | npm audit | 日常开发 |
| **fast** | >20% | 可选 | 无 | 无 | 快速原型 |

> E2E 测试可选（Playwright/Cypress/Appium）

---

## 快速开始

```bash
# 安装
npm install -g openmatrix

# 验证
openmatrix --version

# 使用
/om 实现用户登录
```

---

## 核心命令

| 命令 | 用途 |
|------|------|
| `/om` | 默认入口 - 直接输入任务描述 |
| `/om:test` | 自动补测试 - 给现有代码补充测试 |
| `/om:debug` | 系统化调试 - 四阶段根因分析 + 自动修复 |
| `/om:feature` | 轻量小需求 - 快速迭代，无完整任务追踪 |
| `/om:brainstorm` | 头脑风暴 - 先探索需求和设计 |
| `/om:auto` | 全自动执行 - 无阻塞、无确认、适合 CI/CD |

---

## 七道质量门禁

```
Gate 1: 编译检查    npm run build    → 必须通过
Gate 2: 测试运行    npm test         → 必须通过
Gate 3: 覆盖率检查  >20%/60%/80%     → 可配置
Gate 4: Lint 检查   无 error         → 可配置
Gate 5: 安全扫描    npm audit        → 无高危漏洞
Gate 6: E2E 测试    Playwright 等    → 可选
Gate 7: 验收标准    用户定义         → 必须全部满足
```

---

## 与 superpowers 配合

OpenMatrix 自动执行任务 + superpowers 提供额外技能 = 完美组合

```bash
# superpowers 写代码，OpenMatrix 保证质量
/om 实现用户登录    # 自动 TDD + 质量门禁 + AI 验收
```

---

## 详细文档

| 文档 | 内容 |
|------|------|
| [执行流程图](docs/FLOW.md) | 完整流程图和阶段说明 |
| [开发路线图](docs/ROADMAP.md) | 功能规划和进度 |
| [系统架构](docs/ARCHITECTURE.md) | 核心组件和设计 |
| [术语对照表](docs/TERMINOLOGY.md) | 中英文术语对照 |

---

## 常见问题

**Q: 哪种质量级别适合我？**

| 场景 | 推荐模式 |
|------|---------|
| 生产代码、核心功能 | strict |
| 日常功能开发 | balanced |
| 快速原型、POC | fast |

**Q: Meeting 是什么？**

A: 遇到阻塞时创建记录，但**不停止执行**。最后用 `/om:meeting` 统一处理所有阻塞。

**Q: 支持哪些语言？**

A: 原生支持 TypeScript/JavaScript、Python、Go、Java、Rust 等所有主流语言。

---

## 配置示例

```json
{
  "quality": {
    "tdd": false,
    "minCoverage": 60,
    "strictLint": true,
    "securityScan": true,
    "e2eTests": false
  },
  "approvalPoints": ["plan", "merge"],
  "agents": { "maxConcurrent": 3 }
}
```

---

<div align="center">

**如果觉得有用，请给个 Star！**

[![Star History Chart](https://api.star-history.com/svg?repos=bigfish1913/openmatrix&type=Date)](https://star-history.com/#/bigfish1913/openmatrix&Date)

MIT | Made by [bigfish1913](https://github.com/bigfish1913)

</div>