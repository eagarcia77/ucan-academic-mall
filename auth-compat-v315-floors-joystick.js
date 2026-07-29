'use strict';

const http = require('http');
const baseWriteHead = http.ServerResponse.prototype.writeHead;
const baseWrite = http.ServerResponse.prototype.write;
const baseEnd = http.ServerResponse.prototype.end;

require('./auth-compat-v313-parallel.js');

const VERSION = 'V315';
const REVISION = 'R19';
const BUILD = 'V315-20260729-FLOORS-JOYSTICK-ONE-LOCOMOTION-R19';
const LOADER_BUILD = 'V315-20260729-FLOORS-JOYSTICK-LOADER-R19';
const RUNTIME_SRC = `/js/ucan_v315_unified_floors_joystick.js?build=${BUILD}`;

function requestPath(response) {
  try { return new URL(response?.req?.url || '/', 'http://localhost').pathname; }
  catch (_) { return ''; }
}

function transformHtml(value) {
  let html = String(value || '');

  // Elimina controladores XR y de movimiento anteriores antes de que puedan instalarse.
  html = html.replace(/\s*<script[^>]+ucan_v272_xr_desktop_parity\.js[^>]*><\/script>/gi, '');
  html = html.replace(/\s*<script[^>]+ucan_v304_xr_entry_mr_fix\.js[^>]*><\/script>/gi, '');
  html = html.replace(/\s*<script[^>]+ucan_v315_unified_floors_joystick\.js[^>]*><\/script>/gi, '');

  // Mantiene el cargador social V313, pero con una URL nueva sin caché.
  html = html.replace(
    /\/js\/ucan_v266_keyboard_jump\.js(?:\?build=[^"']+)?/g,
    `/js/ucan_v266_keyboard_jump.js?build=${LOADER_BUILD}`
  );

  // V315 debe ejecutarse después de Babylon y antes del archivo que construye la escena.
  const mainPattern = /(<script[^>]+src=["']\/js\/ucan_babylon_mall_v265_accounts_avatars\.js[^>]*><\/script>)/i;
  if (mainPattern.test(html)) {
    html = html.replace(mainPattern, `<script src="${RUNTIME_SRC}" data-ucan-v315-floors-joystick="true"></script>\n  $1`);
  } else {
    html = html.replace('</head>', `  <script src="${RUNTIME_SRC}" data-ucan-v315-floors-joystick="true"></script>\n</head>`);
  }

  html = html.replace(/UCAN Academic Mall V(?:272|283|313|314)/g, 'UCAN Academic Mall V315');
  html = html.replace(/COMPILACIÓN V(?:272|283|313|314)(?: · [^<]+)?(?: ACTIVA)?/g, 'COMPILACIÓN V315 · PISOS Y JOYSTICK UNIFICADOS');
  html = html.replace(/V(?:272|283|313|314):[^<]*/g, 'V315: pisos 1, 2 y 3 comparten la misma escena y browser/VR utilizan un solo motor de locomoción.');
  html = html.replace('</head>', `  <meta name="ucan-runtime-v315" content="${BUILD}" />\n</head>`);
  return html;
}

function transformJson(value) {
  try {
    const data = JSON.parse(String(value || '{}'));
    if (!data || typeof data !== 'object') return value;
    return JSON.stringify({
      ...data,
      ok:data.ok !== false,
      version:VERSION,
      releaseVersion:VERSION,
      revision:REVISION,
      build:BUILD,
      loaderBuild:LOADER_BUILD,
      architecture:'one-scene-one-locomotion-floor-parity',
      sameFloor1BrowserVr:true,
      sameFloor2BrowserVr:true,
      sameFloor3BrowserVr:true,
      sameMovementBrowserVr:true,
      oneLocomotionEngine:true,
      legacyV272LocomotionLoaded:false,
      legacyV283LocomotionInstalled:false,
      legacyV304XrEntryLoaded:false,
      leftJoystickMove:true,
      leftJoystickClickSprint:true,
      rightJoystickTurn:true,
      rightJoystickClickTurnMode:true,
      rightJoystickForwardTeleport:true,
      smoothTurn:true,
      snapTurn30:true,
      headRelativeMovement:true,
      handRelativeMovement:true,
      controllerTriggerInteraction:true,
      controllerPrimaryInteraction:true,
      controllerSecondaryClose:true,
      controllerGripGestures:true,
      automaticEscalators:true,
      floorParityRuntime:RUNTIME_SRC,
      persistentAccounts:true,
      persistentAvatars:true
    });
  } catch (_) {
    return value;
  }
}

http.ServerResponse.prototype.writeHead = function writeHeadV315(statusCode, statusMessage, headers) {
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
  if (transformable) this.__ucanV315Chunks = [];
  try {
    this.removeHeader?.('Content-Length');
    this.setHeader?.('X-UCAN-Version', VERSION);
    this.setHeader?.('X-UCAN-Revision', REVISION);
    this.setHeader?.('X-UCAN-Locomotion', 'one-engine');
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
    nextHeaders['X-UCAN-Locomotion'] = 'one-engine';
    if (transformable) {
      nextHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
      nextHeaders.Pragma = 'no-cache';
      nextHeaders.Expires = '0';
    }
  }
  if (message === undefined) return baseWriteHead.call(this, statusCode, nextHeaders);
  return baseWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.write = function writeV315(chunk, encoding, callback) {
  if (Array.isArray(this.__ucanV315Chunks)) {
    if (chunk != null) this.__ucanV315Chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : 'utf8'));
    if (typeof encoding === 'function') process.nextTick(encoding);
    else if (typeof callback === 'function') process.nextTick(callback);
    return true;
  }
  return baseWrite.call(this, chunk, encoding, callback);
};

http.ServerResponse.prototype.end = function endV315(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (Array.isArray(this.__ucanV315Chunks)) {
      if (body != null) this.__ucanV315Chunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body), typeof encoding === 'string' ? encoding : 'utf8'));
      const combined = Buffer.concat(this.__ucanV315Chunks).toString('utf8');
      delete this.__ucanV315Chunks;
      const pathname = requestPath(this);
      body = Buffer.from(
        pathname === '/version' || pathname === '/health' || pathname === '/healthz'
          ? transformJson(combined)
          : transformHtml(combined),
        'utf8'
      );
    }
  } catch (error) {
    console.error('[UCAN V315 response]', error);
  }
  return baseEnd.call(this, body, encoding, callback);
};

console.info(`[UCAN ${VERSION} ${REVISION}] Pisos 1–3 y locomoción completa del joystick activados antes de crear la escena (${BUILD}).`);
