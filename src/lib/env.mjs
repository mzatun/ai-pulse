/**
 * 极简 .env 加载器
 * 仅在变量尚未存在于 process.env 时注入，避免覆盖已有环境配置。
 * 不依赖任何第三方包；.env 已被 .gitignore 忽略，不会入库。
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = join(__dirname, '..', '..', '.env');

export function loadEnv() {
  if (!existsSync(ENV_PATH)) return;
  const txt = readFileSync(ENV_PATH, 'utf-8');
  for (const raw of txt.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    // 去掉成对引号
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
