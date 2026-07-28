'use strict';

require('./auth-compat-v307-presence.js');

const http = require('http');
const { createWorldSyncSystem } = require('./lib/world-sync-v308');

const VERSION = 'V308';
const BUILD = 'V308-20260728-SINGLE-SCENE-CROSS-ENV-INTERACTION';
const worldSystem = createWorldSyncSystem();
global.__UCAN_WORLD_SYNC_V308__ = worldSystem;

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
    'X-UCAN-World-Build':BUILD
  });
  res.end(body);
}

async function readJson(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('Solicitud de interacción demasiado grande.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch (_) {
    const error = new Error('JSON de interacción inválido.');
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
http.createServer = function createServerWithWorldV308(listener) {
  if (typeof listener !== 'function') return previousCreateServer.apply(this, arguments);
  return previousCreateServer.call(this, async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith('/api/world-v308')) {
        await worldSystem.handle(req, res, pathname, url, sessionUser(req), readJson, sendJson);
        return;
      }
      return await listener(req, res);
    } catch (error) {
      console.error('[UCAN World V308]', error);
      if (!res.headersSent && !res.writableEnded) sendJson(res, error.statusCode || 500, { error:error.message || 'Error interno de interacción.' });
    }
  });
};

console.info(`[UCAN ${VERSION}] Una sola escena e interacción compartida browser/WebXR activas.`);
