'use strict';

require('./auth-compat-v304-r6.js');

const http = require('http');
const { createVoiceSystem, loadIceServersFromEnvironment } = require('./lib/voice-signaling');

const voiceSystem = createVoiceSystem({
  rooms:['SV-201', 'SV-202', 'SV-203', 'SV-204', 'SV-205', 'ANF-301'],
  roomLimit:Number(process.env.VOICE_ROOM_LIMIT || 12),
  iceServers:loadIceServersFromEnvironment()
});

global.__UCAN_VOICE_SYSTEM_V306__ = voiceSystem;

function sendJson(res, status, data) {
  if (res.headersSent || res.writableEnded) return;
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':Buffer.byteLength(body),
    'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma':'no-cache',
    'Expires':'0',
    'Permissions-Policy':'microphone=(self), xr-spatial-tracking=(self)',
    'X-UCAN-Voice-Version':'V306'
  });
  res.end(body);
}

async function readJson(req, limit = 256 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('Solicitud de audio demasiado grande.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (_) {
    const error = new Error('JSON de audio inválido.');
    error.statusCode = 400;
    throw error;
  }
}

function sessionUser(req) {
  const auth = global.__UCAN_AUTH_SYSTEM_V283__;
  try {
    return auth?.getUserFromRequest?.(req) || auth?.getSessionUser?.(req) || null;
  } catch (_) {
    return null;
  }
}

const previousCreateServer = http.createServer;
http.createServer = function createServerWithVoiceV306(listener) {
  if (typeof listener !== 'function') return previousCreateServer.apply(this, arguments);
  return previousCreateServer.call(this, async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(url.pathname);
      if (pathname.startsWith('/api/voice/')) {
        await voiceSystem.handle(req, res, pathname, url, sessionUser(req), readJson, sendJson);
        return;
      }
      return await listener(req, res);
    } catch (error) {
      console.error('[UCAN Voice V306]', error);
      if (!res.headersSent && !res.writableEnded) {
        sendJson(res, error.statusCode || 500, { error:error.message || 'Error interno del audio.' });
      }
    }
  });
};

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.once(signal, () => voiceSystem.close());
}

console.info('[UCAN Voice V306] Señalización WebRTC por salas y anfiteatro activa.');
