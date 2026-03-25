# OpenMatrix

<div align="center">

**唯一同时实现 TDD + 严格质量门禁 + 全自动执行的 AI 任务编排系统**

*自动化 ≠ 牺牲质量 | 高质量 ≠ 手动操作*

[![npm version](https://badge.fury.io/js/openmatrix.svg)](https://badge.fury.io/js/openmatrix)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/Node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Compatible-blue.svg)](https://claude.ai/code)

[English](#english) | [中文文档](#中文文档)

</div>

---

# 中文文档

## 目录

- [痛点](#痛点)
- [解决方案](#解决方案)
- [快速开始](#快速开始)
- [核心特性](#核心特性)
- [与其他方案对比](#与其他方案对比)
- [使用指南](#使用指南)
- [配置](#配置)
- [开发](#开发)

---

## 痛点

你是否遇到过这些问题？

| 问题 | superpowers | gsd | 传统开发 |
|------|-------------|-----|---------|
| ❌ AI 写的代码有 bug | 经常 | 经常 | 经常 |
| ❌ 测试覆盖率不够 | 无保证 | 无保证 | 靠自觉 |
| ❌ 代码风格不一致 | 无强制 | 无强制 | 靠 Code Review |
| ❌ 安全漏洞 | 不检查 | 不检查 | 靠自觉 |
| ❌ 遇到阻塞就停止 | 是 | 是 | N/A |
| ❌ 需要手动调用多个技能 | 是 | 是 | N/A |

**核心问题**: 现有方案要么**自动化但不保证质量**，要么**质量好但需要手动操作**。

---

## 解决方案

**OpenMatrix = 100% 自动化 + 6 道质量门禁**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   用户: /om:start --quality strict 实现用户登录                  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   🧪 TDD 阶段:   先写测试 (测试必须失败 → RED)                   │
│   ✨ 开发阶段:   再写代码 (测试必须通过 → GREEN)                 │
│   ✅ 验证阶段:   6 道质量门禁                                    │
│   🎉 验收阶段:   最终确认 + 质量报告                             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   📊 质量报告:                                                   │
│   ├── Tests:     ✅ 15/15 passed, 82% coverage                  │
│   ├── Build:     ✅ Success                                     │
│   ├── Lint:      ✅ No errors (3 warnings)                      │
│   ├── Security:  ✅ No vulnerabilities                          │
│   └── Criteria:  ✅ 5/5 acceptance criteria met                 │
│                                                                 │
│   ⏱️ 耗时: 12分钟 | 质量评分: A | 状态: ✅ 完成                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 快速开始

### 安装

```bash
# 克隆并安装
git clone https://github.com/bigfish1913/openmatrix.git
cd openmatrix && npm install && npm run build && npm link

# 复制 Skills 到 Claude Code
mkdir -p ~/.claude/commands/om
cp skills/*.md ~/.claude/commands/om/

# 验证安装
openmatrix --version
```

### 第一次使用

```bash
# 启动任务 (第一个问题就是选择质量级别)
/om:start 实现用户登录功能

# 系统会问:
# 问题 0: 选择质量级别?
#   - 🚀 strict (推荐生产代码) → TDD + 80%覆盖率 + AI验收
#   - ⚖️ balanced (日常开发)   → 60%覆盖率 + AI验收
#   - ⚡ fast (快速原型)       → 无质量门禁
```

### 质量级别选择指南

| 你的场景 | 推荐级别 | 为什么 |
|---------|---------|--------|
| 生产代码、核心功能 | **strict** | TDD 保证质量，80%覆盖率 |
| 日常功能开发 | **balanced** | 速度与质量平衡 |
| 快速原型、POC | **fast** | 最快速度验证想法 |

### 验证安装成功

```bash
/om:status
# 应该显示: OpenMatrix is ready. Run /om:start to begin.
```

---

## 核心特性

### 1️⃣ 三级质量配置

| 级别 | TDD | 覆盖率 | Lint | 安全 | 适用场景 |
|------|:---:|:------:|:----:|:----:|---------|
| `fast` | ❌ | 0% | ❌ | ❌ | 快速原型、POC、实验 |
| `balanced` | ❌ | 60% | ✅ | ✅ | **日常开发 (默认)** |
| `strict` | ✅ | 80% | ✅ | ✅ | 生产代码、核心功能 |

```bash
/om:start --quality fast     # 5分钟原型
/om:start --quality balanced # 10分钟功能 (默认)
/om:start --quality strict   # 20分钟生产级代码
```

### 2️⃣ 六道质量门禁

```
┌─────────────────────────────────────────────────────────────────┐
│                    Verify 阶段 - 质量门禁                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🚪 Gate 1: 编译检查                                            │
│  └─ npm run build → 无编译错误 → ✅ PASS                        │
│                                                                 │
│  🚪 Gate 2: 测试运行                                            │
│  └─ npm test → 所有测试通过 → ✅ PASS                           │
│                                                                 │
│  🚪 Gate 3: 覆盖率检查                                          │
│  └─ 覆盖率 >= 60% (balanced) / 80% (strict) → ✅ PASS           │
│                                                                 │
│  🚪 Gate 4: Lint 检查                                           │
│  └─ 无 error (strict 模式) → ✅ PASS                            │
│                                                                 │
│  🚪 Gate 5: 安全扫描                                            │
│  └─ npm audit → 无 high/critical 漏洞 → ✅ PASS                 │
│                                                                 │
│  🚪 Gate 6: 验收标准                                            │
│  └─ 用户定义的验收标准全部满足 → ✅ PASS                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3️⃣ TDD 模式 (业界首创)

```
传统开发流程:
  需求 → 代码 → 测试 → 发现Bug → 修复 → 回归测试 → ...
  ⏱️ 循环多次，耗时不可控

OpenMatrix TDD 流程:
  需求 → 测试(RED) → 代码(GREEN) → 验证(REFACTOR) → 完成
  ⏱️ 一次通过，无需返工
```

### 4️⃣ Meeting 机制 (不中断执行)

```
❌ 其他方案:
   TASK-001 ✓ → TASK-002 阻塞 ⏸️ → 等待用户... (浪费时间)

✅ OpenMatrix:
   TASK-001 ✓ → TASK-002 阻塞 → 创建Meeting → 跳过 ↷
   → TASK-003 ✓ → TASK-004 ✓ → 执行完成!
   → 用户用 /om:meeting 统一处理所有阻塞
```

### 5️⃣ 6 种专用 Agent

| Agent | 职责 | 使用场景 |
|-------|------|---------|
| 🎯 Planner | 任务拆解、计划制定 | 复杂任务分析 |
| 💻 Coder | 代码编写、重构 | 功能实现 |
| 🧪 Tester | 测试用例、执行测试 | TDD、覆盖率 |
| 🔍 Reviewer | 代码审查、质量检查 | 验证阶段 |
| 📚 Researcher | 搜索资料、知识检索 | 技术调研 |
| ⚡ Executor | 执行命令、文件操作 | 构建、部署 |

---

## 与其他方案对比

### 对比表

| 特性 | OpenMatrix | superpowers | gsd |
|------|:----------:|:-----------:|:---:|
| **100% 自动化** | ✅ auto 模式 | ❌ 50% | ❌ 60% |
| **TDD 内置** | ✅ | ❌ 需手动 | ❌ |
| **覆盖率强制** | ✅ 可配置 | ❌ | ❌ |
| **安全扫描** | ✅ npm audit | ❌ | ❌ |
| **阻塞不中断** | ✅ Meeting | ❌ | ❌ |
| **质量报告** | ✅ JSON+MD | ❌ | 部分 |
| **上手难度** | ⚡ 极简 | 中等 | 较高 |
| **一句话开始** | ✅ | ❌ | ❌ |

### 选择建议

```
你的需求                              推荐方案
─────────────────────────────────────────────────
"我要自动化，但不能牺牲质量"    →    OpenMatrix ⭐
"我要快速原型验证"              →    OpenMatrix (fast)
"我要生产级代码"                →    OpenMatrix (strict)
"我要精细控制每一步"            →    superpowers
"我要完整项目管理流程"          →    gsd
```

---

## 使用指南

### Skills 命令

| 命令 | 用途 | 示例 |
|------|------|------|
| `/om:start` | 启动新任务 | `/om:start --quality strict "任务"` |
| `/om:status` | 查看状态 | `/om:status` |
| `/om:approve` | 审批决策 | `/om:approve APPR-001` |
| `/om:meeting` | 处理阻塞 | `/om:meeting` |
| `/om:resume` | 恢复中断 | `/om:resume TASK-001` |
| `/om:retry` | 重试失败 | `/om:retry TASK-001` |
| `/om:report` | 生成报告 | `/om:report` |

### 完整使用流程

```
1. /om:start --quality strict 实现用户登录功能
   ↓
2. 回答 3-5 个澄清问题
   ↓
3. 确认执行计划
   ↓
4. 自动执行 (TDD → 开发 → 验证 → 验收)
   ↓
5. 如果有 Meeting: /om:meeting 处理
   ↓
6. /om:report 查看完整报告
```

### 质量报告示例

```json
{
  "taskId": "TASK-001",
  "overall": "pass",
  "tests": { "passed": 15, "failed": 0, "coverage": 82 },
  "build": { "success": true },
  "lint": { "errors": 0, "warnings": 3 },
  "security": { "vulnerabilities": [] },
  "acceptance": { "met": 5, "total": 5 }
}
```

---

## 配置

### .openmatrixrc.json

```json
{
  "timeout": { "default": 120, "max": 600 },
  "retry": { "maxRetries": 3, "backoff": "exponential" },
  "approvalPoints": ["plan", "merge"],
  "quality": {
    "tdd": false,
    "minCoverage": 60,
    "strictLint": true,
    "securityScan": true,
    "level": "balanced"
  },
  "agents": {
    "maxConcurrent": 3,
    "model": "claude-sonnet-4-6"
  }
}
```

### 质量配置详解

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `tdd` | boolean | false | 启用 TDD 模式 |
| `minCoverage` | number | 60 | 最低覆盖率 (%) |
| `strictLint` | boolean | true | 严格 Lint (error 即失败) |
| `securityScan` | boolean | true | 启用安全扫描 |
| `level` | string | "balanced" | 质量级别预设 |

---

## 开发

```bash
# 克隆
git clone https://github.com/bigfish1913/openmatrix.git
cd openmatrix

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 测试
npm test

# 链接到全局
npm link
```

### 项目结构

```
openmatrix/
├── src/
│   ├── cli/              # CLI 命令
│   ├── orchestrator/     # 调度层
│   │   ├── phase-executor.ts    # 四阶段执行器
│   │   ├── task-planner.ts      # 任务拆解
│   │   └── git-commit-manager.ts # 自动提交
│   ├── agents/           # Agent 层
│   ├── storage/          # 存储层
│   └── types/            # 类型定义
├── skills/               # Claude Code Skills
└── tests/                # 测试
```

---

## Roadmap

- [x] TDD 模式
- [x] 6 道质量门禁
- [x] Meeting 机制
- [x] 质量报告
- [ ] VSCode 扩展
- [ ] Python/Go 支持
- [ ] CI/CD 集成
- [ ] 团队协作功能
- [ ] 质量趋势分析

---

## 常见问题

### Q: OpenMatrix 和 superpowers 可以一起用吗？

**A**: 可以！OpenMatrix 专注于任务自动化执行，superpowers 专注于代码质量技能。你可以：
- 用 OpenMatrix 自动执行任务
- 用 superpowers 的 brainstorming/TDD 等技能辅助

### Q: 哪种质量模式适合我？

| 场景 | 推荐模式 |
|------|---------|
| 快速验证想法 | `fast` |
| 日常开发 | `balanced` (默认) |
| 生产代码 | `strict` |
| 核心功能 | `strict` |

### Q: Meeting 是什么？

**A**: 当任务执行遇到阻塞（如缺少信息、需要决策）时，OpenMatrix 会创建 Meeting 记录，但**不停止执行**。其他任务继续执行，最后用 `/om:meeting` 统一处理。

---

## License

MIT © 2024

---

## 相关链接

- [Claude Code 文档](https://docs.anthropic.com/claude-code)
- [GitHub Issues](https://github.com/bigfish1913/openmatrix/issues)
- [更新日志](CHANGELOG.md)

---

<div align="center">

**如果觉得有用，请给个 ⭐ Star！**

Made with ❤️ by [bigfish1913](https://github.com/bigfish1913)

</div>

---

# English

## OpenMatrix: High Quality + Full Automation

The **only** AI task orchestration system that combines:
- ✅ **TDD Mode** - Write tests first, then code
- ✅ **6 Quality Gates** - Build, Tests, Coverage, Lint, Security, Acceptance
- ✅ **100% Automation** - Auto mode requires no confirmation

### Quick Start

```bash
# Install
git clone https://github.com/bigfish1913/openmatrix.git
cd openmatrix && npm install && npm run build && npm link

# Copy Skills
mkdir -p ~/.claude/commands/om
cp skills/*.md ~/.claude/commands/om/

# Use
/om:start --quality strict Implement user authentication
```

### Quality Levels

| Level | TDD | Coverage | Lint | Security | Use Case |
|-------|-----|----------|------|----------|----------|
| `fast` | ❌ | 0% | ❌ | ❌ | Prototypes |
| `balanced` | ❌ | 60% | ✅ | ✅ | Daily development |
| `strict` | ✅ | 80% | ✅ | ✅ | Production code |

### License

MIT
