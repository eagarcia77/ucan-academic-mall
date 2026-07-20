'use strict';

require('./auth-compat-v271.js');

const http = require('http');

const VERSION = 'V284';
const BUILD = 'V284-20260720-DESKTOP-FLOOR-GUARD';
const PREVIOUS_BUILD = 'V283-20260720-UNIFIED-XR-DESKTOP-PARITY';
const FLOOR_GUARD_SCRIPT = `/js/ucan_v284_desktop_floor_guard.js?build=${BUILD}`;

if (!http.ServerResponse.prototype.__ucanV284FloorGuardPatched) {
  const originalWriteHead = http.ServerResponse.prototype.writeHead;
  const originalEnd = http.ServerResponse.prototype.end;

  http.ServerResponse.prototype.writeHead = function patchedWriteHead(statusCode, statusMessage, headers) {
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
    }
    if (message === undefined) return originalWriteHead.call(this, statusCode, nextHeaders);
    return originalWriteHead.call(this, statusCode, message, nextHeaders);
  };

  http.ServerResponse.prototype.end = function patchedEnd(chunk, encoding, callback) {
    let body = chunk;
    try {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        let text = Buffer.isBuffer(body) ? body.toString(encoding && typeof encoding === 'string' ? encoding : 'utf8') : body;
        const contentType = String(this.getHeader('Content-Type') || this.getHeader('content-type') || '');

        if (/text\/html/i.test(contentType) && text.includes('UCAN Academic Mall V283')) {
          text = text
            .replaceAll(PREVIOUS_BUILD, BUILD)
            .replaceAll('UCAN Academic Mall V283', 'UCAN Academic Mall V284')
            .replaceAll('COMPILACIÓN V283 ACTIVA', 'COMPILACIÓN V284 ACTIVA')
            .replace('V283: un solo controlador comparte iluminación, movimiento, altura, colisiones y escaleras entre Meta Quest y el browser.', 'V284: los pisos 1 y 2 permanecen estables; el pasillo del anfiteatro solo ajusta altura cuando el usuario está en el Piso 3.');

          if (!text.includes('/js/ucan_v284_desktop_floor_guard.js')) {
            text = text.replace(
              /\n\s*<script src="\/js\/ucan_v276_interactive_sky\.js/,
              `\n  <script src="${FLOOR_GUARD_SCRIPT}"></script>\n  <script src="/js/ucan_v276_interactive_sky.js`
            );
          }
          body = text;
        } else if (/application\/json/i.test(contentType)) {
          try {
            const data = JSON.parse(text);
            if (data?.version === 'V283' && data?.build === PREVIOUS_BUILD) {
              data.version = VERSION;
              data.build = BUILD;
              data.floorGuardScript = FLOOR_GUARD_SCRIPT;
              data.desktopFloorGuard = true;
              data.theaterHeightRequiresFloorThree = true;
              data.floorOneCenterProtected = true;
              data.floorTwoCenterProtected = true;
              data.sideAisleProtected = true;
              data.accidentalFloorThreeLiftFixed = true;
              body = JSON.stringify(data);
            }
          } catch (_) {}
        }
      }
    } catch (error) {
      console.error('[UCAN V284 response compatibility]', error);
    }
    return originalEnd.call(this, body, encoding, callback);
  };

  http.ServerResponse.prototype.__ucanV284FloorGuardPatched = true;
}

console.info('[UCAN V284] Protección del piso del navegador y compatibilidad V283 cargadas.');
