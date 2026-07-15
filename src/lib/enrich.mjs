/**
 * LLM 增强管线（阶段二核心）
 *
 * 五环节：摘要 / 语义主题聚类 / 情感 / 热度 / 每日速报
 * - 有 LLM（agnes AI）→ 调用模型生成
 * - 无 LLM 或调用失败 → 规则降级，站点照常构建不崩
 * - 按 signal.url 做增量缓存（data/ai-cache.json），次日只处理新信号
 *
 * 只对去重后 Top N（默认 80）调用 LLM，控制成本；其余走规则。
 */

import { chat, llmEnabled, parseJson } from './llm.mjs';
import { TRACKS } from '../sources.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', '..', 'data');
const CACHE_FILE = join(DATA_DIR, 'ai-cache.json');

const MAIN_TRACKS = Object.keys(TRACKS); // ['ai-agent','fde','opc','llm','open-source']
const LLM_TOP_N = Number(process.env.LLM_TOP_N) || 40; // 只对 Top N 调用 LLM（可用 LLM_TOP_N 环境变量覆盖，便于调试）

// ── 缓存 ────────────────────────────────────
function loadCache() {
  try {
    return JSON.parse(readFileSync(CACHE_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

// ── 规则降级 ────────────────────────────────
function ruleTopics(sig) {
  const matched = sig.tags?.find(t => MAIN_TRACKS.includes(t));
  const mainTrack = matched || 'other';
  const sub = sig.tags?.find(t => t !== mainTrack) || '未分类';
  return [mainTrack, sub];
}

function ruleHeat(sig) {
  const tierW = sig.tier === 1 ? 0.4 : sig.tier === 2 ? 0.25 : 0.1;
  const srcW = Math.min(0.3, (sig.alternativeSources?.length || 0) * 0.1);
  return Math.min(1, 0.3 + tierW + srcW);
}

function ruleSummary(sig) {
  if (sig.summary && sig.summary.length > 15) return sig.summary.slice(0, 80);
  return (sig.title || '').slice(0, 80);
}

// ── 单条 LLM 增强 ───────────────────────────
async function enrichOne(sig, useLLM, cache) {
  const key = sig.url || sig.title;
  const cached = cache[key];
  if (cached && cached._title === (sig.title || '')) {
    sig.aiSummary = cached.aiSummary;
    sig.topics = cached.topics;
    sig.sentiment = cached.sentiment;
    sig.heat = cached.heat;
    sig._fromCache = true;
    return;
  }

  if (useLLM) {
    const prompt = `你是一名 AI 行业情报分析师。请分析下面这条资讯，严格返回 JSON：
{
  "summary": "用简体中文写 1 句话客观摘要，突出具体事实/数字，不超过 50 字",
  "mainTrack": "从 [${MAIN_TRACKS.join(', ')}, other] 中选最匹配的主线",
  "subTopic": "用一个简短中文短语概括子话题（不超过 8 字）",
  "sentiment": "positive / neutral / negative 三选一",
  "heat": "0 到 1 之间的热度数值，越受关注越高"
}
只返回 JSON，不要解释。

标题：${sig.title || ''}
来源：${sig.sourceName || ''}
正文：${(sig.summary || '').slice(0, 600)}`;

    const raw = await chat([
      { role: 'system', content: '你是严谨的 AI 行业情报分析师，只输出 JSON。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.2, maxTokens: 1024, json: true });

    const parsed = parseJson(raw);
    if (parsed && parsed.summary) {
      sig.aiSummary = parsed.summary.slice(0, 120);
      sig.topics = [
        MAIN_TRACKS.includes(parsed.mainTrack) ? parsed.mainTrack : 'other',
        parsed.subTopic || '未分类',
      ];
      sig.sentiment = ['positive', 'neutral', 'negative'].includes(parsed.sentiment)
        ? parsed.sentiment : 'neutral';
      sig.heat = typeof parsed.heat === 'number'
        ? Math.max(0, Math.min(1, parsed.heat)) : ruleHeat(sig);
      cache[key] = {
        _title: sig.title || '',
        aiSummary: sig.aiSummary,
        topics: sig.topics,
        sentiment: sig.sentiment,
        heat: sig.heat,
      };
      return;
    }
    // 解析失败 → 落下面规则
  }

  // 规则降级
  sig.aiSummary = ruleSummary(sig);
  sig.topics = ruleTopics(sig);
  sig.sentiment = 'neutral';
  sig.heat = ruleHeat(sig);
  cache[key] = {
    _title: sig.title || '',
    aiSummary: sig.aiSummary,
    topics: sig.topics,
    sentiment: sig.sentiment,
    heat: sig.heat,
  };
}

/**
 * 批量增强
 * @param {Array} signals - 已按 score 排序的去重信号
 */
export async function enrichSignals(signals) {
  const cache = loadCache();
  const enabled = llmEnabled();
  const useLLMCount = Math.min(signals.length, LLM_TOP_N);
  console.log(`\n  LLM 增强: ${enabled ? `启用 (Top ${useLLMCount} 调用模型)` : '未配置 key，走规则降级'}`);

  let hit = 0;
  const tasks = signals.map((sig, i) => enrichOne(sig, enabled && i < useLLMCount, cache)
    .then(() => { if (sig._fromCache) hit++; }));

  await Promise.allSettled(tasks);
  saveCache(cache);
  console.log(`  增强完成: ${signals.length} 条 (缓存命中 ${hit})`);
  return signals;
}

// ── 真主题聚类（替代伪 clusterByTags）────────
export function clusterByTopic(signals) {
  const clusters = {};
  for (const sig of signals) {
    const mainTrack = sig.topics?.[0] || 'other';
    if (!clusters[mainTrack]) clusters[mainTrack] = [];
    clusters[mainTrack].push(sig);
  }
  // 收敛：每个主线按 score 取前 20
  return Object.fromEntries(
    Object.entries(clusters).map(([track, sigs]) => [
      track,
      [...sigs].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 20),
    ])
  );
}

// ── 每日速报 ────────────────────────────────
export async function buildDailyBrief(signals) {
  const top = [...signals]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 10);

  if (top.length === 0) return '今日暂无足够信号生成速报。';

  if (llmEnabled()) {
    const brief = await chat([
      { role: 'system', content: '你是 AI 行业情报编辑，用简体中文写一段"今日 AI 要点"，3-4 句，突出最重要的 2-3 个变化，客观、不夸张。只输出正文。' },
      {
        role: 'user',
        content: '基于以下今日高关注信号，写一段速报：\n' +
          top.map((s, i) => `${i + 1}. [${s.sourceName}] ${s.title} — ${(s.aiSummary || '').slice(0, 60)}`).join('\n'),
      },
    ], { temperature: 0.4, maxTokens: 2500 });
    if (brief) return brief.replace(/\n+/g, ' ').trim();
  }

  // 规则降级：拼接 Top 5 标题
  return '今日重点：' + top.slice(0, 5).map(s => s.title.slice(0, 30)).join('；') + '。';
}
