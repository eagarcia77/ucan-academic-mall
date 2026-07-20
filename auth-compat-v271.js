'use strict';

const Module = require('module');
const http = require('http');
const fs = require('fs');
const path = require('path');

const UCAN_VERSION = 'V282';
const UCAN_BUILD = 'V282-20260720-QUEST-BROWSER-ONE-WAY-ESCALATOR-PARITY';
const UCAN_SCRIPT = `/js/ucan_babylon_mall_v265_accounts_avatars.js?build=${UCAN_BUILD}`;
const UCAN_XR_SCRIPT = `/js/ucan_v277_xr_navigation_recovery.js?build=${UCAN_BUILD}`;
const UCAN_BLOCKER_SCRIPT = `/js/ucan_v275_blocker_pickability.js?build=${UCAN_BUILD}`;
const UCAN_PARITY_SCRIPT = `/js/ucan_v279_xr_visual_parity.js?build=${UCAN_BUILD}`;
const UCAN_ALIGNMENT_SCRIPT = `/js/ucan_v280_xr_floor_stair_alignment.js?build=${UCAN_BUILD}`;
const UCAN_QUEST_PARITY_SCRIPT = `/js/ucan_v281_quest_visual_rooftop_parity.js?build=${UCAN_BUILD}`;
const UCAN_ENVIRONMENT_PARITY_SCRIPT = `/js/ucan_v282_environment_escalator_parity.js?build=${UCAN_BUILD}`;
const UCAN_SKY_SCRIPT = `/js/ucan_v276_interactive_sky.js?build=${UCAN_BUILD}`;
const UCAN_SKY_REFRESH_SCRIPT = `/js/ucan_v276_sky_refresh.js?build=${UCAN_BUILD}`;
const UCAN_AVATAR_STUDIO_SCRIPT = `/js/ucan_v270_avatar_studio.js?build=${UCAN_BUILD}`;
const UCAN_ROLLBACK_SCRIPT = `/js/ucan_v277_profile_rollback_persistence.js?build=${UCAN_BUILD}`;
const UCAN_SCROLL_ACCESS_SCRIPT = `/js/ucan_v278_scroll_direct_access.js?build=${UCAN_BUILD}`;

function repairCompletionFile(dataDir) {
  if (!dataDir) return { checked:false, repaired:0, directAccess:0 };
  const file = path.join(dataDir, 'users.json');
  if (!fs.existsSync(file)) return { checked:true, repaired:0, directAccess:0 };
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!Array.isArray(data.users)) return { checked:true, repaired:0, directAccess:0 };
    let repaired = 0;
    let directAccess = 0;
    for (const user of data.users) {
      const avatarReady = user.avatarConfigured === true || Boolean(user.avatarConfiguredAt);
      if (avatarReady && user.avatarConfigured !== true) {
        user.avatarConfigured = true;
        repaired += 1;
      }
      if (avatarReady && !user.avatarConfiguredAt) {
        user.avatarConfiguredAt = user.updatedAt || user.createdAt || new Date().toISOString();
        repaired += 1;
      }
      if (avatarReady && user.forcePasswordChange === true) {
        user.forcePasswordChange = false;
        user.passwordGateBypassedAt = new Date().toISOString();
        user.updatedAt = user.passwordGateBypassedAt;
        repaired += 1;
        directAccess += 1;
      } else if (user.passwordChangedAt && user.forcePasswordChange === true) {
        user.forcePasswordChange = false;
        repaired += 1;
      }
    }
    if (repaired) {
      const tmp = `${file}.v282.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
      fs.renameSync(tmp, file);
      console.info(`[UCAN V282] Se repararon ${repaired} indicadores persistentes; ${directAccess} cuenta(s) recibieron acceso directo por avatar.`);
    }
    return { checked:true, repaired, directAccess };
  } catch (error) {
    console.warn('[UCAN V282] No se pudo revisar la persistencia de perfiles:', error.message);
    return { checked:false, repaired:0, directAccess:0, error:error.message };
  }
}

let persistenceAudit = { checked:false, repaired:0, directAccess:0 };
const originalLoad = Module._load;
Module._load = function patchedModuleLoad(request, parent, isMain) {
  const exported = originalLoad.apply(this, arguments);
  let resolved = '';
  try { resolved = Module._resolveFilename(request, parent); } catch (_) {}

  if (/[\\/]lib[\\/]auth\.js$/.test(resolved) && exported && typeof exported.createAuthSystem === 'function' && !exported.__ucanV282Compat) {
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
      global.__UCAN_AUTH_SYSTEM_V282__ = auth;
      return auth;
    };
    exported.__ucanV282Compat = true;
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

function campusV282Html() {
  const file = path.join(__dirname, 'public', 'campus.html');
  let html = fs.readFileSync(file, 'utf8');
  const xrScripts = `${UCAN_XR_SCRIPT}"></script>\n  <script src="${UCAN_BLOCKER_SCRIPT}"></script>\n  <script src="${UCAN_PARITY_SCRIPT}"></script>\n  <script src="${UCAN_ALIGNMENT_SCRIPT}"></script>\n  <script src="${UCAN_QUEST_PARITY_SCRIPT}"></script>\n  <script src="${UCAN_ENVIRONMENT_PARITY_SCRIPT}`;
  const mainWithSky = `${UCAN_SCRIPT}"></script>\n  <script src="${UCAN_SKY_SCRIPT}"></script>\n  <script src="${UCAN_SKY_REFRESH_SCRIPT}`;
  const studioWithRollbackAndScroll = `${UCAN_AVATAR_STUDIO_SCRIPT}"></script>\n  <script src="${UCAN_ROLLBACK_SCRIPT}"></script>\n  <script src="${UCAN_SCROLL_ACCESS_SCRIPT}`;
  html = html
    .replaceAll('V272-20260717-XR-DESKTOP-PARITY-SPEED', UCAN_BUILD)
    .replaceAll('UCAN Academic Mall V272', 'UCAN Academic Mall V282')
    .replaceAll('COMPILACIÓN V272 ACTIVA', 'COMPILACIÓN V282 ACTIVA')
    .replace('/js/ucan_v272_xr_desktop_parity.js?build=' + UCAN_BUILD, xrScripts)
    .replace(UCAN_SCRIPT, mainWithSky)
    .replace(UCAN_AVATAR_STUDIO_SCRIPT, studioWithRollbackAndScroll)
    .replace('V272: el entorno VR utiliza la misma escena de computadora y la velocidad normal coincide en 5.0 m/s.', 'V282: Meta Quest y browser comparten velocidad, giro, colisiones y direcciones; las escaleras eléctricas de bajar no permiten subir.');
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
      const auth = global.__UCAN_AUTH_SYSTEM_V282__;
      const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(parsed.pathname);

      if (pathname === '/health' || pathname === '/healthz') {
        return sendJson(res, 200, {
          ok:true,
          version:UCAN_VERSION,
          build:UCAN_BUILD,
          persistence:persistenceAudit,
          immersiveVisualParity:true,
          xrHeadHeightAware:true,
          automaticStairAlignment:true,
          floorSnapRecovery:true,
          questExposureCalibrated:true,
          rooftopDesktopMovement:true,
          rooftopNativeCollisions:true,
          browserQuestEnvironmentParity:true,
          oneWayElectricEscalators:true,
          downEscalatorsCannotAscend:true,
          rooftopStairsBidirectional:true
        });
      }
      if (pathname === '/version') {
        return sendJson(res, 200, {
          version:UCAN_VERSION,
          build:UCAN_BUILD,
          script:UCAN_SCRIPT,
          xrScript:UCAN_XR_SCRIPT,
          blockerScript:UCAN_BLOCKER_SCRIPT,
          parityScript:UCAN_PARITY_SCRIPT,
          alignmentScript:UCAN_ALIGNMENT_SCRIPT,
          questParityScript:UCAN_QUEST_PARITY_SCRIPT,
          environmentParityScript:UCAN_ENVIRONMENT_PARITY_SCRIPT,
          skyScript:UCAN_SKY_SCRIPT,
          skyRefreshScript:UCAN_SKY_REFRESH_SCRIPT,
          rollbackScript:UCAN_ROLLBACK_SCRIPT,
          scrollAccessScript:UCAN_SCROLL_ACCESS_SCRIPT,
          immersiveVisualParity:true,
          sameSceneAsDesktop:true,
          xrHeadHeightAware:true,
          automaticStairAlignment:true,
          floorSnapRecovery:true,
          questExposureCalibrated:true,
          questExposureFactor:0.86,
          rooftopDesktopMovement:true,
          rooftopNativeCollisions:true,
          rooftopImmediateStop:true,
          browserQuestEnvironmentParity:true,
          sharedNaturalSpeed:5.0,
          sharedComfortSpeed:3.4,
          sharedSmoothTurnSpeed:1.9,
          oneWayElectricEscalators:true,
          downEscalatorsCannotAscend:true,
          upEscalatorsCannotDescend:true,
          rooftopStairsBidirectional:true,
          directAccessWhenAvatarConfigured:true,
          persistenceRepair:persistenceAudit
        });
      }
      if (pathname === '/campus' && req.method === 'GET' && auth?.getSessionUser?.(req)) {
        return sendHtml(res, 200, campusV282Html());
      }

      const authManaged = pathname.startsWith('/api/auth/') || pathname === '/api/profile' || pathname.startsWith('/api/profile/') || pathname === '/api/presence' || pathname.startsWith('/api/admin/users');
      if (authManaged && auth && typeof auth.handleApi === 'function') {
        const handled = await auth.handleApi(pathname, req, res, parsed, { readJsonBody, sendJson });
        if (handled !== false || res.headersSent || res.writableEnded) return;
      }
      return await listener(req, res);
    } catch (error) {
      console.error('[UCAN V282 auth compatibility]', error);
      if (!res.headersSent && !res.writableEnded) sendJson(res, error.statusCode || 500, { error:error.message || 'Error interno' });
    }
  });
};

console.info('[UCAN V282] Paridad Meta Quest/browser, escaleras unidireccionales, iluminación, altura, acceso y persistencia cargados.');
