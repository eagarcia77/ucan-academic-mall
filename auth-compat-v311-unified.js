'use strict';

const path = require('path');
const http = require('http');
const { installPersistentIdentity } = require('./lib/persistent-identity-v311');
const { VERSION, REVISION, BUILD, API_PREFIX, createUnifiedWorld } = require('./lib/unified-world-v311');

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
