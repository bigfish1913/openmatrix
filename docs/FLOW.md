# OpenMatrix 执行流程图

## 完整流程概览

```mermaid
flowchart TB
    subgraph Input["🎯 用户输入"]
        A["/om:start 实现用户登录功能"]
    end

    subgraph QA["📋 阶段 0: 交互式问答"]
        Q0["Q0: 选择质量级别?"]
        Q0 --> Q0A["🚀 strict"]
        Q0 --> Q0B["⚖️ balanced"]
        Q0 --> Q0C["⚡ fast"]
        Q1["Q1: 任务目标?"]
        Q2["Q2: 技术栈?"]
        Q3["Q3: 文档要求?"]
    end

    subgraph Plan["📐 阶段 1: 任务规划"]
        P1["Planner Agent"]
        P2["生成执行计划"]
        P3["子任务列表 + 依赖图"]
    end

    subgraph Exec["⚙️ 阶段 2: 任务执行"]
        direction TB
        E1["执行子任务"]
        E2{"有阻塞?"}
        E3["创建 Meeting"]
        E4["继续执行其他任务"]
        E5["全部完成"]
    end

    A --> Q0
    Q0 --> Q1 --> Q2 --> Q3
    Q3 --> P1 --> P2 --> P3
    P3 --> E1
    E1 --> E2
    E2 -->|是| E3 --> E4 --> E1
    E2 -->|否| E5
```

## 质量级别执行流程

### strict 模式 (推荐生产代码)

```mermaid
flowchart LR
    subgraph TDD["🧪 TDD 阶段"]
        T1["Tester 编写测试"]
        T2["测试必须失败<br/>(RED)"]
    end

    subgraph Dev["✨ 开发阶段"]
        D1["Coder 编写代码"]
        D2["测试必须通过<br/>(GREEN)"]
    end

    subgraph Ver["✅ 验证阶段"]
        V1["7 道质量门禁"]
    end

    subgraph Acc["🎉 验收阶段"]
        A1["AI Reviewer"]
        A2["最终确认"]
    end

    T1 --> T2 --> D1 --> D2 --> V1 --> A1 --> A2
```

### balanced 模式 (日常开发)

```mermaid
flowchart LR
    subgraph Dev["✨ 开发阶段"]
        D1["Coder 编写代码"]
    end

    subgraph Ver["✅ 验证阶段"]
        V1["5 道质量门禁"]
    end

    subgraph Acc["🎉 验收阶段"]
        A1["AI Reviewer"]
        A2["最终确认"]
    end

    D1 --> V1 --> A1 --> A2
```

### fast 模式 (快速原型)

```mermaid
flowchart LR
    subgraph Dev["✨ 开发阶段"]
        D1["Coder 编写代码"]
    end

    subgraph Done["🏁 完成"]
        E1["结束"]
    end

    D1 --> E1
```

## 七道质量门禁

```mermaid
flowchart TB
    subgraph Gates["🚪 7 Quality Gates"]
        direction TB
        G1["Gate 1: 编译检查<br/>npm run build"]
        G2["Gate 2: 测试运行<br/>npm test"]
        G3["Gate 3: 覆盖率检查<br/>>20%/60%/80%"]
        G4["Gate 4: Lint 检查<br/>无 error"]
        G5["Gate 5: 安全扫描<br/>npm audit"]
        G6["Gate 6: E2E 测试<br/>Playwright 等 (可选)"]
        G7["Gate 7: 验收标准<br/>用户定义"]

        G1 --> G2 --> G3 --> G4 --> G5 --> G6 --> G7
    end

    G1 -->|❌ 失败| FAIL["阻止继续"]
    G2 -->|❌ 失败| FAIL
    G3 -->|⚠️ 不达标| WARN["警告但继续"]
    G4 -->|❌ 失败| FAIL
    G5 -->|❌ 有漏洞| FAIL
    G6 -->|⏭️ 跳过| SKIP["可选，可跳过"]
    G7 -->|❌ 未满足| FAIL

    G7 -->|✅ 全部通过| PASS["进入 Accept 阶段"]
```

## Research 调研模式

**适用场景**: 垂直领域任务（游戏开发、支付系统、电商网站等），需要先了解领域知识再执行任务。

```mermaid
flowchart TB
    subgraph Init["📚 初始化"]
        A["/om:research 做一个游戏"]
        B["CLI: 创建研究会话"]
    end

    subgraph Analyze["🔍 AI 领域分析"]
        C["Agent: 识别领域"]
        D["识别核心方面<br/>(5-10个)"]
        E["识别关键决策"]
    end

    subgraph Preview["📋 用户确认"]
        F["展示调研范围"]
        F -->|确认| G["开始研究"]
        F -->|调整| H["修改方向"]
        F -->|跳过| I["直接进入 /om:start"]
    end

    subgraph Research["🔬 并行研究"]
        R1["Agent 1: 领域知识<br/>核心概念 + 行业标准"]
        R2["Agent 2: 技术方案<br/>主流架构 + 最佳实践"]
        R3["Agent 3: 应用场景<br/>实际案例 + 常见挑战"]
    end

    subgraph Survey["📝 领域问卷"]
        S1["基于研究结果提问"]
        S2["收集用户决策"]
    end

    subgraph Output["📄 生成领域文档"]
        O1["GDD / PRD / 技术方案"]
        O2["knowledge/ 关键发现"]
        O3["context.json → start"]
    end

    subgraph Next["🚀 接入执行"]
        N1["/om:start 任务执行"]
    end

    A --> B --> C --> D --> E --> F
    G --> R1
    G --> R2
    G --> R3
    R1 --> S1
    R2 --> S1
    R3 --> S1
    S1 --> S2 --> O1 --> O2 --> O3 --> N1
    H --> C
    I --> N1
```

### Research 输出文件

```
.openmatrix/research/
├── session.json          # 研究会话状态
├── RESEARCH.md           # 领域专属文档 (GDD/PRD/技术方案)
├── knowledge/
│   ├── finding-1.md      # 关键发现
│   └── finding-2.md
└── context.json          # → start 的任务上下文
```

### 与 brainstorm 的关系

brainstorm 检测到垂直领域时，会建议使用 `/om:research` 进行深度调研，调研完成后再接入 `/om:start` 执行任务。

```
brainstorm → 检测到垂直领域 → suggestResearch → /om:research → /om:start
```

## Meeting 处理流程

**重要**: 任务执行完成后，系统自动检测并处理 Meeting，无需用户手动调用 `/om:meeting`。

```mermaid
flowchart TB
    subgraph Exec["任务执行"]
        T1["TASK-001: ✅ 完成"]
        T2["TASK-002: ⚠️ 阻塞"]
        T3["TASK-003: ✅ 完成"]
        T4["TASK-004: ⚠️ 阻塞"]
        T5["TASK-005: ✅ 完成"]
        E1["所有任务执行完成"]
    end

    subgraph Check["🔍 自动检测"]
        C1{"有 pending Meeting?"}
    end

    subgraph Meeting["📋 交互式处理 (自动弹出)"]
        M1["Meeting-001: 数据库连接失败"]
        M2["Meeting-002: API设计决策"]

        M1 --> M1A["💡 提供信息"]
        M1 --> M1B["⏭️ 跳过任务"]
        M1 --> M1C["🔄 重试"]

        M2 --> M2A["💡 提供信息"]
        M2 --> M2B["⏭️ 跳过任务"]
        M2 --> M2C["🔄 重试"]
    end

    subgraph Retry["🔄 重新执行"]
        R1["重新执行 TASK-002"]
        R2["重新执行 TASK-004"]
    end

    subgraph Done["🏁 完成"]
        D1["生成最终报告"]
    end

    T1 --> T2 --> T3 --> T4 --> T5 --> E1
    E1 --> C1
    C1 -->|是| Meeting
    C1 -->|否| Done
    T2 -.->|创建| M1
    T4 -.->|创建| M2
    M1A --> R1
    M2A --> R2
    R1 --> C1
    R2 --> C1
```

## AI 验收流程

```mermaid
flowchart TB
    subgraph Accept["🎉 Accept 阶段 (Reviewer Agent)"]
        A1["📄 读取 verify-report.md"]
        A2["✅ 验证验收标准"]
        A3["🔍 确认可合并"]
        A4["📊 生成 quality-report.json"]
        A5["📝 生成 accept-report.md"]
    end

    A1 --> A2 --> A3 --> A4 --> A5

    A5 --> Result{"验收结果"}

    Result -->|✅ 通过| Pass["ACCEPT_PASSED<br/>Quality Score: A"]
    Result -->|⚠️ 需修改| Modify["ACCEPT_NEEDS_MODIFICATION"]
    Result -->|❌ 失败| Fail["ACCEPT_FAILED"]
```

## 最终报告

```mermaid
flowchart LR
    subgraph Report["📊 /om:report"]
        R1["执行统计"]
        R2["质量报告"]
        R3["产出文件列表"]
    end

    subgraph Output["📁 产出文件"]
        O1["state.json"]
        O2["tasks/TASK-XXX/"]
        O3["approvals/"]
        O4["quality-report.json"]
    end

    Report --> Output
```

## 完整生命周期

```mermaid
sequenceDiagram
    participant U as 用户
    participant S as Skill
    participant RS as Researcher
    participant P as Planner
    participant C as Coder
    participant T as Tester
    participant R as Reviewer
    participant M as Meeting

    alt 垂直领域任务
        U->>S: /om:research 做一个游戏
        S->>RS: AI 分析主题，识别领域
        RS->>S: 领域 + 调研方向
        S->>U: 确认研究范围?
        U->>S: 确认
        par 并行研究
            S->>RS: Agent 1: 领域知识
        and
            S->>RS: Agent 2: 技术方案
        and
            S->>RS: Agent 3: 应用场景
        end
        RS->>S: 研究结果
        S->>U: 领域问卷
        U->>S: 回答
        S->>S: 生成领域文档 (GDD/PRD)
        S->>U: 开始执行?
        U->>S: 确认
    end

    U->>S: /om:start 实现登录
    S->>U: Q0: 质量级别?
    U->>S: strict
    S->>U: Q1-Q3: 其他问题?
    U->>S: 回答
    S->>P: 任务规划
    P->>S: 执行计划

    loop 每个子任务
        S->>T: TDD: 写测试
        T->>S: 测试(RED)
        S->>C: 开发: 写代码
        C->>S: 代码(GREEN)
        S->>R: 验证: 质量门禁
        alt 验证通过
            R->>S: PASS
        else 验证失败
            R->>S: FAIL
            S->>M: 创建 Meeting (pending)
            Note over S: 跳过阻塞任务，继续执行
        end
        S->>R: 验收: AI确认
        R->>S: ACCEPT_PASSED
    end

    Note over S: 所有任务执行完成

    alt 有 pending Meeting
        S->>S: 自动检测 Meeting
        S->>U: 📋 展示待处理 Meeting
        loop 处理每个 Meeting
            U->>S: 提供信息/跳过/重试
            alt 提供信息或重试
                S->>C: 重新执行阻塞任务
                C->>S: 任务完成
            end
        end
    end

    S->>U: ✅ 全部完成 - 生成报告
```

---

## 相关链接

- [返回 README](../README.md)
- [Skills 命令](../skills/)
- [配置说明](../README.md#配置)
