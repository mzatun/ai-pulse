/**
 * 主采集脚本
 * 从所有配置的来源拉取数据，去重、评分、聚类
 */

import { SOURCES } from './sources.mjs';
import { collectRSS } from './collectors/rss.mjs';
import { collectGitHub } from './collectors/github.mjs';
import { deduplicateSignals, scoreSignal } from './lib/cluster.mjs';
import { enrichSignals, clusterByTopic, buildDailyBrief } from './lib/enrich.mjs';
import { loadEnv } from './lib/env.mjs';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_DIR = join(import.meta.dirname, '..', 'data');

async function collectFromSource(source) {
  const start = Date.now();
  let result;

  try {
    switch (source.type) {
      case 'rss':
        result = await collectRSS(source);
        break;
      case 'github-api':
        result = await collectGitHub(source);
        break;
      default:
        result = { signals: [], error: `Unknown type: ${source.type}` };
    }
  } catch (err) {
    result = { signals: [], error: err.message };
  }

  const elapsed = Date.now() - start;

  return {
    sourceId: source.id,
    sourceName: source.name,
    type: source.type,
    tier: source.tier,
    tags: source.tags,
    region: source.region,
    signalCount: result.signals?.length || 0,
    error: result.error,
    elapsed,
    signals: result.signals || [],
  };
}

async function main() {
  loadEnv(); // 注入 .env 中的 AGNES_* / GITHUB_TOKEN（不入库）

  console.log('═══════════════════════════════════════');
  console.log('  AI Pulse — Data Collection');
  console.log(`  ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════\n');

  const runId = `run-${Date.now()}`;
  const runLog = {
    runId,
    startedAt: new Date().toISOString(),
    sourceResults: [],
    totalSignals: 0,
    errors: [],
  };

  // 并发采集所有来源
  const promises = SOURCES.map(source => collectFromSource(source));
  const results = await Promise.allSettled(promises);

  let allSignals = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const source = SOURCES[i];

    if (result.status === 'fulfilled') {
      const r = result.value;
      runLog.sourceResults.push(r);
      runLog.totalSignals += r.signalCount;
      allSignals.push(...r.signals);

      const status = r.error ? `❌ ${r.error}` : `✅ ${r.signalCount} signals`;
      console.log(`  [${r.tier}] ${r.sourceName.padEnd(25)} ${status} (${r.elapsed}ms)`);
    } else {
      runLog.errors.push({ sourceId: source.id, error: result.reason?.message });
      runLog.sourceResults.push({
        sourceId: source.id,
        sourceName: source.name,
        signalCount: 0,
        error: result.reason?.message,
      });
      console.log(`  [${source.tier}] ${source.name.padEnd(25)} ❌ ${result.reason?.message}`);
    }
  }

  console.log(`\n  Total raw signals: ${allSignals.length}`);

  // 每源限制最大条数，降低噪声并控制产物体积（可在 sources.mjs 用 maxItems 覆盖）
  const capped = [];
  const counts = {};
  for (const sig of allSignals) {
    const cap = SOURCES.find(s => s.id === sig.sourceId)?.maxItems ?? 50;
    counts[sig.sourceId] = (counts[sig.sourceId] || 0);
    if (counts[sig.sourceId] < cap) { capped.push(sig); counts[sig.sourceId]++; }
  }
  allSignals = capped;

  // 去重
  const deduped = deduplicateSignals(allSignals);
  console.log(`  After dedup: ${deduped.length}`);

  // 评分
  const now = Date.now();
  for (const sig of deduped) {
    sig.score = scoreSignal(sig, now);
  }

  // 按分数排序
  deduped.sort((a, b) => b.score - a.score);

  // LLM 增强（摘要 / 主题 / 情感 / 热度，含规则降级与增量缓存）
  await enrichSignals(deduped);

  // 真主题聚类（替代伪 clusterByTags）
  const clusters = clusterByTopic(deduped);

  // 保存数据
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

  const dailyBrief = await buildDailyBrief(deduped);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    runId,
    dailyBrief,
    totalRaw: allSignals.length,
    totalDeduped: deduped.length,
    signals: deduped.map(sig => ({
      id: sig.id,
      sourceId: sig.sourceId,
      sourceName: sig.sourceName,
      title: sig.title,
      url: sig.url,
      summary: sig.summary,
      aiSummary: sig.aiSummary || null,
      topics: sig.topics || ['other', '未分类'],
      sentiment: sig.sentiment || 'neutral',
      heat: sig.heat || 0.3,
      publishedAt: sig.publishedAt,
      author: sig.author,
      tags: sig.tags,
      tier: sig.tier,
      region: sig.region,
      score: sig.score,
      stars: sig.stars || null,
      alternativeSources: sig.alternativeSources || [],
    })),
    clusters: Object.fromEntries(
      Object.entries(clusters).map(([tag, sigs]) => [
        tag,
        sigs.sort((a, b) => b.score - a.score).slice(0, 20),
      ])
    ),
  };

  writeFileSync(join(DATA_DIR, 'snapshot.json'), JSON.stringify(snapshot, null, 2));
  writeFileSync(join(DATA_DIR, 'run-log.json'), JSON.stringify(runLog, null, 2));

  // 生成来源健康报告
  const total = runLog.sourceResults.length;
  const ok = runLog.sourceResults.filter(r => !r.error).length;
  const byTier = {};
  const byRegion = {};
  const sources = [];
  for (const r of runLog.sourceResults) {
    if (!byTier[r.tier]) byTier[r.tier] = { total: 0, ok: 0, fail: 0 };
    byTier[r.tier].total++;
    if (r.error) byTier[r.tier].fail++; else byTier[r.tier].ok++;

    if (!byRegion[r.region]) byRegion[r.region] = { total: 0, ok: 0, fail: 0 };
    byRegion[r.region].total++;
    if (r.error) byRegion[r.region].fail++; else byRegion[r.region].ok++;

    sources.push({
      id: r.sourceId, name: r.sourceName, tier: r.tier, region: r.region,
      signals: r.signalCount, ok: !r.error, error: r.error || null,
    });
  }

  const healthReport = {
    generatedAt: new Date().toISOString(),
    totalSources: total,
    successful: ok,
    failed: total - ok,
    successRate: `${Math.round((ok / total) * 100)}%`,
    byTier,
    byRegion,
    sources,
  };

  writeFileSync(join(DATA_DIR, 'health.json'), JSON.stringify(healthReport, null, 2));

  console.log(`\n  Data saved to data/snapshot.json`);
  console.log(`  Health report saved to data/health.json`);
  console.log('  Done.\n');
}

main().catch(err => {
  console.error('Collection failed:', err);
  process.exit(1);
});
