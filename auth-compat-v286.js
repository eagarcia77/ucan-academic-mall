'use strict';

require('./auth-compat-v271.js');

const http = require('http');
const fs = require('fs');
const path = require('path');
const { VERSION, BUILD, patchMainScene } = require('./lib/direct-floor-fix-v286');

const PREVIOUS_BUILD = 'V283-20260720-UNIFIED-XR-DESKTOP-PARITY';
const MAIN_PATH = '/js/ucan_babylon_mall_v265_accounts_avatars.js';
const MAIN_FILE = path.join(__dirname, 'public', 'js', 'ucan_babylon_mall_v265_accounts_avatars.js');
const MAIN_SCRIPT = `${MAIN_PATH}?build=${BUILD}`;
let patchAudit = { checked:false, patched:false, reason:'Todavía no solicitado.' };

function sendPatchedMainScene(res) {
  try {
    const source = fs.readFileSync(MAIN_FILE, 'utf8');
    const result = patchMainScene(source);
    patchAudit = {
      checked:true,
      patched:result.patched,
      reason:result.reason,
      originalOccurrences:result.originalOccurrences,
      directConditionPresent:result.directConditionPresent === true,
      oldConditionPresent:result.oldConditionPresent === true,
      servedAt:new Date().toISOString()
    };
    if (!result.patched) throw new Error(result.reason || 'No se pudo aplicar la corrección directa del piso.');
    const body = result.code;
    res.writeHead(200, {
      'Content-Type':'application/javascript; charset=utf-8',
      'Content-Length':Buffer.byteLength(body),
      'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma':'no-cache',
      'Expires':'0',
      'X-UCAN-Floor-Fix':VERSION
    });
    res.end(body);
  } catch (error) {
    patchAudit = { checked:true, patched:false, reason:error.message, servedAt:new Date().toISOString() };
    const body = `console.error(${JSON.stringify(`[UCAN ${VERSION}] ${error.message}`)});`;
    res.writeHead(500, {
      'Content-Type':'application/javascript; charset=utf-8',
      'Content-Length':Buffer.byteLength(body),
      'Cache-Control':'no-store'
    });
    res.end(body);
  }
}

// auth-compat-v271 ya envolvió http.createServer. Esta segunda envoltura se ejecuta
// dentro de la capa V283 y sustituye únicamente el archivo principal antes del servidor estático.
const priorCreateServer = http.createServer;
http.createServer = function createV286Server(listener) {
  if (typeof listener !== 'function') return priorCreateServer.apply(this, arguments);
  return priorCreateServer.call(this, async (req, res) => {
    try {
      const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(parsed.pathname);
      if (req.method === 'GET' && pathname === MAIN_PATH) return sendPatchedMainScene(res);
      return await listener(req, res);
    } catch (error) {
      if (!res.headersSent && !res.writableEnded) {
        const body = JSON.stringify({ error:error.message || 'Error interno V286' });
        res.writeHead(500, { 'Content-Type':'application/json; charset=utf-8', 'Content-Length':Buffer.byteLength(body), 'Cache-Control':'no-store' });
        res.end(body);
      }
    }
  });
};

// Las rutas /health, /version y /campus las responde la envoltura V283 antes de llegar
// al listener V286. Se actualizan aquí sus cuerpos y se elimina Content-Length antiguo.
if (!http.ServerResponse.prototype.__ucanV286DirectFloorPatched) {
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
            .replaceAll('UCAN Academic Mall V283', 'UCAN Academic Mall V286')
            .replaceAll('COMPILACIÓN V283 ACTIVA', 'COMPILACIÓN V286 ACTIVA')
            .replace('V283: un solo controlador comparte iluminación, movimiento, altura, colisiones y escaleras entre Meta Quest y el browser.', 'V286: la función original exige estar en el Piso 3 antes de aplicar el desnivel del anfiteatro.');
          body = text;
        } else if (/^\s*[\[{]/.test(text)) {
          try {
            const data = JSON.parse(text);
            if (data?.version === 'V283' && data?.build === PREVIOUS_BUILD) {
              data.version = VERSION;
              data.build = BUILD;
              data.script = MAIN_SCRIPT;
              data.directSourceFloorFix = true;
              data.mainSceneServedPatched = true;
              data.floorFixStrategy = 'intercept-main-script-before-static-stream';
              data.theaterHeightRequiresActualFloorThree = true;
              data.floorOneCenterProtected = true;
              data.floorTwoCenterProtected = true;
              data.sideAisleProtected = true;
              data.accidentalFloorThreeLiftFixed = true;
              data.v284AndV285RuntimeGuardsReplaced = true;
              data.patchAudit = patchAudit;
              body = JSON.stringify(data);
            }
          } catch (_) {}
        }
      }
    } catch (error) {
      console.error('[UCAN V286 response compatibility]', error);
    }
    return originalEnd.call(this, body, encoding, callback);
  };

  http.ServerResponse.prototype.__ucanV286DirectFloorPatched = true;
}

console.info('[UCAN V286] La escena principal se sirve con la condición del Piso 3 corregida directamente.');
