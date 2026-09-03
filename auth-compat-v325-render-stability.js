'use strict';

const http = require('http');

require('./auth-compat-v323-browser-panel.js');

const baseWriteHead = http.ServerResponse.prototype.writeHead;
const baseWrite = http.ServerResponse.prototype.write;
const baseEnd = http.ServerResponse.prototype.end;

const VERSION = 'V325';
const REVISION = 'R29';
const BUILD = 'V325-20260903-STABLE-RENDER-XR-STAIRS-R29';
const STABILITY_SRC = '/js/ucan_v325_render_stability.js?build=V325-20260903-STABLE-RENDER-XR-STAIRS-R29';
const LANDING_SRC = '/js/ucan_v326_xr_landing_release.js?build=V326-20260806-XR-LANDING-RELEASE-R30';
const STAIR_RIDE_SRC = '/js/ucan_v327_xr_stair_ride_height.js?build=V327-20260903-XR-AUTO-STAIRS-HEIGHT-R31';

function contentTypeFrom(response, headers) {
  const entries = headers && typeof headers === 'object' ? Object.entries(headers) : [];
  const direct = entries.find(([key]) => String(key).toLowerCase() === 'content-type')?.[1];
  return String(direct || response.getHeader?.('Content-Type') || '');
}

function transformHtml(value) {
  let html = String(value || '');
  const tags = [];

  if (!html.includes('ucan_v325_render_stability.js')) {
    tags.push(`<script src="${STABILITY_SRC}" data-ucan-v325-render-stability="true"></script>`);
  }
  if (!html.includes('ucan_v326_xr_landing_release.js')) {
    tags.push(`<script src="${LANDING_SRC}" data-ucan-v326-xr-landing-release="true"></script>`);
  }
  if (!html.includes('ucan_v327_xr_stair_ride_height.js')) {
    tags.push(`<script src="${STAIR_RIDE_SRC}" data-ucan-v327-xr-stair-ride="true"></script>`);
  }

  if (tags.length) {
    const mainPattern = /(<script[^>]+src=["']\/js\/ucan_babylon_mall_v265_accounts_avatars\.js[^>]*><\/script>)/i;
    const block = tags.join('\n  ');
    if (mainPattern.test(html)) html = html.replace(mainPattern, `${block}\n  $1`);
    else html = html.replace('</head>', `  ${block}\n</head>`);
  }

  html = html.replace(/UCAN Academic Mall V323/g, 'UCAN Academic Mall V327');
  html = html.replace(/UCAN Academic Mall V325/g, 'UCAN Academic Mall V327');
  html = html.replace(/UCAN Academic Mall V326/g, 'UCAN Academic Mall V327');
  html = html.replace(/COMPILACIÓN V323[^<]*/g, 'COMPILACIÓN V327 · WEBXR ALTURA Y ESCALERAS AUTOMÁTICAS');
  html = html.replace(/COMPILACIÓN V325[^<]*/g, 'COMPILACIÓN V327 · WEBXR ALTURA Y ESCALERAS AUTOMÁTICAS');
  html = html.replace(/COMPILACIÓN V326[^<]*/g, 'COMPILACIÓN V327 · WEBXR ALTURA Y ESCALERAS AUTOMÁTICAS');
  html = html.replace('</head>', `  <meta name="ucan-render-stability" content="${BUILD}" />\n  <meta name="ucan-xr-landing-release" content="V326-R30" />\n  <meta name="ucan-xr-stair-ride" content="V327-R31" />\n</head>`);
  return html;
}

http.ServerResponse.prototype.writeHead = function writeHeadV325(statusCode, statusMessage, headers) {
  let message = statusMessage;
  let nextHeaders = headers;
  if (statusMessage && typeof statusMessage === 'object') {
    nextHeaders = statusMessage;
    message = undefined;
  }
  const type = contentTypeFrom(this, nextHeaders);
  if (/text\/html/i.test(type)) this.__ucanV325Chunks = [];
  try {
    this.setHeader?.('X-UCAN-Stability', VERSION);
    this.setHeader?.('X-UCAN-Stability-Revision', REVISION);
    this.setHeader?.('X-UCAN-XR-Landing', 'V326');
    this.setHeader?.('X-UCAN-XR-Stair-Ride', 'V327');
    if (/text\/html/i.test(type)) {
      this.removeHeader?.('Content-Length');
      this.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    }
  } catch (_) {}
  if (nextHeaders && typeof nextHeaders === 'object') {
    nextHeaders = {
      ...nextHeaders,
      'X-UCAN-Stability':VERSION,
      'X-UCAN-Stability-Revision':REVISION,
      'X-UCAN-XR-Landing':'V326',
      'X-UCAN-XR-Stair-Ride':'V327'
    };
    for (const key of Object.keys(nextHeaders)) {
      if (String(key).toLowerCase() === 'content-length' && /text\/html/i.test(type)) delete nextHeaders[key];
    }
  }
  if (message === undefined) return baseWriteHead.call(this, statusCode, nextHeaders);
  return baseWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.write = function writeV325(chunk, encoding, callback) {
  if (Array.isArray(this.__ucanV325Chunks)) {
    if (chunk != null) this.__ucanV325Chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : 'utf8')
    );
    if (typeof encoding === 'function') process.nextTick(encoding);
    else if (typeof callback === 'function') process.nextTick(callback);
    return true;
  }
  return baseWrite.call(this, chunk, encoding, callback);
};

http.ServerResponse.prototype.end = function endV325(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (Array.isArray(this.__ucanV325Chunks)) {
      if (body != null) this.__ucanV325Chunks.push(
        Buffer.isBuffer(body) ? body : Buffer.from(String(body), typeof encoding === 'string' ? encoding : 'utf8')
      );
      body = Buffer.from(transformHtml(Buffer.concat(this.__ucanV325Chunks).toString('utf8')), 'utf8');
      delete this.__ucanV325Chunks;
    }
  } catch (reason) {
    console.error('[UCAN V325 response]', reason);
  }
  return baseEnd.call(this, body, encoding, callback);
};

console.info(`[UCAN ${VERSION} ${REVISION}] Estabilidad visual + desembarque V326 + escaleras/altura V327 activos (${BUILD}).`);