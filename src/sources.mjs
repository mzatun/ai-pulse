/**
 * 数据源配置
 * 分层: Tier1(官方/一手) > Tier2(专业媒体) > Tier3(社区/传播)
 * 主题: AI Agent, FDE(前端部署工程师), OPC(一人公司)
 */

export const SOURCES = [
  // ── Tier 1: 官方一手来源 ──────────────────────────
  {
    id: 'openai-blog',
    name: 'OpenAI Blog',
    url: 'https://openai.com/blog/rss.xml',
    type: 'rss', tier: 1,
    tags: ['ai-agent', 'llm'], region: 'global',
  },
  {
    id: 'anthropic-news',
    name: 'Anthropic News',
    url: 'https://www.anthropic.com/news/rss.xml',
    type: 'rss', tier: 1,
    tags: ['ai-agent', 'safety'], region: 'global',
    // 官方无 RSS(404)，回退 RSSHub / Google News 聚合
    fallbacks: [
      'https://rsshub.app/anthropic/news',
      'https://news.google.com/rss/search?q=anthropic&hl=en-US&gl=US&ceid=US:en',
    ],
  },
  {
    id: 'google-ai-blog',
    name: 'Google AI Blog',
    url: 'https://blog.google/technology/ai/rss/',
    type: 'rss', tier: 1,
    tags: ['ai-agent', 'llm'], region: 'global',
  },
  {
    id: 'huggingface-blog',
    name: 'Hugging Face Blog',
    url: 'https://huggingface.co/blog/feed.xml',
    type: 'rss', tier: 1,
    tags: ['open-source', 'llm', 'ai-agent'], region: 'global',
    // 主地址偶发不稳定时回退 RSSHub
    fallbacks: ['https://rsshub.app/huggingface/blog'],
  },
  {
    id: 'github-trending',
    name: 'GitHub Trending',
    url: 'https://api.github.com/search/repositories?q=ai+agent+created:>2025-01-01&sort=stars&per_page=20',
    type: 'github-api', tier: 1,
    tags: ['ai-agent', 'fde', 'opc'], region: 'global',
  },
  {
    id: 'arxiv-csai',
    name: 'arXiv cs.AI',
    url: 'https://rss.arxiv.org/rss/cs.AI',
    type: 'rss', tier: 1,
    tags: ['research', 'ai-agent'], region: 'global',
  },
  {
    id: 'langchain-blog',
    name: 'LangChain Blog',
    url: 'https://blog.langchain.dev/feed/',
    type: 'rss', tier: 1,
    tags: ['ai-agent', 'framework'], region: 'global',
    // /rss/ 已失效（返回整站 HTML），回退 Atom /feed/ 与聚合源
    fallbacks: [
      'https://news.google.com/rss/search?q=langchain&hl=en-US&gl=US&ceid=US:en',
      'https://rsshub.app/langchain/blog',
    ],
  },
  {
    id: 'cloudflare-blog',
    name: 'Cloudflare Blog',
    url: 'https://blog.cloudflare.com/rss/',
    type: 'rss', tier: 1,
    tags: ['fde', 'edge', 'deployment'], region: 'global',
  },

  // ── Tier 2: 专业媒体 + 国内来源 ────────────────────
  {
    id: 'hacker-news',
    name: 'Hacker News',
    url: 'https://hnrss.org/newest?q=AI+agent+OR+FDE+OR+solo+founder&count=20',
    type: 'rss', tier: 2,
    tags: ['ai-agent', 'fde', 'opc'], region: 'global',
  },
  {
    id: 'producthunt',
    name: 'Product Hunt',
    url: 'https://www.producthunt.com/feed',
    type: 'rss', tier: 2,
    tags: ['opc', 'ai-agent', 'product'], region: 'global',
  },
  {
    id: 'devto-ai',
    name: 'Dev.to AI',
    url: 'https://dev.to/feed/tag/aiagent',
    type: 'rss', tier: 2,
    tags: ['ai-agent', 'fde'], region: 'global',
  },
  {
    id: 'sspai-ai',
    name: '少数派 AI',
    url: 'https://sspai.com/feed',
    type: 'rss', tier: 2,
    tags: ['opc', 'ai-agent', 'productivity'], region: 'cn',
  },
  {
    id: '36kr-ai',
    name: '36氪 AI',
    url: 'https://36kr.com/feed',
    type: 'rss', tier: 2,
    tags: ['ai-agent', 'opc', 'startup'], region: 'cn',
  },
  {
    id: 'jina-blog',
    name: 'Jina AI Blog',
    url: 'https://jina.ai/blog/feed.xml',
    type: 'rss', tier: 2,
    tags: ['ai-agent', 'embedding'], region: 'global',
    // 主地址不稳定时回退中文 AI 源（国内可达）
    fallbacks: ['https://www.qbitai.com/feed'],
  },
  {
    id: 'github-releases-agent',
    name: 'GitHub: Agent Releases',
    url: 'https://api.github.com/search/repositories?q=ai+agent+in:name+pushed:>2025-06-01&sort=updated&per_page=15',
    type: 'github-api', tier: 2,
    tags: ['ai-agent', 'open-source'], region: 'global',
  },
  {
    id: 'github-releases-fde',
    name: 'GitHub: FDE Tools',
    url: 'https://api.github.com/search/repositories?q=frontend+deploy+ai+in:name+pushed:>2025-06-01&sort=updated&per_page=15',
    type: 'github-api', tier: 2,
    tags: ['fde', 'open-source'], region: 'global',
  },
];

// 趋势主线定义
export const TRACKS = {
  'ai-agent': {
    id: 'ai-agent',
    name: 'AI Agent',
    label: 'AI Agent 与工具生态',
    kicker: 'AI AGENT',
    description: '智能体从单次调用走向多步推理、工具编排和长期记忆，正在重塑软件交互方式。',
    judgmentChange: 'Agent 的核心竞争力从模型能力转向工具连接、状态维护和可靠完成率。',
    nextSignal: '关注端到端任务完成率、错误恢复、权限隔离和人工接管成本。',
    color: '#8b5cf6',
    icon: '🤖',
  },
  'fde': {
    id: 'fde',
    name: 'FDE',
    label: '前端部署工程师',
    kicker: 'FDE',
    description: 'AI 让前端开发从手写代码转向自然语言描述 → 生成 → 部署，FDE 成为新职业形态。',
    judgmentChange: '部署自动化从 CI/CD 脚本升级为 AI 理解需求后一键生成完整应用并发布。',
    nextSignal: '观察 AI 生成前端的保真度、可维护性、部署成功率和真实用户采用。',
    color: '#06b6d4',
    icon: '🚀',
  },
  'opc': {
    id: 'opc',
    name: 'OPC',
    label: '一人公司',
    kicker: 'OPC',
    description: 'AI 工具链让一个人具备过去一个团队的生产力，独立开发者和微创业成为主流。',
    judgmentChange: '一人公司的瓶颈从技术能力转向产品判断、分发和持续运营。',
    nextSignal: '关注独立开发者收入中位数、AI 工具依赖度、产品留存和商业化路径。',
    color: '#f97316',
    icon: '👤',
  },
  'llm': {
    id: 'llm',
    name: 'LLM',
    label: '大模型进展',
    kicker: 'LLM',
    description: '基础模型在推理、多模态和上下文窗口上持续突破，推动上层应用边界。',
    judgmentChange: '模型竞争从参数规模转向推理时计算、数据效率和任务可靠性。',
    nextSignal: '关注跨基准复现、评测污染、推理成本和开放程度。',
    color: '#22c55e',
    icon: '🧠',
  },
  'open-source': {
    id: 'open-source',
    name: 'Open Source',
    label: '开源生态',
    kicker: 'OPEN SOURCE',
    description: '开源模型和工具正在降低 AI 应用门槛，社区驱动创新加速。',
    judgmentChange: '开源从模型权重分发扩展到完整工具链、评测基准和部署方案。',
    nextSignal: '关注开源模型的真实部署率、社区活跃度和商业可持续性。',
    color: '#ef4444',
    icon: '📦',
  },
};

// 热点标签
export const HOT_TAGS = [
  { tag: 'ai-agent', label: 'AI Agent', count: 0 },
  { tag: 'fde', label: 'FDE', count: 0 },
  { tag: 'opc', label: '一人公司', count: 0 },
  { tag: 'llm', label: '大模型', count: 0 },
  { tag: 'open-source', label: '开源', count: 0 },
  { tag: 'research', label: '论文', count: 0 },
  { tag: 'framework', label: '框架', count: 0 },
  { tag: 'deployment', label: '部署', count: 0 },
  { tag: 'startup', label: '创业', count: 0 },
];
