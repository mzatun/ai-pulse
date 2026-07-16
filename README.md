# AI Pulse

> **AI Agent · FDE · OPC — 证据驱动的 AI 行业动态监控**

用可追溯的一手证据，连接 AI 行业的变化、趋势与行动。

## 聚焦领域

| 领域 | 说明 |
|------|------|
| **AI Agent** | 智能体、工具调用、多智能体协作、Agent 框架与平台 |
| **FDE** | 前端部署工程师 — AI 驱动的前端开发、部署自动化、vibe coding |
| **OPC** | 一人公司 — AI 时代的个人创业、自动化工作流、独立开发者经济 |

## 特性

- 📊 多来源数据采集 (RSS / Atom / GitHub API)
- 🌍 国内外来源覆盖（少数派、36氪 等国内源 + 海外一手源）
- 🔁 **源可靠性兜底**：主地址失效自动回退 RSSHub / 镜像 / Google News（`sources.mjs` 的 `fallbacks`）
- 🛡️ **双层解析**：rss-parser 标准解析 + cheerio 宽松兜底，兼容不规范 feed（裸 `&`、属性无值等）
- ⏱️ **安全抓取**：3MB 上限 / 超时重试退避 / SSRF 防护（不再因截断返回损坏数据）
- 🔑 **GitHub Token 支持**（限流 60 → 5000 次/小时）
- 🩺 **源健康体检**：`npm run health` 一键定位失效 / 截断 / 解析失败源
- 🎨 静态站点（SSG），GitHub Pages 部署，暗色主题

**在线预览**：https://mzatun.github.io/ai-pulse/

## 快速开始

```bash
# 安装依赖
npm install

# 采集数据
npm run collect

# 构建站点
npm run build

# 源健康体检（不落库，仅诊断）
npm run health

# 本地预览
npm run dev
# → http://localhost:3000
```

## 配置

### 环境变量（`.env`）

复制 `.env.example` 为 `.env` 并填入（`.env` 已被 `.gitignore` 忽略，不会入库）：

```bash
cp .env.example .env
```

| 变量 | 说明 |
|------|------|
| `GITHUB_TOKEN` | 可选但推荐。提升 GitHub API 限流 60 → 5000 次/小时。生成：GitHub → Settings → Tokens（默认 public 只读权限即可） |
| `AGNES_API_KEY` 等 | 阶段二（智能化）预留，当前未启用 |

### 源兜底机制

`src/sources.mjs` 中每个源可配置 `fallbacks: [...urls]`。主地址 fetch 或解析失败时，会依次尝试备用地址，任一成功即用。适用于：

- 官方 RSS 改版失效（如 Anthropic 官方无 RSS → 回退 Google News 聚合）
- 墙外源受限（海外 runner 直连；若走国内，可改用 RSSHub 镜像兜底）
- feed 地址漂移（如 LangChain `/rss/` 返回整站 HTML → 回退 `/feed/` Atom 与聚合源）

## 部署

- 推送到 `github.com/mzatun/ai-pulse`，GitHub Settings → Pages → Source 选 "GitHub Actions"。
- 推荐在**海外 runner** 运行（墙外一手源直连无障碍）。
- 国内环境运行：fallback 中已预置 RSSHub / 镜像 / Google News 兜底，墙外主源失败会自动切换。

## 项目结构

```
ai-pulse/
├── src/
│   ├── sources.mjs          # 数据源配置（含 fallbacks / maxItems）
│   ├── collect.mjs          # 主采集脚本（去重/评分/健康报告）
│   ├── build.mjs            # 静态站点生成（SSG）
│   ├── serve.mjs            # 本地开发服务器
│   ├── healthcheck.mjs      # 源健康体检（npm run health）
│   ├── collectors/
│   │   ├── rss.mjs          # RSS/Atom 采集器（支持 fallback）
│   │   └── github.mjs       # GitHub API 采集器（支持 fallback + token）
│   └── lib/
│       ├── fetch.mjs        # 安全 HTTP 抓取（3MB 上限/超时重试/SSRF）
│       ├── parseRss.mjs     # 双层解析（rss-parser + cheerio 兜底）
│       └── cluster.mjs      # 去重/聚类/评分
├── web/assets/              # 样式与前端交互
├── data/                    # 采集数据（git-ignored）
├── dist/                    # 构建输出（git-ignored）
└── .github/workflows/       # 部署 / 每日刷新
```

## 数据源（当前 16 个）

**Tier 1（一手）**：OpenAI、Anthropic（兜底 Google News/RSSHub）、Google AI、Hugging Face（兜底 RSSHub）、GitHub Trending、arXiv cs.AI、LangChain（兜底 `/feed/`/Google News/RSSHub）、Cloudflare

**Tier 2（专业/社区/国内）**：Hacker News、Product Hunt、Dev.to、少数派、36氪、Jina（兜底 量子位）、GitHub Agent Releases、GitHub FDE Tools

## 采集管线

```
RSS/API → 安全抓取(3MB/超时重试) → 双层解析(rss-parser + cheerio)
        → 每源限流降噪 → 去重 → 评分 → 静态快照
```

## 升级路线

| 阶段 | 方向 | 状态 |
|------|------|------|
| **A 数据可靠性** | 修复截断 Bug、fallback 兜底、解析兜底、GitHub token、健康体检 | ✅ 已完成 |
| B 智能化 | 接国内大模型做摘要/语义去重/主题聚类/情感热度/每日速报 | 📋 规划中 |
| C 产品化 | 搜索/筛选/分页、真聚类、RSS 输出、日报推送、修死按钮 | 📋 规划中 |
| D 工程化 | 配置数据一致性、健康看板告警、测试、可选轻量后端 | 📋 规划中 |

## License

MIT
