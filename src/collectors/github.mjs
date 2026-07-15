/**
 * GitHub API 采集器
 * 抓取热门仓库、趋势项目
 * 支持 source.fallbacks：主地址失败时依次尝试备用地址
 */

import { safeFetch } from '../lib/fetch.mjs';

export async function collectGitHub(source) {
  const headers = process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {};
  if (!process.env.GITHUB_TOKEN) {
    console.warn('  ⚠️  GITHUB_TOKEN 未设置，GitHub API 限流为 60 次/小时');
  }

  const urls = [source.url, ...(source.fallbacks || [])].filter(Boolean);
  let lastErr = null;

  for (const url of urls) {
    const result = await safeFetch(url, { timeout: 20000, headers });
    if (!result.ok) {
      lastErr = `${url} → ${result.error}`;
      continue;
    }

    try {
      const data = JSON.parse(result.body);
      const signals = (data.items || []).map(repo => ({
        id: `github--${repo.id}`,
        sourceId: source.id,
        sourceName: source.name,
        title: `${repo.full_name}: ${repo.description || 'No description'}`,
        url: repo.html_url,
        summary: [
          `Stars: ${repo.stargazers_count}`,
          `Language: ${repo.language || 'N/A'}`,
          `Topics: ${(repo.topics || []).join(', ')}`,
          repo.description || '',
        ].filter(Boolean).join(' | '),
        publishedAt: repo.created_at,
        author: repo.owner?.login || '',
        tags: [...(source.tags || []), ...(repo.topics || [])],
        tier: source.tier,
        region: source.region || 'global',
        stars: repo.stargazers_count,
        media: null,
      }));

      return { signals, error: null };
    } catch (err) {
      lastErr = `${url} → parse: ${err.message}`;
      continue;
    }
  }

  return { signals: [], error: lastErr || 'no url configured' };
}
