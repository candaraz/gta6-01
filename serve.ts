// serve.ts — Solmar Bay v3: a tiny static server for local play-testing.
// One job: serve game/ on http://localhost:8080 so the game opens in a
// desktop browser with no build step. Run: node serve.ts

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), 'game');
const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

const server = createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
  const path = join(root, url === '/' ? 'index.html' : url);
  if (!existsSync(path) || !statSync(path).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
});

server.listen(8080, () => {
  console.log('Solmar Bay at http://localhost:8080');
  console.log('Shots: http://localhost:8080/index.html?shot=chase&seed=7 (and mission, drive, start)');
});
