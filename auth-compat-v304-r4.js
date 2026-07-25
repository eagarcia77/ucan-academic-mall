'use strict';

const http = require('http');

// Conserva autenticación, pisos, geometría V303 y ecosistema V304.
require('./auth-compat-v293.js');

const previousWriteHead = http.ServerResponse.prototype.writeHead;
const previousEnd = http.ServerResponse.prototype.end;

const REVISION = 'R4';
const BUILD = 'V304-20260725-QUEST-GLASS-RAILS-HOLIDAY-R4';
const LOADER_BUILD = 'V304-20260725-QUEST-R4-LOADER';
const RUNTIME_PATH = '/js/ucan_v304_quest_glass_rails_holiday_r4.js';
const RUNTIME_SCRIPT = `${RUNTIME_PATH}?build=${BUILD}`;

function updateVersionData(data) {
  if (!data || typeof data !== 'object') return data;
  const versionPayload = Object.prototype.hasOwnProperty.call(data, 'version') ||
    Object.prototype.hasOwnProperty.call(data, 'build') ||
    Object.prototype.hasOwnProperty.call(data, 'releaseVersion') ||
    Object.prototype.hasOwnProperty.call(data, 'questControlsVersion');
  if (!versionPayload) return data;

  data.questVisualRevision = REVISION;
  data.questVisualBuild = BUILD;
  data.questVisualRuntime = RUNTIME_SCRIPT;
  data.questGlassConvertedFromBlack = true;
  data.questGlassColor = '#b8e2ea';
  data.questGlassUsesMeshVisibility = true;
  data.questStairRailingsRebuiltOnSideEdges = true;
  data.questStairRailingsBehindStairsDisabled = true;
  data.questStairWestRailX = 41.14;
  data.questStairEastRailX = 46.86;
  data.questHolidayBoardTwoReadableFaces = true;
  data.questHolidayBoardBacksideMirroringDisabled = true;
  data.questHolidayBoardFixedOrientation = true;
  data.questVisualFixNonBlocking = true;
  data.questVisualFixBatched = true;
  data.questVisualFixBrowserUnaffected = true;
  return data;
}

function transformText(text) {
  let value = String(text);
  if (/<html|<body|<script/i.test(value) && !value.includes('V304-20260725-GLOBAL-R5-LOADER')) {
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

http.ServerResponse.prototype.writeHead = function writeHeadV304R4(statusCode, statusMessage, headers) {
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
    nextHeaders['X-UCAN-Quest-Visual-Revision'] = REVISION;
    nextHeaders['X-UCAN-Quest-Glass'] = REVISION;
    nextHeaders['X-UCAN-Quest-Stair-Rails'] = REVISION;
    nextHeaders['X-UCAN-Quest-Holiday-Signs'] = REVISION;
  }
  if (message === undefined) return previousWriteHead.call(this, statusCode, nextHeaders);
  return previousWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.end = function endV304R4(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      const isBuffer = Buffer.isBuffer(body);
      const text = isBuffer ? body.toString(typeof encoding === 'string' ? encoding : 'utf8') : body;
      const transformed = transformText(text);
      body = isBuffer ? Buffer.from(transformed, 'utf8') : transformed;
    }
  } catch (error) {
    console.error('[UCAN V304 R4 response compatibility]', error);
  }
  return previousEnd.call(this, body, encoding, callback);
};

console.info(`[UCAN V304 ${REVISION}] Preloader de cristales, barandas y carteles de feriados activo.`);