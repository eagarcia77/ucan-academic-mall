'use strict';

const http = require('http');

// Conserva R5, R4, V293, V287, autenticación, pisos, cristales y barandas.
require('./auth-compat-v304-r5.js');

const previousWriteHead = http.ServerResponse.prototype.writeHead;
const previousWrite = http.ServerResponse.prototype.write;
const previousEnd = http.ServerResponse.prototype.end;

const REVISION = 'R6';
const BUILD = 'V304-20260728-UPRIGHT-SIGNS-TERRACE-XR-INTERACTION-R6';
const LOADER_BUILD = 'V304-20260728-R6-SIGNS-TERRACE-LOADER';
const RUNTIME_PATH = '/js/ucan_v304_signs_terrace_interaction_r6.js';
const RUNTIME_SCRIPT = `${RUNTIME_PATH}?build=${BUILD}`;
const BUFFERABLE_CONTENT = /(?:text\/html|application\/javascript|text\/javascript)/i;

function updateVersionData(data) {
  if (!data || typeof data !== 'object') return data;
  const versionPayload = Object.prototype.hasOwnProperty.call(data, 'version') ||
    Object.prototype.hasOwnProperty.call(data, 'build') ||
    Object.prototype.hasOwnProperty.call(data, 'releaseVersion') ||
    Object.prototype.hasOwnProperty.call(data, 'questControlsVersion');
  if (!versionPayload) return data;

  data.visualInteractionRevision = REVISION;
  data.visualInteractionBuild = BUILD;
  data.visualInteractionRuntime = RUNTIME_SCRIPT;
  data.seasonalSignsCopiedFromSourceCanvas = true;
  data.seasonalSignsDynamicTextureInvertY = true;
  data.seasonalSignsTwoFrontFacesR6 = true;
  data.seasonalSignsBacksideDisabledR6 = true;
  data.seasonalSignsBillboardDisabledR6 = true;
  data.seasonalSignsUprightBrowserQuestMR = true;
  data.seasonalOriginalBoardsHiddenByR6 = true;
  data.r6LegacySignGuardEnabled = true;
  data.r6LegacySignsSuppressedBeforeRender = true;
  data.r5LegacySignMaintenanceSuppressedByR6 = true;
  data.terraceTriggerSelectionR6 = true;
  data.terracePrimarySelectionR6 = true;
  data.terraceJoystickSelectionR6 = true;
  data.terraceControllerRaySelectionR6 = true;
  data.terraceHeadGazeFallbackR6 = true;
  data.terraceOwnXRInfoPanelR6 = true;
  data.terraceInfoTextureInvertYR6 = true;
  data.universalInfoTextureRuntimeCorrectedR6 = true;
  data.skyInfoTextureRuntimeCorrectedR6 = true;
  data.r5GlobalGlassPreserved = true;
  data.r4QuestRailsPreserved = true;
  data.r6StreamingHtmlJsTransform = true;
  return data;
}

function patchR5Runtime(value) {
  if (!value.includes('V304-20260725-GLOBAL-GLASS-UPRIGHT-SIGNS-R5')) return value;
  let patched = value;
  patched = patched.replace(
    "function normalizeBoards() {\n    if (!state.scene) return;",
    "function normalizeBoards() {\n    if (window.__UCAN_VISUAL_INTERACTION_V304_R6__?.installed === true) return;\n    if (!state.scene) return;"
  );
  patched = patched.replace(
    "function maintainBoards() {\n    for (const [source, faces] of state.boardFaces) {",
    "function maintainBoards() {\n    const r6OwnsBoards = window.__UCAN_VISUAL_INTERACTION_V304_R6__?.installed === true;\n    for (const [source, faces] of state.boardFaces) {"
  );
  patched = patched.replace(
    "for (const face of faces) {\n        try {\n          face.setEnabled?.(true);\n          face.isVisible = true;\n          face.visibility = 1;",
    "for (const face of faces) {\n        try {\n          face.setEnabled?.(!r6OwnsBoards);\n          face.isVisible = !r6OwnsBoards;\n          face.visibility = r6OwnsBoards ? 0 : 1;"
  );
  return patched;
}

function patchSeasonalRuntime(value) {
  if (!value.includes('V304-20260723-SEASONAL-NATURAL-ECOSYSTEM-PR')) return value;
  return value.replace('board.texture.update(false);', 'board.texture.update(true);');
}

function patchUniversalRuntime(value) {
  if (!value.includes('V292-20260721-UNIVERSAL-SIGN-WINDOW-CLOCK')) return value;
  return value.replace('state.texture.update(false);', 'state.texture.update(true);');
}

function patchSkyRuntime(value) {
  if (!value.includes('V287-20260720-FLOOR-STATE-SKY-OPT')) return value;
  return value.replace('state.infoTexture.update(false);', 'state.infoTexture.update(true);');
}

function transformText(text) {
  let value = String(text);
  if (/<html|<body|<script/i.test(value)) {
    value = value.replace(
      /\/js\/ucan_v266_keyboard_jump\.js\?build=[^"']+/g,
      `/js/ucan_v266_keyboard_jump.js?build=${LOADER_BUILD}`
    );
  }
  value = patchR5Runtime(value);
  value = patchSeasonalRuntime(value);
  value = patchUniversalRuntime(value);
  value = patchSkyRuntime(value);

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

http.ServerResponse.prototype.writeHead = function writeHeadV304R6(statusCode, statusMessage, headers) {
  let message = statusMessage;
  let nextHeaders = headers;
  if (statusMessage && typeof statusMessage === 'object') {
    nextHeaders = statusMessage;
    message = undefined;
  }

  const contentType = headerValue(nextHeaders, 'content-type') || String(this.getHeader?.('Content-Type') || '');
  if (BUFFERABLE_CONTENT.test(contentType)) this.__ucanR6TextChunks = [];

  try {
    this.removeHeader?.('Content-Length');
    this.setHeader?.('X-UCAN-Visual-Interaction-Revision', REVISION);
    this.setHeader?.('X-UCAN-Seasonal-Signs', REVISION);
    this.setHeader?.('X-UCAN-Terrace-Interaction', REVISION);
  } catch (_) {}

  if (nextHeaders && typeof nextHeaders === 'object') {
    nextHeaders = { ...nextHeaders };
    for (const key of Object.keys(nextHeaders)) {
      if (key.toLowerCase() === 'content-length') delete nextHeaders[key];
    }
    nextHeaders['X-UCAN-Visual-Interaction-Revision'] = REVISION;
    nextHeaders['X-UCAN-Seasonal-Signs'] = REVISION;
    nextHeaders['X-UCAN-Terrace-Interaction'] = REVISION;
  }
  if (message === undefined) return previousWriteHead.call(this, statusCode, nextHeaders);
  return previousWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.write = function writeV304R6(chunk, encoding, callback) {
  if (Array.isArray(this.__ucanR6TextChunks)) {
    if (chunk != null) this.__ucanR6TextChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : 'utf8'));
    if (typeof encoding === 'function') process.nextTick(encoding);
    else if (typeof callback === 'function') process.nextTick(callback);
    return true;
  }
  return previousWrite.call(this, chunk, encoding, callback);
};

http.ServerResponse.prototype.end = function endV304R6(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (Array.isArray(this.__ucanR6TextChunks)) {
      if (body != null) this.__ucanR6TextChunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body), typeof encoding === 'string' ? encoding : 'utf8'));
      const combined = Buffer.concat(this.__ucanR6TextChunks).toString('utf8');
      delete this.__ucanR6TextChunks;
      body = Buffer.from(transformText(combined), 'utf8');
    } else if (typeof body === 'string' || Buffer.isBuffer(body)) {
      const isBuffer = Buffer.isBuffer(body);
      const text = isBuffer ? body.toString(typeof encoding === 'string' ? encoding : 'utf8') : body;
      const transformed = transformText(text);
      body = isBuffer ? Buffer.from(transformed, 'utf8') : transformed;
    }
  } catch (error) {
    console.error('[UCAN V304 R6 response compatibility]', error);
  }
  return previousEnd.call(this, body, encoding, callback);
};

console.info(`[UCAN V304 ${REVISION}] Preloader de carteles e interacción de terraza activo.`);