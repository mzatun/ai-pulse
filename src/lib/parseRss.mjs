/**
 * RSS / Atom 解析（双层）
 * 1) rss-parser 标准解析（先）
 * 2) 失败则用 cheerio 宽松解析兜底（兼容不规范 XML，如 LangChain blog）
 * 统一返回 { items: [...] }，item 字段对齐 rss-parser 常用字段。
 */

import RSSParser from 'rss-parser';
import * as cheerio from 'cheerio';

const parser = new RSSParser({
  timeout: 15000,
  customFields: {
    item: [
      ['media:content', 'mediaContent'],
      ['media:thumbnail', 'mediaThumbnail'],
    ],
  },
});

export function sanitizeXml(xml) {
  // 转义裸 &（非合法 XML 实体的 &），兼容部分不规范 feed
  return xml.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;');
}

function parseWithCheerio(xml) {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items = [];
  $('item, entry').each((i, el) => {
    const node = $(el);
    const linkEl = node.find('link').first();
    const link = linkEl.attr('href') || linkEl.text().trim() || '';
    const descNode = node.find('description, summary, content').first();
    const text = descNode.text().trim();
    items.push({
      title: node.find('title').first().text().trim(),
      link,
      contentSnippet: text,
      content: text,
      pubDate: node.find('pubDate, updated, published').first().text().trim(),
      isoDate: node.find('pubDate, updated, published').first().text().trim(),
      guid: node.find('guid, id').first().text().trim() || link,
    });
  });
  return items;
}

export async function parseFeed(xml) {
  try {
    const feed = await parser.parseString(sanitizeXml(xml));
    const items = feed.items || feed.entries || [];
    if (items.length) return { items };
  } catch {
    // rss-parser 失败，走 cheerio 兜底
  }
  const items = parseWithCheerio(xml);
  if (items.length) return { items };
  throw new Error('无法解析为 RSS/Atom');
}
