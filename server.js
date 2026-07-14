const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { createAuthSystem } = require('./lib/auth');

const PORT = Number(process.env.PORT || 3000);
const UCAN_VERSION = 'V265';
const UCAN_BUILD = String(process.env.UCAN_BUILD || 'V265-20260714-USERS-AVATARS');
const UCAN_MAIN_SCRIPT = '/js/ucan_babylon_mall_v265_accounts_avatars.js?build=V265-20260714-USERS-AVATARS';
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
const VALID_ROOMS = new Set(['SV-201','SV-202','SV-203','SV-204','SV-205','ANF-301']);
const COLLAB_SPACES = new Set([...VALID_ROOMS, 'CAFETERIA', 'BIBLIOTECA']);
const VOICE_ROOM_LIMIT = Math.max(2, Math.min(30, Number(process.env.VOICE_ROOM_LIMIT || 12)));
const VOICE_STUN_URL = String(process.env.VOICE_STUN_URL || 'stun:stun.cloudflare.com:3478').trim();
const VOICE_TURN_URL = String(process.env.VOICE_TURN_URL || '').trim();
const VOICE_TURN_USERNAME = String(process.env.VOICE_TURN_USERNAME || '').trim();
const VOICE_TURN_CREDENTIAL = String(process.env.VOICE_TURN_CREDENTIAL || '').trim();
const VOICE_CLIENTS = new Map();

for (const dir of [GENERATED_DIR, DATA_DIR, UPLOAD_DIR]) fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(CATALOG_FILE)) fs.writeFileSync(CATALOG_FILE, JSON.stringify({ version:1, assets:[] }, null, 2));
if (!fs.existsSync(COLLAB_FILE)) fs.writeFileSync(COLLAB_FILE, JSON.stringify({ version:1, spaces:{} }, null, 2));

const authSystem = createAuthSystem({
  dataDir: DATA_DIR,
  registrationEnabled: REGISTRATION_ENABLED,
  initialAdminUsername: ADMIN_INITIAL_USERNAME,
  initialAdminPassword: ADMIN_INITIAL_PASSWORD,
  initialAdminEmail: ADMIN_INITIAL_EMAIL,
  initialAdminDisplayName: 'Administrador UCAN'
});

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
  '.webm': 'video/webm', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.pdf': 'application/pdf',
  '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.pps': 'application/vnd.ms-powerpoint', '.ppsx': 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8', '.csv': 'text/csv; charset=utf-8'
};

function commandAvailable(command) {
  const result = spawnSync('sh', ['-lc', `command -v ${command}`], { encoding: 'utf-8' });
  return result.status === 0;
}

function readCatalog() {
  try {
    const parsed = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'));
    if (!Array.isArray(parsed.assets)) parsed.assets = [];
    return parsed;
  } catch (err) {
    console.error('No se pudo leer catalog.json:', err);
    return { version:1, assets:[] };
  }
}

async function writeCatalog(catalog) {
  const tmp = `${CATALOG_FILE}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(catalog, null, 2));
  await fsp.rename(tmp, CATALOG_FILE);
}


function readCollaboration() {
  try {
    const parsed = JSON.parse(fs.readFileSync(COLLAB_FILE, 'utf8'));
    if (!parsed.spaces || typeof parsed.spaces !== 'object') parsed.spaces = {};
    return parsed;
  } catch (err) {
    console.error('No se pudo leer collaboration.json:', err);
    return { version:1, spaces:{} };
  }
}

let collabWriteChain = Promise.resolve();
function writeCollaboration(data) {
  collabWriteChain = collabWriteChain.then(async () => {
    const tmp = `${COLLAB_FILE}.tmp`;
    await fsp.writeFile(tmp, JSON.stringify(data, null, 2));
    await fsp.rename(tmp, COLLAB_FILE);
  });
  return collabWriteChain;
}

function cleanText(value, max = 500) {
  return String(value || '').replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function collabId(prefix = 'item') {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
}

function ensureSpaceState(data, space) {
  if (!data.spaces[space] || typeof data.spaces[space] !== 'object') data.spaces[space] = {};
  return data.spaces[space];
}

function trimList(list, max) {
  if (Array.isArray(list) && list.length > max) list.splice(0, list.length - max);
}

function applyCollabAction(space, action, payload, actor) {
  const data = readCollaboration();
  const state = ensureSpaceState(data, space);
  const now = new Date().toISOString();
  const who = cleanText(actor || 'Participante', 40) || 'Participante';

  if (action === 'set-poll' && space === 'SV-201') {
    const question = cleanText(payload.question, 300);
    const options = (Array.isArray(payload.options) ? payload.options : []).map(v => cleanText(v, 120)).filter(Boolean).slice(0,5);
    if (!question || options.length < 2) throw new Error('La encuesta requiere una pregunta y al menos dos opciones.');
    state.poll = { question, options:options.map(text => ({ text, votes:0 })), voters:{}, createdAt:now, actor:who };
  } else if (action === 'vote' && space === 'SV-201') {
    if (!state.poll || !Array.isArray(state.poll.options)) throw new Error('No hay encuesta activa.');
    const index = Number(payload.index);
    if (!Number.isInteger(index) || !state.poll.options[index]) throw new Error('Opción de encuesta no válida.');
    state.poll.voters ||= {};
    const previous = state.poll.voters[who];
    if (Number.isInteger(previous) && state.poll.options[previous]) state.poll.options[previous].votes = Math.max(0, Number(state.poll.options[previous].votes || 0) - 1);
    state.poll.voters[who] = index;
    state.poll.options[index].votes = Number(state.poll.options[index].votes || 0) + 1;
  } else if (action === 'set-scenario' && space === 'SV-202') {
    const prompt = cleanText(payload.prompt, 1000); if (!prompt) throw new Error('Escriba el escenario.'); state.prompt = prompt; state.updatedAt = now;
  } else if (action === 'add-decision' && space === 'SV-202') {
    const value = cleanText(payload.text, 1000); if (!value) throw new Error('Escriba una decisión.');
    state.decisions ||= []; state.decisions.push({ id:collabId('decision'), text:value, actor:who, createdAt:now }); trimList(state.decisions,60);
  } else if (action === 'add-card' && space === 'SV-203') {
    const title=cleanText(payload.title,180); const column=['ideas','progress','done'].includes(payload.column)?payload.column:'ideas';
    if(!title) throw new Error('Escriba el título de la tarjeta.'); state.cards ||= []; state.cards.push({id:collabId('card'),title,column,actor:who,createdAt:now}); trimList(state.cards,90);
  } else if (action === 'move-card' && space === 'SV-203') {
    const card=(state.cards||[]).find(c=>c.id===payload.id); if(!card) throw new Error('Tarjeta no encontrada.');
    if(!['ideas','progress','done'].includes(payload.column)) throw new Error('Columna no válida.'); card.column=payload.column; card.updatedAt=now;
  } else if (action === 'add-evidence' && space === 'SV-205') {
    const title=cleanText(payload.title,240); if(!title) throw new Error('Escriba el título de la evidencia.');
    state.evidence ||= []; state.evidence.push({id:collabId('evidence'),title,tag:cleanText(payload.tag,60),source:cleanText(payload.source,500),note:cleanText(payload.note,1200),actor:who,createdAt:now}); trimList(state.evidence,80);
  } else if (action === 'add-question' && space === 'ANF-301') {
    const value=cleanText(payload.text,600); if(!value) throw new Error('Escriba una pregunta.');
    state.questions ||= []; state.questions.push({id:collabId('question'),text:value,actor:who,votes:0,voters:{},createdAt:now}); trimList(state.questions,100);
  } else if (action === 'upvote-question' && space === 'ANF-301') {
    const item=(state.questions||[]).find(q=>q.id===payload.id); if(!item) throw new Error('Pregunta no encontrada.');
    item.voters ||= {}; if(!item.voters[who]){item.voters[who]=true;item.votes=Number(item.votes||0)+1;}
  } else if (action === 'reaction' && space === 'ANF-301') {
    const kind=['applause','idea','question'].includes(payload.kind)?payload.kind:''; if(!kind) throw new Error('Reacción no válida.');
    state.reactions ||= {applause:0,idea:0,question:0}; state.reactions[kind]=Number(state.reactions[kind]||0)+1;
  } else if (action === 'join-speaker' && space === 'ANF-301') {
    state.speakers ||= []; if(!state.speakers.some(s=>s.actor===who)) state.speakers.push({id:collabId('speaker'),actor:who,createdAt:now}); trimList(state.speakers,30);
  } else if (action === 'cafe-order' && space === 'CAFETERIA') {
    const items=(Array.isArray(payload.items)?payload.items:[]).slice(0,20).map(item=>({id:cleanText(item.id,30),name:cleanText(item.name,100),price:Number(item.price||0)})).filter(i=>i.name);
    if(!items.length) throw new Error('El pedido está vacío.'); state.orders ||= []; state.orderCounter=Number(state.orderCounter||0)+1;
    const number=`C${String(state.orderCounter).padStart(3,'0')}`; state.orders.push({id:collabId('order'),number,items,actor:who,total:items.reduce((s,i)=>s+i.price,0),createdAt:now}); trimList(state.orders,30);
  } else if (action === 'reserve-seat' && space === 'BIBLIOTECA') {
    const seat=cleanText(payload.seat,100); const duration=Math.max(30,Math.min(120,Number(payload.duration||30))); if(!seat) throw new Error('Seleccione un espacio.');
    state.reservations ||= []; state.reservations.push({id:collabId('reservation'),seat,duration,actor:who,createdAt:now}); trimList(state.reservations,40);
  } else {
    throw new Error('La acción no es válida para este espacio.');
  }
  state.lastUpdated = now;
  data.spaces[space] = state;
  return { data, state };
}

const ASTRONOMY_CACHE = new Map();

async function fetchJsonWithTimeout(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal:controller.signal, headers:{ 'User-Agent':'UCAN-Academic-Mall/257' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getCometCalendar(year) {
  const cacheKey = `comets-${year}`;
  const cached = ASTRONOMY_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.time < 6 * 60 * 60 * 1000) return cached.value;
  const endpoint = `https://ssd-api.jpl.nasa.gov/cad.api?date-min=${year}-01-01&date-max=${year}-12-31&dist-max=2&kind=c&body=Earth&fullname=true&limit=24&neo=false`;
  const payload = await fetchJsonWithTimeout(endpoint);
  const fields = Array.isArray(payload.fields) ? payload.fields : [];
  const index = Object.fromEntries(fields.map((field, i) => [field, i]));
  const events = (Array.isArray(payload.data) ? payload.data : []).map(row => ({
    designation:String(row[index.des] || '').trim(),
    name:String(row[index.fullname] || row[index.des] || 'Cometa').trim(),
    date:String(row[index.cd] || ''),
    distanceAu:Number(row[index.dist] || 0),
    relativeVelocityKms:Number(row[index.v_rel] || 0)
  })).filter(item => item.date);
  const value = { ok:true, year, source:'NASA/JPL SBDB Close Approach Data API', signature:payload.signature || null, events };
  ASTRONOMY_CACHE.set(cacheKey, { time:Date.now(), value });
  return value;
}

function diagnostics() {
  const requiredFiles = [
    'public/campus.html', 'public/login.html', 'public/admin.html', 'public/js/ucan_babylon_mall_v265_accounts_avatars.js', 'public/js/ucan_avatar_shared.js', 'public/js/ucan_v265_identity.js', 'lib/auth.js', 'public/js/ucan_v240_features.js', 'public/js/ucan_v240_voice.js', 'public/js/ucan_v240_experiences.js',
    'public/vendor/babylon.js', 'public/vendor/babylonjs.loaders.min.js', 'public/vendor/jszip.min.js',
    'public/assets/logos/inter_san_german.png', 'public/assets/logos/ucan_ppoha.png', 'public/assets/logos/inter_san_german_v252.png', 'public/assets/logos/ucan_ppoha_v252.png',
    'data/catalog.json', 'data/collaboration.json', 'data/users.json'
  ];
  const files = Object.fromEntries(requiredFiles.map(rel => [rel, fs.existsSync(path.join(__dirname, rel))]));
  const catalog = readCatalog();
  return {
    ok: Object.values(files).every(Boolean), version: 'v265-users-avatars', build: UCAN_BUILD, mainScript: UCAN_MAIN_SCRIPT, files,
    libreOffice: commandAvailable('libreoffice'), pdfToPpm: commandAvailable('pdftoppm'),
    persistentAssets: catalog.assets.length, dataDirectory: DATA_DIR,
    collaboration: { enabled:true, spaces:[...COLLAB_SPACES], persistent:true },
    environment: { forceReload:true, cacheDisabled:true, rooftop:true, rooftopLevel:27.2, dayNightCycle:true, seasons:['spring','summer','autumn','winter'], scenicLandscape:true, additionalLandscapes:true, rooftopAudio:false, raisedTheaterCeiling:true, interiorLightsAlwaysOn:true, defaultInsideBuilding:true, opaqueFloorSeparation:true, obsoleteFloorOpeningsRemoved:true, rooftopStairs:true, rooftopStairAccess:'bidirectional', accessibilityControls:true, automaticQuality:true, architecturalAudit:true, wayfindingDirectories:true, interactiveAstronomyPanels:true, enlargedPanelViewer:true, astronomyPanelClearanceAudit:true, userAccounts:true, administratorRole:true, customizableAvatars:true, multiplayerPresence:true },
    accounts: authSystem.stats(),
    voice: { enabled:true, isolatedByRoom:true, locationAwareClient:true, activeParticipants:VOICE_CLIENTS.size, rooms:voiceRoomCounts(), roomLimit:VOICE_ROOM_LIMIT, stunConfigured:Boolean(VOICE_STUN_URL), turnConfigured:Boolean(VOICE_TURN_URL) },
    node: process.version
  };
}

function send(res, status, body, type = 'text/plain; charset=utf-8', headers = {}) {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}
function sendJson(res, status, value, headers = {}) { send(res, status, JSON.stringify(value), MIME['.json'], headers); }
function redirect(res, location, status = 302) { res.writeHead(status, { Location:location, 'Cache-Control':'no-store' }); res.end(); }

function safeJoin(base, target) {
  const decoded = decodeURIComponent(target.split('?')[0]);
  const clean = decoded === '/' ? '/campus.html' : decoded;
  const filePath = path.normalize(path.join(base, clean));
  if (!filePath.startsWith(base)) return null;
  return filePath;
}

function sanitizeFilename(name = 'archivo') {
  const base = path.basename(name).normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 160);
  return base || 'archivo';
}

function collectBody(req, maxBytes = 100 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let total = 0; let failed = false;
    req.on('data', chunk => {
      if (failed) return;
      total += chunk.length;
      if (total > maxBytes) { failed = true; reject(new Error('El archivo excede el máximo permitido de 100 MB.')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!failed) resolve(Buffer.concat(chunks)); });
    req.on('error', reject);
  });
}

function requireAdmin(req, res) {
  const sessionUser = authSystem.getSessionUser(req);
  if (sessionUser?.role === 'admin') return sessionUser;
  const provided = String(req.headers['x-admin-pin'] || '');
  if (LEGACY_ADMIN_PIN_ENABLED && ADMIN_PIN && provided && provided === ADMIN_PIN) return { id:'legacy-pin', username:'admin-pin', role:'admin' };
  sendJson(res, 403, { error:'Se requiere una cuenta de administrador.' });
  return false;
}

async function renderPptx(buffer, originalName) {
  const renderId = `pptx_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const renderDir = path.join(GENERATED_DIR, renderId);
  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'ucan-pptx-'));
  await fsp.mkdir(renderDir, { recursive: true });
  try {
    const fileName = sanitizeFilename(originalName);
    const inputPath = path.join(workDir, fileName);
    await fsp.writeFile(inputPath, buffer);
    const libre = spawnSync('libreoffice', ['--headless','--convert-to','pdf','--outdir',workDir,inputPath], { encoding:'utf-8', timeout:120000 });
    if (libre.error) throw new Error(`No se pudo ejecutar LibreOffice: ${libre.error.message}`);
    if (libre.status !== 0) throw new Error(`LibreOffice no pudo convertir el archivo. ${libre.stderr || libre.stdout || ''}`.trim());
    const pdfName = `${path.parse(fileName).name}.pdf`;
    const pdfPath = path.join(workDir, pdfName);
    if (!fs.existsSync(pdfPath)) throw new Error('La conversión no generó el PDF esperado.');
    await fsp.copyFile(pdfPath, path.join(renderDir, pdfName));
    const prefix = path.join(renderDir, 'slide');
    const poppler = spawnSync('pdftoppm', ['-png','-r','120',pdfPath,prefix], { encoding:'utf-8', timeout:120000 });
    if (poppler.error || poppler.status !== 0) throw new Error(`No se pudieron generar miniaturas. ${poppler.stderr || poppler.stdout || poppler.error?.message || ''}`.trim());
    const slideFiles = (await fsp.readdir(renderDir)).filter(n=>/^slide-\d+\.png$/i.test(n)).sort((a,b)=>Number(a.match(/\d+/)?.[0]||0)-Number(b.match(/\d+/)?.[0]||0));
    return { ok:true, renderId, pages:slideFiles.map(n=>`/generated/${renderId}/${n}`), pdf:`/generated/${renderId}/${pdfName}` };
  } finally {
    await fsp.rm(workDir, { recursive:true, force:true });
  }
}

async function serveFile(res, filePath) {
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile()) return send(res,404,'Archivo no encontrado');
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length':stat.size, 'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0', 'Pragma':'no-cache', 'Expires':'0', 'X-UCAN-Version':UCAN_VERSION, 'X-UCAN-Build':UCAN_BUILD });
    fs.createReadStream(filePath).pipe(res);
  } catch { send(res,404,'Archivo no encontrado'); }
}

function publicAsset(asset) {
  return {
    id:asset.id, name:asset.name, room:asset.room, type:asset.type, size:asset.size, createdAt:asset.createdAt,
    fileUrl:`/api/assets/${asset.id}/file`, render:asset.render || null
  };
}

function cleanVoiceId(value) {
  const id = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{8,80}$/.test(id) ? id : '';
}

function cleanVoiceName(value) {
  return String(value || 'Participante').replace(/[<>\r\n]/g, '').trim().slice(0, 40) || 'Participante';
}

async function readJsonBody(req, maxBytes = 96 * 1024) {
  const buffer = await collectBody(req, maxBytes);
  if (!buffer.length) return {};
  try { return JSON.parse(buffer.toString('utf8')); }
  catch { throw new Error('Solicitud JSON inválida.'); }
}

function voiceParticipant(client) {
  return { id:client.id, name:client.name, room:client.room };
}

function voiceRoomMembers(room, exceptId = '') {
  return [...VOICE_CLIENTS.values()].filter(c => c.room === room && c.id !== exceptId).map(voiceParticipant);
}

function voiceRoomCounts() {
  const rooms = Object.fromEntries([...VALID_ROOMS].map(room => [room, 0]));
  for (const client of VOICE_CLIENTS.values()) if (rooms[client.room] !== undefined) rooms[client.room] += 1;
  return rooms;
}

function writeVoiceEvent(client, type, payload = {}) {
  const packet = { type, ...payload };
  const serialized = `data: ${JSON.stringify(packet)}\n\n`;
  if (client.response && !client.response.destroyed && !client.response.writableEnded) {
    try { client.response.write(serialized); return; } catch { client.response = null; }
  }
  client.queue.push(serialized);
  if (client.queue.length > 100) client.queue.splice(0, client.queue.length - 100);
}

function broadcastVoice(room, type, payload = {}, exceptId = '') {
  for (const client of VOICE_CLIENTS.values()) {
    if (client.room === room && client.id !== exceptId) writeVoiceEvent(client, type, payload);
  }
}

function removeVoiceClient(clientId, reason = 'left') {
  const client = VOICE_CLIENTS.get(clientId);
  if (!client) return false;
  VOICE_CLIENTS.delete(clientId);
  try { if (client.response && !client.response.writableEnded) client.response.end(); } catch {}
  broadcastVoice(client.room, 'peer-left', { peerId:client.id, name:client.name, reason }, client.id);
  return true;
}

function voiceIceServers() {
  const servers = [];
  if (VOICE_STUN_URL) servers.push({ urls:VOICE_STUN_URL });
  if (VOICE_TURN_URL && VOICE_TURN_USERNAME && VOICE_TURN_CREDENTIAL) {
    servers.push({ urls:VOICE_TURN_URL, username:VOICE_TURN_USERNAME, credential:VOICE_TURN_CREDENTIAL });
  }
  return servers;
}

const voiceMaintenance = setInterval(() => {
  const now = Date.now();
  for (const [id, client] of VOICE_CLIENTS) {
    if (now - client.lastSeen > 70000) { removeVoiceClient(id, 'timeout'); continue; }
    if (client.response && !client.response.destroyed && !client.response.writableEnded) {
      try { client.response.write(': keepalive\n\n'); } catch { client.response = null; }
    }
  }
}, 15000);
voiceMaintenance.unref?.();

const server = http.createServer(async (req, res) => {
  try {
    const url = req.url || '/';
    const parsed = new URL(url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsed.pathname;

    const authResult = await authSystem.handleApi(pathname, req, res, parsed, { readJsonBody, sendJson });
    if (authResult !== false) return;

    if (pathname === '/api/astronomy/comets' && req.method === 'GET') {
      const requestedYear = Number(parsed.searchParams.get('year') || new Date().getUTCFullYear());
      const year = Math.max(2024, Math.min(2035, Number.isInteger(requestedYear) ? requestedYear : new Date().getUTCFullYear()));
      try {
        return sendJson(res, 200, await getCometCalendar(year));
      } catch (error) {
        console.warn('No se pudo consultar JPL SBDB:', error.message);
        return sendJson(res, 200, { ok:false, year, source:'NASA/JPL SBDB Close Approach Data API', events:[], error:'Servicio de cometas temporalmente no disponible.' });
      }
    }

    if (pathname === '/api/collab' && req.method === 'GET') {
      const account = authSystem.requireAuth(req, res, sendJson); if (!account) return;
      const space = String(parsed.searchParams.get('space') || '');
      if (!COLLAB_SPACES.has(space)) return sendJson(res, 400, { error:'Espacio colaborativo no válido.' });
      const data = readCollaboration();
      return sendJson(res, 200, { space, state:data.spaces[space] || {}, updatedAt:data.spaces[space]?.lastUpdated || null });
    }

    if (pathname === '/api/collab/action' && req.method === 'POST') {
      const account = authSystem.requireAuth(req, res, sendJson); if (!account) return;
      const body = await readJsonBody(req, 64 * 1024);
      const space = String(body.space || '');
      if (!COLLAB_SPACES.has(space)) return sendJson(res, 400, { error:'Espacio colaborativo no válido.' });
      const result = applyCollabAction(space, String(body.action || ''), body.payload || {}, account.displayName || account.username);
      await writeCollaboration(result.data);
      return sendJson(res, 200, { ok:true, space, state:result.state });
    }

    if (pathname === '/api/collab/clear' && req.method === 'POST') {
      if (!requireAdmin(req,res)) return;
      const body = await readJsonBody(req, 8192); const space=String(body.space||'');
      if (!COLLAB_SPACES.has(space)) return sendJson(res,400,{error:'Espacio colaborativo no válido.'});
      const data=readCollaboration(); data.spaces[space]={ lastUpdated:new Date().toISOString() }; await writeCollaboration(data);
      return sendJson(res,200,{ok:true,space,state:data.spaces[space]});
    }

    if (pathname === '/api/voice/config' && req.method === 'GET') {
      const account = authSystem.requireAuth(req, res, sendJson); if (!account) return;
      return sendJson(res, 200, { iceServers:voiceIceServers(), roomLimit:VOICE_ROOM_LIMIT, rooms:[...VALID_ROOMS], displayName:account.displayName });
    }

    if (pathname === '/api/voice/rooms' && req.method === 'GET') {
      const account = authSystem.requireAuth(req, res, sendJson); if (!account) return;
      return sendJson(res, 200, { rooms:voiceRoomCounts(), roomLimit:VOICE_ROOM_LIMIT, total:VOICE_CLIENTS.size });
    }

    if (pathname === '/api/voice/join' && req.method === 'POST') {
      const account = authSystem.requireAuth(req, res, sendJson); if (!account) return;
      const body = await readJsonBody(req);
      const clientId = cleanVoiceId(body.clientId);
      const room = String(body.room || '');
      const name = cleanVoiceName(account.displayName || account.username);
      if (!clientId) return sendJson(res, 400, { error:'Identificador de audio inválido.' });
      if (!VALID_ROOMS.has(room)) return sendJson(res, 400, { error:'Sala de audio no válida.' });
      const members = voiceRoomMembers(room, clientId);
      if (!VOICE_CLIENTS.has(clientId) && members.length >= VOICE_ROOM_LIMIT) return sendJson(res, 409, { error:`La sala alcanzó el máximo de ${VOICE_ROOM_LIMIT} participantes.` });
      const prior = VOICE_CLIENTS.get(clientId);
      if (prior && prior.room !== room) removeVoiceClient(clientId, 'changed-room');
      const client = VOICE_CLIENTS.get(clientId) || { id:clientId, queue:[], response:null, signalCount:0, signalWindow:Date.now() };
      client.name = name; client.room = room; client.lastSeen = Date.now();
      VOICE_CLIENTS.set(clientId, client);
      broadcastVoice(room, 'peer-joined', { peer:voiceParticipant(client) }, clientId);
      return sendJson(res, 200, { ok:true, self:voiceParticipant(client), participants:voiceRoomMembers(room, clientId), roomCount:voiceRoomMembers(room).length, roomLimit:VOICE_ROOM_LIMIT });
    }

    if (pathname === '/api/voice/events' && req.method === 'GET') {
      const account = authSystem.requireAuth(req, res, sendJson); if (!account) return;
      const clientId = cleanVoiceId(parsed.searchParams.get('clientId'));
      const client = VOICE_CLIENTS.get(clientId);
      if (!client) return sendJson(res, 404, { error:'Primero debe entrar a una sala de audio.' });
      client.lastSeen = Date.now();
      res.writeHead(200, { 'Content-Type':'text/event-stream; charset=utf-8', 'Cache-Control':'no-cache, no-transform', 'Connection':'keep-alive', 'X-Accel-Buffering':'no' });
      res.write(`data: ${JSON.stringify({ type:'connected', room:client.room, participants:voiceRoomMembers(client.room, client.id) })}\n\n`);
      client.response = res;
      for (const queued of client.queue.splice(0)) res.write(queued);
      req.on('close', () => { if (client.response === res) client.response = null; });
      return;
    }

    if (pathname === '/api/voice/signal' && req.method === 'POST') {
      const account = authSystem.requireAuth(req, res, sendJson); if (!account) return;
      const body = await readJsonBody(req);
      const from = cleanVoiceId(body.from); const to = cleanVoiceId(body.to);
      const sender = VOICE_CLIENTS.get(from); const recipient = VOICE_CLIENTS.get(to);
      if (!sender || !recipient || sender.room !== recipient.room) return sendJson(res, 404, { error:'Los participantes no están disponibles en la misma sala.' });
      const now = Date.now();
      if (now - sender.signalWindow > 60000) { sender.signalWindow = now; sender.signalCount = 0; }
      sender.signalCount += 1;
      if (sender.signalCount > 400) return sendJson(res, 429, { error:'Demasiados mensajes de señalización.' });
      sender.lastSeen = now;
      writeVoiceEvent(recipient, 'signal', { from:sender.id, name:sender.name, data:body.data });
      return sendJson(res, 202, { ok:true });
    }

    if (pathname === '/api/voice/heartbeat' && req.method === 'POST') {
      const account = authSystem.requireAuth(req, res, sendJson); if (!account) return;
      const body = await readJsonBody(req, 8192);
      const client = VOICE_CLIENTS.get(cleanVoiceId(body.clientId));
      if (!client) return sendJson(res, 404, { error:'Participante no encontrado.' });
      client.lastSeen = Date.now();
      return sendJson(res, 200, { ok:true });
    }

    if (pathname === '/api/voice/leave' && req.method === 'POST') {
      const account = authSystem.requireAuth(req, res, sendJson); if (!account) return;
      const body = await readJsonBody(req, 8192);
      removeVoiceClient(cleanVoiceId(body.clientId), 'left');
      return sendJson(res, 200, { ok:true });
    }

    if (req.method === 'POST' && pathname === '/api/render-pptx') {
      const account = authSystem.requireAuth(req, res, sendJson); if (!account) return;
      const filename = parsed.searchParams.get('filename') || 'presentacion.pptx';
      const result = await renderPptx(await collectBody(req), filename);
      return sendJson(res,200,result);
    }

    if (pathname === '/api/assets' && req.method === 'GET') {
      const account = authSystem.requireAuth(req, res, sendJson); if (!account) return;
      const room = parsed.searchParams.get('room');
      let assets = readCatalog().assets.slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
      if (room) assets = assets.filter(a=>a.room===room);
      return sendJson(res,200,{ assets:assets.map(publicAsset) });
    }

    if (pathname === '/api/assets' && req.method === 'POST') {
      if (!requireAdmin(req,res)) return;
      const room = parsed.searchParams.get('room') || '';
      const originalName = parsed.searchParams.get('filename') || 'archivo';
      if (!VALID_ROOMS.has(room)) return sendJson(res,400,{error:'Sala no válida.'});
      const buffer = await collectBody(req);
      if (!buffer.length) return sendJson(res,400,{error:'El archivo está vacío.'});
      const id = `${Date.now().toString(36)}_${crypto.randomBytes(5).toString('hex')}`;
      const safeName = sanitizeFilename(originalName);
      const storedName = `${id}__${safeName}`;
      const filePath = path.join(UPLOAD_DIR, storedName);
      await fsp.writeFile(filePath, buffer);
      const ext = path.extname(safeName).toLowerCase();
      let render = null;
      if (['.ppt','.pptx','.pps','.ppsx','.pptm','.potx'].includes(ext)) {
        try { render = await renderPptx(buffer, safeName); }
        catch (err) { render = { error:err.message || String(err) }; }
      }
      const asset = { id, name:originalName, safeName, storedName, room, type:req.headers['content-type'] || MIME[ext] || 'application/octet-stream', size:buffer.length, createdAt:new Date().toISOString(), render };
      const catalog = readCatalog(); catalog.assets.push(asset); await writeCatalog(catalog);
      return sendJson(res,201,publicAsset(asset));
    }

    const assetMetaMatch = pathname.match(/^\/api\/assets\/([a-zA-Z0-9_]+)$/);
    if (assetMetaMatch && req.method === 'GET') {
      const account = authSystem.requireAuth(req, res, sendJson); if (!account) return;
      const asset = readCatalog().assets.find(a=>a.id===assetMetaMatch[1]);
      return asset ? sendJson(res,200,publicAsset(asset)) : sendJson(res,404,{error:'Archivo no encontrado.'});
    }
    if (assetMetaMatch && req.method === 'DELETE') {
      if (!requireAdmin(req,res)) return;
      const catalog = readCatalog(); const index = catalog.assets.findIndex(a=>a.id===assetMetaMatch[1]);
      if (index<0) return sendJson(res,404,{error:'Archivo no encontrado.'});
      const [asset] = catalog.assets.splice(index,1);
      await fsp.rm(path.join(UPLOAD_DIR,asset.storedName),{force:true});
      if (asset.render?.renderId) await fsp.rm(path.join(GENERATED_DIR,asset.render.renderId),{recursive:true,force:true});
      await writeCatalog(catalog);
      return sendJson(res,200,{ok:true,id:asset.id});
    }
    const assetFileMatch = pathname.match(/^\/api\/assets\/([a-zA-Z0-9_]+)\/file$/);
    if (assetFileMatch && req.method === 'GET') {
      const account = authSystem.requireAuth(req, res, sendJson); if (!account) return;
      const asset = readCatalog().assets.find(a=>a.id===assetFileMatch[1]);
      if (!asset) return sendJson(res,404,{error:'Archivo no encontrado.'});
      return serveFile(res,path.join(UPLOAD_DIR,asset.storedName));
    }

    if (pathname === '/version') {
      return sendJson(res, 200, {
        ok: true,
        version: UCAN_VERSION,
        build: UCAN_BUILD,
        mainScript: UCAN_MAIN_SCRIPT,
        expectedTitle: 'UCAN Academic Mall V265',
        cache: 'no-store'
      }, {
        'X-UCAN-Version': UCAN_VERSION,
        'X-UCAN-Build': UCAN_BUILD,
        'Pragma': 'no-cache',
        'Expires': '0'
      });
    }
    if (pathname === '/login' || pathname === '/login.html') {
      const user = authSystem.getSessionUser(req);
      if (user) return redirect(res, user.forcePasswordChange ? '/campus?password=change' : '/campus');
      return serveFile(res, path.join(PUBLIC_DIR, 'login.html'));
    }
    if (pathname === '/admin' || pathname === '/admin.html') {
      const user = authSystem.getSessionUser(req);
      if (!user) return redirect(res, '/login?next=admin');
      if (user.role !== 'admin') return redirect(res, '/campus?error=admin');
      return serveFile(res, path.join(PUBLIC_DIR, 'admin.html'));
    }
    if (pathname === '/' || pathname === '/campus' || pathname === '/campus.html') {
      const user = authSystem.getSessionUser(req);
      if (!user) return redirect(res, '/login');
      return serveFile(res,path.join(PUBLIC_DIR,'campus.html'));
    }
    if (pathname === '/health') { const d=diagnostics(); return sendJson(res,d.ok?200:500,{...d,mode:'node-docker-libreoffice'}); }
    if (pathname === '/diagnostics') { const d=diagnostics(); return send(res,d.ok?200:500,JSON.stringify(d,null,2),MIME['.json']); }

    if (pathname.startsWith('/generated/')) {
      const account = authSystem.requireAuth(req, res, sendJson); if (!account) return;
      const filePath=safeJoin(GENERATED_DIR,pathname.replace(/^\/generated/,''));
      return filePath ? serveFile(res,filePath) : send(res,403,'Acceso no permitido');
    }
    const filePath=safeJoin(PUBLIC_DIR,pathname);
    return filePath ? serveFile(res,filePath) : send(res,403,'Acceso no permitido');
  } catch (err) {
    console.error(err);
    sendJson(res,500,{error:err.message || 'Error interno del servidor'});
  }
});

server.listen(PORT,'0.0.0.0',()=>console.log(`UCAN Academic Mall ${UCAN_VERSION} (${UCAN_BUILD}) running on http://0.0.0.0:${PORT}`));
