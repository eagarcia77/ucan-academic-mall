'use strict';

const http = require('http');
const { VERSION, REVISION, BUILD, API_PREFIX, createRealtimeWorld } = require('./lib/realtime-world-v312');

const LOADER_BUILD = 'V312-20260729-VR-CANONICAL-REALTIME-LOADER-R16';

// Conserva autenticación, voz, persistencia y validación visual de V311.
require('./auth-compat-v311-unified.js');

const realtimeWorld = createRealtimeWorld();
global.__UCAN_REALTIME_WORLD_V312_SERVER__ = realtimeWorld;

function sendJson(res, status, data) {
  if (res.headersSent || res.writableEnded) return;
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':Buffer.byteLength(body),
    'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma':'no-cache',
    'Expires':'0',
    'X-UCAN-World-Version':VERSION,
    'X-UCAN-World-Revision':REVISION
  });
  res.end(body);
}

async function readJson(req, limit = 128 * 1024) {
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

function transformHtml(value) {
  let html = String(value || '');
  html = html.replace(
    /\/js\/ucan_v266_keyboard_jump\.js(?:\?build=[^"']+)?/g,
    `/js/ucan_v266_keyboard_jump.js?build=${LOADER_BUILD}`
  );
  html = html.replace(/UCAN Academic Mall V(?:272|311)/g, 'UCAN Academic Mall V312');
  html = html.replace(/COMPILACIÓN V(?:272|311)(?: · UN SOLO MUNDO)?(?: ACTIVA)?/g, 'COMPILACIÓN V312 · ENTORNO VR CANÓNICO');
  html = html.replace(/V272: el entorno VR utiliza la misma escena de computadora[^<]*/g, 'V312: el browser utiliza el entorno visual de VR; usuarios, avatares e interacción operan en un solo mundo.');
  return html;
}

function transformVersion(value) {
  try {
    const data = JSON.parse(String(value || '{}'));
    if (!data || typeof data !== 'object') return value;
    const persistent = global.__UCAN_PERSISTENT_IDENTITY_V311__?.getStatus?.() || {};
    const realtime = realtimeWorld.getStatus();
    return JSON.stringify({
      ...data,
      version:VERSION,
      releaseVersion:VERSION,
      revision:REVISION,
      build:BUILD,
      loaderBuild:LOADER_BUILD,
      architecture:'vr-canonical-one-scene-realtime',
      authoritativeEnvironment:'VR',
      browserUsesVrEnvironment:true,
      oneBabylonSceneBrowserVr:true,
      sameGeometryBrowserVr:true,
      sameMaterialsBrowserVr:true,
      sameLightingBrowserVr:true,
      sameObjectsBrowserVr:true,
      sameFloor3StairsBrowserVr:true,
      sameUsersBrowserVr:true,
      browserToVrInteraction:true,
      vrToBrowserInteraction:true,
      realtimeSse:true,
      pollingFallback:true,
      worldApi:API_PREFIX,
      legacyQuestVisualLayersLoaded:false,
      legacyPresenceV307ClientLoaded:false,
      legacyInteractionV308ClientLoaded:false,
      legacyUnifiedV311ClientLoaded:false,
      cameraAndControlsOnlyDifference:true,
      persistentAccounts:true,
      persistentAvatars:true,
      persistentDataDir:persistent.persistentMountPath || '/app/data',
      persistentDataWritable:persistent.writable === true,
      persistentUserRecordsValid:persistent.userRecordsValid === true,
      persistentUserBackups:Number(persistent.backups || 0),
      realtimeParticipants:realtime.participants,
      realtimeSubscribers:realtime.subscribers
    });
  } catch (_) {
    return value;
  }
}

const previousWriteHead = http.ServerResponse.prototype.writeHead;
const previousWrite = http.ServerResponse.prototype.write;
const previousEnd = http.ServerResponse.prototype.end;

http.ServerResponse.prototype.writeHead = function writeHeadV312(statusCode, statusMessage, headers) {
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
  const transformable = /text\/html/i.test(contentType) || (pathname === '/version' && /application\/json/i.test(contentType));
  if (transformable) this.__ucanV312Chunks = [];
  try {
    this.removeHeader?.('Content-Length');
    this.setHeader?.('X-UCAN-World-Version', VERSION);
    this.setHeader?.('X-UCAN-World-Revision', REVISION);
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
    nextHeaders['X-UCAN-World-Version'] = VERSION;
    nextHeaders['X-UCAN-World-Revision'] = REVISION;
    if (transformable) {
      nextHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
      nextHeaders.Pragma = 'no-cache';
      nextHeaders.Expires = '0';
    }
  }
  if (message === undefined) return previousWriteHead.call(this, statusCode, nextHeaders);
  return previousWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.write = function writeV312(chunk, encoding, callback) {
  if (Array.isArray(this.__ucanV312Chunks)) {
    if (chunk != null) this.__ucanV312Chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : 'utf8'));
    if (typeof encoding === 'function') process.nextTick(encoding);
    else if (typeof callback === 'function') process.nextTick(callback);
    return true;
  }
  return previousWrite.call(this, chunk, encoding, callback);
};

http.ServerResponse.prototype.end = function endV312(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (Array.isArray(this.__ucanV312Chunks)) {
      if (body != null) this.__ucanV312Chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body), typeof encoding === 'string' ? encoding : 'utf8'));
      const combined = Buffer.concat(this.__ucanV312Chunks).toString('utf8');
      delete this.__ucanV312Chunks;
      body = Buffer.from(requestPath(this) === '/version' ? transformVersion(combined) : transformHtml(combined), 'utf8');
    }
  } catch (error) {
    console.error('[UCAN V312 response]', error);
  }
  return previousEnd.call(this, body, encoding, callback);
};

const previousCreateServer = http.createServer;
http.createServer = function createServerWithRealtimeWorldV312(listener) {
  if (typeof listener !== 'function') return previousCreateServer.apply(this, arguments);
  return previousCreateServer.call(this, async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith(API_PREFIX)) {
        await realtimeWorld.handle(req, res, pathname, url, sessionUser(req), readJson, sendJson);
        return;
      }
      return await listener(req, res);
    } catch (error) {
      console.error('[UCAN Realtime V312]', error);
      if (!res.headersSent && !res.writableEnded) sendJson(res, error.statusCode || 500, { error:error.message || 'Error interno del mundo en tiempo real.' });
    }
  });
};

console.info(`[UCAN ${VERSION} ${REVISION}] Browser usa el entorno VR; presencia e interacción en tiempo real activas (${BUILD}).`);
