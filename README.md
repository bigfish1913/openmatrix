# OpenMatrix

> **高质量 + 全自动** — 唯一同时实现 TDD + 严格质量门禁 + 全自动执行的 AI 任务编排系统

[![npm version](https://badge.fury.io/js/openmatrix.svg)](https://badge.fury.io/js/openmatrix)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

```
🚀 OpenMatrix v0.2.0 - 质量增强版

用户: /om:start --quality strict 实现用户登录功能

OpenMatrix:
  🧪 TDD 阶段:    先写测试 (RED)
  ✨ 开发阶段:    编写代码 (GREEN)
  ✅ 验证阶段:    6 道质量门禁
  🎉 验收阶段:    最终确认

📊 质量报告:
  ├── Tests:     ✅ 15/15 passed, 82% coverage
  ├── Build:     ✅ Success
  ├── Lint:      ✅ No errors
  ├── Security:  ✅ No vulnerabilities
  └── Criteria:  ✅ 5/5 met

⏱️ 耗时: 12分钟 | 质量评分: A | 状态: ✅ 完成
```

---

## 🏆 为什么 OpenMatrix 超越其他方案？

### 核心优势：自动化 + 高质量

| 特性 | OpenMatrix | superpowers | gsd |
|------|------------|-------------|-----|
| **自动化程度** | 🔥 **100%** - auto 模式无需确认 | 50% - 关键点需确认 | 60% - 阶段间需确认 |
| **质量保证** | ✅ **6 道质量门禁** | 依赖用户自觉 | 基础验证 |
| **TDD 支持** | ✅ **内置 TDD 模式** | 需手动调用技能 | ❌ 无 |
| **覆盖率要求** | ✅ **可配置 (0-80%)** | ❌ 无强制 | ❌ 无强制 |
| **安全扫描** | ✅ **自动 npm audit** | ❌ 无 | ❌ 无 |
| **阻塞处理** | 🎯 **Meeting 机制** - 不中断执行 | 停止等待 | 停止等待 |
| **质量报告** | ✅ **JSON + Markdown** | ❌ 无 | 部分支持 |
| **上手难度** | ⚡ 极简 - 一句话开始 | 中等 | 较高 |

### 🚀 独一无二的能力

#### 1. 三级质量配置

```bash
/om:start --quality fast     # 最快，无质量门禁
/om:start --quality balanced # 平衡 (默认): 60%覆盖率 + Lint + 安全
/om:start --quality strict   # 严格: TDD + 80%覆盖率 + 严格Lint + 安全
```

#### 2. 六道质量门禁

```
┌─────────────────────────────────────────────────────────────────┐
│                    Verify 阶段 - 严格质量门禁                     │
├─────────────────────────────────────────────────────────────────┤
│  🚪 Gate 1: 编译检查     npm run build     → 必须通过           │
│  🚪 Gate 2: 测试运行     npm test         → 必须通过           │
│  🚪 Gate 3: 覆盖率检查   >= 60%/80%       → 可配置             │
│  🚪 Gate 4: Lint 检查    无 error         → 可配置             │
│  🚪 Gate 5: 安全扫描     npm audit        → 无高危漏洞         │
│  🚪 Gate 6: 验收标准     用户定义         → 必须全部满足       │
└─────────────────────────────────────────────────────────────────┘
```

#### 3. TDD 模式 (业界首创)

```
传统开发:  代码 → 测试 → 修复 → 重复
OpenMatrix TDD: 测试(RED) → 代码(GREEN) → 验证(质量门禁)

结果: 第一次就写对，无需返工
```

#### 4. Meeting 机制 (不中断执行)

```
superpowers/gsd: 遇到问题 → 停止 → 等用户 → 浪费时间

OpenMatrix:
├── TASK-001: 完成 ✓
├── TASK-002: 阻塞 → 创建 Meeting → 跳过，继续 ↷
├── TASK-003: 完成 ✓
└── TASK-004: 阻塞 → 创建 Meeting → 跳过，继续 ↷

执行完成! 然后用 /om:meeting 统一处理
```

---

## 快速开始

### 安装

```bash
# 方式 1: 从源码安装 (推荐)
git clone https://github.com/bigfish1913/openmatrix.git
cd openmatrix && npm install && npm run build && npm link

# 复制 Skills
mkdir -p ~/.claude/commands/om
cp skills/*.md ~/.claude/commands/om/

# 方式 2: 从插件市场安装
/plugin marketplace add bigfish1913/openmatrix
/plugin install openmatrix
```

### 5分钟上手

```bash
# 默认模式 (balanced)
/om:start 实现用户登录功能

# 严格质量模式
/om:start --quality strict 实现用户登录功能

# 快速模式 (无质量门禁)
/om:start --quality fast 实现用户登录功能
```

---

## 质量配置详解

### 三级预设

| 级别 | TDD | 覆盖率 | Lint | 安全 | 适用场景 |
|------|-----|--------|------|------|---------|
| `fast` | ❌ | 0% | ❌ | ❌ | 快速原型、POC |
| `balanced` | ❌ | 60% | ✅ 严格 | ✅ | 常规开发 (默认) |
| `strict` | ✅ | 80% | ✅ 严格 | ✅ | 生产代码、核心功能 |

### 自定义配置

```json
// .openmatrixrc.json
{
  "quality": {
    "tdd": true,
    "minCoverage": 75,
    "strictLint": true,
    "securityScan": true
  }
}
```

---

## 执行流程

### 四阶段流程 (TDD 模式)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│     TDD     │────▶│   Develop   │────▶│   Verify    │────▶│   Accept    │
│   🧪 RED    │     │   ✨ GREEN  │     │   ✅ GATES  │     │   🎉 DONE   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
      │                   │                   │                   │
      ▼                   ▼                   ▼                   ▼
  Tester 编写测试     Coder 编写代码      6道质量门禁        最终确认
  测试必须失败        测试必须通过        必须全部通过       生成报告
```

### 三阶段流程 (非 TDD 模式)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Develop   │────▶│   Verify    │────▶│   Accept    │
│   ✨ 编码   │     │   ✅ 验证   │     │   🎉 验收   │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 质量报告

每个任务完成后生成 `quality-report.json`:

```json
{
  "taskId": "TASK-001",
  "timestamp": "2024-03-25T10:30:00Z",
  "tests": {
    "passed": 15,
    "failed": 0,
    "coverage": 82,
    "status": "pass"
  },
  "build": {
    "success": true,
    "errors": [],
    "status": "pass"
  },
  "lint": {
    "errors": 0,
    "warnings": 3,
    "status": "pass"
  },
  "security": {
    "vulnerabilities": [],
    "status": "pass"
  },
  "acceptance": {
    "total": 5,
    "met": 5,
    "status": "pass"
  },
  "overall": "pass"
}
```

---

## Skills 命令

| 命令 | 用途 | 示例 |
|------|------|------|
| `/om:start` | 启动新任务 | `/om:start --quality strict "任务"` |
| `/om:status` | 查看执行状态 | `/om:status` |
| `/om:approve` | 审批决策 | `/om:approve APPR-001` |
| `/om:meeting` | 处理阻塞/决策 | `/om:meeting` |
| `/om:resume` | 恢复中断任务 | `/om:resume TASK-001` |
| `/om:retry` | 重试失败任务 | `/om:retry TASK-001` |
| `/om:report` | 生成执行报告 | `/om:report` |

---

## 使用案例

### 案例 1: 严格质量模式 - 生产级功能

```
/om:start --quality strict 实现支付系统

OpenMatrix:
  🧪 TDD 阶段:
     - 生成 12 个测试用例
     - 测试全部失败 (RED) ✓

  ✨ 开发阶段:
     - 实现支付逻辑
     - 测试全部通过 (GREEN) ✓

  ✅ 验证阶段:
     ├── Tests:     ✅ 12/12 passed
     ├── Coverage:  ✅ 85% (>= 80%)
     ├── Build:     ✅ Success
     ├── Lint:      ✅ No errors
     ├── Security:  ✅ No vulnerabilities
     └── Criteria:  ✅ 8/8 met

  📊 质量评分: A
  ⏱️ 耗时: 25分钟
```

### 案例 2: 快速模式 - 原型验证

```
/om:start --quality fast 验证 API 设计

OpenMatrix:
  ✨ 开发阶段: 5分钟
  ✅ 验证阶段: 跳过质量门禁
  🎉 完成

  ⏱️ 耗时: 5分钟
```

---

## 与其他方案对比

### OpenMatrix vs superpowers

| 维度 | OpenMatrix | superpowers |
|------|------------|-------------|
| **理念** | 自动化 + 质量保证 | 技能工具箱 |
| **质量** | 强制门禁 | 依赖用户自觉 |
| **TDD** | 内置 | 需手动调用 |
| **自动化** | 100% 可选 | 50% |
| **学习曲线** | 极简 | 中等 |

**结论**: 想要自动化 + 质量保证 → OpenMatrix；想要精细控制 → superpowers

### OpenMatrix vs gsd

| 维度 | OpenMatrix | gsd |
|------|------------|-----|
| **定位** | 任务执行引擎 | 项目生命周期管理 |
| **质量** | 6道门禁 | 基础验证 |
| **上手** | 一句话开始 | 需要创建 PROJECT.md |
| **阻塞处理** | Meeting 机制 | 停止等待 |

**结论**: 想要快速执行 → OpenMatrix；想要完整项目管理 → gsd

---

## 适合谁用？

| 用户类型 | 推荐度 | 原因 |
|---------|-------|------|
| **追求质量的开发者** | ⭐⭐⭐⭐⭐ | TDD + 质量门禁保证代码质量 |
| **独立开发者** | ⭐⭐⭐⭐⭐ | 快速完成功能，无需复杂配置 |
| **团队开发** | ⭐⭐⭐⭐ | 质量门禁确保团队代码标准 |
| **原型/POC** | ⭐⭐⭐⭐ | fast 模式快速验证想法 |
| **需要精细控制** | ⭐⭐⭐ | 考虑 superpowers |

---

## 架构

```
┌────────────────────────────────────────────────────────────────┐
│                        用户层 (Claude Code)                      │
│  Skills: /om:start  /om:status  /om:approve  /om:meeting      │
└──────────────────────────────┬─────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────┐
│                      调度层 (Orchestrator)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │  Parser  │ │ Planner  │ │ Scheduler│ │ QualityManager   │   │
│  │ 任务解析  │ │ 任务拆解  │ │ 调度引擎  │ │   质量门禁控制    │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
└──────────────────────────────┬─────────────────────────────────┘
                               │
┌──────────────────────────────▼─────────────────────────────────┐
│                        执行层 (Agents)                           │
│  ┌────────┐ ┌───────┐ ┌────────┐ ┌──────────┐ ┌────────────┐   │
│  │Planner │ │ Coder │ │ Tester │ │ Reviewer │ │ Researcher │   │
│  └───┬────┘ └───┬───┘ └───┬────┘ └────┬─────┘ └─────┬──────┘   │
│      └──────────┴─────────┴──────────┴──────────────┘          │
│                         Claude Subagent                         │
└────────────────────────────────────────────────────────────────┘
```

---

## 配置

`.openmatrixrc.json`:

```json
{
  "timeout": { "default": 120, "max": 600 },
  "retry": { "maxRetries": 3, "backoff": "exponential" },
  "approvalPoints": ["plan", "merge"],
  "quality": {
    "tdd": false,
    "minCoverage": 60,
    "strictLint": true,
    "securityScan": true
  },
  "agents": {
    "maxConcurrent": 3,
    "model": "claude-sonnet-4-6"
  }
}
```

---

## 开发

```bash
# 克隆 & 安装
git clone https://github.com/bigfish1913/openmatrix.git
cd openmatrix && npm install

# 开发
npm run dev          # 开发模式
npm run build        # 构建
npm test             # 测试
```

---

## Roadmap

- [ ] VSCode 扩展
- [ ] 更多语言支持 (Python, Go)
- [ ] CI/CD 集成
- [ ] 团队协作功能
- [ ] 质量趋势分析

---

## License

MIT

---

## 相关链接

- [Claude Code 文档](https://docs.anthropic.com/claude-code)
- [GitHub Issues](https://github.com/bigfish1913/openmatrix/issues)
- [更新日志](CHANGELOG.md)
