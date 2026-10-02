/**
 * RSS/Atom 采集器
 * 使用 parseFeed（rss-parser + cheerio 兜底）解析 feeds
 * 支持 source.fallbacks：主地址失败时依次尝试备用地址（RSSHub / 镜像 / 聚合）
 */

import { safeFetch } from '../lib/fetch.mjs';
import { parseFeed } from '../lib/parseRss.mjs';

export async function collectRSS(source) {
  const urls = [source.url, ...(source.fallbacks || [])].filter(Boolean);
  let lastErr = null;

  for (const url of urls) {
    const result = await safeFetch(url, { timeout: source.timeout || 20000 });
    if (!result.ok) {
      lastErr = `${url} → ${result.error}`;
      continue;
    }

    try {
      const { items } = await parseFeed(result.body);
      const isFallback = urls.length > 1 && url !== source.url;
      // source.titleFilter：综合媒体源的 AI 相关性过滤（正则，测试对象 = 标题 + 摘要）
      // 用于滤掉泛科技 / 商业流中与 AI 无关的条目（股票、消费、宏观等）
      const titleFilter = source.titleFilter
        ? (source.titleFilter instanceof RegExp ? source.titleFilter : new RegExp(source.titleFilter, 'i'))
        : null;
      const signals = items
        .filter(item => !titleFilter || titleFilter.test(`${item.title || ''} ${item.contentSnippet || item.content || ''}`))
        .map(item => ({
          id: `${source.id}--${item.guid || item.link || item.title}`,
          sourceId: source.id,
          sourceName: isFallback ? `${source.name} (兜底)` : source.name,
          title: cleanText(item.title || ''),
          url: item.link || item.guid || '',
          summary: cleanText(item.contentSnippet || item.content || '').slice(0, 500),
          publishedAt: item.pubDate || item.isoDate || new Date().toISOString(),
          author: item.creator || item.author || '',
          tags: source.tags || [],
          tier: source.tier,
          region: source.region || 'global',
          media: item.mediaContent?.$.url || item.mediaThumbnail?.$.url || null,
        }));
      return { signals, error: null };
    } catch (err) {
      lastErr = `${url} → parse: ${err.message}`;
      continue;
    }
  }

  return { signals: [], error: lastErr || 'no url configured' };
}

function cleanText(text) {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
