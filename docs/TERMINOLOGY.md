# OpenMatrix 术语对照表

本文档提供 OpenMatrix 中所有技术术语的中英文对照和详细解释。

---

## 质量级别

| 英文 | 中文 | 说明 |
|------|------|------|
| **strict** | 严格模式 | TDD + 80% 覆盖率 + 严格 Lint + 安全扫描 + AI 验收。推荐用于生产代码。 |
| **balanced** | 平衡模式 | 60% 覆盖率 + Lint + 安全扫描 + AI 验收。推荐用于日常开发。 |
| **fast** | 快速模式 | 无质量门禁。推荐用于快速原型。 |

### 质量级别详细对比

| 特性 | strict | balanced | fast |
|------|:------:|:--------:|:----:|
| TDD | ✅ | ❌ | ❌ |
| 最低覆盖率 | >80% | >60% | >20% |
| Lint | ✅ 严格 | ✅ | ❌ |
| 安全扫描 | ✅ | ✅ | ❌ |
| E2E 测试 | ❓ 可选 | ❓ 可选 | ❌ |
| AI 验收 | ✅ | ✅ | ❌ |

---

## 执行阶段

| 英文 | 中文 | 说明 |
|------|------|------|
| **planning** | 规划阶段 | Planner Agent 分解任务、生成执行计划 |
| **execution** | 执行阶段 | Coder/Tester Agent 执行开发任务 |
| **verification** | 验证阶段 | 7 道质量门禁验证 |
| **acceptance** | 验收阶段 | Reviewer Agent 最终确认 |

---

## 任务状态

| 英文 | 中文 | 说明 |
|------|------|------|
| **pending** | 待处理 | 任务已创建，等待调度 |
| **scheduled** | 已调度 | 任务已分配，准备执行 |
| **in_progress** | 进行中 | 任务正在执行 |
| **blocked** | 阻塞 | 任务遇到阻塞，无法继续 |
| **waiting** | 等待 | 任务已创建 Meeting，等待处理 |
| **verify** | 验证中 | 任务在质量门禁验证阶段 |
| **accept** | 验收中 | 任务在 AI 验收阶段 |
| **completed** | 已完成 | 任务执行完成并通过验收 |
| **failed** | 失败 | 任务执行失败 |
| **retry_queue** | 重试队列 | 任务等待重试 |

---

## Agent 类型

| 英文 | 中文 | 说明 |
|------|------|------|
| **planner** | 规划 Agent | 分解用户需求、生成执行计划和任务依赖图 |
| **coder** | 编码 Agent | 编写代码、实现功能、修复 Bug |
| **tester** | 测试 Agent | 编写测试、执行 TDD 流程、生成测试用例 |
| **reviewer** | 审核 Agent | AI 验收阶段确认、生成质量报告 |
| **researcher** | 调研 Agent | `/om:research` 领域知识收集、问题探索 |
| **executor** | 执行 Agent | 通用任务执行、命令运行 |

---

## 质量门禁

| 英文 | 中文 | 说明 |
|------|------|------|
| **Build Check** | 编译检查 | `npm run build` 或等效构建命令必须通过 |
| **Test Run** | 测试运行 | `npm test` 或等效测试命令必须通过 |
| **Coverage Check** | 覆盖率检查 | 测试覆盖率必须达到配置阈值 (20%/60%/80%) |
| **Lint Check** | Lint 检查 | 无 Lint error (strict 模式下无 warning) |
| **Security Scan** | 安全扫描 | `npm audit` 无高危漏洞 |
| **E2E Tests** | E2E 测试 | Playwright/Cypress 等端到端测试通过 (可选) |
| **Acceptance Criteria** | 验收标准 | 用户定义的验收条件全部满足 |

---

## Meeting 机制

| 英文 | 中文 | 说明 |
|------|------|------|
| **Meeting** | 会议 | 阻塞任务的记录机制，不中断执行 |
| **blocking** | 阻塞型 | 任务无法继续执行，需要外部信息 |
| **decision** | 决策型 | 需要用户选择方案 |
| **review** | 审核型 | 需要用户审核确认 |
| **planning** | 规划型 | 任务规划需要调整 |
| **ambiguity** | 歧义型 | 需求或技术方案存在歧义 |
| **pending** | 待处理 | Meeting 已创建，等待用户处理 |
| **resolved** | 已解决 | Meeting 已处理完成 |
| **cancelled** | 已取消 | Meeting 被用户取消 |

---

## Skills 命令

| 命令 | 中文名称 | 说明 |
|------|----------|------|
| `/om` | 默认入口 | 直接输入任务描述自动启动 |
| `/om:start` | 启动任务 | 启动新任务，交互式问答 |
| `/om:auto` | 全自动执行 | 无阻塞、无确认、直接完成 |
| `/om:brainstorm` | 头脑风暴 | 先探索需求和设计，再执行任务 |
| `/om:research` | 领域调研 | AI 驱动的领域调研和问题探索 |
| `/om:debug` | 系统化调试 | 四阶段根因分析 + 自动修复验证循环 |
| `/om:feature` | 轻量小需求 | 快速迭代小功能，分步 Git 提交 |
| `/om:status` | 查看状态 | 查看当前执行状态 |
| `/om:approve` | 审批决策 | 处理审批点 |
| `/om:meeting` | 处理阻塞 | 处理 pending Meeting |
| `/om:resume` | 智能恢复 | 恢复中断任务 |
| `/om:retry` | 重试失败 | 重试失败任务 |
| `/om:report` | 生成报告 | 生成质量报告 |
| `/check` | 项目检查 | 自动检测可改进点 |

---

## 审批点

| 英文 | 中文 | 说明 |
|------|------|------|
| **plan** | 计划审批 | 用户确认任务分解计划 |
| **merge** | 合并审批 | 用户确认代码合并 |
| **deploy** | 部署审批 | 用户确认部署操作 |

---

## 测试类型

| 英文 | 中文 | 说明 |
|------|------|------|
| **unit** | 单元测试 | 测试单个函数或模块 |
| **integration** | 集成测试 | 测试多个模块协作 |
| **e2e** | 端到端测试 | 测试完整用户流程 |
| **api** | API 测试 | 测试 API 接口 |
| **ui** | UI 测试 | 测试用户界面 |
| **visual** | 视觉回归测试 | 测试 UI 视觉一致性 |
| **performance** | 性能测试 | 测试系统性能 |
| **accessibility** | 无障碍测试 | 测试无障碍访问 |

---

## 测试框架

| 英文 | 适用语言 | 说明 |
|------|----------|------|
| **vitest** | TypeScript/JavaScript | Vite 原生测试框架 |
| **jest** | TypeScript/JavaScript | 通用测试框架 |
| **mocha** | TypeScript/JavaScript | 灵活测试框架 |
| **playwright** | 多语言 | E2E 测试框架 |
| **cypress** | TypeScript/JavaScript | E2E 测试框架 |
| **pytest** | Python | Python 测试框架 |
| **unittest** | Python | Python 内置测试 |
| **junit** | Java | Java 测试框架 |
| **gotest** | Go | Go 内置测试 |
| **cargo-test** | Rust | Rust 内置测试 |

---

## 歧义类型

| 英文 | 中文 | 说明 |
|------|------|------|
| **requirement** | 需求歧义 | 需求描述不清晰、存在多种解读 |
| **technical** | 技术歧义 | 技术方案选择、实现方式不明确 |
| **dependency** | 依赖歧义 | 依赖项版本、接口契约不明确 |
| **acceptance** | 验收歧义 | 验收标准不清晰、无法验证 |
| **test_result** | 测试结果歧义 | 测试结果不一致、无法判断 |

---

## 项目类型

| 英文 | 中文 | 说明 |
|------|------|------|
| **openmatrix** | OpenMatrix 项目 | OpenMatrix 自身项目 |
| **ai-project** | AI 项目 | 包含 prompts/skills/agents 的项目 |
| **nodejs** | Node.js 项目 | Node.js 纯 JavaScript 项目 |
| **typescript** | TypeScript 项目 | TypeScript 项目 |
| **python** | Python 项目 | Python 项目 |
| **go** | Go 项目 | Go 语言项目 |
| **rust** | Rust 项目 | Rust 语言项目 |
| **java** | Java 项目 | Java 项目 |
| **csharp** | C# 项目 | C# .NET 项目 |
| **react** | React 项目 | React 前端项目 |
| **vue** | Vue 项目 | Vue 前端项目 |
| **angular** | Angular 项目 | Angular 前端项目 |
| **nextjs** | Next.js 项目 | Next.js 全栈项目 |

---

## 构建工具

| 英文 | 说明 |
|------|------|
| **npm** | npm scripts 构建命令 |
| **yarn** | yarn 构建命令 |
| **pnpm** | pnpm 构建命令 |
| **make** | Makefile 构建 |
| **docker** | Docker/Docker Compose 构建 |
| **gradle** | Gradle (Java) 构建 |
| **maven** | Maven (Java) 构建 |
| **cargo** | Cargo (Rust) 构建 |
| **webpack** | webpack 打包 |
| **vite** | Vite 打包 |
| **esbuild** | esbuild 打包 |
| **rollup** | Rollup 打包 |
| **turbo** | Turborepo 构建 |
| **bazel** | Bazel 构建 |

---

## 部署方式

| 英文 | 中文 | 说明 |
|------|------|------|
| **docker** | Docker 部署 | Docker 容器部署 |
| **docker-compose** | Docker Compose | Docker Compose 多容器部署 |
| **kubernetes** | K8s 部署 | Kubernetes 集群部署 |
| **helm** | Helm 部署 | Helm Chart 部署 |
| **npm** | npm 发布 | npm 包发布 |
| **github-pages** | GitHub Pages | GitHub Pages 静态部署 |
| **vercel** | Vercel | Vercel 云部署 |
| **netlify** | Netlify | Netlify 云部署 |
| **aws** | AWS | AWS 云部署 |
| **gcp** | Google Cloud | Google Cloud 部署 |
| **azure** | Azure | Azure 云部署 |

---

## 调试术语

| 英文 | 中文 | 说明 |
|------|------|------|
| **task_failure** | 任务失败 | 任务执行过程中失败 |
| **project_bug** | 项目 Bug | 用户项目代码中的 Bug |
| **system_bug** | 系统 Bug | OpenMatrix 系统自身的 Bug |
| **environment** | 环境问题 | 环境配置问题 |
| **diagnosing** | 诊断中 | 正在进行根因分析 |
| **awaiting_fix** | 等待修复 | 等待用户确认是否修复 |
| **fixing** | 修复中 | 正在实施修复 |
| **verifying** | 验证中 | 正在验证修复效果 |

---

## 其他常用术语

| 英文 | 中文 | 说明 |
|------|------|------|
| **SubagentTask** | 子 Agent 任务 | Claude Code Agent 工具调用的配置 |
| **worktree** | 工作树 | Git worktree 隔离执行环境 |
| **QualityConfig** | 质量配置 | 质量门禁配置参数 |
| **QualityReport** | 质量报告 | Verify 阶段生成的报告 |
| **AppConfig** | 应用配置 | 全局运行配置 |
| **RunStatus** | 运行状态 | 整体执行状态 |
| **phase** | 阶段 | 任务执行阶段 |
| **artifact** | 产出文件 | 任务执行产生的文件 |
| **context.md** | 上下文文件 | Agent 间传递的上下文信息 |

---

## 相关链接

- [返回 README](../README.md)
- [架构详解](ARCHITECTURE.md)
- [执行流程](FLOW.md)