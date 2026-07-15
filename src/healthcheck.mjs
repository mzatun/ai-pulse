/**
 * 源清单体检脚本
 * 逐源做 fetch + 解析双层探测，输出详细健康报告 data/health-check.json
 * 用途：快速定位失效源 / 截断源 / 解析失败源，便于迭代替换。
 * 运行: npm run health
 */

import { SOURCES } from './sources.mjs';
import { safeFetch } from './lib/fetch.mjs';
import { parseFeed } from './lib/parseRss.mjs';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(import.meta.dirname, '..', 'data');

async function probe(source) {
  const start = Date.now();
  const urls = [source.url, ...(source.fallbacks || [])].filter(Boolean);

  let result = null;
  let usedUrl = source.url;
  let usedFallback = false;
  for (const u of urls) {
    const r = await safeFetch(u, { timeout: 20000 });
    if (r.ok) { result = r; usedUrl = u; usedFallback = u !== source.url; break; }
    result = r; // 保留最后一个失败结果用于报错
  }

  let parseOk = null;
  let parseError = null;
  let itemCount = 0;

  if (result && result.ok) {
    try {
      if (source.type === 'rss') {
        const { items } = await parseFeed(result.body);
        itemCount = items?.length || 0;
      } else if (source.type === 'github-api') {
        const data = JSON.parse(result.body);
        itemCount = data.items?.length || 0;
      }
      parseOk = true;
    } catch (err) {
      parseError = err.message;
    }
  }

  const elapsed = Date.now() - start;

  // 综合判定：fetch 成功 且 解析成功 才算健康
  const healthy = result?.ok && parseOk;

  return {
    id: source.id,
    name: source.name,
    url: usedUrl,
    isFallback: usedFallback,
    type: source.type,
    tier: source.tier,
    region: source.region,
    healthy,
    fetchOk: result?.ok || false,
    httpStatus: result?.status || 0,
    bytes: result?.bytes || 0,
    truncated: result?.truncated || false,
    fetchError: result?.error || null,
    parseOk,
    parseError,
    itemCount,
    elapsed,
  };
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  AI Pulse — Source Health Check');
  console.log(`  ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════\n');

  const details = await Promise.all(SOURCES.map(s => probe(s)));
  for (const d of details) {
    const flag = d.healthy ? '✅' : '❌';
    const fb = d.isFallback ? '⤵' : ' ';
    const reason = !d.fetchOk ? `fetch: ${d.fetchError}` : (d.parseOk ? '' : `parse: ${d.parseError}`);
    console.log(`  ${flag}${fb} [T${d.tier}/${d.region}] ${d.name.padEnd(22)} ${d.itemCount}项 ${d.bytes}B ${d.elapsed}ms ${reason}`);
  }

  const total = details.length;
  const healthy = details.filter(d => d.healthy).length;
  const failed = total - healthy;

  const byTier = {};
  const byRegion = {};
  for (const d of details) {
    if (!byTier[d.tier]) byTier[d.tier] = { total: 0, ok: 0, fail: 0 };
    byTier[d.tier].total++;
    if (d.healthy) byTier[d.tier].ok++; else byTier[d.tier].fail++;

    if (!byRegion[d.region]) byRegion[d.region] = { total: 0, ok: 0, fail: 0 };
    byRegion[d.region].total++;
    if (d.healthy) byRegion[d.region].ok++; else byRegion[d.region].fail++;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalSources: total,
    healthy,
    failed,
    successRate: `${Math.round((healthy / total) * 100)}%`,
    byTier,
    byRegion,
    details,
  };

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, 'health-check.json'), JSON.stringify(report, null, 2));

  console.log(`\n  成功率: ${report.successRate} (${healthy}/${total})`);
  console.log(`  报告已写入 data/health-check.json`);
}

main().catch(err => {
  console.error('Health check failed:', err);
  process.exit(1);
});
