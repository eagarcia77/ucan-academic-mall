'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const baseWriteHead = http.ServerResponse.prototype.writeHead;
const baseWrite = http.ServerResponse.prototype.write;
const baseEnd = http.ServerResponse.prototype.end;
const { installPersistentIdentity } = require('./lib/persistent-identity-v311');
const { createVoiceSystem, loadIceServersFromEnvironment } = require('./lib/voice-signaling');
const { VERSION:WORLD_VERSION, REVISION:WORLD_REVISION, API_PREFIX:WORLD_API, createRealtimeWorld } = require('./lib/realtime-world-v312');

const VERSION = 'V313';
const REVISION = 'R17';
const BUILD = 'V313-20260729-PARALLEL-ENVIRONMENTS-R17';
const LOADER_BUILD = 'V313-20260729-PARALLEL-LOADER-R17';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const IDENTITY_PATH = '/js/ucan_v265_identity.js';
const IDENTITY_FILE = path.join(__dirname, 'public', 'js', 'ucan_v265_identity.js');

const persistence = installPersistentIdentity({ dataDir:DATA_DIR });

// Solo se conserva la base de autenticación y el controlador XR general.
// No se cargan las cadenas V304/V306/V307/V308/V309/V310/V311/V312.
require('./auth-compat-v271.js');

const voiceSystem = createVoiceSystem({
  rooms:['SV-201','SV-202','SV-203','SV-204','SV-205','ANF-301'],
  roomLimit:Number(process.env.VOICE_ROOM_LIMIT || 12),
  iceServers:loadIceServersFromEnvironment()
});
const realtimeWorld = createRealtimeWorld();
global.__UCAN_VOICE_SYSTEM_V313__ = voiceSystem;
global.__UCAN_REALTIME_WORLD_V313_SERVER__ = realtimeWorld;

function sendJson(res, status, data) {
  if (res.headersSent || res.writableEnded) return;
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':Buffer.byteLength(body),
    'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma':'no-cache',
    'Expires':'0',
    'X-UCAN-Version':VERSION,
    'X-UCAN-Revision':REVISION
  });
  res.end(body);
}

async function readJson(req, limit = 256 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('Solicitud demasiado grande.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch (_) {
    const error = new Error('JSON inválido.');
    error.statusCode = 400;
    throw error;
  }
}

function sessionUser(req) {
  const auth = global.__UCAN_AUTH_SYSTEM_V283__;
  try { return auth?.getUserFromRequest?.(req) || auth?.getSessionUser?.(req) || null; }
  catch (_) { return null; }
}

function requestPath(response) {
  try { return new URL(response?.req?.url || '/', 'http://localhost').pathname; }
  catch (_) { return ''; }
}

function patchedIdentitySource() {
  let source = fs.readFileSync(IDENTITY_FILE, 'utf8');
  source = source.replace(
    'presenceLoop();setInterval(presenceLoop,2200);',
    "window.__UCAN_LEGACY_PRESENCE_DISABLED_V313__=true;console.info('[UCAN V313] La presencia heredada fue desactivada; el canal en tiempo real controla todos los entornos.');"
  );
  source = source.replace(
    "window.__UCAN_IDENTITY__={version:'V270',getUser:()=>state.user,getRemoteCount:()=>state.remote.size,openAvatarEditor:()=>openModal(false),toggleThirdPerson};",
    "window.__UCAN_IDENTITY__={version:'V313',getUser:()=>state.user,getRemoteCount:()=>window.__UCAN_REALTIME_WORLD_V312__?.getState?.().remoteAvatars||0,openAvatarEditor:()=>openModal(false),toggleThirdPerson,legacyPresenceDisabled:true,parallelEnvironments:true};"
  );
  return source;
}

function servePatchedIdentity(res) {
  const body = patchedIdentitySource();
  res.writeHead(200, {
    'Content-Type':'application/javascript; charset=utf-8',
    'Content-Length':Buffer.byteLength(body),
    'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma':'no-cache',
    'Expires':'0',
    'X-UCAN-Identity-Version':VERSION,
    'X-UCAN-Legacy-Presence':'disabled'
  });
  res.end(body);
}

function transformHtml(value) {
  let html = String(value || '');
  html = html.replace(
    /\/js\/ucan_v266_keyboard_jump\.js(?:\?build=[^"']+)?/g,
    `/js/ucan_v266_keyboard_jump.js?build=${LOADER_BUILD}`
  );
  html = html.replace(/\s*<script[^>]+ucan_v304_xr_entry_mr_fix\.js[^>]*><\/script>/gi, '');
  html = html.replace(/\s*<script[^>]+ucan_v309_strict_visual_parity\.js[^>]*><\/script>/gi, '');
  html = html.replace(/\s*<script[^>]+ucan_v310_visual_validation(?:_guard)?\.js[^>]*><\/script>/gi, '');
  html = html.replace(/\s*<script[^>]+ucan_v311_unified_world\.js[^>]*><\/script>/gi, '');
  html = html.replace(/UCAN Academic Mall V(?:272|283|309|311|312)/g, 'UCAN Academic Mall V313');
  html = html.replace(/COMPILACIÓN V(?:272|283|309|311|312)(?: · [^<]+)?(?: ACTIVA)?/g, 'COMPILACIÓN V313 · ENTORNOS EN PARALELO');
  html = html.replace(/V(?:272|283|309|311|312):[^<]*/g, 'V313: browser, móvil, VR y MR comparten una sola escena, interacción y presencia en tiempo real.');
  html = html.replace('</head>', `  <meta name="ucan-runtime" content="${BUILD}" />\n</head>`);
  return html;
}

function transformJson(value) {
  try {
    const data = JSON.parse(String(value || '{}'));
    if (!data || typeof data !== 'object') return value;
    const persistent = persistence.getStatus();
    const realtime = realtimeWorld.getStatus();
    return JSON.stringify({
      ...data,
      ok:data.ok !== false,
      version:VERSION,
      releaseVersion:VERSION,
      revision:REVISION,
      build:BUILD,
      loaderBuild:LOADER_BUILD,
      architecture:'single-canonical-scene-parallel-environments',
      authoritativeScene:'V313 parallel canonical scene',
      browserMobileVrMrSameScene:true,
      sameGeometryEveryEnvironment:true,
      sameMaterialsEveryEnvironment:true,
      sameVisibilityEveryEnvironment:true,
      sameFloor3StairsEveryEnvironment:true,
      sameInteractionPipelineEveryEnvironment:true,
      samePresenceChannelEveryEnvironment:true,
      cameraAndInputAdapterOnlyDifference:true,
      sceneModifiedOnXrEntry:false,
      mrHidesVirtualGeometry:false,
      legacyQuestVisualLayersLoaded:false,
      legacyPresenceV307Loaded:false,
      legacyWorldV308Loaded:false,
      strictParityV309Loaded:false,
      visualValidationV310Loaded:false,
      unifiedWorldV311Loaded:false,
      vrCanonicalV312Loaded:false,
      realtimeTransportVersion:WORLD_VERSION,
      realtimeTransportRevision:WORLD_REVISION,
      realtimeApi:WORLD_API,
      realtimeParticipants:realtime.participants,
      realtimeSubscribers:realtime.subscribers,
      sharedVoice:true,
      persistentAccounts:true,
      persistentAvatars:true,
      persistentDataDir:persistent.persistentMountPath,
      persistentDataWritable:persistent.writable === true,
      persistentUserRecordsValid:persistent.userRecordsValid === true,
      persistentUserBackups:Number(persistent.backups || 0)
    });
  } catch (_) {
    return value;
  }
}

http.ServerResponse.prototype.writeHead = function writeHeadV313(statusCode, statusMessage, headers) {
  let message = statusMessage;
  let nextHeaders = headers;
  if (statusMessage && typeof statusMessage === 'object') {
    nextHeaders = statusMessage;
    message = undefined;
  }
  const contentType = String(
    (nextHeaders && Object.entries(nextHeaders).find(([key]) => key.toLowerCase() === 'content-type')?.[1]) ||
    this.getHeader?.('Content-Type') || ''
  );
  const pathname = requestPath(this);
  const transformable = /text\/html/i.test(contentType) || ((pathname === '/version' || pathname === '/health' || pathname === '/healthz') && /application\/json/i.test(contentType));
  if (transformable) this.__ucanV313Chunks = [];
  try {
    this.removeHeader?.('Content-Length');
    this.setHeader?.('X-UCAN-Version', VERSION);
    this.setHeader?.('X-UCAN-Revision', REVISION);
    if (transformable) {
      this.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      this.setHeader?.('Pragma', 'no-cache');
      this.setHeader?.('Expires', '0');
    }
  } catch (_) {}
  if (nextHeaders && typeof nextHeaders === 'object') {
    nextHeaders = { ...nextHeaders };
    for (const key of Object.keys(nextHeaders)) {
      const lower = key.toLowerCase();
      if (lower === 'content-length') delete nextHeaders[key];
      if (transformable && ['cache-control','pragma','expires'].includes(lower)) delete nextHeaders[key];
    }
    nextHeaders['X-UCAN-Version'] = VERSION;
    nextHeaders['X-UCAN-Revision'] = REVISION;
    if (transformable) {
      nextHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
      nextHeaders.Pragma = 'no-cache';
      nextHeaders.Expires = '0';
    }
  }
  if (message === undefined) return baseWriteHead.call(this, statusCode, nextHeaders);
  return baseWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.write = function writeV313(chunk, encoding, callback) {
  if (Array.isArray(this.__ucanV313Chunks)) {
    if (chunk != null) this.__ucanV313Chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : 'utf8'));
    if (typeof encoding === 'function') process.nextTick(encoding);
    else if (typeof callback === 'function') process.nextTick(callback);
    return true;
  }
  return baseWrite.call(this, chunk, encoding, callback);
};

http.ServerResponse.prototype.end = function endV313(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (Array.isArray(this.__ucanV313Chunks)) {
      if (body != null) this.__ucanV313Chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body), typeof encoding === 'string' ? encoding : 'utf8'));
      const combined = Buffer.concat(this.__ucanV313Chunks).toString('utf8');
      delete this.__ucanV313Chunks;
      const pathname = requestPath(this);
      body = Buffer.from(pathname === '/version' || pathname === '/health' || pathname === '/healthz' ? transformJson(combined) : transformHtml(combined), 'utf8');
    }
  } catch (error) {
    console.error('[UCAN V313 response]', error);
  }
  return baseEnd.call(this, body, encoding, callback);
};

const previousCreateServer = http.createServer;
http.createServer = function createParallelServerV313(listener) {
  if (typeof listener !== 'function') return previousCreateServer.apply(this, arguments);
  return previousCreateServer.call(this, async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(url.pathname);
      if (req.method === 'GET' && pathname === IDENTITY_PATH) return servePatchedIdentity(res);
      if (pathname.startsWith(WORLD_API)) {
        await realtimeWorld.handle(req, res, pathname, url, sessionUser(req), readJson, sendJson);
        return;
      }
      if (pathname.startsWith('/api/voice/')) {
        await voiceSystem.handle(req, res, pathname, url, sessionUser(req), readJson, sendJson);
        return;
      }
      return await listener(req, res);
    } catch (error) {
      console.error('[UCAN V313 server]', error);
      if (!res.headersSent && !res.writableEnded) sendJson(res, error.statusCode || 500, { error:error.message || 'Error interno V313.' });
    }
  });
};

console.info(`[UCAN ${VERSION} ${REVISION}] Arranque limpio: una escena, una interacción y una presencia para todos los entornos (${BUILD}).`);
