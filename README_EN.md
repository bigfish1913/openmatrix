# OpenMatrix

<div align="center">

**The Only AI Task Orchestration with TDD + Quality Gates + 100% Automation**

*Automation ≠ Sacrificing Quality | High Quality ≠ Manual Work*

[![npm version](https://badge.fury.io/js/openmatrix.svg)](https://www.npmjs.com/package/openmatrix)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/badge/Node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-Compatible-blue.svg)](https://claude.ai/code)

**[中文文档](README.md)** | **[English](README_EN.md)**

</div>

---

## One-Liner Introduction

```bash
/om Implement user login
# Auto-starts task orchestration, first question selects quality level, then fully automatic
```

> `/om` is a shortcut for `/om:start` with identical functionality

### 🪄 Auto-Invoke (No Command Needed)

After installation, just type task descriptions directly:

```
User input: Implement user login feature
     ↓
Auto-invokes: /om:start Implement user login feature
```

**Trigger Scenarios:**

| User Input | Why Trigger |
|------------|-------------|
| `Implement user login` | Feature development |
| `Login page is broken` | Bug fix |
| `Performance is too slow` | Optimization |
| `Write unit tests` | Testing |
| `Build a complete user system` | Multi-component task |
| `Set up a backend from scratch` | Multi-step project |
| `Frontend + Backend + Database` | Full-stack work |

**Keyword Triggers:**
- `实现...` / `添加...` / `修复...` / `优化...` / `测试...` (Chinese)
- `implement...` / `add...` / `fix...` / `build...` / `test...` (English)
- `support...` / `need...` / `want to...`
- Task file paths: `docs/task.md`

**Won't Trigger:**
- Questions: "How to implement login?" / "How to configure?"
- Info requests: "Show config" / "List files"
- Navigation: "Open directory" / "Go to folder"

---

## Execution Flow Overview

```
User Input → Quality Selection → Task Planning → Execution → Quality Gates → AI Acceptance → Meeting Handling → Complete
```

| Phase | Description | Key Point |
|:-----:|-------------|-----------|
| 0 | Interactive Q&A | **First question selects quality level** |
| 1 | Task Planning | Planner Agent generates plan |
| 2 | Task Execution | strict/balanced/fast modes |
| 3 | Quality Gates | 6 quality gate validations |
| 4 | AI Acceptance | Reviewer Agent final confirmation |
| 5 | Meeting | Non-blocking, process at end and **re-execute** |
| 6 | Final Report | Quality score + deliverables |

📖 **Detailed Flow Diagrams**: [docs/FLOW.md](docs/FLOW.md) (with Mermaid diagrams)

---

## Why Choose OpenMatrix?

### Comparison with superpowers / gsd

| Feature | OpenMatrix | superpowers | gsd |
|---------|:----------:|:-----------:|:---:|
| **100% Automation** | ✅ auto mode | ❌ 50% | ❌ 60% |
| **Built-in TDD** | ✅ strict mode | ❌ Manual | ❌ None |
| **Coverage Enforcement** | ✅ 60-80% | ❌ None | ❌ None |
| **Security Scanning** | ✅ npm audit | ❌ None | ❌ None |
| **AI Acceptance** | ✅ Reviewer Agent | ❌ None | Partial |
| **Non-blocking** | ✅ Meeting mechanism | ❌ Stops | ❌ Stops |
| **Quality Reports** | ✅ JSON + MD | ❌ None | Partial |
| **Ease of Use** | ⚡ One-liner start | Medium | High |

---

## Quick Start

### Installation

**Option 1: NPM Install (Recommended)**

```bash
# Global install
npm install -g openmatrix

# Skills are automatically installed to ~/.claude/commands/om/
# If auto-install fails, run manually:
openmatrix install-skills
```

**Option 2: Install from Source**

```bash
# Clone and install
git clone https://github.com/bigfish1913/openmatrix.git
cd openmatrix && npm install && npm run build && npm link

# Install Skills (if postinstall didn't run)
openmatrix install-skills
```

### Verify Installation

```bash
# Check CLI is available
openmatrix --version

# Check Skills are installed
openmatrix install-skills
# Or check directly:
ls ~/.claude/commands/om/
# Should show: start.md  auto.md  status.md  approve.md  meeting.md  resume.md  retry.md  report.md
```

### First Use

```bash
/om:start Implement user login feature

# System will ask first:
┌─────────────────────────────────────────────────────────┐
│ Question 0: Select Quality Level                        │
├─────────────────────────────────────────────────────────┤
│ 🚀 strict   → TDD + 80% coverage + AI acceptance (prod) │
│ ⚖️ balanced  → 60% coverage + AI acceptance (daily)     │
│ ⚡ fast      → No quality gates (prototypes)            │
└─────────────────────────────────────────────────────────┘
```

---

## Core Features

### 1️⃣ Three-Level Quality Configuration (First Question)

| Level | TDD | Coverage | Lint | Security | AI Accept | Use Case |
|:-----:|:---:|:--------:|:----:|:--------:|:---------:|----------|
| **strict** | ✅ | >80% | ✅ Strict | ✅ | ✅ | 🏭 **Production Code** |
| **balanced** | ❌ | >60% | ✅ | ✅ | ✅ | 📦 Daily Development |
| **fast** | ❌ | >20% | ❌ | ❌ | ❌ | 🏃 Quick Prototypes |

> strict can be configured to 100%. Default >80% covers core business logic.

### 2️⃣ Six Quality Gates (Verify Phase)

```
┌─────────────────────────────────────────────────────────────┐
│                    Verify Phase - Quality Gates              │
├─────────────────────────────────────────────────────────────┤
│  🚪 Gate 1: Build Check    npm run build     → Must pass    │
│  🚪 Gate 2: Test Run       npm test         → Must pass    │
│  🚪 Gate 3: Coverage Check >20%/60%/80%    → Configurable │
│  🚪 Gate 4: Lint Check     No errors        → Configurable │
│  🚪 Gate 5: Security Scan  npm audit        → No high-risk │
│  🚪 Gate 6: Acceptance     User defined     → All must met │
└─────────────────────────────────────────────────────────────┘
```

### 3️⃣ TDD Mode (strict Level)

```
Traditional:  Code → Test → Bug → Fix → Regression → ... (many cycles)

OpenMatrix TDD (strict):
  🧪 Test Phase:   Write tests first (RED - tests must fail)
  ✨ Dev Phase:    Write code (GREEN - tests must pass)
  ✅ Verify Phase: 6 quality gates
  🎉 Accept Phase: AI Reviewer final confirmation

Result: Right the first time, no rework
```

### 4️⃣ Meeting Mechanism (Non-blocking)

```
❌ Other solutions:
   TASK-001 ✓ → TASK-002 blocked ⏸️ → Wait for user... (wasted time)

✅ OpenMatrix:
   TASK-001 ✓ → TASK-002 blocked → Create Meeting → Skip ↷
   TASK-003 ✓ → TASK-004 ✓ → Done!
   → User uses /om:meeting to handle all blockers at once
```

### 5️⃣ AI Acceptance (Accept Phase)

```
Accept Phase executed by Reviewer Agent:
├── Check verify-report.md
├── Validate all acceptance criteria
├── Confirm code is merge-ready
└── Generate accept-report.md
```

---

## Execution Flow

### strict Mode (Recommended for Production)

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│   TDD   │────▶│ Develop │────▶│  Verify │────▶│ Accept  │
│ 🧪 RED  │     │ ✨ GREEN│     │ ✅ 6gate│     │ 🎉 AI   │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
```

### balanced Mode (Daily Development)

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│ Develop │────▶│  Verify │────▶│ Accept  │
│ ✨ Code │     │ ✅ 4gate│     │ 🎉 AI   │
└─────────┘     └─────────┘     └─────────┘
```

---

## Skills Commands

| Command | Purpose |
|---------|---------|
| `/om` | **Default entry** - Just type task description to start |
| `/om:start` | Start new task (first question selects quality level) |
| `/om:auto` | 🚀 **Full auto execution** - No blocking, no confirmation, direct completion |
| `/om:status` | View status |
| `/om:approve` | Approve decisions |
| `/om:meeting` | Handle blockers |
| `/om:resume` | Resume interruption |
| `/om:retry` | Retry failures |
| `/om:report` | Generate report |

> `/om` is a shortcut for `/om:start` with identical functionality

### `/om:start` Execution Flow (with Meeting Mechanism)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Execution Phase                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  TASK-001 ✅ ──→ TASK-002 ⚠️blocked ──→ Create Meeting ──→ Skip ↷       │
│                      │                                                   │
│                      ↓                                                   │
│  TASK-003 ✅ ──→ TASK-004 ✅ ──→ TASK-005 ✅ ──→ All tasks done          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        Meeting Auto Detection                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│                    ┌─────────────────────┐                               │
│                    │ Pending Meetings?   │                               │
│                    └──────────┬──────────┘                               │
│                          ╱    \                                          │
│                        No      Yes                                       │
│                        │       │                                         │
│                        ▼       ▼                                         │
│                   ┌───────┐ ┌─────────────────────────────┐              │
│                   │ Done! │ │  📋 Interactive Meeting     │              │
│                   └───────┘ │  ┌─────────────────────────┐│              │
│                             │  │ [1] TASK-002: DB conn   ││              │
│                             │  │     💡Provide / ⏭️Skip   ││              │
│                             │  │ [2] TASK-005: API choice ││              │
│                             │  │     🤔Select option     ││              │
│                             │  └─────────────────────────┘│              │
│                             └──────────────┬──────────────┘              │
│                                            │                              │
│                                            ▼                              │
│                             ┌─────────────────────────────┐              │
│                             │   User provides info/choice │              │
│                             │         ↓                   │              │
│                             │   🔄 Re-execute blocked     │              │
│                             │   TASK-002 ✅               │              │
│                             └──────────────┬──────────────┘              │
│                                            │                              │
└────────────────────────────────────────────┼──────────────────────────────┘
                                             │
                                             ▼
                                      ┌───────────┐
                                      │  Done! 🎉  │
                                      └───────────┘
```

### `/om:auto` Full Auto Mode

**Use Cases**: CI/CD, automation scripts, tasks without human intervention

```bash
/om:auto Implement user login feature           # Default strict mode
/om:auto --mode=balanced Add API endpoint       # Specify balanced mode
/om:auto --fast Create CLI tool                 # Fast prototype mode
```

**Features**:
- ❌ No approval confirmations
- ❌ No phase pauses
- ❌ Meetings auto-skipped (logged but non-blocking)
- ✅ Default strict quality level
- ✅ CI/CD integration ready

**Comparison with `/om:start`**:

| Feature | `/om:start` | `/om:auto` |
|---------|-------------|------------|
| Quality Level | Interactive selection | Parameter/default strict |
| Approval Confirm | Per config | All skipped |
| Meeting | Interactive handling | Auto-skipped |
| Use Case | Daily development | CI/CD, automation |

---

## Quality Reports

Generated after each task completion:

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

## FAQ

### Q: Which quality level is right for me?

| Your Scenario | Recommended Level |
|---------------|-------------------|
| 🏭 Production code, core features | **strict** |
| 📦 Daily feature development | **balanced** |
| 🏃 Quick prototypes, POC | **fast** |

### Q: Can OpenMatrix work with superpowers?

**A**: Yes! OpenMatrix automates task execution, superpowers provides additional skills.

### Q: What is Meeting?

**A**: When blocked, a record is created but **execution doesn't stop**. Use `/om:meeting` to handle all blockers at the end.

---

## Configuration

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

## Development

```bash
git clone https://github.com/bigfish1913/openmatrix.git
cd openmatrix && npm install && npm run build && npm test
```

---

## Roadmap

- [x] TDD Mode
- [x] 6 Quality Gates
- [x] Meeting Mechanism
- [x] Quality Reports
- [x] AI Acceptance
- [x] `/om:auto` Full Auto Mode
- [x] Auto Meeting Handling
- [ ] VSCode Extension
- [ ] Python/Go Support
- [ ] CI/CD Integration

---

<div align="center">

**If you find this useful, please give it a ⭐ Star!**

MIT © 2024 | Made by [bigfish1913](https://github.com/bigfish1913)

</div>
