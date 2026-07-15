/**
 * 静态站点生成器 — 完整版
 * 生成: index, lines/, timeline/, signals/, scout/, events/
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { TRACKS, HOT_TAGS } from './sources.mjs';

const DATA_DIR = join(import.meta.dirname, '..', 'data');
const DIST_DIR = join(import.meta.dirname, '..', 'dist');
const WEB_DIR = join(import.meta.dirname, '..', 'web');

// GitHub Pages 项目站点部署在 /ai-pulse/ 子路径下；
// 本地开发默认 './'，CI 中通过 BASE_PATH 环境变量注入 '/ai-pulse/'
const BASE_PATH = (process.env.BASE_PATH || './').replace(/\/$/, '') + '/';
const CACHE_BUST = '?v=2'; // 强制浏览器刷新旧缓存

function loadSnapshot() {
  try {
    return JSON.parse(readFileSync(join(DATA_DIR, 'snapshot.json'), 'utf-8'));
  } catch {
    console.error('No snapshot.json found. Run: npm run collect');
    process.exit(1);
  }
}

function getSignalsByTrack(snapshot, trackId) {
  return snapshot.signals.filter(s => s.tags.includes(trackId))
    .sort((a, b) => b.score - a.score);
}

function parseDate(iso) {
  if (!iso) return new Date(NaN);
  // 支持 ISO 8601 / RSS (RFC 822) / GMT / 纯日期字符串
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date(NaN) : d;
}

function formatDate(iso) {
  const d = parseDate(iso);
  if (Number.isNaN(d.getTime())) return '日期未知';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function dateKey(iso) {
  const d = parseDate(iso);
  if (Number.isNaN(d.getTime())) return '未知';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function relTime(iso) {
  const diff = Date.now() - parseDate(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return '刚刚';
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  if (d < 30) return `${Math.floor(d / 7)} 周前`;
  return formatDate(iso);
}

function tierBadge(tier) {
  const m = { 1: ['一手', '#22c55e'], 2: ['专业', '#0891b2'], 3: ['社区', '#ea580c'] };
  const [label, color] = m[tier] || ['其他', '#888'];
  return `<span class="tier-badge" style="--tier-color:${color}">${label}</span>`;
}

function regionBadge(region) {
  return region === 'cn'
    ? '<span class="region-badge region-cn">国内</span>'
    : '<span class="region-badge region-global">全球</span>';
}

function e(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getDepth(activePage) {
  if (activePage === '/') return 0;
  return activePage.split('/').filter(Boolean).length;
}

function relHref(href, depth) {
  if (href === '/') {
    return depth === 0 ? './' : '../'.repeat(depth);
  }
  const parts = href.split('/').filter(Boolean);
  const prefix = '../'.repeat(depth);
  return prefix + parts.join('/') + '/';
}

// ══════════════════════════════════════════
// SVG Icons
// ══════════════════════════════════════════
const ICONS = {
  arrow: `<svg class="icon" aria-hidden="true" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sun: `<svg class="icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`,
  github: `<svg class="icon" viewBox="0 0 16 16"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`,
  star: `⭐`,
  signal: `<svg class="icon" viewBox="0 0 16 16"><path d="M2 8h4l2-6 2 12 2-6h4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  route: `<svg class="icon" viewBox="0 0 16 16"><circle cx="3" cy="3" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="13" cy="13" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 3h6a2 2 0 012 2v6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`,
  clock: `<svg class="icon" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 4v4l3 2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  sparkles: `<svg class="icon" viewBox="0 0 16 16"><path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5z" fill="currentColor"/></svg>`,
};

// ══════════════════════════════════════════
// Layout: Topbar
// ══════════════════════════════════════════
function topbar(activePage, depth = 0) {
  const pages = [
    ['/', '关键变化'],
    ['/lines/', '趋势判断'],
    ['/timeline/', '事件脉络'],
    ['/signals/', '来源动态'],
    ['/scout/', '行动参考'],
  ];
  const navLinks = pages.map(([href, label]) =>
    `<a href="${relHref(href, depth)}" ${activePage === href ? 'class="active"' : ''}>${label}</a>`
  ).join('');

  return `
  <header class="topbar">
    <a class="brand" href="${relHref('/', depth)}">
      <span class="brand-icon"><i></i><i></i><i></i></span>
      <span class="brand-text"><strong>AI PULSE</strong><small>AI 行业动态监控</small></span>
    </a>
    <nav class="main-nav">${navLinks}</nav>
    <div class="top-actions">
      <button class="icon-btn" id="theme-toggle" aria-label="切换主题">${ICONS.sun}</button>
      <a class="github-link" href="https://github.com/mzatun/ai-pulse" target="_blank" rel="noopener">
        ${ICONS.github} <span>Star</span>
        <span class="star-count" id="star-count">0</span>
      </a>
    </div>
  </header>`;
}

// ══════════════════════════════════════════
// Layout: Footer
// ══════════════════════════════════════════
function footer(snapshot, depth = 0) {
  return `
  <footer class="site-footer">
    <div class="shell footer-grid">
      <div class="footer-brand">
        <strong>AI PULSE</strong>
        <p>用证据看清 AI 行业变化</p>
        <nav class="footer-subscriptions">
          <a href="https://github.com/mzatun/ai-pulse/subscription" target="_blank">Watch</a>
          <a href="https://github.com/mzatun/ai-pulse/issues" target="_blank">Issues</a>
        </nav>
      </div>
      <div class="footer-links">
        <nav>
          <a href="${relHref('/lines/', depth)}">主线</a>
          <a href="${relHref('/timeline/', depth)}">事件脉络</a>
          <a href="${relHref('/signals/', depth)}">来源动态</a>
          <a href="${relHref('/scout/', depth)}">行动参考</a>
        </nav>
      </div>
    </div>
    <div class="shell footer-meta">
      <p>一手来源优先 · 事实与判断分离 · 证据可追溯<br>快照 ${snapshot.generatedAt ? formatDate(snapshot.generatedAt) : '未知'}</p>
      <span>OPEN SOURCE · STATIC BY DEFAULT</span>
    </div>
  </footer>`;
}

// ══════════════════════════════════════════
// Signal Field SVG (首页动画)
// ══════════════════════════════════════════
function signalField() {
  return `
  <div class="signal-field" aria-hidden="true">
    <svg viewBox="0 0 600 300">
      <path class="signal-link" d="M60 220 C100 180 140 200 200 150 S300 100 360 130 S440 150 520 80"/>
      <path class="signal-link" d="M80 100 C120 140 170 110 230 130 S340 190 420 200 S500 160 560 180"/>
      <circle class="signal-pulse" cx="360" cy="130" r="10"/>
      <circle class="signal-pulse signal-pulse-delay" cx="200" cy="150" r="10"/>
      <circle class="signal-node" cx="60" cy="220" r="4"/>
      <circle class="signal-node" cx="80" cy="100" r="3"/>
      <circle class="signal-node" cx="200" cy="150" r="5"/>
      <circle class="signal-node" cx="230" cy="130" r="3"/>
      <circle class="signal-node" cx="360" cy="130" r="5"/>
      <circle class="signal-node" cx="420" cy="200" r="3"/>
      <circle class="signal-node" cx="520" cy="80" r="4"/>
    </svg>
  </div>`;
}

// ══════════════════════════════════════════
// HTML Shell
// ══════════════════════════════════════════
function shell(title, description, activePage, body) {
  const depth = getDepth(activePage);
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${e(description)}">
  <title>${e(title)}</title>
  <link rel="stylesheet" href="${BASE_PATH}assets/style.css${CACHE_BUST}">
  <link rel="icon" href="${BASE_PATH}assets/favicon.svg${CACHE_BUST}" type="image/svg+xml">
</head>
<body>
  ${topbar(activePage, depth)}
  <main>${body}</main>
  ${footer({ generatedAt: new Date().toISOString() }, depth)}
  <script src="${BASE_PATH}assets/app.js${CACHE_BUST}"></script>
</body>
</html>`;
}

// ══════════════════════════════════════════
// Page: 首页 (关键变化)
// ══════════════════════════════════════════
function dailyBriefSection(snapshot) {
  const brief = snapshot.dailyBrief;
  if (!brief) return '';
  return `
    <section class="section daily-brief">
      <div class="shell">
        <header class="section-head">
          <span class="kicker">AI · 每日速报</span>
          <h2>今日 AI 要点</h2>
        </header>
        <div class="brief-card">
          <span class="brief-icon">${ICONS.sparkles}</span>
          <p>${e(brief)}</p>
        </div>
      </div>
    </section>`;
}

function pageHome(snapshot) {
  const trackEntries = Object.entries(TRACKS);
  const recentSignals = snapshot.signals
    .sort((a, b) => parseDate(b.publishedAt).getTime() - parseDate(a.publishedAt).getTime())
    .slice(0, 12);

  // 统计
  const stats = {
    events: snapshot.totalDeduped,
    signals: snapshot.signals.reduce((n, s) => n + 1 + (s.alternativeSources?.length || 0), 0),
    sources: new Set(snapshot.signals.map(s => s.sourceId)).size,
  };

  const body = `
    <section class="hero shell">
      ${signalField()}
      <div class="hero-content">
        <span class="kicker">AI INDUSTRY INTELLIGENCE</span>
        <h1>看清 AI 行业的关键变化</h1>
        <p>AI Agent · FDE · OPC — 用可追溯的一手证据，连接变化、趋势与下一步行动。</p>
      </div>
      <div class="hero-stats">
        <div class="stat"><strong>${stats.events}</strong><span>独立信号</span></div>
        <div class="stat"><strong>${trackEntries.length}</strong><span>趋势主线</span></div>
        <div class="stat"><strong>${stats.sources}</strong><span>数据来源</span></div>
      </div>
    </section>

    ${dailyBriefSection(snapshot)}

    <section class="section shell">
      <header class="section-head">
        <span class="kicker">01 / KEY THEMES</span>
        <h2>趋势判断</h2>
      </header>
      <div class="track-tabs" id="track-tabs">
        ${trackEntries.map(([key, t], i) => `
          <button class="track-tab ${i === 0 ? 'active' : ''}" data-track="${key}" style="--track-color:${t.color}">
            <span class="track-tab-num">${i + 1}</span>${t.label}
          </button>`).join('')}
      </div>
      <div id="track-content">
        ${trackEntries.map(([key, t], i) => {
          const sigs = getSignalsByTrack(snapshot, key);
          const top3 = sigs.slice(0, 3);
          return `
          <div class="track-panel ${i === 0 ? '' : 'hidden'}" data-track-panel="${key}">
            <article class="trend-card reveal" style="--track-color:${t.color}">
              <div class="trend-header">
                <div>
                  <span class="trend-tag">${t.kicker}</span>
                  <a class="trend-link" href="./lines/${key}/">
                    ${t.label} ${ICONS.arrow}
                  </a>
                </div>
                <button class="randomize-btn" data-randomize="${key}" type="button">↻ 换一个</button>
              </div>
              <div class="trend-body">
                <section class="trend-judgment">
                  <span class="trend-judgment-label">当前判断</span>
                  <h2>${e(t.description)}</h2>
                  <div class="trend-dimensions">
                    <div class="trend-dim">
                      <label>判断变化</label>
                      <p>${e(t.judgmentChange)}</p>
                    </div>
                    <div class="trend-dim">
                      <label>下一信号</label>
                      <p>${e(t.nextSignal)}</p>
                    </div>
                  </div>
                </section>
                <aside class="trend-evidence">
                  <div class="trend-evidence-header">
                    <div>
                      <span>最新证据</span>
                      <strong>${sigs.length} 个支撑信号</strong>
                    </div>
                    <a href="./timeline/?track=${key}">全部证据</a>
                  </div>
                  <div class="evidence-list">
                    ${top3.map(s => `
                    <a class="evidence-item" href="${s.url}" target="_blank" rel="noopener">
                      <time>${formatDate(s.publishedAt)}</time>
                      <strong>${e(s.title.slice(0, 80))}</strong>
                      <small>${s.sourceName} · ${s.tier === 1 ? '一手' : s.tier === 2 ? '专业' : '社区'}</small>
                    </a>`).join('')}
                    ${top3.length === 0 ? '<p style="font-size:0.8rem;color:var(--text-4)">暂无信号</p>' : ''}
                  </div>
                </aside>
              </div>
              <div class="trend-footer">
                <div class="trend-stats">
                  <span>公开信号 <strong>${sigs.length}</strong></span>
                  <span>一手来源 <strong>${sigs.filter(s => s.tier === 1).length}</strong></span>
                </div>
                <a class="btn-primary" href="./lines/${key}/">查看趋势判断 ${ICONS.arrow}</a>
              </div>
            </article>
          </div>`;
        }).join('')}
      </div>
    </section>

    <section class="section section-tint">
      <div class="shell">
        <header class="section-head">
          <span class="kicker">02 / LATEST SIGNALS</span>
          <h2>近期变化</h2>
        </header>
        <div class="signal-list">
          ${recentSignals.map(s => `
          <a class="signal-card" href="${s.url}" target="_blank" rel="noopener" style="--event-color:${TRACKS[s.tags[0]]?.color || 'var(--brand)'}">
            <span class="signal-time">${relTime(s.publishedAt)}</span>
            <div class="signal-info">
              <span>${s.sourceName} · ${s.tier === 1 ? '一手' : s.tier === 2 ? '专业' : '社区'}${s.region === 'cn' ? ' · 国内' : ''}</span>
              <h3>${e(s.title.slice(0, 100))}</h3>
              ${s.aiSummary ? `<p class="signal-ai">${e(s.aiSummary)}</p>` : ''}
              <div class="signal-meta-inline">
                ${tierBadge(s.tier)}
                ${regionBadge(s.region)}
                ${s.stars ? `<span style="font-size:0.7rem;color:#f59e0b">⭐ ${s.stars}</span>` : ''}
              </div>
            </div>
            <span class="signal-arrow">${ICONS.arrow}</span>
          </a>`).join('')}
        </div>
        <a class="btn-primary" href="./timeline/" style="display:inline-flex">查看所有事件脉络 ${ICONS.arrow}</a>
      </div>
    </section>

    <section class="manifesto">
      <div class="shell">
        <span class="kicker">AI PULSE</span>
        <h2>别追每条新闻。<em>看清变化的方向。</em></h2>
        <p>从一手事实出发，沿 AI Agent、FDE、OPC 主线，找到真正会改变决策的行业转折。</p>
        <div class="manifesto-principles">
          <span>一手来源优先</span>
          <span>事实 / 分析 / 预测分层</span>
          <span>证据可追溯</span>
        </div>
      </div>
    </section>`;

  return shell(
    'AI Pulse — AI 行业动态监控',
    'AI Agent · FDE · OPC — 证据驱动的 AI 行业动态监控',
    '/',
    body
  );
}

// ══════════════════════════════════════════
// Page: 趋势判断 (lines/)
// ══════════════════════════════════════════
function pageLines(snapshot) {
  const trackEntries = Object.entries(TRACKS);
  const trackId = 'ai-agent'; // default
  const track = TRACKS[trackId];
  const sigs = getSignalsByTrack(snapshot, trackId);

  const body = `
    <div class="trend-detail-header shell">
      <div class="trend-detail-meta">
        <span class="tag" style="background:${track.color}20;color:${track.color}">${track.kicker}</span>
        <span class="count">${sigs.length} 个支撑信号</span>
      </div>
      <h1 class="trend-detail-title">${e(track.label)}</h1>
      <p class="trend-detail-desc">${e(track.description)}</p>
    </div>

    <div class="shell">
      <div class="track-tabs" id="track-tabs">
        ${trackEntries.map(([key, t]) => `
          <button class="track-tab ${key === trackId ? 'active' : ''}" data-track="${key}" style="--track-color:${t.color}">
            <span class="track-tab-num">${trackEntries.indexOf(trackEntries.find(([k]) => k === key)) + 1}</span>${t.label}
          </button>`).join('')}
      </div>

      <div class="trend-detail-body">
        <div class="trend-detail-judgment">
          <h3>当前判断 · 系统分析</h3>
          <div class="current">${e(track.description)}</div>
          <div class="dim">
            <label>判断变化</label>
            <p>${e(track.judgmentChange)}</p>
          </div>
          <div class="dim">
            <label>下一观察 · 待验证</label>
            <p>${e(track.nextSignal)}</p>
          </div>
        </div>
        <div>
          <h3 style="font-size:0.75rem;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:1rem">最新证据</h3>
          <div class="evidence-list">
            ${sigs.slice(0, 10).map(s => `
            <a class="evidence-item" href="${s.url}" target="_blank" rel="noopener">
              <time>${formatDate(s.publishedAt)}</time>
              <strong>${e(s.title.slice(0, 80))}</strong>
              <small>${s.sourceName} · ${tierBadge(s.tier)} ${regionBadge(s.region)}</small>
            </a>`).join('')}
          </div>
        </div>
      </div>
    </div>`;

  return shell(
    `趋势判断 — ${track.label} — AI Pulse`,
    track.description,
    '/lines/',
    body
  );
}

// ══════════════════════════════════════════
// Page: 事件脉络 (timeline/)
// ══════════════════════════════════════════
function pageTimeline(snapshot) {
  const sorted = [...snapshot.signals].sort((a, b) =>
    parseDate(b.publishedAt).getTime() - parseDate(a.publishedAt).getTime()
  );

  // 按日期分组
  const grouped = {};
  for (const s of sorted) {
    const date = dateKey(s.publishedAt);
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(s);
  }

  const body = `
    <section class="section shell">
      <header class="section-head">
        <span class="kicker">EVENT TIMELINE</span>
        <h2>事件脉络</h2>
      </header>
      <div class="track-tabs" id="track-tabs">
        <button class="track-tab active" data-track="all">全部</button>
        ${Object.entries(TRACKS).map(([key, t]) => `
          <button class="track-tab" data-track="${key}" style="--track-color:${t.color}">${t.label}</button>`).join('')}
      </div>
      <div class="timeline">
        ${Object.entries(grouped).slice(0, 15).map(([date, sigs]) => `
        <div class="timeline-day">
          <h3 class="timeline-date">${formatDate(date)}</h3>
          ${sigs.map(s => {
            const trackColor = TRACKS[s.tags[0]]?.color || 'var(--brand)';
            return `
          <a class="event-row" href="${s.url}" target="_blank" rel="noopener" style="--event-color:${trackColor}" data-track-filter="${s.tags[0] || ''}">
            <span class="event-dot"></span>
            <div class="event-content">
              <time>${s.sourceName} · ${s.tier === 1 ? '一手' : s.tier === 2 ? '专业' : '社区'}${s.region === 'cn' ? ' · 国内' : ''}</time>
              <h3>${e(s.title.slice(0, 100))}</h3>
              <span>${s.tags.map(t => TRACKS[t]?.label || t).join(' · ')}</span>
            </div>
            <span class="signal-arrow">${ICONS.arrow}</span>
          </a>`;
          }).join('')}
        </div>`).join('')}
      </div>
    </section>`;

  return shell('事件脉络 — AI Pulse', 'AI 行业事件时间线', '/timeline/', body);
}

// ══════════════════════════════════════════
// Page: 来源动态 (signals/)
// ══════════════════════════════════════════
function pageSignals(snapshot) {
  // 按来源分组
  const bySource = {};
  for (const s of snapshot.signals) {
    if (!bySource[s.sourceId]) {
      bySource[s.sourceId] = { name: s.sourceName, tier: s.tier, region: s.region, signals: [] };
    }
    bySource[s.sourceId].signals.push(s);
  }

  const sources = Object.entries(bySource).sort((a, b) => a[1].tier - b[1].tier);

  const body = `
    <section class="section shell">
      <header class="section-head">
        <span class="kicker">SOURCE UPDATES</span>
        <h2>来源动态</h2>
      </header>
      <p style="font-size:0.9rem;color:var(--text-2);margin-bottom:2rem">
        监控 ${sources.length} 个来源，实时追踪 AI Agent、FDE、OPC 相关信号。
      </p>
      <div class="source-grid">
        ${sources.map(([id, src]) => `
        <div class="source-card">
          <span class="source-status ok"></span>
          <div class="source-info">
            <div class="source-name">${e(src.name)}</div>
            <div class="source-meta">
              <span>Tier ${src.tier}</span>
              <span>${src.region === 'cn' ? '国内' : '全球'}</span>
              <span>${src.signals.length} 信号</span>
            </div>
          </div>
        </div>`).join('')}
      </div>
    </section>

    <section class="section section-tint">
      <div class="shell">
        <header class="section-head">
          <h2>最新采集信号</h2>
        </header>
        <div class="signal-list">
          ${snapshot.signals.slice(0, 30).map(s => `
          <a class="signal-card" href="${s.url}" target="_blank" rel="noopener">
            <span class="signal-time">${relTime(s.publishedAt)}</span>
            <div class="signal-info">
              <span>${s.sourceName}</span>
              <h3>${e(s.title.slice(0, 100))}</h3>
              ${s.aiSummary ? `<p class="signal-ai">${e(s.aiSummary)}</p>` : ''}
              <div class="signal-meta-inline">
                ${tierBadge(s.tier)}
                ${regionBadge(s.region)}
              </div>
            </div>
            <span class="signal-arrow">${ICONS.arrow}</span>
          </a>`).join('')}
        </div>
      </div>
    </section>`;

  return shell('来源动态 — AI Pulse', '数据来源与采集动态', '/signals/', body);
}

// ══════════════════════════════════════════
// Page: 行动参考 (scout/)
// ══════════════════════════════════════════
function pageScout(snapshot) {
  // 基于信号生成行动参考
  const topSignals = snapshot.signals
    .filter(s => s.tier <= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const scoutTypes = [
    { type: '产品机会', color: '#8b5cf6', icon: '💡' },
    { type: '技术趋势', color: '#06b6d4', icon: '🔬' },
    { type: '创业方向', color: '#f97316', icon: '🚀' },
    { type: '工具推荐', color: '#22c55e', icon: '🔧' },
  ];

  const body = `
    <section class="section shell">
      <header class="section-head">
        <span class="kicker">SCOUT</span>
        <h2>行动参考</h2>
      </header>
      <p style="font-size:0.9rem;color:var(--text-2);margin-bottom:2rem">
        基于最新证据，识别值得验证的产品机会、技术趋势和创业方向。
      </p>
      ${topSignals.map((s, i) => {
        const st = scoutTypes[i % scoutTypes.length];
        return `
      <div class="scout-card" style="--scout-color:${st.color}">
        <div class="scout-type">${st.icon} ${st.type}</div>
        <h3>${e(s.title.slice(0, 80))}</h3>
        <p>${e((s.aiSummary || s.summary || '').slice(0, 200))}</p>
        <div class="scout-evidence">
          证据: <a href="${s.url}" target="_blank" rel="noopener">${s.sourceName}</a> · ${formatDate(s.publishedAt)}
        </div>
      </div>`;
      }).join('')}
    </section>`;

  return shell('行动参考 — AI Pulse', '基于证据的产品机会与行动建议', '/scout/', body);
}

// ══════════════════════════════════════════
// Main Build
// ══════════════════════════════════════════
function main() {
  console.log('Building AI Pulse...\n');

  const snapshot = loadSnapshot();

  if (existsSync(DIST_DIR)) rmSync(DIST_DIR, { recursive: true });
  mkdirSync(DIST_DIR, { recursive: true });

  // 复制 assets
  const assetsDir = join(DIST_DIR, 'assets');
  mkdirSync(assetsDir, { recursive: true });
  const webAssets = join(WEB_DIR, 'assets');
  if (existsSync(webAssets)) {
    for (const f of readdirSync(webAssets)) {
      writeFileSync(join(assetsDir, f), readFileSync(join(webAssets, f)));
    }
  }

  // 首页
  writeFileSync(join(DIST_DIR, 'index.html'), pageHome(snapshot));
  console.log('  index.html');

  // 趋势判断
  mkdirSync(join(DIST_DIR, 'lines'), { recursive: true });
  writeFileSync(join(DIST_DIR, 'lines', 'index.html'), pageLines(snapshot));
  for (const key of Object.keys(TRACKS)) {
    mkdirSync(join(DIST_DIR, 'lines', key), { recursive: true });
    const track = TRACKS[key];
    const sigs = getSignalsByTrack(snapshot, key);
    writeFileSync(join(DIST_DIR, 'lines', key, 'index.html'), shell(
      `${track.label} — AI Pulse`, track.description, '/lines/',
      `<div class="trend-detail-header shell">
        <div class="trend-detail-meta">
          <span class="tag" style="background:${track.color}20;color:${track.color}">${track.kicker}</span>
          <span class="count">${sigs.length} 个支撑信号</span>
        </div>
        <h1 class="trend-detail-title">${e(track.label)}</h1>
        <p class="trend-detail-desc">${e(track.description)}</p>
      </div>
      <div class="shell">
        <div class="trend-detail-body">
          <div class="trend-detail-judgment">
            <h3>当前判断 · 系统分析</h3>
            <div class="current">${e(track.description)}</div>
            <div class="dim"><label>判断变化</label><p>${e(track.judgmentChange)}</p></div>
            <div class="dim"><label>下一观察</label><p>${e(track.nextSignal)}</p></div>
          </div>
          <div>
            <h3 style="font-size:0.75rem;color:var(--text-3);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:1rem">最新证据</h3>
            <div class="evidence-list">
              ${sigs.slice(0, 10).map(s => `
              <a class="evidence-item" href="${s.url}" target="_blank" rel="noopener">
                <time>${formatDate(s.publishedAt)}</time>
                <strong>${e(s.title.slice(0, 80))}</strong>
                <small>${s.sourceName}</small>
              </a>`).join('')}
              ${sigs.length === 0 ? '<p style="font-size:0.85rem;color:var(--text-4)">暂无信号</p>' : ''}
            </div>
          </div>
        </div>
      </div>`
    ));
    console.log(`  lines/${key}/index.html`);
  }

  // 事件脉络
  mkdirSync(join(DIST_DIR, 'timeline'), { recursive: true });
  writeFileSync(join(DIST_DIR, 'timeline', 'index.html'), pageTimeline(snapshot));
  console.log('  timeline/index.html');

  // 来源动态
  mkdirSync(join(DIST_DIR, 'signals'), { recursive: true });
  writeFileSync(join(DIST_DIR, 'signals', 'index.html'), pageSignals(snapshot));
  console.log('  signals/index.html');

  // 行动参考
  mkdirSync(join(DIST_DIR, 'scout'), { recursive: true });
  writeFileSync(join(DIST_DIR, 'scout', 'index.html'), pageScout(snapshot));
  console.log('  scout/index.html');

  // 404
  writeFileSync(join(DIST_DIR, '404.html'), shell('404 — AI Pulse', '页面不存在', '', `
    <div class="empty-state" style="padding:6rem 2rem">
      <h1 style="font-size:3rem;margin-bottom:1rem">404</h1>
      <p>页面不存在</p>
      <a href="./" class="btn-primary" style="margin-top:1.5rem;display:inline-flex">返回首页</a>
    </div>`));

  // 结构化数据（供前端搜索/筛选，阶段三使用）
  writeFileSync(join(DIST_DIR, 'data.json'), JSON.stringify(snapshot));
  console.log('  data.json');

  console.log(`\n  Built ${snapshot.totalDeduped} signals → dist/`);
}

main();
