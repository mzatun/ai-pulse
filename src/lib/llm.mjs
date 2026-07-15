/**
 * LLM 封装（agnes AI，OpenAI 兼容接口）
 *
 * 设计原则：
 * - 从环境变量读取配置（AGNES_BASE_URL / AGNES_MODEL / AGNES_API_KEY）
 * - 无 key 或调用失败 → 返回 null，由上层 enrich 走规则降级，绝不抛错中断构建
 * - 带并发限流 + 重试 + 指数退避，规避限流
 */

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function cfg() {
  return {
    baseUrl: (process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1').replace(/\/$/, ''),
    model: process.env.AGNES_MODEL || 'agnes-2.0-flash',
    apiKey: process.env.AGNES_API_KEY || '',
  };
}

export function llmEnabled() {
  return !!cfg().apiKey;
}

export function llmInfo() {
  const c = cfg();
  return { baseUrl: c.baseUrl, model: c.model, enabled: !!c.apiKey };
}

// ── 并发限流（信号量）────────────────────────
const MAX_CONCURRENT = 4;
let inflight = 0;
const waitQueue = [];

function acquire() {
  return new Promise(resolve => {
    if (inflight < MAX_CONCURRENT) {
      inflight++;
      resolve();
    } else {
      waitQueue.push(resolve);
    }
  });
}

function release() {
  inflight--;
  if (waitQueue.length > 0) {
    inflight++;
    const next = waitQueue.shift();
    next();
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * 调用 chat/completions，返回模型文本；任何失败返回 null。
 * @param {Array} messages - [{role, content}]
 * @param {Object} opts - { temperature, maxTokens, json }
 */
export async function chat(messages, opts = {}) {
  const { baseUrl, model, apiKey } = cfg();
  if (!apiKey) return null;

  const { temperature = 0.3, maxTokens = 1024, json = false } = opts;

  await acquire();
  try {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 90000);
      try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages,
            temperature,
            max_tokens: maxTokens,
            ...(json ? { response_format: { type: 'json_object' } } : {}),
          }),
          signal: ctrl.signal,
        });

        if (res.status === 429) {
          lastErr = new Error('rate limited (429)');
          await sleep(1500 * (attempt + 1));
          continue;
        }
        if (!res.ok) {
          lastErr = new Error(`HTTP ${res.status}`);
          // 4xx 非限流直接放弃，不重试
          if (res.status >= 400 && res.status < 500 && res.status !== 429) {
            console.warn(`  [llm] 调用失败 ${res.status}，跳过该条`);
            return null;
          }
          await sleep(1000 * (attempt + 1));
          continue;
        }

        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content || '';
        return content.trim();
      } catch (err) {
        lastErr = err;
        if (attempt < 2) await sleep(1000 * (attempt + 1));
      } finally {
        clearTimeout(timer);
      }
    }
    console.warn(`  [llm] 调用最终失败 (${lastErr?.message})，走降级`);
    return null;
  } finally {
    release();
  }
}

/**
 * 安全解析 LLM 返回的 JSON（容错：去 ```json 代码块、截断修复）
 */
export function parseJson(text) {
  if (!text) return null;
  let t = text.trim();
  // 去掉 markdown 代码块
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(t);
  } catch {
    // 尝试截取首个 { 到末个 }
    const s = t.indexOf('{');
    const e = t.lastIndexOf('}');
    if (s !== -1 && e !== -1 && e > s) {
      try { return JSON.parse(t.slice(s, e + 1)); } catch { /* ignore */ }
    }
    return null;
  }
}
