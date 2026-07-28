'use strict';

const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,120}$/;
const ALLOWED_TYPES = new Set(['chat', 'gesture', 'reaction', 'focus', 'object-state']);
const ALLOWED_GESTURES = new Set(['wave', 'raise-hand', 'clap', 'point']);
const ALLOWED_REACTIONS = new Set(['👍', '👏', '❤️', '🎉', '❓']);

function createWorldSyncSystem(options = {}) {
  const ttlMs = Math.max(30000, Math.min(300000, Number(options.ttlMs || process.env.WORLD_V308_EVENT_TTL_MS || 120000)));
  const maxEvents = Math.max(100, Math.min(2000, Number(options.maxEvents || process.env.WORLD_V308_MAX_EVENTS || 700)));
  const events = [];
  const objectStates = new Map();
  const rate = new Map();
  let sequence = 0;

  function now() { return Date.now(); }
  function safeText(value, max = 160) {
    return String(value || '').replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function clamp(value) { return Math.max(-1000, Math.min(1000, Number(value) || 0)); }
  function normalizeRoom(value) {
    const text = safeText(value || 'Campus', 80);
    const match = text.match(/^(SV-20[1-5]|ANF-301|CAFETERIA|BIBLIOTECA|TERRAZA|PISO [123]|PATIO)/i);
    return match ? match[1].toUpperCase().replace('CAFETERIA', 'CAFETERÍA') : 'CAMPUS';
  }
  function cleanup() {
    const cutoff = now() - ttlMs;
    while (events.length && events[0].createdAt < cutoff) events.shift();
    while (events.length > maxEvents) events.shift();
    for (const [key, value] of objectStates) if (value.updatedAt < cutoff * 0.25) objectStates.delete(key);
  }
  function allow(clientId) {
    const timestamp = now();
    const recent = (rate.get(clientId) || []).filter(time => timestamp - time < 10000);
    if (recent.length >= 30) return false;
    recent.push(timestamp);
    rate.set(clientId, recent);
    return true;
  }
  function userKey(user) { return String(user?.id || user?.username || user?.email || ''); }
  function sanitizePayload(type, payload = {}) {
    if (type === 'chat') return { text:safeText(payload.text, 240) };
    if (type === 'gesture') {
      const gesture = safeText(payload.gesture, 30);
      return { gesture:ALLOWED_GESTURES.has(gesture) ? gesture : 'wave' };
    }
    if (type === 'reaction') {
      const reaction = String(payload.reaction || '👍');
      return { reaction:ALLOWED_REACTIONS.has(reaction) ? reaction : '👍' };
    }
    if (type === 'focus') {
      const position = payload.position && typeof payload.position === 'object' ? payload.position : {};
      return {
        objectId:safeText(payload.objectId, 120),
        title:safeText(payload.title, 100),
        category:safeText(payload.category, 60),
        position:{ x:clamp(position.x), y:clamp(position.y), z:clamp(position.z) }
      };
    }
    if (type === 'object-state') {
      const state = payload.state && typeof payload.state === 'object' ? payload.state : {};
      return {
        objectId:safeText(payload.objectId, 120),
        title:safeText(payload.title, 100),
        state:JSON.parse(JSON.stringify(state, (key, value) => typeof value === 'string' ? safeText(value, 240) : value))
      };
    }
    return {};
  }
  function publicEvent(event) {
    return {
      sequence:event.sequence,
      id:event.id,
      type:event.type,
      room:event.room,
      clientId:event.clientId,
      userId:event.userId,
      displayName:event.displayName,
      role:event.role,
      device:event.device,
      inXR:event.inXR,
      payload:event.payload,
      createdAt:new Date(event.createdAt).toISOString()
    };
  }
  function snapshot(since, room) {
    cleanup();
    const normalizedRoom = normalizeRoom(room);
    return events
      .filter(event => event.sequence > since && (event.room === normalizedRoom || event.room === 'CAMPUS' || normalizedRoom === 'CAMPUS'))
      .map(publicEvent);
  }

  async function handle(req, res, pathname, url, user, readJson, sendJson) {
    if (!pathname.startsWith('/api/world-v308')) return false;
    if (!userKey(user)) {
      sendJson(res, 401, { error:'Inicie sesión para utilizar la interacción compartida.' });
      return true;
    }

    if (pathname === '/api/world-v308/config' && req.method === 'GET') {
      sendJson(res, 200, {
        ok:true,
        version:'V308',
        strategy:'single-scene-cross-environment-interaction',
        sameSceneBrowserVr:true,
        browserToVr:true,
        vrToBrowser:true,
        voice:true,
        chat:true,
        gestures:true,
        reactions:true,
        sharedFocus:true,
        objectState:true,
        latestSequence:sequence,
        activeEvents:events.length
      });
      return true;
    }

    if (pathname === '/api/world-v308/events' && req.method === 'GET') {
      const since = Math.max(0, Number(url.searchParams.get('since') || 0));
      const room = normalizeRoom(url.searchParams.get('room') || 'Campus');
      sendJson(res, 200, {
        ok:true,
        version:'V308',
        room,
        latestSequence:sequence,
        events:snapshot(since, room),
        objectStates:[...objectStates.values()].filter(value => value.room === room || room === 'CAMPUS')
      });
      return true;
    }

    if (pathname === '/api/world-v308/event' && req.method === 'POST') {
      const body = await readJson(req, 64 * 1024);
      const clientId = String(body.clientId || '');
      const type = safeText(body.type, 30);
      if (!CLIENT_ID_PATTERN.test(clientId)) {
        sendJson(res, 400, { error:'Identificador de dispositivo inválido.' });
        return true;
      }
      if (!ALLOWED_TYPES.has(type)) {
        sendJson(res, 400, { error:'Tipo de interacción no permitido.' });
        return true;
      }
      if (!allow(clientId)) {
        sendJson(res, 429, { error:'Demasiadas interacciones. Espere unos segundos.' });
        return true;
      }
      const payload = sanitizePayload(type, body.payload || {});
      if (type === 'chat' && !payload.text) {
        sendJson(res, 400, { error:'Escriba un mensaje.' });
        return true;
      }
      const room = normalizeRoom(body.room || 'Campus');
      sequence += 1;
      const event = {
        sequence,
        id:`evt_${sequence}_${now().toString(36)}`,
        type,
        room,
        clientId,
        userId:userKey(user),
        displayName:safeText(user.displayName || user.username || 'Participante', 60),
        role:user.role === 'admin' ? 'admin' : 'user',
        device:['browser','quest','mobile','other'].includes(body.device) ? body.device : 'other',
        inXR:body.inXR === true,
        payload,
        createdAt:now()
      };
      events.push(event);
      if (type === 'object-state' && payload.objectId) {
        objectStates.set(`${room}:${payload.objectId}`, {
          room,
          objectId:payload.objectId,
          title:payload.title,
          state:payload.state,
          updatedBy:event.displayName,
          updatedAt:event.createdAt,
          sequence:event.sequence
        });
      }
      cleanup();
      sendJson(res, 201, { ok:true, version:'V308', event:publicEvent(event), latestSequence:sequence });
      return true;
    }

    sendJson(res, 405, { error:'Método no permitido para interacción V308.' });
    return true;
  }

  const cleanupTimer = setInterval(cleanup, 15000);
  cleanupTimer.unref?.();

  return {
    handle,
    close:() => clearInterval(cleanupTimer),
    getStatus:() => ({
      version:'V308',
      enabled:true,
      sameSceneBrowserVr:true,
      browserToVr:true,
      vrToBrowser:true,
      latestSequence:sequence,
      activeEvents:events.length,
      objectStates:objectStates.size
    })
  };
}

module.exports = { createWorldSyncSystem };
