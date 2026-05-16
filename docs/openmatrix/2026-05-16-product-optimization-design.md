# 设计方案: OpenMatrix 产品优化

日期: 2026-05-16

## 核心目标

- README 从 600 行精简到 150 行，第一屏展示核心价值
- 增加 `/om:test` 单点命令作为差异化突破点
- 简化术语：strict→严格，balanced→平衡，fast→快速
- 减少交互问答：从 5-6 个问题减少到 1-2 个

## 目标用户

独立开发者，痛点是"懒得写测试/修 bug"

## 差异化定位

主打"质量保证体系"——自动后台跑质量门禁，用户不用操心

## 改动清单

### 1. README.md 精简

新结构（约 150 行）：

```markdown
# OpenMatrix

## 一句话
你的代码没测试？OpenMatrix 自动帮你补，覆盖率 >80%。

## 30秒演示
[GIF 动图演示]

## 三种模式
| 模式 | 覆盖率 | 测试 | Lint | 适用 |
|-----|-------|------|------|------|
| 严格 | >80% | 先写测试 | ✅ | 生产代码 |
| 平衡 | >60% | 后补测试 | ✅ | 日常开发 |
| 快速 | >20% | 可选 | ❌ | 快速原型 |

## 快速开始
npm install -g openmatrix
/om 实现用户登录

## 单点命令
/om:test 补充登录模块测试    # 自动补测试
/om:debug 登录接口报 500      # 自动诊断修复

## 和 superpowers 配合
superpowers 写代码，OpenMatrix 保证质量。
```

**删除内容（移到 docs/）**：
- 详细流程图 → docs/FLOW.md
- Roadmap → docs/ROADMAP.md
- 状态存储详解 → docs/ARCHITECTURE.md
- 多语言支持列表 → 一句话"支持所有主流语言"
- FAQ 详细问答 → 保留最核心 2 个

### 2. `/om:test` 单点命令增强

**交互流程**：
```bash
/om:test 补充 src/auth/login.ts 的测试

# 自动执行：
1. 分析代码结构
2. 生成测试文件
3. 运行测试 + 覆盖率
4. 如果不达标 → 循环补充（最多 3 次）
5. 输出报告
```

**改动文件**: skills/test.md

### 3. 术语简化

| 现在术语 | 简化后 |
|---------|--------|
| strict | 严格模式 |
| balanced | 平衡模式 |
| fast | 快速模式 |
| Planner Agent | 任务拆分 |
| Coder Agent | 代码生成 |
| Tester Agent | 测试生成 |
| Reviewer Agent | 代码检查 |
| 质量门禁 | 质量检查 |
| Meeting | 阻塞记录 |
| Phase | 阶段 |

**改动文件**: skills/start.md, skills/om.md, skills/test.md

### 4. 交互流程简化

**现在**：
```
/om:start → 问质量级别 → 问E2E → 问模式 → 问验收 → ...（5-6个问题）
```

**改成**：
```
/om → 问模式 → 自动推断其他 → 开始执行
```

**自动推断规则**：
| 模式 | E2E 测试 | AI 验收 | 执行方式 |
|-----|---------|---------|---------|
| 严格 | 可选（问一句） | ✅ 必须 | TDD 流程 |
| 平衡 | ❌ 不需要 | ✅ 必须 | 先开发后测试 |
| 快速 | ❌ 不需要 | ❌ 不需要 | 直接开发 |

**改动文件**: skills/start.md, skills/om.md

## 验收标准

- README 首屏可见核心价值（无滚动）
- `/om:test 补充 xxx 测试` 可自动生成测试并达标
- 严格模式只问 2 个问题，其他模式只问 1 个
- 术语在所有文档中统一

## 风险与应对

| 风险 | 应对措施 |
|-----|---------|
| README 精简遗漏重要信息 | 移到 docs/ 子文档，README 引用 |
| `/om:test` 覆盖率循环卡住 | 最大重试 3 次，超过暂停提示 |
| 术语改动影响现有用户 | README 加"术语对照表"说明 |

## 关联文档

- docs/FLOW.md - 详细执行流程图
- docs/ROADMAP.md - 开发路线图
- docs/ARCHITECTURE.md - 系统架构详解
- docs/TERMINOLOGY.md - 术语对照表