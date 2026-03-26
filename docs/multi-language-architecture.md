# Multi-Language Support Architecture

## Overview

OpenMatrix multi-language support enables automatic detection, configuration, and execution optimization for different programming languages.

## Supported Languages

| Language | Detection Files | Package Manager | Build Command | Test Command |
|----------|-----------------|-----------------|---------------|--------------|
| TypeScript | `tsconfig.json`, `*.ts` | npm/yarn/pnpm | `tsc` / `npm run build` | `npm test` |
| Python | `pyproject.toml`, `setup.py`, `requirements.txt` | pip/poetry/pipenv | `python -m build` | `pytest` |
| Go | `go.mod` | go modules | `go build` | `go test ./...` |
| Java | `pom.xml`, `build.gradle` | maven/gradle | `mvn compile` / `gradle build` | `mvn test` / `gradle test` |
| Rust | `Cargo.toml` | cargo | `cargo build` | `cargo test` |
| Vue | `vue.config.js`, `*.vue` | npm/yarn/pnpm | `vue-cli-service build` | `vue-cli-service test` |
| HTML | `*.html`, `*.htm` | - | - | - |

## Architecture

### 1. Language Detector (`src/languages/detector.ts`)

```
Project Root
    │
    ├── File-based Detection
    │   ├── Check package files (go.mod, Cargo.toml, etc.)
    │   ├── Check config files (tsconfig.json, pyproject.toml)
    │   └── Check source files (*.ts, *.py, *.go)
    │
    └── Content Analysis
        ├── Import patterns (import, require, from)
        └── Syntax markers (func, def, class, fn)
```

### 2. Language Config (`src/languages/config.ts`)

```typescript
interface LanguageConfig {
  name: string;
  extensions: string[];
  detectionFiles: string[];

  // Build & Test
  buildCommand?: string;
  testCommand?: string;
  testFramework?: string;

  // Code Quality
  lintCommand?: string;
  formatCommand?: string;

  // Templates
  templates: {
    unitTest: string;
    performanceTest: string;
    ci: string;
  };

  // Conventions
  conventions: {
    namingConvention: string;
    directoryStructure: string[];
    bestPractices: string[];
  };

  // Agent Prompts
  agentPrompts: {
    coder: string;
    tester: string;
    reviewer: string;
  };
}
```

### 3. Integration with Agent System

```
AgentRunner
    │
    ├── detectLanguage() → Language
    │
    ├── getLanguageConfig(Language) → LanguageConfig
    │
    └── buildPrompt(Task, LanguageConfig) → Enhanced Prompt
```

## Implementation Plan

### Phase 1: Core Modules
1. `src/languages/detector.ts` - Auto language detection
2. `src/languages/configs/` - Per-language configuration files
3. `src/languages/index.ts` - Main export module

### Phase 2: Agent Integration
1. Enhance `AgentRunner` with language-aware prompts
2. Add language detection to `TaskPlanner`
3. Update test/quality commands based on language

### Phase 3: Templates & Documentation
1. Language-specific test templates
2. Performance test templates
3. CI/CD templates
4. Usage documentation

## Detection Strategy

### Priority Order
1. **Explicit config**: Package files (go.mod, Cargo.toml, etc.)
2. **Project config**: tsconfig.json, pyproject.toml
3. **Source analysis**: File extensions and imports

### Multi-language Projects
- Detect all languages present
- Identify primary language (most files / package.json)
- Support polyglot configuration

## Benefits

1. **Zero Configuration**: Auto-detect project language
2. **Optimized Prompts**: Language-specific best practices
3. **Standardized Commands**: Consistent build/test/lint
4. **Quality Assurance**: Language-appropriate testing
5. **Documentation**: Auto-generated language-specific docs