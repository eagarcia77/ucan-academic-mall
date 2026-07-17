const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { createAuthSystem } = require('./lib/auth');

const PORT = Number(process.env.PORT || 3000);
const UCAN_VERSION = 'V271';
const UCAN_BUILD = String(process.env.UCAN_BUILD || 'V271-20260717-XR-PARITY-FLOOR-LOCK');
const UCAN_MAIN_SCRIPT = '/js/ucan_babylon_mall_v265_accounts_avatars.js?build=V271-20260717-XR-PARITY-FLOOR-LOCK';
const ADMIN_PIN = String(process.env.ADMIN_PIN || '');
const LEGACY_ADMIN_PIN_ENABLED = String(process.env.LEGACY_ADMIN_PIN_ENABLED || 'false').toLowerCase() === 'true';
const REGISTRATION_ENABLED = String(process.env.REGISTRATION_ENABLED || 'true').toLowerCase() !== 'false';
const ADMIN_INITIAL_USERNAME = String(process.env.ADMIN_INITIAL_USERNAME || 'admin');
const ADMIN_INITIAL_PASSWORD = String(process.env.ADMIN_INITIAL_PASSWORD || 'Cambiar-UCAN-2026!');
const ADMIN_INITIAL_EMAIL = String(process.env.ADMIN_INITIAL_EMAIL || 'admin@ucan.local');
const PUBLIC_DIR = path.join(__dirname, 'public');
const GENERATED_DIR = path.join(__dirname, 'generated');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const CATALOG_FILE = path.join(DATA_DIR, 'catalog.json');
const COLLAB_FILE = path.join(DATA_DIR, 'collaboration.json');
const MAX_BODY_BYTES = 250 * 1024 * 1024;

for (const dir of [GENERATED_DIR, DATA_DIR, UPLOAD_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}
if (!fs.existsSync(CATALOG_FILE)) fs.writeFileSync(CATALOG_FILE, JSON.stringify({ events: [], announcements: [] }, null, 2));
if (!fs.existsSync(COLLAB_FILE)) fs.writeFileSync(COLLAB_FILE, JSON.stringify({ rooms: {} }, null, 2));

const authSystem = createAuthSystem({
  dataDir: DATA_DIR,
  registrationEnabled: REGISTRATION_ENABLED,
  initialAdminUsername: ADMIN_INITIAL_USERNAME,
  initialAdminPassword: ADMIN_INITIAL_PASSWORD,
  initialAdminEmail: ADMIN_INITIAL_EMAIL,
  appBaseUrl: process.env.APP_BASE_URL,
  resendApiKey: process.env.RESEND_API_KEY,
  resetFromEmail: process.env.RESET_FROM_EMAIL,
  resetReplyTo: process.env.RESET_REPLY_TO
});

function json(res, status, data, extraHeaders = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function text(res, status, body, contentType = 'text/plain; charset=utf-8', extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function safeJoin(base, requestPath) {
  const normalized = path.normalize(requestPath).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(base, normalized);
  return filePath.startsWith(base) ? filePath : null;
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.webp': 'image/webp', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
    '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf', '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json', '.woff2': 'font/woff2', '.ico': 'image/x-icon'
  }[ext] || 'application/octet-stream';
}

async function readBody(req, limit = MAX_BODY_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Cuerpo demasiado grande'), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req, limit = 2 * 1024 * 1024) {
  const body = await readBody(req, limit);
  if (!body.length) return {};
  try { return JSON.parse(body.toString('utf8')); }
  catch { throw Object.assign(new Error('JSON inválido'), { statusCode: 400 }); }
}

function sanitizeFilename(name) {
  return String(name || 'archivo').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

async function serveFile(res, filePath, req) {
  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) return serveFile(res, path.join(filePath, 'index.html'), req);
    const range = req.headers.range;
    if (range && /^(video|audio)\//.test(mimeType(filePath))) {
      const match = range.match(/bytes=(\d*)-(\d*)/);
      if (match) {
        const start = Number(match[1] || 0);
        const end = Math.min(Number(match[2] || stat.size - 1), stat.size - 1);
        if (start <= end) {
          res.writeHead(206, {
            'Content-Type': mimeType(filePath), 'Content-Length': end - start + 1,
            'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Accept-Ranges': 'bytes',
            'Cache-Control': filePath.endsWith('.html') ? 'no-store' : 'public, max-age=31536000, immutable'
          });
          fs.createReadStream(filePath, { start, end }).pipe(res);
          return;
        }
      }
    }
    res.writeHead(200, {
      'Content-Type': mimeType(filePath),
      'Content-Length': stat.size,
      'Cache-Control': filePath.endsWith('.html') ? 'no-store' : 'public, max-age=31536000, immutable'
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    if (error.code === 'ENOENT') text(res, 404, 'No encontrado');
    else text(res, 500, 'Error leyendo archivo');
  }
}

function readJsonFile(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

function writeJsonFile(file, data) {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, file);
}

function adminAuthorized(req, user) {
  if (user?.role === 'admin') return true;
  if (!LEGACY_ADMIN_PIN_ENABLED || !ADMIN_PIN) return false;
  return String(req.headers['x-admin-pin'] || '') === ADMIN_PIN;
}

function extractTextFromOffice(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!['.docx', '.pptx', '.xlsx', '.odt', '.odp', '.ods'].includes(ext)) return '';
  const result = spawnSync('python3', ['-c', `
import sys, zipfile, re
p=sys.argv[1]
try:
 z=zipfile.ZipFile(p)
 texts=[]
 for n in z.namelist():
  if n.endswith('.xml'):
   s=z.read(n).decode('utf-8','ignore')
   texts += re.findall(r'<(?:a:t|w:t|text:p)[^>]*>(.*?)</(?:a:t|w:t|text:p)>',s,re.S)
 print('\\n'.join(re.sub('<[^>]+>',' ',x) for x in texts))
except Exception: pass
`, filePath], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  return result.stdout || '';
}

function summarizeText(raw) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!text) return { summary: 'No se pudo extraer texto suficiente.', keywords: [], keyPoints: [], questions: [] };
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 80);
  const words = (text.toLowerCase().match(/[a-záéíóúñü0-9]{4,}/gi) || []);
  const stop = new Set(['para','como','esta','este','estos','estas','desde','hasta','entre','sobre','donde','cuando','quien','cual','cuales','porque','tambien','ademas','deber','debera','deben','puede','pueden','documento','presentacion','presentación']);
  const freq = new Map();
  for (const w of words) if (!stop.has(w)) freq.set(w, (freq.get(w) || 0) + 1);
  const keywords = [...freq.entries()].sort((a,b) => b[1]-a[1]).slice(0,8).map(([w]) => w);
  const scored = sentences.map((sentence,index) => ({ sentence,index,score:keywords.reduce((s,k)=>s+(sentence.toLowerCase().includes(k)?2:0),0)+Math.min(2,sentence.length/140) })).sort((a,b)=>b.score-a.score).slice(0,4).sort((a,b)=>a.index-b.index);
  return {
    summary: scored.map(x=>x.sentence).join(' ') || sentences.slice(0,3).join(' '),
    keywords,
    keyPoints: sentences.filter(s=>s.length>35).slice(0,5),
    questions: keywords.slice(0,3).map(k=>`¿Cómo se relaciona "${k}" con el objetivo principal?`)
  };
}

async function convertOfficeToPdf(inputPath, outputDir) {
  const result = spawnSync('libreoffice', ['--headless', '--convert-to', 'pdf', '--outdir', outputDir, inputPath], { encoding: 'utf8', timeout: 120000 });
  if (result.error || result.status !== 0) throw new Error(result.stderr || result.stdout || 'No se pudo convertir el archivo');
  const pdf = path.join(outputDir, `${path.basename(inputPath, path.extname(inputPath))}.pdf`);
  if (!fs.existsSync(pdf)) throw new Error('LibreOffice no generó el PDF');
  return pdf;
}

async function renderPdfPages(pdfPath, outputDir, prefix) {
  const targetPrefix = path.join(outputDir, prefix);
  const result = spawnSync('pdftoppm', ['-png', '-r', '125', pdfPath, targetPrefix], { encoding: 'utf8', timeout: 120000 });
  if (result.error || result.status !== 0) throw new Error(result.stderr || result.stdout || 'No se pudieron renderizar las páginas');
  return (await fsp.readdir(outputDir)).filter(name => name.startsWith(`${prefix}-`) && name.endsWith('.png')).sort((a,b) => a.localeCompare(b, undefined, { numeric: true }));
}

function requestUrl(req) {
  return new URL(req.url, `http://${req.headers.host || 'localhost'}`);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = requestUrl(req);
    const pathname = decodeURIComponent(url.pathname);
    const user = authSystem.getUserFromRequest(req);

    if (pathname === '/health' || pathname === '/healthz') return json(res, 200, { ok: true, version: UCAN_VERSION, build: UCAN_BUILD });
    if (pathname === '/version') return json(res, 200, { version: UCAN_VERSION, build: UCAN_BUILD, script: UCAN_MAIN_SCRIPT });

    if (pathname.startsWith('/api/auth/')) return authSystem.handle(req, res, pathname, readJson, json);

    if (pathname === '/api/catalog' && req.method === 'GET') return json(res, 200, readJsonFile(CATALOG_FILE, { events: [], announcements: [] }));
    if (pathname === '/api/catalog' && req.method === 'POST') {
      if (!adminAuthorized(req, user)) return json(res, 403, { error: 'Acceso administrativo requerido' });
      const body = await readJson(req);
      writeJsonFile(CATALOG_FILE, { events: Array.isArray(body.events) ? body.events : [], announcements: Array.isArray(body.announcements) ? body.announcements : [] });
      return json(res, 200, { ok: true });
    }

    if (pathname === '/api/collaboration' && req.method === 'GET') return json(res, 200, readJsonFile(COLLAB_FILE, { rooms: {} }));
    if (pathname === '/api/collaboration' && req.method === 'POST') {
      if (!user) return json(res, 401, { error: 'Inicie sesión' });
      const body = await readJson(req);
      const state = readJsonFile(COLLAB_FILE, { rooms: {} });
      const room = String(body.room || 'general').slice(0,60);
      state.rooms[room] = { ...(state.rooms[room] || {}), ...body.data, updatedAt: new Date().toISOString(), updatedBy: user.username };
      writeJsonFile(COLLAB_FILE, state);
      return json(res, 200, { ok: true, room: state.rooms[room] });
    }

    if (pathname === '/api/upload' && req.method === 'POST') {
      if (!user) return json(res, 401, { error: 'Inicie sesión' });
      const filename = sanitizeFilename(url.searchParams.get('filename') || req.headers['x-filename'] || 'archivo');
      const buffer = await readBody(req);
      const id = `${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
      const dir = path.join(UPLOAD_DIR, id);
      fs.mkdirSync(dir, { recursive: true });
      const filePath = path.join(dir, filename);
      fs.writeFileSync(filePath, buffer);
      let extracted = '';
      if (/^text\//.test(req.headers['content-type'] || '') || /\.(txt|md|csv|json|html)$/i.test(filename)) extracted = buffer.toString('utf8');
      else extracted = extractTextFromOffice(filePath);
      return json(res, 200, { id, filename, size: buffer.length, url: `/generated/uploads/${id}/${encodeURIComponent(filename)}`, analysis: summarizeText(extracted) });
    }

    if (pathname === '/api/render-pptx' && req.method === 'POST') {
      if (!user) return json(res, 401, { error: 'Inicie sesión' });
      const filename = sanitizeFilename(url.searchParams.get('filename') || 'presentacion.pptx');
      const buffer = await readBody(req);
      const job = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const dir = path.join(GENERATED_DIR, job);
      fs.mkdirSync(dir, { recursive: true });
      const input = path.join(dir, filename);
      fs.writeFileSync(input, buffer);
      const pdfPath = await convertOfficeToPdf(input, dir);
      const pages = await renderPdfPages(pdfPath, dir, 'slide');
      return json(res, 200, { job, pages: pages.map(name => `/generated/${job}/${name}`), pdf: `/generated/${job}/${path.basename(pdfPath)}` });
    }

    if (pathname === '/api/astronomy/comets' && req.method === 'GET') {
      const query = 'https://ssd-api.jpl.nasa.gov/cad.api?dist-max=0.35&date-min=now&date-max=%2B365&sort=date';
      const response = await fetch(query, { headers: { 'User-Agent': 'UCAN-Academic-Mall/1.0' } });
      if (!response.ok) throw new Error(`JPL respondió ${response.status}`);
      return json(res, 200, await response.json());
    }

    if (pathname.startsWith('/generated/')) {
      const relative = pathname.replace(/^\/generated\//, '');
      const file = safeJoin(GENERATED_DIR, relative);
      if (!file) return text(res, 403, 'Ruta inválida');
      return serveFile(res, file, req);
    }

    if (pathname === '/' || pathname === '/login') return serveFile(res, path.join(PUBLIC_DIR, 'login.html'), req);
    if (pathname === '/register') return serveFile(res, path.join(PUBLIC_DIR, 'login.html'), req);
    if (pathname === '/campus') {
      if (!user) return res.writeHead(302, { Location: '/login' }).end();
      return serveFile(res, path.join(PUBLIC_DIR, 'campus.html'), req);
    }
    if (pathname === '/admin') {
      if (!user) return res.writeHead(302, { Location: '/login' }).end();
      if (user.role !== 'admin') return text(res, 403, 'Acceso administrativo requerido');
      return serveFile(res, path.join(PUBLIC_DIR, 'admin.html'), req);
    }

    const relative = pathname.replace(/^\//, '');
    const file = safeJoin(PUBLIC_DIR, relative);
    if (!file) return text(res, 403, 'Ruta inválida');
    return serveFile(res, file, req);
  } catch (error) {
    console.error(error);
    json(res, error.statusCode || 500, { error: error.message || 'Error interno' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`UCAN Academic Mall ${UCAN_VERSION} escuchando en http://0.0.0.0:${PORT}`);
});
