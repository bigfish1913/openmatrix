# OpenMatrix

<div align="center">

**同时实现 TDD + 严格质量门禁 + 全自动执行的 AI 任务编排系统**

*自动化 ≠ 牺牲质量 | 高质量 ≠ 手动操作*

[![npm version](https://badge.fury.io/js/openmatrix.svg)](https://www.npmjs.com/package/openmatrix)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/Node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Compatible-blue.svg)](https://claude.ai/code)
[![Website](https://img.shields.io/badge/官网-matrix.laofu.online-brightgreen)](https://matrix.laofu.online/)

**[📚 官方文档](https://matrix.laofu.online/docs/)** | **[🚀 快速开始](https://matrix.laofu.online/docs/getting-started/)** | **[💬 GitHub](https://github.com/bigfish1913/openmatrix)**

**[中文](README.md)** | **[English](README_EN.md)**

</div>

---

## 一句话介绍

```bash
/om 实现用户登录
# 自动启动任务编排，第一个问题选质量级别，然后全自动执行
```

> `/om` 是 `/om:start` 的快捷方式，功能完全相同

### 🪄 自动调用 (无需输入命令)

安装后，直接输入任务描述即可自动调用:

```
用户输入: 实现用户登录功能
     ↓
自动调用: /om:start 实现用户登录功能
```

**触发场景:**

| 用户输入 | 触发原因 |
|---------|---------|
| `实现用户登录功能` | 功能开发 |
| `登录页面报错了` | Bug 修复 |
| `性能太慢需要优化` | 性能优化 |
| `写个单元测试` | 测试相关 |
| `做个完整的用户系统` | 多组件任务 |
| `从零搭建一个后台` | 多步骤项目 |
| `前端+后端+数据库` | 全栈工作 |

**关键词触发:**
- `实现...` / `添加...` / `修复...` / `优化...` / `测试...`
- `支持...` / `需要...` / `想要...` / `要做...`
- `implement...` / `add...` / `fix...` / `build...`
- 任务文档路径: `docs/task.md`

**不触发的情况:**
- 问问题: "怎么实现登录?" / "如何配置?"
- 查信息: "显示配置" / "列出文件"
- 导航: "打开目录" / "进入文件夹"

---

## 执行流程概览

```
用户输入 → 质量选择 → 任务规划 → 执行 → 质量门禁 → AI验收 → Meeting处理 → 完成
```

| 阶段 | 说明 | 关键点 |
|:----:|------|--------|
| 0 | 交互问答 | **第一个问题选质量级别** |
| 1 | 任务规划 | Planner Agent 生成计划 |
| 2 | 任务执行 | strict/balanced/fast 三种模式 |
| 3 | 质量门禁 | 6 道质量门禁验证 |
| 4 | AI 验收 | Reviewer Agent 最终确认 |
| 5 | Meeting | 阻塞不中断，最后处理并**重新执行** |
| 6 | 最终报告 | 质量评分 + 产出文件 |

📖 **详细流程图**: [docs/FLOW.md](docs/FLOW.md) (含 Mermaid 图表)

---

## 为什么选择 OpenMatrix？

### 与 superpowers / gsd 对比

| 特性 | OpenMatrix | superpowers | gsd |
|------|:----------:|:-----------:|:---:|
| **100% 自动化** | ✅ auto 模式 | ❌ 50% | ❌ 60% |
| **TDD 内置** | ✅ strict 模式 | ❌ 需手动 | ❌ 无 |
| **覆盖率强制** | ✅ 60-80% | ❌ 无 | ❌ 无 |
| **安全扫描** | ✅ npm audit | ❌ 无 | ❌ 无 |
| **AI 验收** | ✅ Reviewer Agent | ❌ 无 | 部分 |
| **阻塞不中断** | ✅ Meeting 机制 | ❌ 停止 | ❌ 停止 |
| **质量报告** | ✅ JSON + MD | ❌ 无 | 部分 |
| **上手难度** | ⚡ 一句话开始 | 中等 | 较高 |

---

## 快速开始

### 安装

**方式一: NPM 安装 (推荐)**

```bash
# 全局安装
npm install -g openmatrix

# Skills 会自动安装到 ~/.claude/commands/om/
# 如果自动安装失败，手动执行:
openmatrix install-skills
```

**方式二: 从源码安装**

```bash
# 克隆并安装
git clone https://github.com/bigfish1913/openmatrix.git
cd openmatrix && npm install && npm run build && npm link

# 安装 Skills (如果 postinstall 未自动执行)
openmatrix install-skills
```

### 验证安装

```bash
# 检查 CLI 是否可用
openmatrix --version

# 检查 Skills 是否安装成功
openmatrix install-skills
# 或直接查看
ls ~/.claude/commands/om/
# 应显示: start.md  auto.md  status.md  approve.md  meeting.md  resume.md  retry.md  report.md
```

### 第一次使用

```bash
/om:start 实现用户登录功能

# 系统会先问:
┌─────────────────────────────────────────────────────────┐
│ 问题 0: 选择质量级别                                     │
├─────────────────────────────────────────────────────────┤
│ 🚀 strict   → TDD + 80%覆盖率 + AI验收 (推荐生产代码)    │
│ ⚖️ balanced  → 60%覆盖率 + AI验收 (日常开发)            │
│ ⚡ fast      → 无质量门禁 (快速原型)                     │
└─────────────────────────────────────────────────────────┘
```

---

## 核心特性

### 1️⃣ 三级质量配置 (第一个问题就让你选)

| 级别 | TDD | 覆盖率 | Lint | 安全 | AI验收 | 适用场景 |
|:----:|:---:|:------:|:----:|:----:|:------:|---------|
| **strict** | ✅ | >80% | ✅ 严格 | ✅ | ✅ | 🏭 **生产代码** |
| **balanced** | ❌ | >60% | ✅ | ✅ | ✅ | 📦 日常开发 |
| **fast** | ❌ | >20% | ❌ | ❌ | ❌ | 🏃 快速原型 |

> strict 可配置为 100%。默认 >80% 覆盖核心业务逻辑。

### 2️⃣ 六道质量门禁 (Verify 阶段)

```
┌─────────────────────────────────────────────────────────────┐
│                    Verify 阶段 - 质量门禁                     │
├─────────────────────────────────────────────────────────────┤
│  🚪 Gate 1: 编译检查     npm run build     → 必须通过       │
│  🚪 Gate 2: 测试运行     npm test         → 必须通过       │
│  🚪 Gate 3: 覆盖率检查   >20%/60%/80%    → 可配置         │
│  🚪 Gate 4: Lint 检查    无 error         → 可配置         │
│  🚪 Gate 5: 安全扫描     npm audit        → 无高危漏洞     │
│  🚪 Gate 6: 验收标准     用户定义         → 必须全部满足   │
└─────────────────────────────────────────────────────────────┘
```

### 3️⃣ TDD 模式 (strict 级别)

```
传统开发:  代码 → 测试 → Bug → 修复 → 回归 → ... (循环多次)

OpenMatrix TDD (strict):
  🧪 测试阶段: 先写测试 (RED - 测试必须失败)
  ✨ 开发阶段: 再写代码 (GREEN - 测试必须通过)
  ✅ 验证阶段: 6道质量门禁
  🎉 验收阶段: AI Reviewer 最终确认

结果: 第一次就写对，无需返工
```

### 4️⃣ Meeting 机制 (阻塞不中断)

```
❌ 其他方案:
   TASK-001 ✓ → TASK-002 阻塞 ⏸️ → 等用户... (浪费时间)

✅ OpenMatrix:
   TASK-001 ✓ → TASK-002 阻塞 → 创建Meeting → 跳过 ↷
   TASK-003 ✓ → TASK-004 ✓ → 完成!
   → 用户用 /om:meeting 统一处理所有阻塞
```

### 5️⃣ AI 验收 (Accept 阶段)

```
Accept 阶段由 Reviewer Agent 执行:
├── 检查 verify-report.md
├── 验证所有验收标准
├── 确认代码可合并
└── 生成 accept-report.md
```

---

## 执行流程

### strict 模式 (推荐生产代码)

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│   TDD   │────▶│ Develop │────▶│  Verify │────▶│ Accept  │
│ 🧪 RED  │     │ ✨ GREEN│     │ ✅ 6门禁│     │ 🎉 AI   │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
```

### balanced 模式 (日常开发)

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Develop │────▶│  Verify │────▶│ Accept  │
│ ✨ 编码 │     │ ✅ 4门禁│     │ 🎉 AI   │
└─────────┘     └─────────┘     └─────────┘
```

---

## Skills 命令

| 命令 | 用途 |
|------|------|
| `/om` | **默认入口** - 直接输入任务描述即可启动 |
| `/om:start` | 启动新任务 (第一个问题选质量级别) |
| `/om:auto` | 🚀 **全自动执行** - 无阻塞、无确认、直接完成 |
| `/om:status` | 查看状态 |
| `/om:approve` | 审批决策 |
| `/om:meeting` | 处理阻塞问题 |
| `/om:resume` | 恢复中断 |
| `/om:retry` | 重试失败 |
| `/om:report` | 生成报告 |

> `/om` 是 `/om:start` 的快捷方式，功能完全相同

### `/om:start` 执行流程 (含 Meeting 机制)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            执行阶段                                       │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  TASK-001 ✅ ──→ TASK-002 ⚠️阻塞 ──→ 创建Meeting ──→ 跳过 ↷             │
│                      │                                                   │
│                      ↓                                                   │
│  TASK-003 ✅ ──→ TASK-004 ✅ ──→ TASK-005 ✅ ──→ 所有任务执行完成        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                         Meeting 自动检测                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                    ┌─────────────────────┐                               │
│                    │ 有 pending Meeting? │                               │
│                    └──────────┬──────────┘                               │
│                          ╱    \                                          │
│                        否      是                                        │
│                        │       │                                         │
│                        ▼       ▼                                         │
│                   ┌───────┐ ┌─────────────────────────────┐              │
│                   │ 完成! │ │  📋 交互式处理 Meeting       │              │
│                   └───────┘ │  ┌─────────────────────────┐│              │
│                             │  │ [1] TASK-002: 数据库连接││              │
│                             │  │     💡提供信息 / ⏭️跳过  ││              │
│                             │  │ [2] TASK-005: API决策   ││              │
│                             │  │     🤔选择方案          ││              │
│                             │  └─────────────────────────┘│              │
│                             └──────────────┬──────────────┘              │
│                                            │                              │
│                                            ▼                              │
│                             ┌─────────────────────────────┐              │
│                             │   用户提供信息/选择方案      │              │
│                             │         ↓                   │              │
│                             │   🔄 重新执行阻塞任务        │              │
│                             │   TASK-002 ✅               │              │
│                             └──────────────┬──────────────┘              │
│                                            │                              │
└────────────────────────────────────────────┼──────────────────────────────┘
                                             │
                                             ▼
                                      ┌───────────┐
                                      │  完成! 🎉  │
                                      └───────────┘
```

### `/om:auto` 全自动模式

**适用场景**: CI/CD、自动化脚本、无需人工干预的任务

```bash
/om:auto 实现用户登录功能              # 默认 strict 模式
/om:auto --mode=balanced 添加API接口   # 指定 balanced 模式
/om:auto --fast 创建CLI工具            # 快速原型模式
```

**特点**:
- ❌ 无审批点确认
- ❌ 无 Phase 间暂停
- ❌ Meeting 自动跳过 (记录但不阻塞)
- ✅ 默认 strict 质量级别
- ✅ 适合 CI/CD 集成

**与 `/om:start` 对比**:

| 特性 | `/om:start` | `/om:auto` |
|------|-------------|------------|
| 质量级别 | 交互式选择 | 参数指定/默认 strict |
| 审批确认 | 根据配置 | 全部跳过 |
| Meeting | 交互式处理 | 自动跳过 |
| 适用场景 | 日常开发 | CI/CD、自动化 |

---

## 质量报告

每个任务完成后生成:

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

## 多语言支持

OpenMatrix 通过 Claude Code Agent 工具**原生支持所有主流编程语言**：

| 语言 | 测试命令 | 构建命令 |
|------|---------|---------|
| TypeScript/JavaScript | `npm test` / `vitest` | `npm run build` |
| Python | `pytest` | `python -m build` |
| Go | `go test ./...` | `go build` |
| Java | `mvn test` | `mvn compile` |
| Rust | `cargo test` | `cargo build` |
| 其他 | 任意 CLI 命令 | 任意 CLI 命令 |

**无需额外配置** — Agent 可执行任意 shell 命令，Claude 理解所有主流语言。

---

## 常见问题

### Q: 哪种质量级别适合我？

| 你的场景 | 推荐级别 |
|---------|---------|
| 🏭 生产代码、核心功能 | **strict** |
| 📦 日常功能开发 | **balanced** |
| 🏃 快速原型、POC | **fast** |

### Q: OpenMatrix 和 superpowers 可以一起用吗？

**A**: 可以！OpenMatrix 自动执行任务，superpowers 提供额外技能。

### Q: Meeting 是什么？

**A**: 遇到阻塞时创建记录，但**不停止执行**。最后用 `/om:meeting` 统一处理。

---

## 配置

`.openmatrixrc.json`:

```json
{
  "quality": {
    "tdd": false,
    "minCoverage": 60,
    "strictLint": true,
    "securityScan": true
  },
  "approvalPoints": ["plan", "merge"],
  "agents": { "maxConcurrent": 3 }
}
```

---

## 开发

```bash
git clone https://github.com/bigfish1913/openmatrix.git
cd openmatrix && npm install && npm run build && npm test
```

---

## Roadmap

- [x] TDD 模式
- [x] 6 道质量门禁
- [x] Meeting 机制
- [x] 质量报告
- [x] AI 验收
- [x] `/om:auto` 全自动模式
- [x] 多语言支持 (Python/Go/Java/TypeScript 等)
- [ ] VSCode 扩展
- [ ] CI/CD 集成

---

<div align="center">

**如果觉得有用，请给个 ⭐ Star！**

MIT © 2024 | Made by [bigfish1913](https://github.com/bigfish1913)

</div>
