'use strict';

const http = require('http');
const baseWriteHead = http.ServerResponse.prototype.writeHead;
const baseWrite = http.ServerResponse.prototype.write;
const baseEnd = http.ServerResponse.prototype.end;

// Conserva autenticación, persistencia, voz y presencia. V318 controla la entrega
// de la geometría y locomoción de escaleras antes de crear la escena.
require('./auth-compat-v313-parallel.js');

const VERSION = 'V318';
const REVISION = 'R22';
const BUILD = 'V318-20260730-ISOLATED-ESCALATORS-WIDE-ROOFTOP-R22';
const RUNTIME_SRC = '/js/ucan_v316_complete_browser_vr_audit.js?build=V318-20260730-ISOLATED-RAMP-ROUTING-R22';
const LOADER_SRC = '/js/ucan_v318_social_loader.js?build=V318-20260730-SOCIAL-LOADER-R22';
const STAIRS_SRC = '/js/ucan_v318_stairs_all_environments.js?build=V318-20260730-ISOLATED-ESCALATORS-WIDE-ROOFTOP-R22';

const SCRIPT_TARGETS = new Set([
  '/js/ucan_babylon_mall_v265_accounts_avatars.js',
  '/js/ucan_v316_complete_browser_vr_audit.js',
  '/js/ucan_v313_parallel_scene.js'
]);

function requestPath(response) {
  try { return new URL(response?.req?.url || '/', 'http://localhost').pathname; }
  catch (_) { return ''; }
}

function removeScript(html, fileName) {
  const escaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.replace(new RegExp(`\\s*<script[^>]+${escaped}[^>]*><\\/script>`, 'gi'), '');
}

function transformHtml(value) {
  let html = String(value || '');
  for (const script of [
    'ucan_v272_xr_desktop_parity.js',
    'ucan_v304_xr_entry_mr_fix.js',
    'ucan_v313_xr_entry.js',
    'ucan_v315_unified_floors_joystick.js',
    'ucan_v316_complete_browser_vr_audit.js',
    'ucan_v316_social_loader.js',
    'ucan_v317_escalator_clearance.js',
    'ucan_v318_social_loader.js',
    'ucan_v318_stairs_all_environments.js'
  ]) html = removeScript(html, script);
  html = removeScript(html, 'ucan_v266_keyboard_jump.js');

  const mainPattern = /(<script[^>]+src=["']\/js\/ucan_babylon_mall_v265_accounts_avatars\.js[^>]*><\/script>)/i;
  const runtimeTag = `<script src="${RUNTIME_SRC}" data-ucan-v318-locomotion="true"></script>`;
  if (mainPattern.test(html)) html = html.replace(mainPattern, `${runtimeTag}\n  $1`);
  else html = html.replace('</head>', `  ${runtimeTag}\n</head>`);

  const renderParityPattern = /(<script[^>]+src=["']\/js\/ucan_v314_render_parity\.js[^>]*><\/script>)/i;
  const loaderTag = `<script src="${LOADER_SRC}" data-ucan-v318-social-loader="true"></script>`;
  if (renderParityPattern.test(html)) html = html.replace(renderParityPattern, `${loaderTag}\n  $1`);
  else html = html.replace('</body>', `  ${loaderTag}\n</body>`);

  html = html.replace(/UCAN Academic Mall V(?:272|283|313|314|315|316|317)/g, 'UCAN Academic Mall V318');
  html = html.replace(/COMPILACIÓN V(?:272|283|313|314|315|316|317)(?: · [^<]+)?(?: ACTIVA)?/g, 'COMPILACIÓN V318 · RUTAS DE ESCALERAS AISLADAS');
  html = html.replace(/V(?:272|283|313|314|315|316|317):[^<]*/g, 'V318: cristales frontales eliminados, Piso 1→Piso 2 aislado y escalera a la terraza ampliada.');
  html = html.replace('</head>', `  <meta name="ucan-runtime-v318" content="${BUILD}" />\n</head>`);
  return html;
}

function patchBaseScene(source) {
  let code = String(source || '');
  code = code.replace('const width = 5.2;', 'const width = 8.4;');
  code = code.replace(
    "new BABYLON.Vector3(7.2, 0.12, 4.2), mats.path, root, true);",
    "new BABYLON.Vector3(10.6, 0.12, 5.4), mats.path, root, true);"
  );
  code = code.replace(
    "new BABYLON.Vector3(7.2, 0.12, 4.2), mats.path, root, true);",
    "new BABYLON.Vector3(10.6, 0.12, 5.4), mats.path, root, true);"
  );
  code = code.replace(/\s*box\(scene, 'baranda cristal hueco norte premium',[^\n]+\);/g, '');
  code = code.replace(/\s*box\(scene, 'baranda cristal hueco sur premium',[^\n]+\);/g, '');
  code = code.replace(
    "window.__UCAN_ROOFTOP_STAIRS__ = {",
    "window.__UCAN_ROOFTOP_STAIRS_V318__ = { width:8.4, landingWidth:10.6, allEnvironments:true };\n    window.__UCAN_ROOFTOP_STAIRS__ = {"
  );
  return code;
}

function patchLocomotion(source) {
  let code = String(source || '');
  const replacements = [
    ["{ id:'p1-p2-oeste', minX:-25.8, maxX:-14.2", "{ id:'p1-p2-oeste', minX:-23.4, maxX:-16.6"],
    ["{ id:'p2-p1-este', minX:-13.8, maxX:-2.2", "{ id:'p2-p1-este', minX:-11.4, maxX:-4.6"],
    ["{ id:'p2-p3-oeste', minX:-39.8, maxX:-28.2", "{ id:'p2-p3-oeste', minX:-37.4, maxX:-30.6"],
    ["{ id:'p3-p2-este', minX:-31.8, maxX:-20.2", "{ id:'p3-p2-este', minX:-29.4, maxX:-22.6"],
    ["{ id:'p3-terraza', minX:38.0, maxX:50.0", "{ id:'p3-terraza', minX:39.2, maxX:48.8"]
  ];
  for (const [from, to] of replacements) code = code.replace(from, to);
  code = code.replace(
    "console.info('[UCAN V316 R20] Auditoría completa, locomoción por rig y panel unificado instalados.');",
    "console.info('[UCAN V318 R22] Locomoción con rutas físicas aisladas instalada.');"
  );
  return code;
}

function patchCanonicalScene(source) {
  let code = String(source || '');
  code = code.replace(
    "const STAIR = Object.freeze({ minX:40.8, maxX:47.2, bottomZ:39.0, topZ:10.5 });",
    "const STAIR = Object.freeze({ minX:39.5, maxX:48.5, bottomZ:39.0, topZ:10.5 });"
  );
  return code;
}

function transformScript(pathname, value) {
  if (pathname === '/js/ucan_babylon_mall_v265_accounts_avatars.js') return patchBaseScene(value);
  if (pathname === '/js/ucan_v316_complete_browser_vr_audit.js') return patchLocomotion(value);
  if (pathname === '/js/ucan_v313_parallel_scene.js') return patchCanonicalScene(value);
  return value;
}

function transformJson(value) {
  try {
    const data = JSON.parse(String(value || '{}'));
    if (!data || typeof data !== 'object') return value;
    const persistence = global.__UCAN_PERSISTENT_IDENTITY_V311__?.getStatus?.() || {};
    const realtime = global.__UCAN_REALTIME_WORLD_V313_SERVER__?.getStatus?.() || {};
    return JSON.stringify({
      ...data,
      ok:data.ok !== false,
      version:VERSION,
      releaseVersion:VERSION,
      revision:REVISION,
      build:BUILD,
      architecture:'one-scene-isolated-escalator-routes-wide-rooftop-stairs',
      sameRulesBrowserMobileVrMr:true,
      allFrontEscalatorGlassRemoved:true,
      floor1ToFloor2StopsAtFloor2:true,
      floor1ToFloor3AutomaticContinuation:false,
      isolatedEscalatorRoutes:true,
      rooftopStairWidth:8.4,
      rooftopLandingWidth:10.6,
      rooftopRouteWidth:9.6,
      oneLocomotionRig:true,
      continuousStairMovement:true,
      scriptedStairTransitions:false,
      runtime:RUNTIME_SRC,
      socialLoader:LOADER_SRC,
      stairRulesRuntime:STAIRS_SRC,
      persistentAccounts:true,
      persistentAvatars:true,
      persistentDataWritable:persistence.writable === true,
      realtimeParticipants:Number(realtime.participants || 0),
      realtimeSubscribers:Number(realtime.subscribers || 0)
    });
  } catch (_) { return value; }
}

http.ServerResponse.prototype.writeHead = function writeHeadV318(statusCode, statusMessage, headers) {
  let message = statusMessage;
  let nextHeaders = headers;
  if (statusMessage && typeof statusMessage === 'object') {
    nextHeaders = statusMessage;
    message = undefined;
  }
  const pathname = requestPath(this);
  const contentType = String(
    (nextHeaders && Object.entries(nextHeaders).find(([key]) => key.toLowerCase() === 'content-type')?.[1]) ||
    this.getHeader?.('Content-Type') || ''
  );
  const transformable = SCRIPT_TARGETS.has(pathname) || /text\/html/i.test(contentType) ||
    ((pathname === '/version' || pathname === '/health' || pathname === '/healthz') && /application\/json/i.test(contentType));
  if (transformable) this.__ucanV318Chunks = [];
  try {
    this.removeHeader?.('Content-Length');
    this.setHeader?.('X-UCAN-Version', VERSION);
    this.setHeader?.('X-UCAN-Revision', REVISION);
    this.setHeader?.('X-UCAN-Stairs', 'isolated-routes-wide-rooftop');
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
    nextHeaders['X-UCAN-Stairs'] = 'isolated-routes-wide-rooftop';
    if (transformable) {
      nextHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
      nextHeaders.Pragma = 'no-cache';
      nextHeaders.Expires = '0';
    }
  }
  if (message === undefined) return baseWriteHead.call(this, statusCode, nextHeaders);
  return baseWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.write = function writeV318(chunk, encoding, callback) {
  if (Array.isArray(this.__ucanV318Chunks)) {
    if (chunk != null) this.__ucanV318Chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : 'utf8'));
    if (typeof encoding === 'function') process.nextTick(encoding);
    else if (typeof callback === 'function') process.nextTick(callback);
    return true;
  }
  return baseWrite.call(this, chunk, encoding, callback);
};

http.ServerResponse.prototype.end = function endV318(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (Array.isArray(this.__ucanV318Chunks)) {
      if (body != null) this.__ucanV318Chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body), typeof encoding === 'string' ? encoding : 'utf8'));
      const combined = Buffer.concat(this.__ucanV318Chunks).toString('utf8');
      delete this.__ucanV318Chunks;
      const pathname = requestPath(this);
      const transformed = SCRIPT_TARGETS.has(pathname)
        ? transformScript(pathname, combined)
        : pathname === '/version' || pathname === '/health' || pathname === '/healthz'
          ? transformJson(combined)
          : transformHtml(combined);
      body = Buffer.from(String(transformed), 'utf8');
    }
  } catch (reason) {
    console.error('[UCAN V318 response]', reason);
  }
  return baseEnd.call(this, body, encoding, callback);
};

console.info(`[UCAN ${VERSION} ${REVISION}] Rutas de escaleras aisladas y acceso a terraza ampliado (${BUILD}).`);
