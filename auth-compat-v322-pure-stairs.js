'use strict';

const http = require('http');
const baseWriteHead = http.ServerResponse.prototype.writeHead;
const baseWrite = http.ServerResponse.prototype.write;
const baseEnd = http.ServerResponse.prototype.end;

require('./auth-compat-v313-parallel.js');

const VERSION = 'V322';
const REVISION = 'R26';
const BUILD = 'V322-20260730-PURE-STAIR-GROUND-AUTHORITY-R26';
const RUNTIME_SRC = '/js/ucan_v316_complete_browser_vr_audit.js?build=V322-20260730-ONE-MOVEMENT-LOOP-R26';
const AUTHORITY_SRC = '/js/ucan_v322_stair_authority.js?build=V322-20260730-PURE-GROUND-PROVIDER-R26';
const LOADER_SRC = '/js/ucan_v322_social_loader.js?build=V322-20260730-CLEAN-SOCIAL-LOADER-R26';

const SCRIPT_TARGETS = new Set([
  '/js/ucan_babylon_mall_v265_accounts_avatars.js',
  '/js/ucan_v316_complete_browser_vr_audit.js',
  '/js/ucan_v313_parallel_scene.js',
  '/js/ucan_v314_render_parity.js'
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
    'ucan_v272_xr_desktop_parity.js','ucan_v304_xr_entry_mr_fix.js','ucan_v313_xr_entry.js',
    'ucan_v315_unified_floors_joystick.js','ucan_v316_complete_browser_vr_audit.js','ucan_v316_social_loader.js',
    'ucan_v317_escalator_clearance.js','ucan_v318_social_loader.js','ucan_v318_stairs_all_environments.js',
    'ucan_v318_floor_route_controller.js','ucan_v319_social_loader.js','ucan_v319_floor_route_controller.js',
    'ucan_v319_vr_accessibility.js','ucan_v320_social_loader.js','ucan_v320_floor_lock_controller.js',
    'ucan_v321_social_loader.js','ucan_v321_stair_authority.js','ucan_v322_social_loader.js',
    'ucan_v322_stair_authority.js','ucan_v322_visual_comfort.js'
  ]) html = removeScript(html, script);
  html = removeScript(html, 'ucan_v266_keyboard_jump.js');

  const mainPattern = /(<script[^>]+src=["']\/js\/ucan_babylon_mall_v265_accounts_avatars\.js[^>]*><\/script>)/i;
  const runtimeTag = `<script src="${RUNTIME_SRC}" data-ucan-v322-locomotion="true"></script>`;
  const authorityTag = `<script src="${AUTHORITY_SRC}" data-ucan-v322-stair-authority="true"></script>`;
  if (mainPattern.test(html)) html = html.replace(mainPattern, `${runtimeTag}\n  ${authorityTag}\n  $1`);
  else html = html.replace('</head>', `  ${runtimeTag}\n  ${authorityTag}\n</head>`);

  const renderParityPattern = /(<script[^>]+src=["']\/js\/ucan_v314_render_parity\.js[^>]*><\/script>)/i;
  const loaderTag = `<script src="${LOADER_SRC}" data-ucan-v322-social-loader="true"></script>`;
  if (renderParityPattern.test(html)) html = html.replace(renderParityPattern, `${loaderTag}\n  $1`);
  else html = html.replace('</body>', `  ${loaderTag}\n</body>`);

  html = html.replace(/UCAN Academic Mall V(?:272|283|313|314|315|316|317|318|319|320|321)/g, 'UCAN Academic Mall V322');
  html = html.replace(/COMPILACIÓN V(?:272|283|313|314|315|316|317|318|319|320|321)(?: · [^<]+)?(?: ACTIVA)?/g, 'COMPILACIÓN V322 · UNA RESOLUCIÓN DE ESCALERAS');
  html = html.replace(/V(?:272|283|313|314|315|316|317|318|319|320|321):[^<]*/g, 'V322: el motor de locomoción consulta una sola autoridad de altura una vez por cuadro.');
  html = html.replace('</head>', `  <meta name="ucan-runtime-v322" content="${BUILD}" />\n</head>`);
  return html;
}

function patchBaseScene(source) {
  let code = String(source || '');
  code = code.replace('const width = 5.2;', 'const width = 8.4;');
  code = code.replace(/new BABYLON\.Vector3\(7\.2, 0\.12, 4\.2\), mats\.path, root, true\);/g, 'new BABYLON.Vector3(10.6, 0.12, 5.4), mats.path, root, true);');
  code = code.replace(/\s*box\(scene, 'baranda cristal hueco norte premium',[^\n]+\);/g, '');
  code = code.replace(/\s*box\(scene, 'baranda cristal hueco sur premium',[^\n]+\);/g, '');
  code = code.replace('setupEscalatorRide(scene, camera);', "window.__UCAN_LEGACY_ESCALATOR_RIDE_DISABLED_V322__ = true;");
  code = code.replace('setupReliableMovement(scene, camera);', "window.__UCAN_LEGACY_RELIABLE_MOVEMENT_DISABLED_V322__ = true;");
  code = code.replace('scene.onBeforeRenderObservable.add(() => clampCameraHeight(camera));', "window.__UCAN_LEGACY_CLAMP_HEIGHT_DISABLED_V322__ = true;");
  return code;
}

function patchLocomotion(source) {
  let code = String(source || '');
  const groundPattern = /function groundFor\(position\) \{[\s\S]*?return nearestFloor\(estimated\);\s*\}/;
  code = code.replace(groundPattern, `function groundFor(position) {
    const authority = window.__UCAN_STAIR_AUTHORITY_V322__;
    if (authority?.installed && typeof authority.resolveGround === 'function') {
      const resolved = authority.resolveGround(position, state.ground);
      if (Number.isFinite(Number(resolved))) return Number(resolved);
    }
    return Number.isFinite(Number(state.ground)) ? Number(state.ground) : LEVEL.one;
  }`);

  code = code.replace(
    'state.ground = groundFor(state.desktop.position);',
    '// V322: state.ground ya fue resuelto una vez en updateMovement; no volver a calcularlo aquí.'
  );
  code = code.replace(
    'if (camera.position && !rampGround(camera.position, state.ground)) state.lastSafe.copyFrom(camera.position);',
    "if (camera.position && !window.__UCAN_STAIR_AUTHORITY_V322__?.getState?.().activeRoute) state.lastSafe.copyFrom(camera.position);"
  );
  code = code.replace(
    'state.floor = state.ground;\n      state.velocity?.set?.(0, 0, 0);',
    `state.floor = state.ground;
      window.__UCAN_STAIR_AUTHORITY_V322__?.setFloor?.(state.ground, 'panel-navigation');
      state.velocity?.set?.(0, 0, 0);`
  );
  code = code.replace(
    'state.floor = nearestFloor(state.ground);\n    camera.position.y = state.ground + currentEyeHeight();',
    `state.floor = nearestFloor(state.ground);
    window.__UCAN_STAIR_AUTHORITY_V322__?.setFloor?.(state.floor, 'teleport');
    camera.position.y = state.ground + currentEyeHeight();`
  );
  code = code.replace(
    'state.floor = floor;\n    state.velocity.set(0, 0, 0);',
    `state.floor = floor;
    window.__UCAN_STAIR_AUTHORITY_V322__?.setFloor?.(floor, 'reset');
    state.velocity.set(0, 0, 0);`
  );
  code = code.replace(
    "console.info('[UCAN V316 R20] Auditoría completa, locomoción por rig y panel unificado instalados.');",
    "console.info('[UCAN V322 R26] Un solo ciclo de movimiento consulta una autoridad pura de escaleras.');"
  );
  return code;
}

function patchCanonicalScene(source) {
  return String(source || '').replace(
    "const STAIR = Object.freeze({ minX:40.8, maxX:47.2, bottomZ:39.0, topZ:10.5 });",
    "const STAIR = Object.freeze({ minX:39.5, maxX:48.5, bottomZ:39.0, topZ:10.5 });"
  );
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
      architecture:'one-movement-loop-pure-stair-ground-provider',
      singleMovementLoop:true,
      groundResolvedOncePerMovementFrame:true,
      stairAuthorityOwnsRenderLoop:false,
      stairAuthorityMovesCamera:false,
      forcedLandingTeleport:false,
      legacyEscalatorRideDisabled:true,
      legacyReliableMovementDisabled:true,
      legacyClampCameraHeightDisabled:true,
      legacyV318CameraGuardLoaded:false,
      legacyV319LandingLayerLoaded:false,
      legacyV321CameraSynchronizerLoaded:false,
      allSixStairRoutes:true,
      sameRulesBrowserMobileVrMr:true,
      allFrontEscalatorGlassRemoved:true,
      rooftopStairWidth:8.4,
      rooftopLandingWidth:10.6,
      visualComfortSameBrowserVr:true,
      runtime:RUNTIME_SRC,
      authority:AUTHORITY_SRC,
      socialLoader:LOADER_SRC,
      persistentAccounts:true,
      persistentAvatars:true,
      persistentDataWritable:persistence.writable === true,
      realtimeParticipants:Number(realtime.participants || 0),
      realtimeSubscribers:Number(realtime.subscribers || 0)
    });
  } catch (_) { return value; }
}

http.ServerResponse.prototype.writeHead = function writeHeadV322(statusCode, statusMessage, headers) {
  let message = statusMessage;
  let nextHeaders = headers;
  if (statusMessage && typeof statusMessage === 'object') { nextHeaders = statusMessage; message = undefined; }
  const pathname = requestPath(this);
  const contentType = String((nextHeaders && Object.entries(nextHeaders).find(([key]) => key.toLowerCase() === 'content-type')?.[1]) || this.getHeader?.('Content-Type') || '');
  const transformable = SCRIPT_TARGETS.has(pathname) || /text\/html/i.test(contentType) || ((pathname === '/version' || pathname === '/health' || pathname === '/healthz') && /application\/json/i.test(contentType));
  if (transformable) this.__ucanV322Chunks = [];
  try {
    this.removeHeader?.('Content-Length');
    this.setHeader?.('X-UCAN-Version', VERSION);
    this.setHeader?.('X-UCAN-Revision', REVISION);
    this.setHeader?.('X-UCAN-Stair-Authority', 'pure-ground-provider');
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
    nextHeaders['X-UCAN-Stair-Authority'] = 'pure-ground-provider';
    if (transformable) {
      nextHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
      nextHeaders.Pragma = 'no-cache';
      nextHeaders.Expires = '0';
    }
  }
  if (message === undefined) return baseWriteHead.call(this, statusCode, nextHeaders);
  return baseWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.write = function writeV322(chunk, encoding, callback) {
  if (Array.isArray(this.__ucanV322Chunks)) {
    if (chunk != null) this.__ucanV322Chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : 'utf8'));
    if (typeof encoding === 'function') process.nextTick(encoding);
    else if (typeof callback === 'function') process.nextTick(callback);
    return true;
  }
  return baseWrite.call(this, chunk, encoding, callback);
};

http.ServerResponse.prototype.end = function endV322(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (Array.isArray(this.__ucanV322Chunks)) {
      if (body != null) this.__ucanV322Chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body), typeof encoding === 'string' ? encoding : 'utf8'));
      const combined = Buffer.concat(this.__ucanV322Chunks).toString('utf8');
      delete this.__ucanV322Chunks;
      const pathname = requestPath(this);
      const transformed = SCRIPT_TARGETS.has(pathname)
        ? transformScript(pathname, combined)
        : pathname === '/version' || pathname === '/health' || pathname === '/healthz'
          ? transformJson(combined)
          : transformHtml(combined);
      body = Buffer.from(String(transformed), 'utf8');
    }
  } catch (reason) {
    console.error('[UCAN V322 response]', reason);
  }
  return baseEnd.call(this, body, encoding, callback);
};

console.info(`[UCAN ${VERSION} ${REVISION}] Una sola resolución de altura por cuadro activa (${BUILD}).`);