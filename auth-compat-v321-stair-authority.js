'use strict';

const http = require('http');
const baseWriteHead = http.ServerResponse.prototype.writeHead;
const baseWrite = http.ServerResponse.prototype.write;
const baseEnd = http.ServerResponse.prototype.end;

require('./auth-compat-v313-parallel.js');

const VERSION = 'V321';
const REVISION = 'R25';
const BUILD = 'V321-20260730-SINGLE-STAIR-AUTHORITY-R25';
const RUNTIME_SRC = '/js/ucan_v316_complete_browser_vr_audit.js?build=V321-20260730-ONE-LOCOMOTION-ENGINE-R25';
const LOADER_SRC = '/js/ucan_v321_social_loader.js?build=V321-20260730-SINGLE-STAIR-AUTHORITY-LOADER-R25';

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
    'ucan_v321_social_loader.js','ucan_v321_stair_authority.js'
  ]) html = removeScript(html, script);
  html = removeScript(html, 'ucan_v266_keyboard_jump.js');

  const mainPattern = /(<script[^>]+src=["']\/js\/ucan_babylon_mall_v265_accounts_avatars\.js[^>]*><\/script>)/i;
  const runtimeTag = `<script src="${RUNTIME_SRC}" data-ucan-v321-locomotion="true"></script>`;
  if (mainPattern.test(html)) html = html.replace(mainPattern, `${runtimeTag}\n  $1`);
  else html = html.replace('</head>', `  ${runtimeTag}\n</head>`);

  const renderParityPattern = /(<script[^>]+src=["']\/js\/ucan_v314_render_parity\.js[^>]*><\/script>)/i;
  const loaderTag = `<script src="${LOADER_SRC}" data-ucan-v321-social-loader="true"></script>`;
  if (renderParityPattern.test(html)) html = html.replace(renderParityPattern, `${loaderTag}\n  $1`);
  else html = html.replace('</body>', `  ${loaderTag}\n</body>`);

  html = html.replace(/UCAN Academic Mall V(?:272|283|313|314|315|316|317|318|319|320)/g, 'UCAN Academic Mall V321');
  html = html.replace(/COMPILACIÓN V(?:272|283|313|314|315|316|317|318|319|320)(?: · [^<]+)?(?: ACTIVA)?/g, 'COMPILACIÓN V321 · AUTORIDAD ÚNICA DE ESCALERAS');
  html = html.replace(/V(?:272|283|313|314|315|316|317|318|319|320):[^<]*/g, 'V321: una sola autoridad controla las seis rutas de escaleras en todos los entornos.');
  html = html.replace('</head>', `  <meta name="ucan-runtime-v321" content="${BUILD}" />\n</head>`);
  return html;
}

function patchBaseScene(source) {
  let code = String(source || '');
  code = code.replace('const width = 5.2;', 'const width = 8.4;');
  code = code.replace(/new BABYLON\.Vector3\(7\.2, 0\.12, 4\.2\), mats\.path, root, true\);/g, 'new BABYLON.Vector3(10.6, 0.12, 5.4), mats.path, root, true);');
  code = code.replace(/\s*box\(scene, 'baranda cristal hueco norte premium',[^\n]+\);/g, '');
  code = code.replace(/\s*box\(scene, 'baranda cristal hueco sur premium',[^\n]+\);/g, '');

  code = code.replace(
    'setupEscalatorRide(scene, camera);',
    "window.__UCAN_LEGACY_ESCALATOR_RIDE_DISABLED_V321__ = true;"
  );
  code = code.replace(
    'setupReliableMovement(scene, camera);',
    "window.__UCAN_LEGACY_RELIABLE_MOVEMENT_DISABLED_V321__ = true;"
  );
  code = code.replace(
    'scene.onBeforeRenderObservable.add(() => clampCameraHeight(camera));',
    "window.__UCAN_LEGACY_CLAMP_HEIGHT_DISABLED_V321__ = true;"
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
    /function groundFor\(position\) \{\s*const ramp = rampGround\(position, state\.ground\);/,
    `function groundFor(position) {\n    const sharedGround = window.__UCAN_STAIR_AUTHORITY_V321__?.resolveGround?.(position, state.ground);\n    if (Number.isFinite(Number(sharedGround))) return Number(sharedGround);\n    const ramp = rampGround(position, state.ground);`
  );
  code = code.replace(
    'state.ground = groundFor(state.desktop.position);',
    `state.ground = Number(window.__UCAN_STAIR_AUTHORITY_V321__?.resolveGround?.(state.desktop.position, state.ground) ?? state.ground);`
  );
  code = code.replace(
    'state.floor = state.ground;\n      state.velocity?.set?.(0, 0, 0);',
    `state.floor = state.ground;\n      window.__UCAN_STAIR_AUTHORITY_V321__?.setFloor?.(state.ground, 'panel-navigation');\n      state.velocity?.set?.(0, 0, 0);`
  );
  code = code.replace(
    'state.floor = nearestFloor(state.ground);\n    camera.position.y = state.ground + currentEyeHeight();',
    `state.floor = nearestFloor(state.ground);\n    window.__UCAN_STAIR_AUTHORITY_V321__?.setFloor?.(state.floor, 'teleport');\n    camera.position.y = state.ground + currentEyeHeight();`
  );
  code = code.replace(
    'state.floor = floor;\n    state.velocity.set(0, 0, 0);',
    `state.floor = floor;\n    window.__UCAN_STAIR_AUTHORITY_V321__?.setFloor?.(floor, 'reset');\n    state.velocity.set(0, 0, 0);`
  );
  code = code.replace(
    "console.info('[UCAN V316 R20] Auditoría completa, locomoción por rig y panel unificado instalados.');",
    "console.info('[UCAN V321 R25] Locomoción delegada a una sola autoridad de escaleras.');"
  );
  return code;
}

function patchCanonicalScene(source) {
  return String(source || '').replace(
    "const STAIR = Object.freeze({ minX:40.8, maxX:47.2, bottomZ:39.0, topZ:10.5 });",
    "const STAIR = Object.freeze({ minX:39.5, maxX:48.5, bottomZ:39.0, topZ:10.5 });"
  );
}

function patchRenderParity(source) {
  let code = String(source || '');
  const comfort = `function comfortV321(requested){let z=0,s=st.scene;if(!s)return z;let mode=requested;try{mode=mode||localStorage.getItem('ucanV319VisualMode')||'comfort'}catch(_){mode=mode||'comfort'}if(!['comfort','dim','normal'].includes(mode))mode='comfort';s.metadata={...(s.metadata||{})};if(!s.metadata.ucanV321BaseVisual){const i=s.imageProcessingConfiguration;s.metadata.ucanV321BaseVisual={exposure:n(i?.exposure??1),contrast:n(i?.contrast??1),environmentIntensity:n(s.environmentIntensity??1)}}const base=s.metadata.ucanV321BaseVisual,p=mode==='dim'?{exposure:.58,contrast:1.02,environment:.52,light:.60}:mode==='normal'?{exposure:base.exposure,contrast:base.contrast,environment:base.environmentIntensity,light:1}:{exposure:.72,contrast:1.04,environment:.65,light:.74};const i=s.imageProcessingConfiguration;if(i){if(!eq(i.exposure,p.exposure,.001)){i.exposure=p.exposure;z++}if(!eq(i.contrast,p.contrast,.001)){i.contrast=p.contrast;z++}if('toneMappingEnabled'in i&&!i.toneMappingEnabled){i.toneMappingEnabled=true;z++}}if(!eq(s.environmentIntensity,p.environment,.001)){s.environmentIntensity=p.environment;z++}for(const l of s.lights||[]){l.metadata={...(l.metadata||{})};if(!Number.isFinite(Number(l.metadata.ucanV321BaseIntensity)))l.metadata.ucanV321BaseIntensity=n(l.intensity);const target=n(l.metadata.ucanV321BaseIntensity)*p.light;if(!eq(l.intensity,target,.001)){l.intensity=target;z++}}window.__UCAN_VISUAL_COMFORT_V319__={version:'V321',revision:'R25',mode,exposure:p.exposure,contrast:p.contrast,environmentIntensity:p.environment,lightFactor:p.light,sameBrowserVr:true};return z}\nwindow.__UCAN_APPLY_VISUAL_COMFORT_V319__=comfortV321;\n`;
  code = code.replace('function profile(){if(!st.scene||!st.engine)return 0;let z=0;', `${comfort}function profile(){if(!st.scene||!st.engine)return 0;let z=comfortV321();`);
  code = code.replace('z+=rs();st.repairs++;', 'z+=rs();z+=comfortV321();st.repairs++;');
  return code;
}

function transformScript(pathname, value) {
  if (pathname === '/js/ucan_babylon_mall_v265_accounts_avatars.js') return patchBaseScene(value);
  if (pathname === '/js/ucan_v316_complete_browser_vr_audit.js') return patchLocomotion(value);
  if (pathname === '/js/ucan_v313_parallel_scene.js') return patchCanonicalScene(value);
  if (pathname === '/js/ucan_v314_render_parity.js') return patchRenderParity(value);
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
      architecture:'single-stair-authority-no-legacy-movement',
      singleStairAuthority:true,
      allSixStairRoutes:true,
      sameRulesBrowserMobileVrMr:true,
      legacyEscalatorRideDisabled:true,
      legacyReliableMovementDisabled:true,
      legacyClampCameraHeightDisabled:true,
      stableFloorOnlyChangesByRouteOrExplicitNavigation:true,
      intentionalDirectionRequired:true,
      automaticFloorChangesDisabled:true,
      allFrontEscalatorGlassRemoved:true,
      rooftopStairWidth:8.4,
      rooftopLandingWidth:10.6,
      visualComfortSameBrowserVr:true,
      oneLocomotionRig:true,
      runtime:RUNTIME_SRC,
      socialLoader:LOADER_SRC,
      persistentAccounts:true,
      persistentAvatars:true,
      persistentDataWritable:persistence.writable === true,
      realtimeParticipants:Number(realtime.participants || 0),
      realtimeSubscribers:Number(realtime.subscribers || 0)
    });
  } catch (_) { return value; }
}

http.ServerResponse.prototype.writeHead = function writeHeadV321(statusCode, statusMessage, headers) {
  let message = statusMessage;
  let nextHeaders = headers;
  if (statusMessage && typeof statusMessage === 'object') { nextHeaders = statusMessage; message = undefined; }
  const pathname = requestPath(this);
  const contentType = String((nextHeaders && Object.entries(nextHeaders).find(([key]) => key.toLowerCase() === 'content-type')?.[1]) || this.getHeader?.('Content-Type') || '');
  const transformable = SCRIPT_TARGETS.has(pathname) || /text\/html/i.test(contentType) || ((pathname === '/version' || pathname === '/health' || pathname === '/healthz') && /application\/json/i.test(contentType));
  if (transformable) this.__ucanV321Chunks = [];
  try {
    this.removeHeader?.('Content-Length');
    this.setHeader?.('X-UCAN-Version', VERSION);
    this.setHeader?.('X-UCAN-Revision', REVISION);
    this.setHeader?.('X-UCAN-Stair-Authority', 'single');
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
    nextHeaders['X-UCAN-Stair-Authority'] = 'single';
    if (transformable) {
      nextHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
      nextHeaders.Pragma = 'no-cache';
      nextHeaders.Expires = '0';
    }
  }
  if (message === undefined) return baseWriteHead.call(this, statusCode, nextHeaders);
  return baseWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.write = function writeV321(chunk, encoding, callback) {
  if (Array.isArray(this.__ucanV321Chunks)) {
    if (chunk != null) this.__ucanV321Chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : 'utf8'));
    if (typeof encoding === 'function') process.nextTick(encoding);
    else if (typeof callback === 'function') process.nextTick(callback);
    return true;
  }
  return baseWrite.call(this, chunk, encoding, callback);
};

http.ServerResponse.prototype.end = function endV321(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (Array.isArray(this.__ucanV321Chunks)) {
      if (body != null) this.__ucanV321Chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body), typeof encoding === 'string' ? encoding : 'utf8'));
      const combined = Buffer.concat(this.__ucanV321Chunks).toString('utf8');
      delete this.__ucanV321Chunks;
      const pathname = requestPath(this);
      const transformed = SCRIPT_TARGETS.has(pathname)
        ? transformScript(pathname, combined)
        : pathname === '/version' || pathname === '/health' || pathname === '/healthz'
          ? transformJson(combined)
          : transformHtml(combined);
      body = Buffer.from(String(transformed), 'utf8');
    }
  } catch (reason) {
    console.error('[UCAN V321 response]', reason);
  }
  return baseEnd.call(this, body, encoding, callback);
};

console.info(`[UCAN ${VERSION} ${REVISION}] Autoridad única de escaleras activa (${BUILD}).`);
