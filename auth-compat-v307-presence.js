'use strict';

require('./auth-compat-v306-voice.js');

const http = require('http');
const fs = require('fs');
const path = require('path');
const { createPresenceSystem } = require('./lib/presence-sync-v307');

const VERSION = 'V307';
const BUILD = 'V307-20260728-BROWSER-XR-DEVICE-PRESENCE';
const IDENTITY_PATH = '/js/ucan_v265_identity.js';
const IDENTITY_FILE = path.join(__dirname, 'public', 'js', 'ucan_v265_identity.js');

const presenceSystem = createPresenceSystem();
global.__UCAN_PRESENCE_SYSTEM_V307__ = presenceSystem;

function sendJson(res, status, data) {
  if (res.headersSent || res.writableEnded) return;
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':Buffer.byteLength(body),
    'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma':'no-cache',
    'Expires':'0',
    'X-UCAN-Presence-Version':VERSION,
    'X-UCAN-Presence-Build':BUILD
  });
  res.end(body);
}

async function readJson(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('Solicitud de presencia demasiado grande.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch (_) {
    const error = new Error('JSON de presencia inválido.');
    error.statusCode = 400;
    throw error;
  }
}

function sessionUser(req) {
  const auth = global.__UCAN_AUTH_SYSTEM_V283__;
  try { return auth?.getUserFromRequest?.(req) || auth?.getSessionUser?.(req) || null; }
  catch (_) { return null; }
}

function patchedIdentitySource() {
  let source = fs.readFileSync(IDENTITY_FILE, 'utf8');
  source = source.replace(
    'presenceLoop();setInterval(presenceLoop,2200);',
    "window.__UCAN_LEGACY_PRESENCE_DISABLED_V307__=true;console.info('[UCAN V307] Presencia V1 desactivada; V307 controla browser y WebXR por dispositivo.');"
  );
  source = source.replace(
    "window.__UCAN_IDENTITY__={version:'V270',getUser:()=>state.user,getRemoteCount:()=>state.remote.size,openAvatarEditor:()=>openModal(false),toggleThirdPerson};",
    "window.__UCAN_IDENTITY__={version:'V307',getUser:()=>state.user,getRemoteCount:()=>window.__UCAN_PRESENCE_XR_V307__?.getState?.().remoteAvatars||0,openAvatarEditor:()=>openModal(false),toggleThirdPerson,legacyPresenceDisabled:true};"
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
    'X-UCAN-Presence-Version':VERSION,
    'X-UCAN-Legacy-Presence':'disabled'
  });
  res.end(body);
}

const previousCreateServer = http.createServer;
http.createServer = function createServerWithPresenceV307(listener) {
  if (typeof listener !== 'function') return previousCreateServer.apply(this, arguments);
  return previousCreateServer.call(this, async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(url.pathname);
      if (req.method === 'GET' && pathname === IDENTITY_PATH) return servePatchedIdentity(res);
      if (pathname.startsWith('/api/presence-v2')) {
        await presenceSystem.handle(req, res, pathname, url, sessionUser(req), readJson, sendJson);
        return;
      }
      return await listener(req, res);
    } catch (error) {
      console.error('[UCAN Presence V307]', error);
      if (!res.headersSent && !res.writableEnded) sendJson(res, error.statusCode || 500, { error:error.message || 'Error interno de presencia.' });
    }
  });
};

console.info(`[UCAN ${VERSION}] Presencia por dispositivo para browser y WebXR activa.`);
