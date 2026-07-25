'use strict';

const http = require('http');

// Conserva R4, V293, V287, autenticación, pisos, barandas y geometría Meta Quest.
require('./auth-compat-v304-r4.js');

const previousWriteHead = http.ServerResponse.prototype.writeHead;
const previousEnd = http.ServerResponse.prototype.end;

const REVISION = 'R5';
const BUILD = 'V304-20260725-GLOBAL-GLASS-UPRIGHT-SIGNS-R5';
const LOADER_BUILD = 'V304-20260725-GLOBAL-R5-LOADER';
const RUNTIME_PATH = '/js/ucan_v304_global_glass_signs_r5.js';
const RUNTIME_SCRIPT = `${RUNTIME_PATH}?build=${BUILD}`;

function updateVersionData(data) {
  if (!data || typeof data !== 'object') return data;
  const versionPayload = Object.prototype.hasOwnProperty.call(data, 'version') ||
    Object.prototype.hasOwnProperty.call(data, 'build') ||
    Object.prototype.hasOwnProperty.call(data, 'releaseVersion') ||
    Object.prototype.hasOwnProperty.call(data, 'questControlsVersion');
  if (!versionPayload) return data;

  data.globalVisualRevision = REVISION;
  data.globalVisualBuild = BUILD;
  data.globalVisualRuntime = RUNTIME_SCRIPT;
  data.browserGlassCorrected = true;
  data.browserGlassColor = '#a9dce6';
  data.browserGlassAlpha = 0.52;
  data.browserGlassLightingIndependent = true;
  data.browserGlassDepthPrePassDisabled = true;
  data.browserGlassDepthWriteDisabled = true;
  data.seasonalBoardsTwoFrontFaces = true;
  data.seasonalBoardsBacksideMirroringDisabled = true;
  data.seasonalBoardsBillboardDisabled = true;
  data.seasonalBoardsUpright = true;
  data.seasonalBoardsBrowserQuestMR = true;
  data.questR4Preserved = true;
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

http.ServerResponse.prototype.writeHead = function writeHeadV304R5(statusCode, statusMessage, headers) {
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
    nextHeaders['X-UCAN-Global-Visual-Revision'] = REVISION;
    nextHeaders['X-UCAN-Browser-Glass'] = REVISION;
    nextHeaders['X-UCAN-Seasonal-Signs'] = REVISION;
  }
  if (message === undefined) return previousWriteHead.call(this, statusCode, nextHeaders);
  return previousWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.end = function endV304R5(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      const isBuffer = Buffer.isBuffer(body);
      const text = isBuffer ? body.toString(typeof encoding === 'string' ? encoding : 'utf8') : body;
      const transformed = transformText(text);
      body = isBuffer ? Buffer.from(transformed, 'utf8') : transformed;
    }
  } catch (error) {
    console.error('[UCAN V304 R5 response compatibility]', error);
  }
  return previousEnd.call(this, body, encoding, callback);
};

console.info(`[UCAN V304 ${REVISION}] Preloader global de cristales y carteles activo.`);