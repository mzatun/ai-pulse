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
      const signals = items.map(item => ({
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
