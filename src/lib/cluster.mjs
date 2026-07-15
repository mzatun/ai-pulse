/**
 * 去重 + 聚类
 * - 基于 URL 去重
 * - 基于标题相似度聚类
 * - 标签聚合
 */

export function deduplicateSignals(signals) {
  const seen = new Map();
  const unique = [];

  for (const sig of signals) {
    const key = normalizeUrl(sig.url);
    if (seen.has(key)) {
      // 同一事件多个来源，合并
      const existing = seen.get(key);
      existing.alternativeSources = existing.alternativeSources || [];
      existing.alternativeSources.push({
        sourceId: sig.sourceId,
        sourceName: sig.sourceName,
        url: sig.url,
      });
      // 保留更高 tier 的信息
      if (sig.tier < existing.tier) {
        existing.tier = sig.tier;
      }
    } else {
      sig.alternativeSources = [];
      seen.set(key, sig);
      unique.push(sig);
    }
  }

  return unique;
}

export function clusterByTags(signals) {
  const clusters = {};

  for (const sig of signals) {
    for (const tag of sig.tags) {
      if (!clusters[tag]) {
        clusters[tag] = [];
      }
      clusters[tag].push(sig);
    }
  }

  return clusters;
}

export function scoreSignal(signal, now = Date.now()) {
  const age = now - new Date(signal.publishedAt).getTime();
  const ageHours = age / (1000 * 60 * 60);

  // 时间衰减 (越新越高)
  const recencyScore = Math.max(0, 1 - ageHours / 168); // 7天衰减到0

  // Tier 加权 (越一手越高)
  const tierScore = signal.tier === 1 ? 1.0 : signal.tier === 2 ? 0.7 : 0.4;

  // 来源数量
  const sourceScore = Math.min(1, (signal.alternativeSources?.length || 0) * 0.3 + 0.4);

  // Stars (如果有)
  const starScore = signal.stars ? Math.min(1, Math.log10(signal.stars + 1) / 5) : 0.3;

  return recencyScore * 0.35 + tierScore * 0.3 + sourceScore * 0.2 + starScore * 0.15;
}

function normalizeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.replace(/\/+$/, '').toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
