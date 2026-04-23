# 设计方案: /om:test 指令

日期: 2026-04-23

## 核心目标
- 全自动扫描项目，发现测试缺失
- 从业务角度分析，像"测试工程师"一样理解代码逻辑生成测试
- 支持 UI 测试（用户确认 + AI 推荐）
- 自动验证生成的测试

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    用户调用 /om:test                          │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Skill 层 (skills/test.md)                       │
│                                                               │
│  1. 调用 CLI 收集项目原始数据                                   │
│  2. 分析业务逻辑、发现测试缺失                                   │
│  3. 询问用户是否需要 UI 测试                                    │
│  4. 调用 Agent 生成测试代码                                     │
│  5. 调用 CLI 验证测试                                          │
└─────────────────────────────┬───────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────┐       ┌─────────────────────┐
│ CLI 层               │       │ Agent 层             │
│ (commands/test.ts)   │       │ (general-purpose)    │
│                     │       │                      │
│ • 扫描项目结构        │       │ • 生成测试代码        │
│ • 检测测试框架        │       │ • 分析业务逻辑        │
│ • 运行测试验证        │       │                      │
│ • 输出 JSON 数据      │       │                      │
└─────────────────────┘       └─────────────────────┘
```

## 数据模型

### CLI 输出 JSON

```typescript
interface TestScanResult {
  sessionId: string;
  status: 'scanning' | 'analyzing' | 'generating' | 'verifying' | 'completed';

  projectInfo: {
    language: string;
    testFramework: string;
    hasExistingTests: boolean;
    testDirectory: string;
  };

  sourceFiles: string[];
  existingTests: string[];

  uiInfo?: {
    hasFrontend: boolean;
    frontendFramework: string;
    hasUITests: boolean;
    recommendedUIFramework: string;
  };
}
```

## 关键接口 / API

### CLI 命令

```bash
openmatrix test              # 全自动扫描
openmatrix test --json       # 输出 JSON 格式
openmatrix test --verify     # 扫描后运行测试验证
```

### Skill 调用

```
/om:test              # 无参数，自动扫描整个项目
/om:test src/auth/    # 指定目录范围（可选扩展）
```

## 技术方案

- **方案选择**: 方案 A - Skill + CLI 协作模式
- **理由**: 符合 OpenMatrix 分层原则（AI 做 AI 的事，CLI 做 CLI 的事）

### 文件结构

- `skills/test.md` - Skill 定义文件
- `src/cli/commands/test.ts` - CLI 命令实现

## Skill 执行流程

```
Step 1: 调用 CLI 收集原始数据
    │   openmatrix test --json
    ▼
Step 2: AI 分析项目上下文
    │   • 读取 projectInfo 判断语言和框架
    │   • 读取 sourceFiles 了解项目结构
    │   • 读取 existingTests 识别现有覆盖
    ▼
Step 3: 发现测试缺失
    │   • 对比源文件与测试文件
    │   • 分析每个源文件的业务逻辑复杂度
    │   • 识别关键业务场景未被测试覆盖
    │   • 输出缺失测试报告
    ▼
Step 4: UI 测试决策
    │   • 如果 hasFrontend=true，AskUserQuestion 是否需要 UI 测试
    │   • AI 给出推荐（基于 frontendFramework 和现有测试情况）
    ▼
Step 5: 生成测试
    │   • 调用 Agent(general-purpose) 生成单元测试
    │   • 如果需要 UI 测试，调用 Agent 生成 E2E 测试
    │   • Agent 将测试文件写入对应目录
    ▼
Step 6: 验证测试
    │   • 调用 CLI: openmatrix test --verify
    │   • 如果验证失败，分析失败原因
    │   • 如果失败次数 < 3，重新生成修复
    │   • 如果失败次数 >= 3，暂停并报告
    ▼
Step 7: 输出报告
    │   • 展示生成的测试文件列表
    │   • 展示验证结果
    │   • Git 提交（可选）
```

## 测试文件生成策略

### 文件放置规则

| 项目类型 | 测试目录 | 文件命名 |
|---------|---------|---------|
| TypeScript | `__tests__/` 或 `tests/` | `{source}.test.ts` |
| Python | `tests/` | `test_{source}.py` |
| Go | `{package}_test.go` | 与源文件同目录 |

### UI 测试特殊处理

```
tests/e2e/
├── playwright.config.ts
├── pages/
│   └── LoginPage.spec.ts
├── screenshots/
│   └── *.png
└── .gitignore
```

## 错误处理策略

### 自动验证循环

```
生成测试 → 运行测试验证 → 判断结果
    │                        │
    │              ┌─────────┴─────────┐
    │              │                   │
    │           通过                  失败
    │              │                   │
    │              ▼                   ▼
    │        输出成功报告          retryCount + 1
    │                               │
    │                      ┌────────┴────────┐
    │                      │                 │
    │                   < 3 次            >= 3 次
    │                      │                 │
    │                      ▼                 ▼
    │               重新分析修复         暂停并报告
    │               (带失败信息)         (可能测试框架问题)
```

### 错误类型处理

| 错误类型 | 处理方式 |
|---------|---------|
| 测试语法错误 | Agent 分析错误信息，修复测试代码 |
| 测试逻辑错误 | Agent 分析失败断言，调整测试用例 |
| 环境配置错误 | 提示用户检查测试框架配置 |
| 3 次失败后 | 报告问题，建议用户手动检查 |

## 约束与风险

### 约束
- 需要项目已有测试框架配置
- 测试生成依赖 AI 对业务逻辑的理解

### 风险
- 项目可能没有测试框架配置，需要 AI 智能判断
- 大项目扫描可能耗时较长
- 生成的测试可能需要用户调整断言细节

## 验收标准

- `/om:test` 命令可用
- 能扫描项目并发现测试缺失
- 能生成并写入测试文件
- 能自动验证测试（循环最多 3 次）
- UI 测试可选，用户确认 + AI 推荐
- 截图等文件规范放置并 git 忽略