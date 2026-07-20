'use strict';

require('./auth-compat-v271.js');

const http = require('http');

const VERSION = 'V285';
const BUILD = 'V285-20260720-DESKTOP-FLOOR-LOCK';
const PREVIOUS_BUILD = 'V283-20260720-UNIFIED-XR-DESKTOP-PARITY';
const FLOOR_LOCK_SCRIPT = `/js/ucan_v285_desktop_floor_lock.js?build=${BUILD}`;

if (!http.ServerResponse.prototype.__ucanV285FloorLockPatched) {
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
        let text = Buffer.isBuffer(body) ? body.toString(typeof encoding === 'string' ? encoding : 'utf8') : body;

        if (text.includes('UCAN Academic Mall V283')) {
          text = text
            .replaceAll(PREVIOUS_BUILD, BUILD)
            .replaceAll('UCAN Academic Mall V283', 'UCAN Academic Mall V285')
            .replaceAll('COMPILACIÓN V283 ACTIVA', 'COMPILACIÓN V285 ACTIVA')
            .replace('V283: un solo controlador comparte iluminación, movimiento, altura, colisiones y escaleras entre Meta Quest y el browser.', 'V285: los pisos 1 y 2 quedan bloqueados antes del renderizado; el desnivel del anfiteatro solo funciona en el Piso 3.');

          if (!text.includes('/js/ucan_v285_desktop_floor_lock.js')) {
            text = text.replace(
              /\n\s*<script src="\/js\/ucan_v276_interactive_sky\.js/,
              `\n  <script src="${FLOOR_LOCK_SCRIPT}"></script>\n  <script src="/js/ucan_v276_interactive_sky.js`
            );
          }
          body = text;
        } else if (/^\s*[\[{]/.test(text)) {
          try {
            const data = JSON.parse(text);
            if (data?.version === 'V283' && data?.build === PREVIOUS_BUILD) {
              data.version = VERSION;
              data.build = BUILD;
              data.floorLockScript = FLOOR_LOCK_SCRIPT;
              data.desktopFloorLock = true;
              data.floorCorrectionPhase = 'onBeforeCameraRender';
              data.runsAfterSceneHeightAdjustments = true;
              data.theaterHeightRequiresConfirmedFloorThree = true;
              data.floorOneCenterProtected = true;
              data.floorTwoCenterProtected = true;
              data.sideAisleProtected = true;
              data.accidentalFloorThreeLiftFixed = true;
              data.v284GuardReplaced = true;
              body = JSON.stringify(data);
            }
          } catch (_) {}
        }
      }
    } catch (error) {
      console.error('[UCAN V285 response compatibility]', error);
    }
    return originalEnd.call(this, body, encoding, callback);
  };

  http.ServerResponse.prototype.__ucanV285FloorLockPatched = true;
}

console.info('[UCAN V285] Bloqueo definitivo de pisos y compatibilidad V283 cargados.');
