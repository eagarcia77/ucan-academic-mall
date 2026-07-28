'use strict';

const http = require('http');

// Conserva autenticación, pisos, cristales, barandas y revisiones anteriores.
require('./auth-compat-v304-r5.js');

const previousWriteHead = http.ServerResponse.prototype.writeHead;
const previousWrite = http.ServerResponse.prototype.write;
const previousEnd = http.ServerResponse.prototype.end;

const VERSION = 'V307';
const REVISION = 'R11';
const BUILD = 'V307-20260728-BROWSER-XR-DEVICE-PRESENCE-R11';
const LOADER_BUILD = 'V307-20260728-R11-NO-CACHE-LOADER';
const RUNTIME_PATH = '/js/ucan_v305_floor1_terrace_vr_r9.js';
const RUNTIME_SCRIPT = `${RUNTIME_PATH}?build=V305-20260728-FLOOR1-ADS-TERRACE-XR-R9`;
const BRAND_BUILD = 'V306-20260728-FLOOR1-BRAND-UPRIGHT-VR-R10';
const BRAND_RUNTIME_PATH = '/js/ucan_v306_floor1_brand_orientation_r10.js';
const BRAND_RUNTIME_SCRIPT = `${BRAND_RUNTIME_PATH}?build=${BRAND_BUILD}`;
const PRESENCE_RUNTIME_PATH = '/js/ucan_v307_presence_xr_bridge.js';
const PRESENCE_RUNTIME_SCRIPT = `${PRESENCE_RUNTIME_PATH}?build=V307-20260728-BROWSER-XR-DEVICE-PRESENCE`;
const BUFFERABLE_CONTENT = /(?:text\/html|application\/javascript|text\/javascript)/i;

function updateVersionData(data) {
  if (!data || typeof data !== 'object') return data;
  const versionPayload = Object.prototype.hasOwnProperty.call(data, 'version') ||
    Object.prototype.hasOwnProperty.call(data, 'build') ||
    Object.prototype.hasOwnProperty.call(data, 'releaseVersion') ||
    Object.prototype.hasOwnProperty.call(data, 'questControlsVersion');
  if (!versionPayload) return data;

  data.releaseVersion = VERSION;
  data.presenceRevision = REVISION;
  data.presenceBuild = BUILD;
  data.presenceRuntime = PRESENCE_RUNTIME_SCRIPT;
  data.presenceApi = '/api/presence-v2';
  data.presenceByDeviceSession = true;
  data.sameAccountMultipleDevicesVisible = true;
  data.browserUsersVisibleInVr = true;
  data.vrUsersVisibleInBrowser = true;
  data.realXrCameraPresence = true;
  data.legacyUserIdPresenceDisabledV307 = true;
  data.floor1BrandVrRevision = 'R10';
  data.floor1BrandVrBuild = BRAND_BUILD;
  data.floor1BrandVrRuntime = BRAND_RUNTIME_SCRIPT;
  data.floor1BrandExactMetadataTarget = 'brandLogo';
  data.floor1BrandOriginalDoubleSideCauseConfirmed = true;
  data.floor1BrandTwoIndependentFrontFacesR10 = true;
  data.floor1BrandBillboardDisabledR10 = true;
  data.floor1BrandMirroredBackfaceSuppressedR10 = true;
  data.floor1BrandR8R9FacesSuppressedR10 = true;
  data.floor1TerraceVrRuntime = RUNTIME_SCRIPT;
  data.questHtmlJsNoCacheR11 = true;
  data.loaderBuild = LOADER_BUILD;
  return data;
}

function patchR5Runtime(value) {
  if (!value.includes('V304-20260725-GLOBAL-GLASS-UPRIGHT-SIGNS-R5')) return value;
  let patched = value;
  patched = patched.replace(
    "function normalizeBoards() {\n    if (!state.scene) return;",
    "function normalizeBoards() {\n    if (window.__UCAN_FLOOR1_BRAND_VR_V306_R10__?.installed === true || window.__UCAN_VR_INTERACTION_V305_R9__?.installed === true || window.__UCAN_VISUAL_INTERACTION_V304_R6__?.installed === true) return;\n    if (!state.scene) return;"
  );
  patched = patched.replace(
    "function maintainBoards() {\n    for (const [source, faces] of state.boardFaces) {",
    "function maintainBoards() {\n    const newerRuntimeOwnsBoards = window.__UCAN_FLOOR1_BRAND_VR_V306_R10__?.installed === true || window.__UCAN_VR_INTERACTION_V305_R9__?.installed === true || window.__UCAN_VISUAL_INTERACTION_V304_R6__?.installed === true;\n    for (const [source, faces] of state.boardFaces) {"
  );
  patched = patched.replace(
    "for (const face of faces) {\n        try {\n          face.setEnabled?.(true);\n          face.isVisible = true;\n          face.visibility = 1;",
    "for (const face of faces) {\n        try {\n          face.setEnabled?.(!newerRuntimeOwnsBoards);\n          face.isVisible = !newerRuntimeOwnsBoards;\n          face.visibility = newerRuntimeOwnsBoards ? 0 : 1;"
  );
  return patched;
}

function normalizeTextureOrientation(value) {
  let patched = value;
  if (patched.includes('V304-20260723-SEASONAL-NATURAL-ECOSYSTEM-PR')) {
    patched = patched.replace(/board\.texture\.update\(true\);/g, 'board.texture.update(false);');
  }
  if (patched.includes('V292-20260721-UNIVERSAL-SIGN-WINDOW-CLOCK')) {
    patched = patched.replace(/state\.texture\.update\(true\);/g, 'state.texture.update(false);');
  }
  if (patched.includes('V287-20260720-FLOOR-STATE-SKY-OPT')) {
    patched = patched.replace(/state\.infoTexture\.update\(true\);/g, 'state.infoTexture.update(false);');
  }
  return patched;
}

function upgradeLoaderToR11(value) {
  let patched = value;
  patched = patched.replace(
    /\/js\/ucan_v266_keyboard_jump\.js(?:\?build=[^"']+)?/g,
    `/js/ucan_v266_keyboard_jump.js?build=${LOADER_BUILD}`
  );
  patched = patched.replace(/loadFloor1TerraceR8/g, 'loadFloor1TerraceR9');
  patched = patched.replace(
    /\/js\/ucan_v305_floor1_terrace_vr_r8\.js\?build=V305-20260728-FLOOR1-UPRIGHT-TERRACE-JOYSTICK-R8/g,
    RUNTIME_SCRIPT
  );
  patched = patched.replace(/data-ucan-v305-floor1-terrace-r8/g, 'data-ucan-v305-floor1-terrace-r9');
  patched = patched.replace(/\[UCAN V305 R8\][^'"\n]*/g, '[UCAN V305 R9] No se pudo cargar la corrección de terraza XR.');
  return patched;
}

function transformText(text) {
  let value = String(text);
  value = upgradeLoaderToR11(value);
  value = patchR5Runtime(value);
  value = normalizeTextureOrientation(value);

  const trimmed = value.trim();
  if (/^[\[{]/.test(trimmed)) {
    try { return JSON.stringify(updateVersionData(JSON.parse(value))); }
    catch (_) {}
  }
  return value;
}

function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const key = Object.keys(headers).find(candidate => candidate.toLowerCase() === name.toLowerCase());
  return key ? String(headers[key] || '') : '';
}

function applyDiagnosticHeaders(response, headers, contentType) {
  const noCache = BUFFERABLE_CONTENT.test(contentType || '');
  try {
    response.removeHeader?.('Content-Length');
    response.setHeader?.('X-UCAN-VR-Revision', REVISION);
    response.setHeader?.('X-UCAN-VR-Build', BUILD);
    response.setHeader?.('X-UCAN-Presence-Version', VERSION);
    response.setHeader?.('X-UCAN-Quest-Cache', noCache ? 'no-store' : 'default');
    if (noCache) {
      response.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      response.setHeader?.('Pragma', 'no-cache');
      response.setHeader?.('Expires', '0');
      response.setHeader?.('Surrogate-Control', 'no-store');
    }
  } catch (_) {}

  if (!headers || typeof headers !== 'object') return headers;
  const next = { ...headers };
  for (const key of Object.keys(next)) {
    const lower = key.toLowerCase();
    if (lower === 'content-length') delete next[key];
    if (noCache && ['cache-control', 'pragma', 'expires', 'surrogate-control'].includes(lower)) delete next[key];
  }
  next['X-UCAN-VR-Revision'] = REVISION;
  next['X-UCAN-VR-Build'] = BUILD;
  next['X-UCAN-Presence-Version'] = VERSION;
  next['X-UCAN-Quest-Cache'] = noCache ? 'no-store' : 'default';
  if (noCache) {
    next['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0';
    next.Pragma = 'no-cache';
    next.Expires = '0';
    next['Surrogate-Control'] = 'no-store';
  }
  return next;
}

http.ServerResponse.prototype.writeHead = function writeHeadV307R11(statusCode, statusMessage, headers) {
  let message = statusMessage;
  let nextHeaders = headers;
  if (statusMessage && typeof statusMessage === 'object') {
    nextHeaders = statusMessage;
    message = undefined;
  }

  const contentType = headerValue(nextHeaders, 'content-type') || String(this.getHeader?.('Content-Type') || '');
  if (BUFFERABLE_CONTENT.test(contentType)) this.__ucanR11TextChunks = [];
  nextHeaders = applyDiagnosticHeaders(this, nextHeaders, contentType);

  if (message === undefined) return previousWriteHead.call(this, statusCode, nextHeaders);
  return previousWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.write = function writeV307R11(chunk, encoding, callback) {
  if (Array.isArray(this.__ucanR11TextChunks)) {
    if (chunk != null) this.__ucanR11TextChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : 'utf8'));
    if (typeof encoding === 'function') process.nextTick(encoding);
    else if (typeof callback === 'function') process.nextTick(callback);
    return true;
  }
  return previousWrite.call(this, chunk, encoding, callback);
};

http.ServerResponse.prototype.end = function endV307R11(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (Array.isArray(this.__ucanR11TextChunks)) {
      if (body != null) this.__ucanR11TextChunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body), typeof encoding === 'string' ? encoding : 'utf8'));
      const combined = Buffer.concat(this.__ucanR11TextChunks).toString('utf8');
      delete this.__ucanR11TextChunks;
      body = Buffer.from(transformText(combined), 'utf8');
    } else if (typeof body === 'string' || Buffer.isBuffer(body)) {
      const isBuffer = Buffer.isBuffer(body);
      const text = isBuffer ? body.toString(typeof encoding === 'string' ? encoding : 'utf8') : body;
      const transformed = transformText(text);
      body = isBuffer ? Buffer.from(transformed, 'utf8') : transformed;
    }
  } catch (error) {
    console.error('[UCAN V307 R11 response compatibility]', error);
  }
  return previousEnd.call(this, body, encoding, callback);
};

console.info(`[UCAN ${VERSION} ${REVISION}] Cargador sin caché y presencia browser/WebXR activos.`);
