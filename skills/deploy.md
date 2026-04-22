---
name: om:deploy
description: "读取项目结构，生成部署命令和环境信息，支持用户选择部署方式（Docker、Make、npm scripts 等）并执行验证。Triggers on: deploy, 部署, 发布, 发布, docker, kubernetes, 环境搭建, 开发环境, make, task make"
---

<NO-OTHER-SKILLS>
执行此技能时，不得调用 superpowers、gsd 或其他任务编排相关的技能。OpenMatrix 独立运行，不依赖外部任务编排系统。
</NO-OTHER-SKILLS>

<objective>
自动扫描项目环境，检测构建工具、部署方式、CI配置，提供交互式部署选择和命令执行。
</objective>

<trigger-conditions>
## 何时使用

**当用户想要:**
- 查看项目部署选项
- 搭建开发环境
- 执行部署命令
- 了解项目构建工具
- 部署到 Docker/Kubernetes/npm 等

**用户输入示例:**
- `/om:deploy` - 自动扫描项目环境
- `/om:deploy docker` - 指定 Docker 部署
- `/om:deploy --show-dev` - 显示开发命令
- `/om:deploy --dry-run` - 仅预览命令不执行
</trigger-conditions>

<process>
1. **执行检测命令**

   调用 CLI 获取环境信息:
   ```bash
   openmatrix deploy --json --show-dev
   ```

   如果用户指定了部署方式，传入参数:
   ```bash
   openmatrix deploy --deploy-method docker --json
   ```

2. **解析检测结果**

   结果格式:
   ```json
   {
     "action": "deploy_info",
     "projectName": "项目名称",
     "projectType": "typescript|nodejs|python|go|rust|...",
     "projectRoot": "项目路径",
     "timestamp": "检测时间",
     "summary": {
       "hasBuildTool": true,
       "hasCIConfig": false,
       "hasDeployOption": true,
       "buildToolCount": 2,
       "deployOptionCount": 3
     },
     "deployCommands": [
       {
         "method": "docker",
         "command": "docker build -t app .",
         "configFile": "Dockerfile",
         "description": "Docker 部署",
         "dryRun": false
       }
     ],
     "deployOptions": [...],
     "devCommands": {
       "setup": ["npm install"],
       "build": ["npm run build"],
       "test": ["npm run test"],
       "dev": ["npm run dev"],
       "start": ["npm run start"]
     }
   }
   ```

3. **以文档形式展示检测结果**

   **不要使用 AskUserQuestion**，直接输出 markdown 格式的检测报告:

   ```markdown
   # 🚀 部署环境检测报告

   **项目**: [projectName]
   **类型**: [projectType]
   **检测时间**: [timestamp]

   ---

   ## 📊 环境摘要

   | 项目 | 数量/状态 |
   |------|----------|
   | 构建工具 | X 个 |
   | 部署选项 | X 个 |
   | CI 配置 | 已配置/未检测到 |

   ---

   ## 🚀 部署选项

   1. **[部署方式名称]**
      - 📝 命令: `[command]`
      - 📁 配置: `configFile`
      - 💡 说明: [description]
      - ✅ 推荐

   ...

   ---

   ## 🔧 开发命令

   **安装/设置**:
   - `npm install`

   **构建**:
   - `npm run build`

   **测试**:
   - `npm run test`

   **开发/调试**:
   - `npm run dev`

   ---

   **是否执行部署？回复序号或部署方式名称**
   ```

   如果没有检测到部署选项:
   ```
   ⚠️ 未检测到可用的部署选项

   建议添加:
   - Dockerfile (Docker 部署)
   - docker-compose.yml (Docker Compose)
   - 部署脚本 (deploy.sh)
   - Makefile (make deploy)
   ```

4. **等待用户确认**

   展示报告后，等待用户回复。用户回复部署方式名称或序号即执行下一步。

5. **执行部署命令**

   用户选择后，调用 CLI 执行:
   ```bash
   openmatrix deploy --deploy-method <method> --auto --json
   ```

   输出执行结果:
   ```json
   {
     "action": "execute_deploy",
     "method": "docker",
     "command": "docker build -t app .",
     "configFile": "Dockerfile"
   }
   ```

   然后根据命令执行实际的部署操作:
   - Docker: `docker build -t <name> . && docker run <name>`
   - Docker Compose: `docker-compose up -d`
   - Make: `make deploy`
   - npm: `npm run deploy`

6. **验证部署结果**

   执行部署后，验证:
   - Docker: `docker ps` 检查容器状态
   - Kubernetes: `kubectl get pods` 检查 Pod 状态
   - npm: 检查发布状态

</process>

<arguments>
$ARGUMENTS
</arguments>

<examples>
/om:deploy                    # 自动扫描 → 展示报告 → 用户选择 → 执行部署
/om:deploy docker             # 指定 Docker 部署方式
/om:deploy --dry-run          # 仅预览命令，不执行
/om:deploy --show-dev         # 显示开发环境命令
/om:deploy kubernetes --auto  # 自动执行 Kubernetes 部署
</examples>

<notes>
## 执行流程图

```
/om:deploy
    │
    ├── 1. 检测环境 ──→ 生成部署选项列表
    │
    ├── 2. 展示报告 ──→ 输出 Markdown 格式的检测报告
    │                   (不使用交互式对话框)
    │
    ├── 3. 等待选择 ──→ 用户回复部署方式名称或序号
    │
    ├── 4. 执行部署 ──→ 调用 CLI 执行部署命令
    │
    └── 5. 验证结果 ──→ 检查部署状态
                            │
                            ├── 容器/Pod 状态检查
                            ├── 日志检查
                            └── 完成确认 ✅
```

## 支持的部署方式

| 方式 | 说明 | 检测文件 |
|------|------|---------|
| Docker | Docker 容器部署 | Dockerfile |
| Docker Compose | 多容器编排 | docker-compose.yml |
| Kubernetes | K8s 部署 | k8s/*.yaml |
| Helm | Helm Chart | helm/Chart.yaml |
| npm | npm 发布 | package.json (deploy script) |
| Make | Makefile 部署 | Makefile (deploy target) |
| GitHub Pages | 静态站点 | .github/workflows/*.yml |
| Vercel | Vercel 部署 | vercel.json |
| Netlify | Netlify 部署 | netlify.toml |

## CLI 命令选项

| 选项 | 说明 |
|------|------|
| `--json` | JSON 格式输出 |
| `--deploy-method <method>` | 指定部署方式 |
| `--dry-run` | 仅预览命令 |
| `--interactive` | 交互式选择 |
| `--auto` | 自动执行 |
| `--show-dev` | 显示开发命令 |

## 为什么不用交互式对话框？

交互式对话框（AskUserQuestion）会遮挡检测报告，用户无法完整查看部署选项详情。

改为直接输出 Markdown 报告，用户可以:
1. 完整查看所有部署选项
2. 仔细阅读每个选项的命令和配置
3. 自由决定是否执行部署
4. 简单回复序号或名称即可开始执行
</notes>