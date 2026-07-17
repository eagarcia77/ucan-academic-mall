'use strict';

const Module = require('module');
const http = require('http');
const fs = require('fs');
const path = require('path');

const UCAN_VERSION = 'V275';
const UCAN_BUILD = 'V275-20260717-XR-STAIR-BLOCKERS-TERRACE';
const UCAN_SCRIPT = '/js/ucan_babylon_mall_v265_accounts_avatars.js?build=V275-20260717-XR-STAIR-BLOCKERS-TERRACE';
const UCAN_XR_SCRIPT = '/js/ucan_v275_xr_stair_blockers.js?build=V275-20260717-XR-STAIR-BLOCKERS-TERRACE';
const UCAN_BLOCKER_SCRIPT = '/js/ucan_v275_blocker_pickability.js?build=V275-20260717-XR-STAIR-BLOCKERS-TERRACE';

const originalLoad = Module._load;
Module._load = function patchedModuleLoad(request, parent, isMain) {
  const exported = originalLoad.apply(this, arguments);
  let resolved = '';
  try { resolved = Module._resolveFilename(request, parent); } catch (_) {}

  if (/[\\/]lib[\\/]auth\.js$/.test(resolved) && exported && typeof exported.createAuthSystem === 'function' && !exported.__ucanV275Compat) {
    const originalCreateAuthSystem = exported.createAuthSystem;
    exported.createAuthSystem = function createCompatibleAuthSystem(options) {
      const auth = originalCreateAuthSystem(options);
      if (typeof auth.getUserFromRequest !== 'function' && typeof auth.getSessionUser === 'function') {
        auth.getUserFromRequest = auth.getSessionUser;
      }
      if (typeof auth.handle !== 'function' && typeof auth.handleApi === 'function') {
        auth.handle = async function compatibleHandle(req, res, pathname, readJsonBody, sendJson) {
          const parsed = new URL(req.url || pathname || '/', `http://${req.headers.host || 'localhost'}`);
          return auth.handleApi(pathname, req, res, parsed, { readJsonBody, sendJson });
        };
      }
      global.__UCAN_AUTH_SYSTEM_V275__ = auth;
      return auth;
    };
    exported.__ucanV275Compat = true;
  }
  return exported;
};

function sendJson(res, status, data) {
  if (res.headersSent || res.writableEnded) return;
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendHtml(res, status, body) {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end(body);
}

function campusV275Html() {
  const file = path.join(__dirname, 'public', 'campus.html');
  let html = fs.readFileSync(file, 'utf8');
  const xrScripts = `${UCAN_XR_SCRIPT}"></script>\n  <script src="${UCAN_BLOCKER_SCRIPT}`;
  html = html
    .replaceAll('V272-20260717-XR-DESKTOP-PARITY-SPEED', UCAN_BUILD)
    .replaceAll('UCAN Academic Mall V272', 'UCAN Academic Mall V275')
    .replaceAll('COMPILACIÓN V272 ACTIVA', 'COMPILACIÓN V275 ACTIVA')
    .replace('/js/ucan_v272_xr_desktop_parity.js?build=' + UCAN_BUILD, xrScripts)
    .replace('V272: el entorno VR utiliza la misma escena de computadora y la velocidad normal coincide en 5.0 m/s.', 'V275: bloqueos debajo de todas las escaleras, activación por entrada correcta y acceso estable a la terraza.');
  return html;
}

async function readJsonBody(req, limit = 2 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('Cuerpo demasiado grande.');
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

const originalCreateServer = http.createServer;
http.createServer = function createCompatibleServer(listener) {
  if (typeof listener !== 'function') return originalCreateServer.apply(this, arguments);
  return originalCreateServer.call(this, async (req, res) => {
    try {
      const auth = global.__UCAN_AUTH_SYSTEM_V275__;
      const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(parsed.pathname);

      if (pathname === '/health' || pathname === '/healthz') {
        return sendJson(res, 200, { ok:true, version:UCAN_VERSION, build:UCAN_BUILD });
      }
      if (pathname === '/version') {
        return sendJson(res, 200, { version:UCAN_VERSION, build:UCAN_BUILD, script:UCAN_SCRIPT, xrScript:UCAN_XR_SCRIPT, blockerScript:UCAN_BLOCKER_SCRIPT });
      }
      if (pathname === '/campus' && req.method === 'GET' && auth?.getSessionUser?.(req)) {
        return sendHtml(res, 200, campusV275Html());
      }

      const authManaged = pathname.startsWith('/api/auth/') || pathname === '/api/profile' || pathname.startsWith('/api/profile/') || pathname === '/api/presence' || pathname.startsWith('/api/admin/users');
      if (authManaged && auth && typeof auth.handleApi === 'function') {
        const handled = await auth.handleApi(pathname, req, res, parsed, { readJsonBody, sendJson });
        if (handled !== false || res.headersSent || res.writableEnded) return;
      }
      return await listener(req, res);
    } catch (error) {
      console.error('[UCAN V275 auth compatibility]', error);
      if (!res.headersSent && !res.writableEnded) sendJson(res, error.statusCode || 500, { error:error.message || 'Error interno' });
    }
  });
};

console.info('[UCAN V275] Compatibilidad, bloqueos bajo escaleras y acceso a terraza cargados.');
