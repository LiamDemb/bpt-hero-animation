import fs from 'node:fs';
import path from 'node:path';

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function safeJsonFilename(name) {
  const base = path.basename(name || '');
  if (!base || base.includes('..') || !base.endsWith('.json')) {
    return null;
  }
  return base;
}

function safeExportFilename(name) {
  const base = path.basename(name || '');
  if (!base || base.includes('..')) return null;
  const lower = base.toLowerCase();
  if (lower.endsWith('.embed.html')) return base;
  if (!lower.endsWith('.mp4') && !lower.endsWith('.webm')) return null;
  return base;
}

export function savesPlugin() {
  const savesDir = path.resolve(process.cwd(), 'saves');
  const exportsDir = path.resolve(process.cwd(), 'exports');

  return {
    name: 'bpt-saves',
    configureServer(server) {
      fs.mkdirSync(savesDir, { recursive: true });
      fs.mkdirSync(exportsDir, { recursive: true });

      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? '';

        if (url === '/api/saves' && req.method === 'GET') {
          const files = fs
            .readdirSync(savesDir)
            .filter(f => f.endsWith('.json'))
            .map(filename => {
              const stat = fs.statSync(path.join(savesDir, filename));
              return { filename, mtimeMs: stat.mtimeMs };
            })
            .sort((a, b) => b.mtimeMs - a.mtimeMs);
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: true, files }));
          return;
        }

        if (url === '/api/saves/rename' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req);
            const from = safeJsonFilename(body.from);
            const to = safeJsonFilename(body.to);
            const overwrite = Boolean(body.overwrite);
            if (!from || !to) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: 'Invalid filename' }));
              return;
            }
            const fromPath = path.join(savesDir, from);
            const toPath = path.join(savesDir, to);
            if (!fs.existsSync(fromPath)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ ok: false, error: 'Source not found' }));
              return;
            }
            if (fs.existsSync(toPath) && !overwrite) {
              res.statusCode = 409;
              res.end(JSON.stringify({ ok: false, error: 'exists' }));
              return;
            }
            if (fs.existsSync(toPath) && overwrite) {
              fs.unlinkSync(toPath);
            }
            fs.renameSync(fromPath, toPath);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, filename: to }));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: 'Invalid rename request' }));
          }
          return;
        }

        if (url === '/api/saves' && req.method === 'POST') {
          try {
            const body = await readJsonBody(req);
            const filename = safeJsonFilename(body.filename);
            if (!filename) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: 'Invalid filename' }));
              return;
            }
            const filePath = path.join(savesDir, filename);
            const overwrite = Boolean(body.overwrite);
            if (fs.existsSync(filePath) && !overwrite) {
              res.statusCode = 409;
              res.end(JSON.stringify({ ok: false, error: 'exists' }));
              return;
            }
            const content =
              typeof body.content === 'string'
                ? body.content
                : JSON.stringify(body.project ?? body, null, 2);
            fs.writeFileSync(filePath, content, 'utf8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, filename }));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: 'Invalid save request' }));
          }
          return;
        }

        const fileMatch = url.match(/^\/api\/saves\/(.+)$/);
        if (fileMatch && req.method === 'GET') {
          const filename = safeJsonFilename(decodeURIComponent(fileMatch[1]));
          if (!filename) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: 'Invalid filename' }));
            return;
          }
          const filePath = path.join(savesDir, filename);
          if (!fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.end(JSON.stringify({ ok: false, error: 'Not found' }));
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(fs.readFileSync(filePath, 'utf8'));
          return;
        }

        if (url === '/api/exports' && req.method === 'POST') {
          try {
            const filename = safeExportFilename(req.headers['x-filename']);
            if (!filename) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: 'Invalid filename' }));
              return;
            }
            const buffer = await readRawBody(req);
            fs.writeFileSync(path.join(exportsDir, filename), buffer);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true, filename, path: `exports/${filename}` }));
          } catch {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: 'Invalid export request' }));
          }
          return;
        }

        next();
      });
    }
  };
}
