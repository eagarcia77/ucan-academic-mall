'use strict';

const path = require('path');
const http = require('http');
const { installPersistentIdentity } = require('./lib/persistent-identity-v311');
const { VERSION, REVISION, BUILD, API_PREFIX, createUnifiedWorld } = require('./lib/unified-world-v311');

const LOADER_BUILD = 'V311-20260729-CANONICAL-ONE-SCENE-LOADER-R15';
const persistence = installPersistentIdentity({ dataDir:process.env.DATA_DIR || path.join(__dirname, 'data') });

// Conserva autenticación, voz, validación visual y la escena base.
require('./auth-compat-v309-parity.js');

const unifiedWorld = createUnifiedWorld();
global.__UCAN_UNIFIED_WORLD_V311_SERVER__ = unifiedWorld;

function sendJson(res, status, data) {
  if (res.headersSent || res.writableEnded) return;
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':Buffer.byteLength(body),
    'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma':'no-cache',
    'Expires':'0',
    'X-UCAN-Unified-World':VERSION,
    'X-UCAN-Unified-Revision':REVISION
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
  html = html.replace(/UCAN Academic Mall V272/g, 'UCAN Academic Mall V311');
  html = html.replace(/COMPILACIÓN V272 ACTIVA/g, 'COMPILACIÓN V311 · UN SOLO MUNDO');
  return html;
}

function transformVersion(value) {
  try {
    const data = JSON.parse(String(value || '{}'));
    if (!data || typeof data !== 'object') return value;
    const persistent = persistence.getStatus();
    return JSON.stringify({
      ...data,
      version:VERSION,
      releaseVersion:VERSION,
      revision:REVISION,
      build:BUILD,
      loaderBuild:LOADER_BUILD,
      architecture:'one-scene-one-world',
      oneBabylonSceneBrowserVr:true,
      sameGeometryBrowserVr:true,
      sameMaterialsBrowserVr:true,
      sameLightingBrowserVr:true,
      sameObjectsBrowserVr:true,
      sameUsersBrowserVr:true,
      browserToVrInteraction:true,
      vrToBrowserInteraction:true,
      unifiedWorldApi:API_PREFIX,
      legacyQuestVisualLayersLoaded:false,
      legacyPresenceV307ClientLoaded:false,
      legacyInteractionV308ClientLoaded:false,
      cameraAndControlsOnlyDifference:true,
      persistentAccounts:true,
      persistentAvatars:true,
      persistentDataDir:persistent.persistentMountPath,
      persistentDataWritable:persistent.writable,
      persistentUserRecordsValid:persistent.userRecordsValid,
      persistentUserBackups:persistent.backups,
      persistentRecoveryPerformed:persistent.recovered
    });
  } catch (_) {
    return value;
  }
}

const previousWriteHead = http.ServerResponse.prototype.writeHead;
const previousWrite = http.ServerResponse.prototype.write;
const previousEnd = http.ServerResponse.prototype.end;

http.ServerResponse.prototype.writeHead = function writeHeadV311(statusCode, statusMessage, headers) {
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
  if (transformable) this.__ucanV311Chunks = [];
  try {
    this.removeHeader?.('Content-Length');
    this.setHeader?.('X-UCAN-Unified-World', VERSION);
    this.setHeader?.('X-UCAN-Unified-Revision', REVISION);
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
    nextHeaders['X-UCAN-Unified-World'] = VERSION;
    nextHeaders['X-UCAN-Unified-Revision'] = REVISION;
    if (transformable) {
      nextHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
      nextHeaders.Pragma = 'no-cache';
      nextHeaders.Expires = '0';
    }
  }
  if (message === undefined) return previousWriteHead.call(this, statusCode, nextHeaders);
  return previousWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.write = function writeV311(chunk, encoding, callback) {
  if (Array.isArray(this.__ucanV311Chunks)) {
    if (chunk != null) this.__ucanV311Chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : 'utf8'));
    if (typeof encoding === 'function') process.nextTick(encoding);
    else if (typeof callback === 'function') process.nextTick(callback);
    return true;
  }
  return previousWrite.call(this, chunk, encoding, callback);
};

http.ServerResponse.prototype.end = function endV311(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (Array.isArray(this.__ucanV311Chunks)) {
      if (body != null) this.__ucanV311Chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body), typeof encoding === 'string' ? encoding : 'utf8'));
      const combined = Buffer.concat(this.__ucanV311Chunks).toString('utf8');
      delete this.__ucanV311Chunks;
      body = Buffer.from(requestPath(this) === '/version' ? transformVersion(combined) : transformHtml(combined), 'utf8');
    }
  } catch (error) {
    console.error('[UCAN V311 response]', error);
  }
  return previousEnd.call(this, body, encoding, callback);
};

const previousCreateServer = http.createServer;
http.createServer = function createServerWithUnifiedWorldV311(listener) {
  if (typeof listener !== 'function') return previousCreateServer.apply(this, arguments);
  return previousCreateServer.call(this, async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(url.pathname);

      if (pathname.startsWith(API_PREFIX)) {
        await unifiedWorld.handle(req, res, pathname, url, sessionUser(req), readJson, sendJson);
        return;
      }

      if (pathname === '/api/persistence-v311/status' && req.method === 'GET') {
        const user = sessionUser(req);
        const status = persistence.getStatus();
        return sendJson(res, 200, user?.role === 'admin' ? {
          ok:status.writable && status.userRecordsValid,
          version:VERSION,
          revision:REVISION,
          persistentAccounts:true,
          persistentAvatars:true,
          ...status
        } : {
          ok:status.writable && status.userRecordsValid,
          version:VERSION,
          revision:REVISION,
          persistentAccounts:true,
          persistentAvatars:true,
          writable:status.writable,
          markerPresent:status.markerPresent,
          userRecordsValid:status.userRecordsValid,
          users:status.users,
          backups:status.backups,
          recovered:status.recovered,
          persistentMountPath:status.persistentMountPath,
          lastError:status.lastError
        });
      }

      return await listener(req, res);
    } catch (error) {
      console.error('[UCAN Unified V311]', error);
      if (!res.headersSent && !res.writableEnded) sendJson(res, error.statusCode || 500, { error:error.message || 'Error interno del mundo unificado.' });
    }
  });
};

console.info(`[UCAN ${VERSION} ${REVISION}] Una sola escena, presencia, interacción y persistencia de avatares activas (${BUILD}).`);
