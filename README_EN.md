# OpenMatrix

<div align="center">

**Your code has no tests? OpenMatrix automatically adds them with >80% coverage**

*Automation ≠ Sacrificing Quality | High Quality ≠ Manual Work*

[![npm version](https://img.shields.io/npm/v/openmatrix.svg?color=blue&label=npm)](https://www.npmjs.com/package/openmatrix)
[![npm downloads](https://img.shields.io/npm/dm/openmatrix.svg?color=green&label=downloads)](https://www.npmjs.com/package/openmatrix)
[![GitHub stars](https://img.shields.io/github/stars/bigfish1913/openmatrix.svg?style=social&label=Star)](https://github.com/bigfish1913/openmatrix/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Compatible-blue.svg)](https://claude.ai/code)

**[中文](README.md)** | **[English](README_EN.md)**

</div>

---

## 30-Second Demo

```
/om Implement user login feature

# Auto-starts task orchestration → Select quality level → Full automation → Quality gates → AI acceptance → Done
```

> `/om` is a shortcut for `/om:start`. Just type your task description to auto-trigger.

---

## Three Quality Modes

| Mode | Coverage | Tests | Lint | Security | Use Case |
|:----:|:--------:|:-----:|:----:|:--------:|----------|
| **strict** | >80% | TDD write tests first | Strict | npm audit | Production code |
| **balanced** | >60% | Add tests after | Standard | npm audit | Daily development |
| **fast** | >20% | Optional | None | None | Quick prototypes |

> E2E tests optional (Playwright/Cypress/Appium)

---

## Quick Start

```bash
# Install
npm install -g openmatrix

# Verify
openmatrix --version

# Use
/om Implement user login
```

---

## Core Commands

| Command | Purpose |
|---------|---------|
| `/om` | Default entry - just type task description |
| `/om:test` | Auto-add tests - supplement tests for existing code |
| `/om:debug` | Systematic debugging - four-phase root cause analysis + auto-fix |
| `/om:feature` | Lightweight feature - quick iteration, no full task tracking |
| `/om:brainstorm` | Brainstorm - explore requirements and design first |
| `/om:auto` | Full auto execution - no blocking, no confirmation, CI/CD ready |

---

## Seven Quality Gates

```
Gate 1: Build Check    npm run build    → Must pass
Gate 2: Test Run       npm test         → Must pass
Gate 3: Coverage Check >20%/60%/80%    → Configurable
Gate 4: Lint Check     No errors        → Configurable
Gate 5: Security Scan  npm audit        → No high-risk vulnerabilities
Gate 6: E2E Tests      Playwright etc   → Optional
Gate 7: Acceptance     User defined     → All must be met
```

---

## Works with superpowers

OpenMatrix auto-executes tasks + superpowers provides extra skills = Perfect combination

```bash
# superpowers writes code, OpenMatrix ensures quality
/om Implement user login    # Auto TDD + quality gates + AI acceptance
```

---

## Detailed Documentation

| Doc | Content |
|-----|---------|
| [Flow Diagrams](docs/FLOW.md) | Complete flow charts and phase descriptions |
| [Roadmap](docs/ROADMAP.md) | Feature planning and progress |
| [Architecture](docs/ARCHITECTURE.md) | Core components and design |
| [Terminology](docs/TERMINOLOGY.md) | Terminology reference |

---

## FAQ

**Q: Which quality level is right for me?**

| Scenario | Recommended Mode |
|----------|-----------------|
| Production code, core features | strict |
| Daily feature development | balanced |
| Quick prototypes, POC | fast |

**Q: What is Meeting?**

A: When blocked, a record is created but **execution doesn't stop**. Use `/om:meeting` to handle all blockers at the end.

**Q: Which languages are supported?**

A: Native support for TypeScript/JavaScript, Python, Go, Java, Rust, and all mainstream languages.

---

## Configuration Example

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

**If you find this useful, please give it a Star!**

[![Star History Chart](https://api.star-history.com/svg?repos=bigfish1913/openmatrix&type=Date)](https://star-history.com/#/bigfish1913/openmatrix&Date)

MIT | Made by [bigfish1913](https://github.com/bigfish1913)

</div>