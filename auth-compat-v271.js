'use strict';

const Module = require('module');
const http = require('http');
const fs = require('fs');
const path = require('path');

const UCAN_VERSION = 'V277';
const UCAN_BUILD = 'V277-20260720-XR-NAV-ROLLBACK-PERSISTENCE';
const UCAN_SCRIPT = `/js/ucan_babylon_mall_v265_accounts_avatars.js?build=${UCAN_BUILD}`;
const UCAN_XR_SCRIPT = `/js/ucan_v277_xr_navigation_recovery.js?build=${UCAN_BUILD}`;
const UCAN_BLOCKER_SCRIPT = `/js/ucan_v275_blocker_pickability.js?build=${UCAN_BUILD}`;
const UCAN_SKY_SCRIPT = `/js/ucan_v276_interactive_sky.js?build=${UCAN_BUILD}`;
const UCAN_SKY_REFRESH_SCRIPT = `/js/ucan_v276_sky_refresh.js?build=${UCAN_BUILD}`;
const UCAN_AVATAR_STUDIO_SCRIPT = `/js/ucan_v270_avatar_studio.js?build=${UCAN_BUILD}`;
const UCAN_ROLLBACK_SCRIPT = `/js/ucan_v277_profile_rollback_persistence.js?build=${UCAN_BUILD}`;

function repairCompletionFile(dataDir) {
  if (!dataDir) return { checked:false, repaired:0 };
  const file = path.join(dataDir, 'users.json');
  if (!fs.existsSync(file)) return { checked:true, repaired:0 };
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(data.users)) return { checked:true, repaired:0 };
    let repaired = 0;
    for (const user of data.users) {
      if (user.passwordChangedAt && user.forcePasswordChange === true) {
        user.forcePasswordChange = false;
        repaired += 1;
      }
      if (user.avatarConfiguredAt && user.avatarConfigured !== true) {
        user.avatarConfigured = true;
        repaired += 1;
      }
      if (user.avatarConfigured === true && !user.avatarConfiguredAt) {
        user.avatarConfiguredAt = user.updatedAt || user.createdAt || new Date().toISOString();
        repaired += 1;
      }
    }
    if (repaired) {
      const tmp = `${file}.v277.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, file);
      console.info(`[UCAN V277] Se repararon ${repaired} indicadores persistentes de perfil.`);
    }
    return { checked:true, repaired };
  } catch (error) {
    console.warn('[UCAN V277] No se pudo revisar la persistencia de perfiles:', error.message);
    return { checked:false, repaired:0, error:error.message };
  }
}

let persistenceAudit = { checked:false, repaired:0 };
const originalLoad = Module._load;
Module._load = function patchedModuleLoad(request, parent, isMain) {
  const exported = originalLoad.apply(this, arguments);
  let resolved = '';
  try { resolved = Module._resolveFilename(request, parent); } catch (_) {}

  if (/[\\/]lib[\\/]auth\.js$/.test(resolved) && exported && typeof exported.createAuthSystem === 'function' && !exported.__ucanV277Compat) {
    const originalCreateAuthSystem = exported.createAuthSystem;
    exported.createAuthSystem = function createCompatibleAuthSystem(options) {
      persistenceAudit = repairCompletionFile(options?.dataDir);
      const auth = originalCreateAuthSystem(options);
      if (typeof auth.getUserFromRequest !== 'function' && typeof auth.getSessionUser === 'function') auth.getUserFromRequest = auth.getSessionUser;
      if (typeof auth.handle !== 'function' && typeof auth.handleApi === 'function') {
        auth.handle = async function compatibleHandle(req, res, pathname, readJsonBody, sendJson) {
          const parsed = new URL(req.url || pathname || '/', `http://${req.headers.host || 'localhost'}`);
          return auth.handleApi(pathname, req, res, parsed, { readJsonBody, sendJson });
        };
      }
      global.__UCAN_AUTH_SYSTEM_V277__ = auth;
      return auth;
    };
    exported.__ucanV277Compat = true;
  }
  return exported;
};

function sendJson(res, status, data) {
  if (res.headersSent || res.writableEnded) return;
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':Buffer.byteLength(body),
    'Cache-Control':'no-store'
  });
  res.end(body);
}

function sendHtml(res, status, body) {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(status, {
    'Content-Type':'text/html; charset=utf-8',
    'Content-Length':Buffer.byteLength(body),
    'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma':'no-cache',
    'Expires':'0'
  });
  res.end(body);
}

function campusV277Html() {
  const file = path.join(__dirname, 'public', 'campus.html');
  let html = fs.readFileSync(file, 'utf8');
  const xrScripts = `${UCAN_XR_SCRIPT}"></script>\n  <script src="${UCAN_BLOCKER_SCRIPT}`;
  const mainWithSky = `${UCAN_SCRIPT}"></script>\n  <script src="${UCAN_SKY_SCRIPT}"></script>\n  <script src="${UCAN_SKY_REFRESH_SCRIPT}`;
  const studioWithRollback = `${UCAN_AVATAR_STUDIO_SCRIPT}"></script>\n  <script src="${UCAN_ROLLBACK_SCRIPT}`;
  html = html
    .replaceAll('V272-20260717-XR-DESKTOP-PARITY-SPEED', UCAN_BUILD)
    .replaceAll('UCAN Academic Mall V272', 'UCAN Academic Mall V277')
    .replaceAll('COMPILACIÓN V272 ACTIVA', 'COMPILACIÓN V277 ACTIVA')
    .replace('/js/ucan_v272_xr_desktop_parity.js?build=' + UCAN_BUILD, xrScripts)
    .replace(UCAN_SCRIPT, mainWithSky)
    .replace(UCAN_AVATAR_STUDIO_SCRIPT, studioWithRollback)
    .replace('V272: el entorno VR utiliza la misma escena de computadora y la velocidad normal coincide en 5.0 m/s.', 'V277: navegación inmersiva directa, terraza estable, escaleras automáticas, salto, recuperación vertical, rollback y persistencia de perfil.');
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
      const auth = global.__UCAN_AUTH_SYSTEM_V277__;
      const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(parsed.pathname);

      if (pathname === '/health' || pathname === '/healthz') {
        return sendJson(res, 200, { ok:true, version:UCAN_VERSION, build:UCAN_BUILD, persistence:persistenceAudit });
      }
      if (pathname === '/version') {
        return sendJson(res, 200, {
          version:UCAN_VERSION,
          build:UCAN_BUILD,
          script:UCAN_SCRIPT,
          xrScript:UCAN_XR_SCRIPT,
          blockerScript:UCAN_BLOCKER_SCRIPT,
          skyScript:UCAN_SKY_SCRIPT,
          skyRefreshScript:UCAN_SKY_REFRESH_SCRIPT,
          rollbackScript:UCAN_ROLLBACK_SCRIPT,
          persistenceRepair:persistenceAudit
        });
      }
      if (pathname === '/campus' && req.method === 'GET' && auth?.getSessionUser?.(req)) {
        return sendHtml(res, 200, campusV277Html());
      }

      const authManaged = pathname.startsWith('/api/auth/') || pathname === '/api/profile' || pathname.startsWith('/api/profile/') || pathname === '/api/presence' || pathname.startsWith('/api/admin/users');
      if (authManaged && auth && typeof auth.handleApi === 'function') {
        const handled = await auth.handleApi(pathname, req, res, parsed, { readJsonBody, sendJson });
        if (handled !== false || res.headersSent || res.writableEnded) return;
      }
      return await listener(req, res);
    } catch (error) {
      console.error('[UCAN V277 auth compatibility]', error);
      if (!res.headersSent && !res.writableEnded) sendJson(res, error.statusCode || 500, { error:error.message || 'Error interno' });
    }
  });
};

console.info('[UCAN V277] Navegación XR, rollback y persistencia cargados.');