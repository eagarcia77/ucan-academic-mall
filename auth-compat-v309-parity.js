'use strict';

// Conserva autenticación, voz, presencia, interacción y paridad visual V309.
require('./auth-compat-v308-world.js');

const http = require('http');
const path = require('path');
const {
  VERSION,
  REVISION,
  BUILD,
  installVisualValidationSystem
} = require('./lib/visual-validation-v310');

installVisualValidationSystem({ dataDir:path.join(__dirname, 'data') });

const previousWriteHead = http.ServerResponse.prototype.writeHead;
const previousWrite = http.ServerResponse.prototype.write;
const previousEnd = http.ServerResponse.prototype.end;
const HTML_CONTENT = /text\/html/i;
const RUNTIME_SCRIPT = `/js/ucan_v310_visual_validation.js?build=${BUILD}`;

function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const key = Object.keys(headers).find(candidate => candidate.toLowerCase() === name.toLowerCase());
  return key ? String(headers[key] || '') : '';
}

function injectRuntime(text) {
  let html = String(text || '');
  if (!/<canvas[^>]+id=["']renderCanvas["']/i.test(html)) return html;
  if (html.includes('/js/ucan_v310_visual_validation.js')) return html;
  const tag = `  <script src="${RUNTIME_SCRIPT}"></script>\n`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${tag}</body>`);
  return `${html}\n${tag}`;
}

http.ServerResponse.prototype.writeHead = function writeHeadV310(statusCode, statusMessage, headers) {
  let message = statusMessage;
  let nextHeaders = headers;
  if (statusMessage && typeof statusMessage === 'object') {
    nextHeaders = statusMessage;
    message = undefined;
  }

  const contentType = headerValue(nextHeaders, 'content-type') || String(this.getHeader?.('Content-Type') || '');
  if (HTML_CONTENT.test(contentType)) {
    this.__ucanV310HtmlChunks = [];
    try {
      this.removeHeader?.('Content-Length');
      this.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      this.setHeader?.('Pragma', 'no-cache');
      this.setHeader?.('Expires', '0');
      this.setHeader?.('X-UCAN-Visual-Validation', VERSION);
      this.setHeader?.('X-UCAN-Visual-Validation-Revision', REVISION);
    } catch (_) {}
  }

  if (nextHeaders && typeof nextHeaders === 'object') {
    nextHeaders = { ...nextHeaders };
    for (const key of Object.keys(nextHeaders)) {
      const lower = key.toLowerCase();
      if (lower === 'content-length') delete nextHeaders[key];
      if (HTML_CONTENT.test(contentType) && ['cache-control','pragma','expires'].includes(lower)) delete nextHeaders[key];
    }
    nextHeaders['X-UCAN-Visual-Validation'] = VERSION;
    nextHeaders['X-UCAN-Visual-Validation-Revision'] = REVISION;
    if (HTML_CONTENT.test(contentType)) {
      nextHeaders['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
      nextHeaders.Pragma = 'no-cache';
      nextHeaders.Expires = '0';
    }
  }

  if (message === undefined) return previousWriteHead.call(this, statusCode, nextHeaders);
  return previousWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.write = function writeV310(chunk, encoding, callback) {
  if (Array.isArray(this.__ucanV310HtmlChunks)) {
    if (chunk != null) this.__ucanV310HtmlChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : 'utf8'));
    if (typeof encoding === 'function') process.nextTick(encoding);
    else if (typeof callback === 'function') process.nextTick(callback);
    return true;
  }
  return previousWrite.call(this, chunk, encoding, callback);
};

http.ServerResponse.prototype.end = function endV310(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (Array.isArray(this.__ucanV310HtmlChunks)) {
      if (body != null) this.__ucanV310HtmlChunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body), typeof encoding === 'string' ? encoding : 'utf8'));
      const combined = Buffer.concat(this.__ucanV310HtmlChunks).toString('utf8');
      delete this.__ucanV310HtmlChunks;
      body = Buffer.from(injectRuntime(combined), 'utf8');
    } else if (typeof body === 'string' || Buffer.isBuffer(body)) {
      const isBuffer = Buffer.isBuffer(body);
      const value = isBuffer ? body.toString(typeof encoding === 'string' ? encoding : 'utf8') : body;
      const transformed = injectRuntime(value);
      body = isBuffer ? Buffer.from(transformed, 'utf8') : transformed;
    }
  } catch (error) {
    console.error('[UCAN Visual Validation V310 response]', error);
  }
  return previousEnd.call(this, body, encoding, callback);
};

console.info(`[UCAN ${VERSION} ${REVISION}] Validación visual browser/WebXR y reportes persistentes activos.`);
