---
name: om:deploy
description: "智能部署助手：分析项目+系统环境 → 推荐最可行方案 → 执行部署 → 生成一键脚本。Triggers on: deploy, 部署, 发布, docker, kubernetes, 环境搭建, 开发环境, make, taskfile, pm2"
---

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。
</NO-OTHER-SKILLS>

<objective>
智能部署助手：自动分析项目文件和系统环境 → 推荐当前环境下最可行的部署方案 → 用户确认后执行 → 生成可复用的一键脚本。
</objective>

<process>

## Step 1: 读取历史部署配置

```bash
cat .openmatrix/deploy-config.json 2>/dev/null || echo "NO_HISTORY"
```

**如果有历史配置：**
- 对比上次记录的关键文件和当前实际文件
- 判断是否有变更

```bash
# 对比关键文件是否存在变化
ls -la Dockerfile docker-compose.yml Makefile Taskfile.yml 2>/dev/null
cat package.json 2>/dev/null | grep -E '"(deploy|start|build)"'
```

**变更检测结果：**
| 状态 | 处理 |
|------|------|
| 无历史配置 | 正常流程（分析+询问） |
| 无变更 | 直接使用上次配置，仅确认一次 |
| 有变更 | 重新分析并询问 |

---

## Step 2: 分析项目文件

直接读取项目文件，不调用 CLI：

```bash
# 项目配置文件
ls -la Dockerfile docker-compose.yml docker-compose.yaml Makefile Taskfile.yml Taskfile.yaml 2>/dev/null
ls -la k8s/ helm/ .github/workflows/ 2>/dev/null
cat package.json 2>/dev/null
cat go.mod 2>/dev/null
cat Cargo.toml 2>/dev/null
cat requirements.txt pyproject.toml 2>/dev/null
```

提取关键信息：
- 项目类型（Node.js/Go/Python/Rust/Java 等）
- 已有部署配置（Dockerfile、docker-compose、Makefile、k8s 等）
- package.json 中的 scripts（build/start/deploy 等）

---

## Step 3: 检测系统环境

```bash
# 检测已安装的工具
docker --version 2>/dev/null && echo "docker:ok" || echo "docker:missing"
docker-compose --version 2>/dev/null && echo "docker-compose:ok" || echo "docker-compose:missing"
kubectl version --client 2>/dev/null && echo "kubectl:ok" || echo "kubectl:missing"
make --version 2>/dev/null && echo "make:ok" || echo "make:missing"
task --version 2>/dev/null && echo "task:ok" || echo "task:missing"
pm2 --version 2>/dev/null && echo "pm2:ok" || echo "pm2:missing"
node --version 2>/dev/null && echo "node:ok" || echo "node:missing"

# 操作系统
uname -s 2>/dev/null || echo "Windows"
```

---

## Step 4: AI 分析并展示环境报告

基于收集到的信息，直接输出分析报告（不用 AskUserQuestion）：

```markdown
## 🔍 环境分析报告

**项目**: [名称] ([类型])
**操作系统**: [Linux/macOS/Windows]

### 已检测到的部署配置
- ✅ Dockerfile
- ✅ docker-compose.yml
- ❌ Makefile（未找到）

### 已安装的工具
- ✅ Docker 24.0.5
- ✅ make 4.3
- ❌ task（未安装）
- ❌ pm2（未安装）
```

---

## Step 5: 推荐部署方案（带理由）

AI 根据"项目配置 × 已安装工具"交叉分析，用 AskUserQuestion 展示推荐方案：

**推荐逻辑（AI 自行判断，不是硬编码）：**
- 有 Dockerfile + docker 已安装 → Docker 是最直接的选择
- 有 docker-compose + 多服务 → Docker Compose 更合适
- 有 k8s 配置 + kubectl 已安装 → Kubernetes
- 有 Makefile + make 已安装 → 直接用 make
- Node.js + pm2 已安装 → PM2 轻量方案
- 什么都没有 → AI 根据项目类型推荐创建配置

```
AskUserQuestion:
  header: "部署方案"
  question: "基于你的环境分析，推荐以下方案（已标注推荐原因）："

  options:
  - label: "Docker (推荐)"
    description: "已有 Dockerfile + Docker 已安装，直接可用，环境隔离好"
  - label: "Docker Compose"
    description: "检测到 docker-compose.yml，适合多服务编排"
  - label: "Make"
    description: "已有 Makefile + make 已安装，运行 make deploy"
  - label: "npm scripts"
    description: "无需额外工具，直接用 package.json 中的 scripts"
```

---

## Step 6: 确认部署环境

```
AskUserQuestion:
  header: "目标环境"
  question: "部署到哪个环境？"

  options:
  - label: "本地开发 (推荐)"
    description: "快速启动，用于开发调试"
  - label: "测试环境"
    description: "模拟生产配置，用于验证"
  - label: "生产环境"
    description: "需要完整配置和安全检查"
```

---

## Step 7: 执行部署

根据用户选择，AI 执行对应命令：

**Docker 本地：**
```bash
docker build -t <project-name> .
docker run -d -p <port>:<port> --name <project-name> <project-name>
docker ps | grep <project-name>
```

**Docker Compose：**
```bash
docker-compose up -d --build
docker-compose ps
```

**Make：**
```bash
make deploy
```

**npm scripts：**
```bash
npm run build
npm run start
```

执行后验证：
```bash
# 检查服务是否正常运行
docker ps 2>/dev/null | grep <name>
curl -s http://localhost:<port>/health 2>/dev/null || echo "服务已启动"
```

输出执行结果，告知用户服务状态。

---

## Step 8: 询问是否生成一键脚本

```
AskUserQuestion:
  header: "一键脚本"
  question: "部署完成！是否生成一键脚本方便后续开发调试？"

  options:
  - label: "生成 Taskfile.yml (推荐)"
    description: "task 已安装 / 现代化工具，YAML 格式简洁，跨平台"
  - label: "生成 Makefile"
    description: "make 已安装 / 经典工具，已有 Makefile 时保持一致"
  - label: "添加到 npm scripts"
    description: "Node.js 项目，无需额外工具"
  - label: "不需要"
    description: "已有足够配置"
```

---

## Step 9: 生成一键脚本

根据用户选择和项目实际情况，用 Write 工具生成脚本。

**Taskfile.yml 示例（根据实际项目定制）：**
```yaml
version: '3'

vars:
  APP: '{{.APP | default "app"}}'
  PORT: '{{.PORT | default "3000"}}'

tasks:
  setup:
    desc: 安装依赖
    cmds:
      - npm install

  build:
    desc: 构建项目
    cmds:
      - npm run build

  test:
    desc: 运行测试
    cmds:
      - npm test

  dev:
    desc: 本地开发（热重载）
    cmds:
      - npm run dev

  deploy:local:
    desc: 本地 Docker 部署
    cmds:
      - docker build -t {{.APP}} .
      - docker run -d -p {{.PORT}}:{{.PORT}} --name {{.APP}} {{.APP}}
      - echo "✅ 服务已启动 http://localhost:{{.PORT}}"

  deploy:prod:
    desc: 生产部署
    cmds:
      - docker build -t {{.APP}}:{{.VERSION}} .
      - docker push {{.REGISTRY}}/{{.APP}}:{{.VERSION}}

  logs:
    desc: 查看日志
    cmds:
      - docker logs -f {{.APP}}

  stop:
    desc: 停止服务
    cmds:
      - docker stop {{.APP}} && docker rm {{.APP}}
```

**Makefile 示例（根据实际项目定制）：**
```makefile
APP ?= app
PORT ?= 3000

.PHONY: setup build test dev deploy-local deploy-prod logs stop

setup:
	npm install

build:
	npm run build

test:
	npm test

dev:
	npm run dev

deploy-local:
	docker build -t $(APP) .
	docker run -d -p $(PORT):$(PORT) --name $(APP) $(APP)
	@echo "✅ 服务已启动 http://localhost:$(PORT)"

deploy-prod:
	docker build -t $(APP):$(VERSION) .
	docker push $(REGISTRY)/$(APP):$(VERSION)

logs:
	docker logs -f $(APP)

stop:
	docker stop $(APP) && docker rm $(APP)
```

---

## Step 10: 保存部署配置

将用户选择的部署方式保存到 `.openmatrix/deploy-config.json`：

```json
{
  "deployMethod": "docker",
  "envType": "local",
  "scriptTool": "taskfile",
  "lastDetectedFiles": {
    "Dockerfile": true,
    "docker-compose.yml": false,
    "Makefile": false,
    "package.json": true
  },
  "lastDetectedTools": {
    "docker": "24.0.5",
    "make": "4.3",
    "task": null
  },
  "timestamp": "2026-04-22T15:00:00Z"
}
```

下次运行时，对比 `lastDetectedFiles` 和当前实际文件状态，判断是否需要重新询问。

---

## Step 11: 输出总结

```markdown
## ✅ 部署完成

**方案**: Docker 本地部署
**环境**: 本地开发
**脚本**: 已生成 Taskfile.yml

### 常用命令
- `task dev` — 本地开发
- `task deploy:local` — Docker 本地部署
- `task deploy:prod` — 生产部署
- `task logs` — 查看日志
- `task stop` — 停止服务
```

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:deploy              # 自动分析 → 推荐方案 → 执行 → 生成脚本
/om:deploy local        # 直接指定本地环境
/om:deploy prod         # 直接指定生产环境
</examples>

<notes>
## 核心原则

1. **AI 是分析者**：读取真实文件和系统状态，不靠硬编码规则推断
2. **AI 是执行者**：用户确认后直接运行命令，不只是给建议
3. **推荐最可行的**：基于"当前系统已有什么工具"，不是"理论上最好的"
4. **产出可复用脚本**：最终生成 Taskfile/Makefile，方便后续开发调试
5. **记录上次选择**：保存部署配置，下次未变化时直接复用，减少重复询问

## 历史配置复用

`.openmatrix/deploy-config.json` 存储上次部署选择：
- 对比 `lastDetectedFiles` 和当前文件状态
- 状态一致 → 直接使用上次配置，仅确认一次
- 状态变化 → 重新分析并询问

变更检测：
- Dockerfile/docker-compose.yml/Makefile 新增或删除
- package.json scripts 变化
- 系统工具安装状态变化

## 推荐决策依据（AI 自行判断）

| 项目配置 | 系统工具 | 推荐方案 |
|---------|---------|---------|
| 有 Dockerfile | docker 已安装 | Docker |
| 有 docker-compose | docker-compose 已安装 | Docker Compose |
| 有 k8s/ | kubectl 已安装 | Kubernetes |
| 有 Makefile | make 已安装 | Make |
| Node.js | pm2 已安装 | PM2 |
| Node.js | 无特殊工具 | npm scripts |
| 无任何配置 | docker 已安装 | 生成 Dockerfile |
| 无任何配置 | 无工具 | npm scripts / shell 脚本 |

## 脚本工具选择依据

| 条件 | 推荐 |
|------|------|
| task 已安装 | Taskfile.yml |
| make 已安装 / 已有 Makefile | Makefile |
| Node.js 项目 / 无工具 | npm scripts |
| Windows + 无工具 | package.json scripts |
</notes>
