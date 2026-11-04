import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { APP_ROOT } from './storage.js';
import {
  ActionError,
  buildPreview,
  createTemplate,
  currentState,
  saveProject,
  setFolder,
  setOutputPath,
  writeWebsiteFile,
} from './actions.js';

const HOST = '127.0.0.1';
const PORT = Number(process.env.REPOPILOT_PORT) || 4173;
const ALLOWED_HOSTS = [`${HOST}:${PORT}`, `localhost:${PORT}`];
const WEB_ROOT = path.join(APP_ROOT, 'web');
const MAX_BODY_BYTES = 1024 * 1024;
const PICKER_DESCRIPTIONS = {
  projects: 'Choose the folder that contains your project folders',
  website: 'Choose your website project folder',
};
const STATIC_FILES = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
  '/styles.css': { file: 'styles.css', type: 'text/css; charset=utf-8' },
};

function httpError(status, message) {
  return new ActionError(status, message);
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw httpError(413, 'The request is too large.');
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw httpError(400, 'The request body must be JSON.');
  }
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function pickFolder(kind) {
  const description = PICKER_DESCRIPTIONS[kind];
  if (!description) throw httpError(400, 'Unknown folder type.');
  if (process.platform !== 'win32') throw httpError(400, 'Browse works on Windows. Paste the folder path instead.');
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    `$dialog.Description = '${description}'`,
    'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }',
  ].join('; ');
  return new Promise((resolve, reject) => {
    execFile('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { windowsHide: true, timeout: 600000 }, (error, stdout) => {
      if (error) reject(httpError(500, 'The folder picker could not be opened. Paste the folder path instead.'));
      else resolve({ path: stdout.trim() });
    });
  });
}

const API = {
  'GET /api/state': () => currentState(),
  'GET /api/preview': () => buildPreview(),
  'POST /api/pick-folder': (body) => pickFolder(body.kind),
  'POST /api/folder': (body) => setFolder(body.kind, body.path),
  'POST /api/output': (body) => setOutputPath(body.outputRelativePath),
  'POST /api/project': (body) => saveProject(body.folder, body.value),
  'POST /api/template': (body) => createTemplate(body.folder),
  'POST /api/write': () => writeWebsiteFile(),
};

async function handleApi(req, res, pathname) {
  const handler = API[`${req.method} ${pathname}`];
  if (!handler) throw httpError(404, 'Unknown request.');
  const body = req.method === 'POST' ? await readBody(req) : {};
  sendJson(res, 200, await handler(body));
}

async function serveStatic(req, res, pathname) {
  const asset = STATIC_FILES[pathname];
  if (!asset || req.method !== 'GET') throw httpError(404, 'Not found.');
  const body = await fs.readFile(path.join(WEB_ROOT, asset.file));
  res.writeHead(200, { 'Content-Type': asset.type, 'Cache-Control': 'no-store' });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!ALLOWED_HOSTS.includes(req.headers.host)) throw httpError(403, 'Forbidden.');
    const { pathname } = new URL(req.url, `http://${HOST}:${PORT}`);
    if (pathname.startsWith('/api/')) await handleApi(req, res, pathname);
    else await serveStatic(req, res, pathname);
  } catch (error) {
    sendJson(res, error.status || 500, { error: error.message });
  }
});

server.on('error', (error) => {
  const message = error.code === 'EADDRINUSE'
    ? `Port ${PORT} is already in use. Close the other RepoPilot window or set REPOPILOT_PORT.`
    : `RepoPilot could not start: ${error.message}`;
  console.error(message);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  const address = `http://${HOST}:${PORT}`;
  console.log(`RepoPilot is running at ${address}`);
  console.log('Keep this window open while you use RepoPilot. Press Ctrl+C to stop it.');
  if (process.platform === 'win32' && !process.env.REPOPILOT_NO_OPEN) openBrowser(address);
});

function openBrowser(address) {
  const child = spawn('explorer.exe', [address], { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => {});
  child.unref();
}
