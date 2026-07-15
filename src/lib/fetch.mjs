/**
 * 安全 HTTP 抓取层
 * - 超时、重试、退避
 * - SSRF 基本防护
 * - 内容长度限制（超限时明确报错，而非返回被截断的损坏数据）
 */

const BLOCKED_HOSTS = [
  'localhost', '127.0.0.1', '0.0.0.0',
  '169.254.169.254', // AWS metadata
  '[::1]',
];

// 默认 3MB：RSS/Atom feed 与 GitHub API 一般远小于此；
// 旧值 512KB 会截断大 feed 导致 XML 解析报错（隐蔽 bug）。
const DEFAULT_MAX_BYTES = 3_000_000;

export async function safeFetch(url, {
  timeout = 15000,
  maxRetries = 2,
  maxBytes = DEFAULT_MAX_BYTES,
  headers = {},
} = {}) {
  const parsed = new URL(url);
  if (BLOCKED_HOSTS.includes(parsed.hostname)) {
    throw new Error(`Blocked host: ${parsed.hostname}`);
  }

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'AiPulse/0.1 (https://github.com/mzatun/ai-pulse)',
          'Accept': 'application/rss+xml, application/atom+xml, application/xml, application/json, text/html, */*',
          ...headers,
        },
        redirect: 'follow',
      });

      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      // 流式读取并限制大小
      const reader = res.body.getReader();
      const chunks = [];
      let totalBytes = 0;
      let truncated = false;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        totalBytes += value.length;
        if (totalBytes > maxBytes) {
          // 超过上限：丢弃这段数据并标记截断，避免返回半截 XML 让上层解析崩溃
          truncated = true;
          break;
        }
        chunks.push(value);
      }

      if (truncated) {
        try { await reader.cancel(); } catch { /* ignore */ }
        return {
          ok: false,
          status: res.status,
          error: `响应过大（>${maxBytes} 字节，实际约 ${totalBytes}），已截断拒绝`,
          bytes: totalBytes,
          truncated: true,
          url: res.url,
        };
      }

      return {
        ok: true,
        status: res.status,
        contentType: res.headers.get('content-type') || '',
        body: Buffer.concat(chunks).toString('utf-8'),
        bytes: totalBytes,
        truncated: false,
        url: res.url,
      };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = 1000 * Math.pow(2, attempt) + Math.random() * 500;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  return { ok: false, status: 0, error: lastError?.message || 'Unknown error', bytes: 0, truncated: false };
}
