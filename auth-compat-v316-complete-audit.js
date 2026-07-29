'use strict';

const http = require('http');
const baseWriteHead = http.ServerResponse.prototype.writeHead;
const baseWrite = http.ServerResponse.prototype.write;
const baseEnd = http.ServerResponse.prototype.end;

// Conserva autenticación, persistencia, voz y mundo social. V316 reemplaza solamente
// la locomoción, la entrada XR y la entrega del panel.
require('./auth-compat-v313-parallel.js');

const VERSION = 'V316';
const REVISION = 'R20';
const BUILD = 'V316-20260729-COMPLETE-BROWSER-VR-AUDIT-R20';
const RUNTIME_SRC = `/js/ucan_v316_complete_browser_vr_audit.js?build=${BUILD}`;
const LOADER_SRC = '/js/ucan_v316_social_loader.js?build=V316-20260729-SOCIAL-LOADER-NO-DUPLICATE-XR-R20';

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
    'ucan_v316_social_loader.js'
  ]) html = removeScript(html, script);

  // El antiguo cargador incluía salto y una segunda entrada XR. Se sustituye por un
  // cargador que solo instala escena, presencia, voz e interacción.
  html = removeScript(html, 'ucan_v266_keyboard_jump.js');

  const mainPattern = /(<script[^>]+src=["']\/js\/ucan_babylon_mall_v265_accounts_avatars\.js[^>]*><\/script>)/i;
  const runtimeTag = `<script src="${RUNTIME_SRC}" data-ucan-v316-complete-audit="true"></script>`;
  if (mainPattern.test(html)) html = html.replace(mainPattern, `${runtimeTag}\n  $1`);
  else html = html.replace('</head>', `  ${runtimeTag}\n</head>`);

  const renderParityPattern = /(<script[^>]+src=["']\/js\/ucan_v314_render_parity\.js[^>]*><\/script>)/i;
  const loaderTag = `<script src="${LOADER_SRC}" data-ucan-v316-social-loader="true"></script>`;
  if (renderParityPattern.test(html)) html = html.replace(renderParityPattern, `${loaderTag}\n  $1`);
  else html = html.replace('</body>', `  ${loaderTag}\n</body>`);

  html = html.replace(/UCAN Academic Mall V(?:272|283|313|314|315)/g, 'UCAN Academic Mall V316');
  html = html.replace(/COMPILACIÓN V(?:272|283|313|314|315)(?: · [^<]+)?(?: ACTIVA)?/g, 'COMPILACIÓN V316 · AUDITORÍA COMPLETA BROWSER/VR');
  html = html.replace(/V(?:272|283|313|314|315):[^<]*/g, 'V316: browser y VR comparten escena, rig de locomoción, escaleras continuas, panel e interacción.');
  html = html.replace('Use W/A/S/D o las flechas para caminar, la barra espaciadora para saltar y R para reubicarse.', 'Use W/A/S/D o el joystick izquierdo para caminar; joystick derecho para girar o teletransportarse; R para reubicarse.');
  html = html.replace('</head>', `  <meta name="ucan-runtime-v316" content="${BUILD}" />\n</head>`);
  return html;
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
      architecture:'one-scene-one-rig-one-panel',
      completeBrowserVrAudit:true,
      sameFloor1BrowserVr:true,
      sameFloor2BrowserVr:true,
      sameFloor3BrowserVr:true,
      sameSceneBrowserVr:true,
      oneLocomotionRig:true,
      continuousStairMovement:true,
      scriptedStairTransitions:false,
      avatarCameraPresenceSynchronized:true,
      naturalSpeedMetersPerSecond:6.4,
      fastSpeedMetersPerSecond:9.0,
      joystickDeadZone:0.12,
      leftJoystickMove:true,
      leftJoystickStrafe:true,
      leftJoystickClickSprint:true,
      rightJoystickSmoothTurn:true,
      rightJoystickSnapTurn:true,
      rightJoystickClickTurnMode:true,
      rightJoystickTeleport:true,
      triggerInteraction:true,
      primaryButtonInteraction:true,
      secondaryButtonClose:true,
      gripGestures:true,
      leftPanelSingleController:true,
      defaultBabylonXrButtonDisabled:true,
      floatingGreenVrButtonRemoved:true,
      legacyV272LocomotionLoaded:false,
      legacyV304XrEntryLoaded:false,
      legacyV313XrEntryLoaded:false,
      legacyV315LocomotionLoaded:false,
      runtime:RUNTIME_SRC,
      socialLoader:LOADER_SRC,
      persistentAccounts:true,
      persistentAvatars:true,
      persistentDataWritable:persistence.writable === true,
      realtimeParticipants:Number(realtime.participants || 0),
      realtimeSubscribers:Number(realtime.subscribers || 0)
    });
  } catch (_) {
    return value;
  }
}

http.ServerResponse.prototype.writeHead = function writeHeadV316(statusCode, statusMessage, headers) {
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
  const transformable = /text\/html/i.test(contentType) ||
    ((pathname === '/version' || pathname === '/health' || pathname === '/healthz') && /application\/json/i.test(contentType));
  if (transformable) this.__ucanV316Chunks = [];

  try {
    this.removeHeader?.('Content-Length');
    this.setHeader?.('X-UCAN-Version', VERSION);
    this.setHeader?.('X-UCAN-Revision', REVISION);
    this.setHeader?.('X-UCAN-Locomotion', 'one-rig');
    this.setHeader?.('X-UCAN-Panel', 'single-controller');
    this.setHeader?.('Permissions-Policy', 'microphone=(self), xr-spatial-tracking=(self)');
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
    nextHeaders['X-UCAN-Locomotion'] = 'one-rig';
    nextHeaders['X-UCAN-Panel'] = 'single-controller';
    nextHeaders['Permissions-Policy'] = 'microphone=(self), xr-spatial-tracking=(self)';
    if (transformable) {
      nextHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
      nextHeaders.Pragma = 'no-cache';
      nextHeaders.Expires = '0';
    }
  }
  if (message === undefined) return baseWriteHead.call(this, statusCode, nextHeaders);
  return baseWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.write = function writeV316(chunk, encoding, callback) {
  if (Array.isArray(this.__ucanV316Chunks)) {
    if (chunk != null) this.__ucanV316Chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : 'utf8'));
    if (typeof encoding === 'function') process.nextTick(encoding);
    else if (typeof callback === 'function') process.nextTick(callback);
    return true;
  }
  return baseWrite.call(this, chunk, encoding, callback);
};

http.ServerResponse.prototype.end = function endV316(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (Array.isArray(this.__ucanV316Chunks)) {
      if (body != null) this.__ucanV316Chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body), typeof encoding === 'string' ? encoding : 'utf8'));
      const combined = Buffer.concat(this.__ucanV316Chunks).toString('utf8');
      delete this.__ucanV316Chunks;
      const pathname = requestPath(this);
      body = Buffer.from(
        pathname === '/version' || pathname === '/health' || pathname === '/healthz'
          ? transformJson(combined)
          : transformHtml(combined),
        'utf8'
      );
    }
  } catch (error) {
    console.error('[UCAN V316 response]', error);
  }
  return baseEnd.call(this, body, encoding, callback);
};

console.info(`[UCAN ${VERSION} ${REVISION}] Auditoría completa y rig único activados (${BUILD}).`);
