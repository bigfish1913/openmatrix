---
name: om:deploy
description: "智能部署助手：读取项目环境 → 推荐部署方式 → 生成一键脚本。Triggers on: deploy, 部署, 发布, docker, kubernetes, 环境搭建, 开发环境, make, taskfile"
---

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
智能部署助手：自动检测项目环境 → 推荐最优部署方案 → 交互确认 → 执行部署 → 生成一键脚本。
</objective>

<trigger-conditions>
**当用户想要:**
- 查看项目部署选项
- 搭建开发/测试/生产环境
- 执行部署命令
- 生成一键部署脚本

**用户输入示例:**
- `/om:deploy` - 智能部署流程
- `/om:deploy local` - 本地开发环境
- `/om:deploy prod` - 生产环境
</trigger-conditions>

<process>

## Step 1: 检测项目环境

调用 CLI 获取完整环境信息:
```bash
openmatrix deploy --json --show-dev
```

解析检测结果，提取：
- 项目类型、构建工具
- 已有的部署配置（Dockerfile、docker-compose.yml、Makefile 等）
- 可用的中间件（Docker、Kubernetes、npm、Make）
- CI/CD 配置

---

## Step 2: 确认部署环境类型（带推荐）

**AI 根据项目特征判断推荐：**

| 检测特征 | 推荐环境 |
|---------|---------|
| 有 Dockerfile + docker-compose.yml | **本地开发** (容器化开发) |
| 有 CI 配置 + 测试覆盖 | **测试环境** (CI 自动化) |
| 有生产配置 (nginx、ssl、生产依赖) | **生产环境** |
| 无任何配置 | **本地开发** (最简单) |

使用 AskUserQuestion 询问，**显示推荐选项**：

```
header: "部署环境"
question: "选择部署目标环境（AI 推荐基于项目配置）"

options:
- 本地开发 (推荐) - description: "检测到 Dockerfile，适合容器化本地开发"
- 测试环境 - description: "有 CI 配置，适合自动化测试部署"
- 生产环境 - description: "需要完整的生产配置和安全检查"
```

---

## Step 3: 确认使用的中间件（带推荐）

**AI 根据检测结果判断推荐：**

| 已有配置 | 推荐中间件 | 原因 |
|---------|-----------|------|
| Dockerfile | **Docker** | 项目已有容器化配置 |
| docker-compose.yml | **Docker Compose** | 多服务编排已配置 |
| k8s/*.yaml | **Kubernetes** | K8s 部署已配置 |
| Makefile + deploy target | **Make** | 一键部署命令已存在 |
| 仅 package.json | **npm scripts** | 最简单，无需额外工具 |
| 无任何配置 | **建议创建 Dockerfile** | 容器化是最佳实践 |

使用 AskUserQuestion 询问，**显示推荐选项**：

```
header: "部署工具"
question: "选择使用的部署工具（AI 推荐已检测到的配置）"

options:
- Docker (推荐) - description: "已检测到 Dockerfile，直接使用容器部署"
- Docker Compose - description: "检测到 docker-compose.yml，多服务编排"
- Kubernetes - description: "检测到 k8s 配置，生产级部署"
- Make - description: "检测到 Makefile，使用 make deploy"
- npm scripts - description: "使用 package.json 中的 scripts"
- 生成新配置 - description: "无部署配置，AI 自动生成 Dockerfile"
```

---

## Step 4: 执行部署命令

根据用户选择执行对应的部署命令：

| 中间件 | 命令 |
|-------|------|
| Docker | `docker build -t <name> . && docker run <name>` |
| Docker Compose | `docker-compose up -d` |
| Kubernetes | `kubectl apply -f k8s/` |
| Make | `make deploy` |
| npm | `npm run deploy` |

执行前先 **dry-run 预览**：
```bash
openmatrix deploy --deploy-method <method> --dry-run
```

用户确认后执行：
```bash
openmatrix deploy --deploy-method <method> --auto
```

---

## Step 5: 验证部署结果

执行部署后验证：
- Docker: `docker ps` 检查容器运行状态
- Kubernetes: `kubectl get pods` 检查 Pod 状态
- 本地服务: `curl localhost:<port>` 健康检查

---

## Step 6: 确认生成一键部署脚本（带推荐）

**AI 根据项目特征判断推荐：**

| 项目特征 | 推荐脚本工具 | 原因 |
|---------|-------------|------|
| 已有 Makefile | **Make** | 保持一致性，添加新 target |
| Go/复杂项目 | **Taskfile** | 更现代，跨平台支持好 |
| Node.js 项目 | **npm scripts** | 无需额外工具 |
| 多服务项目 | **Docker Compose** | 编排多个服务 |
| 无脚本工具 | **Taskfile (推荐)** | 现代化，易维护 |

使用 AskUserQuestion 询问，**显示推荐选项**：

```
header: "一键脚本"
question: "部署完成！是否生成一键部署脚本？（AI 推荐最适合的工具）"

options:
- 生成 Taskfile (推荐) - description: "现代化任务工具，跨平台，YAML 配置简洁"
- 生成 Makefile - description: "经典工具，已有 Makefile 时保持一致性"
- 使用 npm scripts - description: "Node.js 项目，无需额外依赖"
- 不生成 - description: "已有足够配置，无需额外脚本"
```

---

## Step 7: 生成一键脚本

如果用户选择生成脚本，创建对应文件：

### Taskfile.yml 格式
```yaml
version: '3'

vars:
  IMAGE_NAME: '{{.PROJECT_NAME}}'
  VERSION: '{{.TAG | default "latest"}}'

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
      - npm run test
  
  deploy-local:
    desc: 本地 Docker 部署
    cmds:
      - docker build -t {{.IMAGE_NAME}}:{{.VERSION}} .
      - docker run -d -p 3000:3000 {{.IMAGE_NAME}}:{{.VERSION}}
  
  deploy-prod:
    desc: 生产部署
    cmds:
      - docker build -t {{.IMAGE_NAME}}:{{.VERSION}} .
      - docker push {{.REGISTRY}}/{{.IMAGE_NAME}}:{{.VERSION}}
```

### Makefile 格式
```makefile
.PHONY: setup build test deploy deploy-local deploy-prod

IMAGE_NAME = app
VERSION = latest

setup:
	npm install

build:
	npm run build

test:
	npm run test

deploy-local:
	docker build -t $(IMAGE_NAME):$(VERSION) .
	docker run -d -p 3000:3000 $(IMAGE_NAME):$(VERSION)

deploy-prod:
	docker build -t $(IMAGE_NAME):$(VERSION) .
	docker push registry/$(IMAGE_NAME):$(VERSION)
```

---

## Step 8: 最终总结

输出部署总结：
```markdown
## ✅ 部署完成

**环境**: 本地开发/测试/生产
**工具**: Docker/Make/Taskfile
**脚本**: 已生成 Taskfile.yml

### 一键命令
- `task deploy-local` - 本地部署
- `task deploy-prod` - 生产部署
- `task setup build test` - 完整流程

### 验证状态
- ✅ 容器运行正常
- ✅ 健康检查通过
- ✅ 端口映射正确
```

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:deploy              # 智能部署 → 交互问答（带推荐） → 执行 → 生成脚本
/om:deploy local        # 直接指定本地开发环境
/om:deploy prod docker  # 直接指定生产 + Docker
</examples>

<notes>
## 智能推荐逻辑

每个交互问答都基于检测结果提供推荐：

| 步骤 | 推荐依据 |
|------|---------|
| 环境类型 | 项目配置特征（Dockerfile → 本地，CI → 测试，nginx → 生产） |
| 中间件 | 已存在的配置文件（Dockerfile → Docker，Makefile → Make） |
| 脚本工具 | 项目类型和已有工具（Go → Taskfile，Node → npm，已有 Make → Make） |

## 执行流程

```
/om:deploy
    │
    ├── 1. 检测环境 ──→ 获取完整项目信息
    │
    ├── 2. 问环境类型 ──→ 显示推荐（如：本地开发 ✓ 检测到 Dockerfile）
    │
    ├── 3. 问中间件 ──→ 显示推荐（如：Docker ✓ 已有 Dockerfile）
    │
    ├── 4. 执行部署 ──→ dry-run 预览 → 确认 → 执行
    │
    ├── 5. 验证结果 ──→ 检查容器/服务状态
    │
    ├── 6. 问生成脚本 ──→ 显示推荐（如：Taskfile ✓ 现代化工具）
    │
    ├── 7. 生成脚本 ──→ 创建 Taskfile.yml 或 Makefile
    │
    └── 8. 输出总结 ──→ 一键命令 + 验证状态
```

## 支持的中间件

| 中间件 | 检测文件 | 命令 |
|-------|---------|------|
| Docker | Dockerfile | `docker build/run` |
| Docker Compose | docker-compose.yml | `docker-compose up` |
| Kubernetes | k8s/*.yaml | `kubectl apply` |
| Helm | helm/Chart.yaml | `helm install` |
| Make | Makefile | `make deploy` |
| Taskfile | Taskfile.yml | `task deploy` |
| npm | package.json | `npm run deploy` |

## 脚本工具对比

| 工具 | 优点 | 适用场景 |
|------|------|---------|
| Taskfile | 跨平台、YAML 简洁、变量支持 | Go/Rust/现代项目 |
| Makefile | 经典、广泛支持 | C/C++/已有 Makefile 项目 |
| npm scripts | 无需额外依赖 | Node.js 项目 |
| Docker Compose | 多服务编排 | 微服务项目 |
</notes>