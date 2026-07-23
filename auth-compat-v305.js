'use strict';

const http = require('http');

const VERSION = 'V305';
const BUILD = 'V305-20260723-ECOSYSTEM-VISIBILITY-ENTRY-GARDEN';
const PATH = '/js/ucan_v305_ecosystem_visibility_fix.js';
const SCRIPT = `${PATH}?build=${BUILD}`;

const nativeWriteHead = http.ServerResponse.prototype.writeHead;
const nativeEnd = http.ServerResponse.prototype.end;

function insertVisibilityLayer(text) {
  let html = String(text).replace(/\s*<script src="\/js\/ucan_v305_ecosystem_visibility_fix\.js[^"]*"><\/script>/g, '');
  const tag = `<script src="${SCRIPT}"></script>`;
  const base = html.match(/<script src="\/js\/ucan_v304_seasonal_natural_ecosystem\.js\?build=[^"]+"><\/script>/)?.[0];
  if (base) return html.replace(base, `${base}\n  ${tag}`);
  const main = html.match(/<script src="\/js\/ucan_babylon_mall_v265_accounts_avatars\.js\?build=[^"]+"><\/script>/)?.[0];
  if (main) return html.replace(main, `${main}\n  ${tag}`);
  return html.replace('</body>', `  ${tag}\n</body>`);
}

function updateVersion(data) {
  if (!data || typeof data !== 'object') return data;
  const versionPayload = Object.prototype.hasOwnProperty.call(data, 'version') ||
    Object.prototype.hasOwnProperty.call(data, 'build') ||
    Object.prototype.hasOwnProperty.call(data, 'releaseVersion') ||
    Object.prototype.hasOwnProperty.call(data, 'environmentVersion');
  if (!versionPayload) return data;
  data.environmentBaseVersion = 'V304';
  data.ecosystemVisibilityVersion = VERSION;
  data.ecosystemVisibilityBuild = BUILD;
  data.ecosystemVisibilityScript = SCRIPT;
  data.seasonalEcosystemRootForcedEnabled = true;
  data.seasonalEcosystemVisibleFromInitialLobby = true;
  data.seasonalEntranceGardenEnabled = true;
  data.seasonalEntranceGardenClearOfCentralEscalator = true;
  data.seasonalBoardsRelocatedIntoView = true;
  data.seasonalBoardsUpright = true;
  data.seasonalBoardsBillboardDisabled = true;
  data.seasonalEntranceTitleVisible = true;
  data.seasonalVisibilityBrowserAndQuest = true;
  return data;
}

function transform(text) {
  const value = String(text);
  const trimmed = value.trim();
  if (/^\s*[\[{]/.test(trimmed)) {
    try { return JSON.stringify(updateVersion(JSON.parse(value))); }
    catch (_) {}
  }
  if (/<html|<body|<script/i.test(value)) return insertVisibilityLayer(value);
  return value;
}

http.ServerResponse.prototype.writeHead = function writeHeadV305(statusCode, statusMessage, headers) {
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
    nextHeaders['X-UCAN-Ecosystem-Visibility'] = VERSION;
    nextHeaders['X-UCAN-Entrance-Garden'] = VERSION;
  }
  if (message === undefined) return nativeWriteHead.call(this, statusCode, nextHeaders);
  return nativeWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.end = function endV305(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      const buffer = Buffer.isBuffer(body);
      const text = buffer ? body.toString(typeof encoding === 'string' ? encoding : 'utf8') : body;
      const updated = transform(text);
      body = buffer ? Buffer.from(updated, 'utf8') : updated;
    }
  } catch (error) {
    console.error('[UCAN V305 ecosystem visibility compatibility]', error);
  }
  return nativeEnd.call(this, body, encoding, callback);
};

require('./auth-compat-v293.js');

console.info(`[UCAN ${VERSION}] Corrección de visibilidad del ecosistema y plaza de acceso cargada.`);
