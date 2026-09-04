'use strict';

const http = require('http');

require('./auth-compat-v323-browser-panel.js');

const baseWriteHead = http.ServerResponse.prototype.writeHead;
const baseWrite = http.ServerResponse.prototype.write;
const baseEnd = http.ServerResponse.prototype.end;

const VERSION = 'V328';
const REVISION = 'R38';
const BUILD = 'V328-20260904-RESTORE-MAIN-SOURCE-R38';
const STABILITY_SRC = '/js/ucan_v325_render_stability.js?build=V328-20260904-RESTORE-MAIN-SOURCE-R38';
const FINAL_XR_SRC = '/js/ucan_v328_xr_final_authority.js?build=V328-20260904-RESTORE-MAIN-SOURCE-R38';
const MAIN_BUILD = 'V328-20260904-RESTORE-MAIN-SOURCE-R38';

// La capa V323 se mantiene como adaptador horizontal, pero ya no debe volver a
// publicar sus metadatos como si fuera la versión final.  V323 consulta este
// marcador al terminar la respuesta, después de que V328 haya transformado el
// JSON y los encabezados.
global.__UCAN_ACTIVE_RELEASE__ = Object.freeze({
  version:VERSION,
  releaseVersion:VERSION,
  revision:REVISION,
  build:BUILD
});

function contentTypeFrom(response, headers) {
  const entries = headers && typeof headers === 'object' ? Object.entries(headers) : [];
  const direct = entries.find(([key]) => String(key).toLowerCase() === 'content-type')?.[1];
  return String(direct || response.getHeader?.('Content-Type') || '');
}

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

  // El archivo principal se transforma en el servidor; una URL nueva obliga a
  // Meta Quest y Chrome a descartar cualquier copia V283/V323 retenida.
  html = html.replace(
    /(\/js\/ucan_babylon_mall_v265_accounts_avatars\.js)\?build=[^"']+/g,
    `$1?build=${MAIN_BUILD}`
  );

  // V328 es la única capa autorizada para corregir altura y transportar por escaleras.
  for (const legacy of ['ucan_v326_xr_landing_release.js','ucan_v327_xr_stair_ride_height.js']) {
    html = removeScript(html, legacy);
  }

  const tags = [];
  if (!html.includes('ucan_v325_render_stability.js')) {
    tags.push(`<script src="${STABILITY_SRC}" data-ucan-v325-render-stability="true"></script>`);
  }
  if (!html.includes('ucan_v328_xr_final_authority.js')) {
    tags.push(`<script src="${FINAL_XR_SRC}" data-ucan-v328-xr-final-authority="true"></script>`);
  }

  if (tags.length) {
    const mainPattern = /(<script[^>]+src=["']\/js\/ucan_babylon_mall_v265_accounts_avatars\.js[^>]*><\/script>)/i;
    const block = tags.join('\n  ');
    if (mainPattern.test(html)) html = html.replace(mainPattern, `${block}\n  $1`);
    else html = html.replace('</head>', `  ${block}\n</head>`);
  }

  html = html.replace(/UCAN Academic Mall V(?:323|325|326|327)/g, 'UCAN Academic Mall V328');
  html = html.replace(/COMPILACIÓN V(?:323|325|326|327)[^<]*/g, 'COMPILACIÓN V328 · AUTORIDAD XR ÚNICA Y ATERRIZAJE EXACTO');
  html = html.replace('</head>', `  <meta name="ucan-render-stability" content="V325-R29" />\n  <meta name="ucan-xr-final-authority" content="V328-R38" />\n</head>`);
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
      xrFinalAuthority:FINAL_XR_SRC,
      singleFinalVerticalAuthority:true,
      automaticStairsWithoutJoystick:true,
      exactFloorLanding:true,
      questComfortStairs:true,
      assistedFloorControls:true,
      dynamicDayNightPreserved:true,
      environmentClockShared:true,
      puertoRicoRealTimeAuthority:true,
      resilientBabylonStartup:true,
      webglCompatibilityFallback:true,
      mainSourceRestored:true,
      preventsBetweenFloors:true,
      desktopEyeHeightParity:true,
      targetEyeHeightMeters:1.72,
      underStairSafetyVolumes:true,
      jumpEnabled:true,
      directImmersiveNavigation:true,
      legacyV326RuntimeLoaded:false,
      legacyV327RuntimeLoaded:false,
      renderStabilityLayer:'V325-R29'
    });
  } catch (_) {
    return value;
  }
}

http.ServerResponse.prototype.writeHead = function writeHeadV328(statusCode, statusMessage, headers) {
  let message = statusMessage;
  let nextHeaders = headers;
  if (statusMessage && typeof statusMessage === 'object') {
    nextHeaders = statusMessage;
    message = undefined;
  }
  const type = contentTypeFrom(this, nextHeaders);
  const pathname = requestPath(this);
  const transformable = /text\/html/i.test(type) || ((pathname === '/version' || pathname === '/health' || pathname === '/healthz') && /application\/json/i.test(type));
  if (transformable) this.__ucanV328Chunks = [];
  try {
    this.setHeader?.('X-UCAN-Version', VERSION);
    this.setHeader?.('X-UCAN-Revision', REVISION);
    this.setHeader?.('X-UCAN-Stability', 'V325');
    this.setHeader?.('X-UCAN-XR-Final-Authority', VERSION);
    this.setHeader?.('X-UCAN-Legacy-XR-Vertical', 'disabled');
    if (transformable) {
      this.removeHeader?.('Content-Length');
      this.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      this.setHeader?.('Pragma', 'no-cache');
      this.setHeader?.('Expires', '0');
    }
  } catch (_) {}
  if (nextHeaders && typeof nextHeaders === 'object') {
    nextHeaders = {
      ...nextHeaders,
      'X-UCAN-Version':VERSION,
      'X-UCAN-Revision':REVISION,
      'X-UCAN-Stability':'V325',
      'X-UCAN-XR-Final-Authority':VERSION,
      'X-UCAN-Legacy-XR-Vertical':'disabled'
    };
    for (const key of Object.keys(nextHeaders)) {
      const lower = String(key).toLowerCase();
      if (lower === 'content-length' && transformable) delete nextHeaders[key];
      if (transformable && ['cache-control','pragma','expires'].includes(lower)) delete nextHeaders[key];
    }
    if (transformable) {
      nextHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
      nextHeaders.Pragma = 'no-cache';
      nextHeaders.Expires = '0';
    }
  }
  if (message === undefined) return baseWriteHead.call(this, statusCode, nextHeaders);
  return baseWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.write = function writeV328(chunk, encoding, callback) {
  if (Array.isArray(this.__ucanV328Chunks)) {
    if (chunk != null) this.__ucanV328Chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : 'utf8')
    );
    if (typeof encoding === 'function') process.nextTick(encoding);
    else if (typeof callback === 'function') process.nextTick(callback);
    return true;
  }
  return baseWrite.call(this, chunk, encoding, callback);
};

http.ServerResponse.prototype.end = function endV328(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (Array.isArray(this.__ucanV328Chunks)) {
      if (body != null) this.__ucanV328Chunks.push(
        Buffer.isBuffer(body) ? body : Buffer.from(String(body), typeof encoding === 'string' ? encoding : 'utf8')
      );
      const combined = Buffer.concat(this.__ucanV328Chunks).toString('utf8');
      delete this.__ucanV328Chunks;
      const pathname = requestPath(this);
      body = Buffer.from(
        pathname === '/version' || pathname === '/health' || pathname === '/healthz'
          ? transformJson(combined)
          : transformHtml(combined),
        'utf8'
      );
    }
  } catch (reason) {
    console.error('[UCAN V328 response]', reason);
  }
  return baseEnd.call(this, body, encoding, callback);
};

console.info(`[UCAN ${VERSION} ${REVISION}] V325 visual estable + V328 como única autoridad vertical WebXR (${BUILD}).`);
