/**
 * 本地开发服务器
 * 无需框架依赖，使用 Node.js 原生 http
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const PORT = 3000;
const DIST = join(import.meta.dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

const server = createServer((req, res) => {
  let filePath = join(DIST, req.url === '/' ? 'index.html' : req.url);

  // 目录 → index.html
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  }

  // 无扩展名 → .html
  if (!existsSync(filePath) && !extname(filePath)) {
    filePath = filePath + '.html';
  }

  // 404
  if (!existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404</h1><p>Page not found. Run <code>npm run build</code> first.</p>');
    return;
  }

  const ext = extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch {
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`\n  ⚡ AI Pulse dev server`);
  console.log(`  → http://localhost:${PORT}\n`);
});
