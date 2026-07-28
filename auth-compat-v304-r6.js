'use strict';

const http = require('http');

// Conserva R5, R4, V293, V287, autenticación, pisos, cristales y barandas.
require('./auth-compat-v304-r5.js');

const previousWriteHead = http.ServerResponse.prototype.writeHead;
const previousEnd = http.ServerResponse.prototype.end;

const REVISION = 'R6';
const BUILD = 'V304-20260728-UPRIGHT-SIGNS-TERRACE-XR-INTERACTION-R6';
const LOADER_BUILD = 'V304-20260728-R6-SIGNS-TERRACE-LOADER';
const RUNTIME_PATH = '/js/ucan_v304_signs_terrace_interaction_r6.js';
const RUNTIME_SCRIPT = `${RUNTIME_PATH}?build=${BUILD}`;

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
  data.terraceTriggerSelectionR6 = true;
  data.terracePrimarySelectionR6 = true;
  data.terraceJoystickSelectionR6 = true;
  data.terraceControllerRaySelectionR6 = true;
  data.terraceHeadGazeFallbackR6 = true;
  data.terraceOwnXRInfoPanelR6 = true;
  data.terraceInfoTextureInvertYR6 = true;
  data.r5GlobalGlassPreserved = true;
  data.r4QuestRailsPreserved = true;
  return data;
}

function transformText(text) {
  let value = String(text);
  if (/<html|<body|<script/i.test(value)) {
    value = value.replace(
      /\/js\/ucan_v266_keyboard_jump\.js\?build=[^"']+/g,
      `/js/ucan_v266_keyboard_jump.js?build=${LOADER_BUILD}`
    );
  }
  const trimmed = value.trim();
  if (/^[\[{]/.test(trimmed)) {
    try { return JSON.stringify(updateVersionData(JSON.parse(value))); }
    catch (_) {}
  }
  return value;
}

http.ServerResponse.prototype.writeHead = function writeHeadV304R6(statusCode, statusMessage, headers) {
  let message = statusMessage;
  let nextHeaders = headers;
  if (statusMessage && typeof statusMessage === 'object') {
    nextHeaders = statusMessage;
    message = undefined;
  }
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

http.ServerResponse.prototype.end = function endV304R6(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
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