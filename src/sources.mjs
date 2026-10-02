/**
 * 数据源配置
 * 分层: Tier1(官方/一手) > Tier2(专业媒体) > Tier3(社区/传播)
 * 主题: AI Agent, FDE(前端部署工程师), OPC(一人公司), 创业创新(venture)
 */

// Google News RSS 构造器：按关键词聚合某人物 / 主题的公开报道
// 注意：Google News 在海外 runner 直连可用；国内网络需代理，采集失败会自动跳过
const gnSearch = (q, { hl = 'zh-CN', gl = 'CN', ceid = 'CN:zh-Hans' } = {}) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=${hl}&gl=${gl}&ceid=${ceid}`;

// AI 相关性过滤（titleFilter）：用于综合媒体源降噪
// 这些源的泛科技 / 商业流会混入股票、消费、宏观等与 AI 无关的条目
const AI_FILTER_CN = /\bAI\b|人工智能|大模型|大语言模型|语言模型|生成式|多模态|智能体|机器学习|深度学习|神经网络|算力|智算|具身|机器人|自动驾驶|智能驾驶|智能化|GPT|ChatGPT|DeepSeek|Kimi|豆包|文心|通义|OpenAI|Anthropic|Gemini|Claude|Copilot|英伟达|NVIDIA|GPU|月之暗面|智谱|百川|MiniMax|商汤|旷视|科大讯飞|讯飞|零一万物|阶跃星辰|面壁|智元|宇树|AIGC/i;
const AI_FILTER_EN = /\bAI\b|artificial intelligence|machine learning|deep learning|\bLLM|language model|generative|ChatGPT|GPT|OpenAI|Anthropic|Gemini|Claude|Copilot|agentic|chatbot|robotic|\brobot|autonomous|Nvidia|foundation model|neural|inference/i;

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
    url: 'https://www.36kr.com/feed',
    type: 'rss', tier: 2,
    tags: ['ai-agent', 'opc', 'startup', 'venture'], region: 'cn',
    // 裸域名 36kr.com/feed 已改为返回反爬 HTML，保留作备用；主用 www 版有效 RSS
    fallbacks: ['https://36kr.com/feed'],
    titleFilter: AI_FILTER_CN,
  },
  {
    id: 'jina-blog',
    name: 'Jina AI Blog',
    url: 'https://jina.ai/blog/feed.xml',
    type: 'rss', tier: 2,
    tags: ['ai-agent', 'embedding'], region: 'global',
    // 主地址不稳定时回退 Google News 聚合（勿回退量子位：其已是独立源，会造成标签错乱）
    fallbacks: [gnSearch('Jina AI', { hl: 'en-US', gl: 'US', ceid: 'US:en' })],
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

  // ── Tier 2: AI 创业创新赛道（venture）──────────────
  // ① 人物追踪：8 位持续活跃于 AI 创业 / 创新一线的标志性人物
  //    通过 Google News 关键词聚合其公开报道（group: people 用于板块页「人物雷达」分区）
  {
    id: 'gn-fusheng',
    name: '傅盛',
    url: gnSearch('傅盛'),
    type: 'rss', tier: 2, tags: ['venture', 'people'], region: 'cn', maxItems: 12,
    group: 'people', note: '猎豹移动创始人 · 猎户星空',
  },
  {
    id: 'gn-luqi',
    name: '陆奇',
    url: gnSearch('陆奇 OR 奇绩创坛'),
    type: 'rss', tier: 2, tags: ['venture', 'people'], region: 'cn', maxItems: 12,
    group: 'people', note: '奇绩创坛创始人（原 YC 中国）',
  },
  {
    id: 'gn-kaifulee',
    name: '李开复',
    url: gnSearch('李开复 OR 创新工场'),
    type: 'rss', tier: 2, tags: ['venture', 'people'], region: 'cn', maxItems: 12,
    group: 'people', note: '创新工场董事长 · 零一万物',
  },
  {
    id: 'gn-andrewng',
    name: '吴恩达',
    url: gnSearch('吴恩达 OR "Andrew Ng"'),
    type: 'rss', tier: 2, tags: ['venture', 'people'], region: 'cn', maxItems: 12,
    group: 'people', note: 'Landing AI / DeepLearning.AI 创始人',
  },
  {
    id: 'gn-wujun',
    name: '吴军',
    url: gnSearch('吴军 人工智能'),
    type: 'rss', tier: 2, tags: ['venture', 'people'], region: 'cn', maxItems: 12,
    group: 'people', note: '《浪潮之巅》《智能时代》作者',
  },
  {
    id: 'gn-linchao',
    name: '所长林超',
    url: gnSearch('所长林超'),
    type: 'rss', tier: 2, tags: ['venture', 'people'], region: 'cn', maxItems: 12,
    group: 'people', note: '科技商业内容创作者',
  },
  {
    id: 'gn-wangyuquan',
    name: '王煜全',
    url: gnSearch('王煜全'),
    type: 'rss', tier: 2, tags: ['venture', 'people'], region: 'cn', maxItems: 12,
    group: 'people', note: '海银资本创始合伙人 · 全球科技前哨',
  },
  {
    id: 'gn-zhouhongyi',
    name: '周鸿祎',
    url: gnSearch('周鸿祎'),
    type: 'rss', tier: 2, tags: ['venture', 'people'], region: 'cn', maxItems: 12,
    group: 'people', note: '360 集团创始人',
  },

  // ② 政府与地方基金：各地对 AI 创新的产业基金 / 引导基金投入
  {
    id: 'gn-ai-fund',
    name: '地方AI产业基金',
    url: gnSearch('人工智能产业基金'),
    type: 'rss', tier: 2, tags: ['venture', 'policy'], region: 'cn', maxItems: 12,
    group: 'policy',
  },
  {
    id: 'gn-ai-govfund',
    name: 'AI 政府引导基金',
    url: gnSearch('政府引导基金 人工智能'),
    type: 'rss', tier: 2, tags: ['venture', 'policy'], region: 'cn', maxItems: 12,
    group: 'policy',
  },

  // ③ 国内创业创新媒体
  {
    id: 'qbitai',
    name: '量子位',
    url: 'https://www.qbitai.com/feed',
    type: 'rss', tier: 2, tags: ['venture', 'startup'], region: 'cn', maxItems: 20,
  },
  {
    id: 'leiphone',
    name: '雷峰网',
    url: 'https://www.leiphone.com/feed',
    type: 'rss', tier: 2, tags: ['venture', 'startup'], region: 'cn', maxItems: 20,
  },
  {
    id: 'geekpark',
    name: '极客公园',
    url: 'https://www.geekpark.net/rss',
    type: 'rss', tier: 2, tags: ['venture', 'startup'], region: 'cn', maxItems: 20,
  },
  {
    id: 'tmtpost',
    name: '钛媒体',
    url: 'https://www.tmtpost.com/feed',
    type: 'rss', tier: 2, tags: ['venture', 'startup'], region: 'cn', maxItems: 20,
    titleFilter: AI_FILTER_CN,
  },

  // ④ 国际创投媒体
  {
    id: 'techcrunch-venture',
    name: 'TechCrunch Venture',
    url: 'https://techcrunch.com/category/venture/feed/',
    type: 'rss', tier: 2, tags: ['venture', 'funding'], region: 'global', maxItems: 20,
    titleFilter: AI_FILTER_EN,
  },
  {
    id: 'crunchbase-news',
    name: 'Crunchbase News',
    url: 'https://news.crunchbase.com/feed/',
    type: 'rss', tier: 2, tags: ['venture', 'funding'], region: 'global', maxItems: 15,
    // 部分网络不可达时回退 Google News 聚合
    fallbacks: [gnSearch('crunchbase funding', { hl: 'en-US', gl: 'US', ceid: 'US:en' })],
    titleFilter: AI_FILTER_EN,
  },
  {
    id: 'yc-blog',
    name: 'Y Combinator Blog',
    url: 'https://www.ycombinator.com/blog/rss.xml',
    type: 'rss', tier: 2, tags: ['venture', 'yc'], region: 'global', maxItems: 10,
    titleFilter: AI_FILTER_EN,
  },
  {
    id: 'sequoia',
    name: 'Sequoia Stories',
    url: 'https://www.sequoiacap.com/feed/',
    type: 'rss', tier: 2, tags: ['venture', 'funding'], region: 'global', maxItems: 15,
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
  'venture': {
    id: 'venture',
    name: 'Venture',
    label: 'AI 创业创新',
    kicker: 'VENTURE',
    description: '前沿人物动向、地方基金投向与全球资本选择共同决定下一个窗口——AI 创业从技术竞赛转入「场景 × 分发 × 资本」的综合较量。',
    judgmentChange: '创业门槛从「技术壁垒」转向「场景理解 + 分发效率」；地方资本从补贴算力转向投早、投小、投硬科技。',
    nextSignal: '关注头部人物的新动作、地方 AI 基金的实际出手项目，以及 AI 原生公司披露的收入与融资节奏。',
    color: '#eab308',
    icon: '🌱',
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
  { tag: 'venture', label: '创业创新', count: 0 },
  { tag: 'people', label: '人物', count: 0 },
  { tag: 'policy', label: '政策基金', count: 0 },
  { tag: 'funding', label: '投融资', count: 0 },
];
