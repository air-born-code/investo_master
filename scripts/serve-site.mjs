// Serves site/ locally. Binds to localhost only — this is a private research
// record, and nothing here should be reachable from the network.
//
// Usage: npm run site:serve  (builds first, then serves)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? process.cwd());
const siteDir = path.join(root, 'site');
const port = Number(process.env.PORT ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${port}`);
    const requested = decodeURIComponent(url.pathname);
    const target = path.join(siteDir, requested === '/' ? 'index.html' : requested);

    // Refuse anything resolving outside site/, so a crafted path cannot read
    // the store or .env.local through the server.
    const resolved = path.resolve(target);
    if (resolved !== siteDir && !resolved.startsWith(siteDir + path.sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const info = await stat(resolved).catch(() => null);
    const file = info?.isDirectory() ? path.join(resolved, 'index.html') : resolved;
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
      .end('<p>Not found. Run <code>npm run site:build</code> first.</p>');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Investo Master site: http://localhost:${port}`);
  console.log('Bound to localhost only. Ctrl-C to stop.');
});
