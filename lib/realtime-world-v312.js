'use strict';

const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,120}$/;
const ALLOWED_TYPES = new Set(['chat','gesture','reaction','focus','object-state']);
const ALLOWED_GESTURES = new Set(['wave','raise-hand','clap','point']);
const ALLOWED_REACTIONS = new Set(['👍','👏','❤️','🎉','❓']);

const VERSION = 'V312';
const REVISION = 'R16';
const BUILD = 'V312-20260729-VR-CANONICAL-REALTIME-WORLD-R16';
const API_PREFIX = '/api/world-v312';

function createRealtimeWorld(options = {}) {
  const participantTtlMs = Math.max(10000, Math.min(90000, Number(options.participantTtlMs || 30000)));
  const eventTtlMs = Math.max(30000, Math.min(300000, Number(options.eventTtlMs || 120000)));
  const maxParticipants = Math.max(25, Math.min(1000, Number(options.maxParticipants || 250)));
  const participants = new Map();
  const subscribers = new Map();
  const events = [];
  const objectStates = new Map();
  const rate = new Map();
  let sequence = 0;

  const now = () => Date.now();
  const clamp = value => Math.max(-1200, Math.min(1200, Number(value) || 0));
  const safeText = (value, max = 180) => String(value || '').replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const userKey = user => String(user?.id || user?.username || user?.email || '');
  const clone = value => JSON.parse(JSON.stringify(value || {}));

  function normalizeRoom(value) {
    const text = safeText(value || 'Campus', 100);
    const match = text.match(/^(SV-20[1-5]|ANF-301|CAFETER[IÍ]A|BIBLIOTECA|TERRAZA|PISO [123]|PATIO)/i);
    return match ? match[1].toUpperCase().replace('CAFETERIA','CAFETERÍA') : 'CAMPUS';
  }

  function publicParticipant(participant) {
    return {
      clientId:participant.clientId,
      userId:participant.userId,
      username:participant.username,
      displayName:participant.displayName,
      role:participant.role,
      avatar:clone(participant.avatar),
      position:{ ...participant.position },
      rotationY:participant.rotationY,
      area:participant.area,
      room:participant.room,
      device:participant.device,
      inXR:participant.inXR,
      joinedAt:new Date(participant.joinedAt).toISOString(),
      updatedAt:new Date(participant.updatedAt).toISOString()
    };
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
      payload:clone(event.payload),
      createdAt:new Date(event.createdAt).toISOString()
    };
  }

  function cleanup() {
    const timestamp = now();
    let participantChanged = false;
    for (const [clientId, participant] of participants) {
      if (timestamp - participant.updatedAt <= participantTtlMs) continue;
      participants.delete(clientId);
      participantChanged = true;
    }
    const cutoff = timestamp - eventTtlMs;
    while (events.length && events[0].createdAt < cutoff) events.shift();
    while (events.length > 1400) events.shift();
    for (const [key, state] of objectStates) if (state.updatedAt < cutoff) objectStates.delete(key);
    for (const [key, stamps] of rate) {
      const recent = stamps.filter(item => timestamp - item < 10000);
      if (recent.length) rate.set(key, recent); else rate.delete(key);
    }
    if (participantChanged) broadcastSnapshot();
  }

  function allowed(clientId, count = 1) {
    const timestamp = now();
    const recent = (rate.get(clientId) || []).filter(item => timestamp - item < 10000);
    if (recent.length + count > 40) return false;
    for (let index = 0; index < count; index += 1) recent.push(timestamp);
    rate.set(clientId, recent);
    return true;
  }

  function sanitizeAction(type, payload = {}) {
    if (type === 'chat') return { text:safeText(payload.text, 280) };
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
      return {
        objectId:safeText(payload.objectId, 120),
        title:safeText(payload.title, 100),
        state:clone(payload.state && typeof payload.state === 'object' ? payload.state : {})
      };
    }
    return {};
  }

  function sseWrite(res, eventName, data) {
    if (!res || res.writableEnded || res.destroyed) return false;
    try {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
      return true;
    } catch (_) {
      return false;
    }
  }

  function snapshot(excludeClientId = '', since = 0, room = 'CAMPUS') {
    cleanup();
    const normalizedRoom = normalizeRoom(room);
    return {
      version:VERSION,
      revision:REVISION,
      participants:[...participants.values()]
        .filter(item => item.clientId !== excludeClientId)
        .sort((a,b) => a.joinedAt - b.joinedAt)
        .map(publicParticipant),
      events:events
        .filter(event => event.sequence > since && (normalizedRoom === 'CAMPUS' || event.room === normalizedRoom || event.room === 'CAMPUS'))
        .map(publicEvent),
      objectStates:[...objectStates.values()]
        .filter(item => normalizedRoom === 'CAMPUS' || item.room === normalizedRoom)
        .map(item => ({ ...item, state:clone(item.state), updatedAt:new Date(item.updatedAt).toISOString() })),
      latestSequence:sequence,
      room:normalizedRoom,
      online:participants.size
    };
  }

  function broadcastSnapshot() {
    for (const [clientId, subscriber] of subscribers) {
      if (!sseWrite(subscriber.res, 'snapshot', snapshot(clientId, subscriber.since, subscriber.room))) {
        subscribers.delete(clientId);
      }
    }
  }

  function broadcastEvent(event) {
    const payload = publicEvent(event);
    for (const [clientId, subscriber] of subscribers) {
      if (clientId === event.clientId) continue;
      if (subscriber.room !== 'CAMPUS' && event.room !== 'CAMPUS' && subscriber.room !== event.room) continue;
      if (!sseWrite(subscriber.res, 'interaction', payload)) subscribers.delete(clientId);
    }
  }

  function registerActions(user, clientId, device, inXR, room, actions) {
    const clean = Array.isArray(actions) ? actions.slice(0, 12) : [];
    if (!clean.length || !allowed(clientId, clean.length)) return [];
    const created = [];
    for (const action of clean) {
      const type = safeText(action?.type, 30);
      if (!ALLOWED_TYPES.has(type)) continue;
      const payload = sanitizeAction(type, action?.payload || {});
      if (type === 'chat' && !payload.text) continue;
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
        device,
        inXR,
        payload,
        createdAt:now()
      };
      events.push(event);
      created.push(event);
      if (type === 'object-state' && payload.objectId) {
        objectStates.set(`${room}:${payload.objectId}`, {
          room,
          objectId:payload.objectId,
          title:payload.title,
          state:clone(payload.state),
          updatedBy:event.displayName,
          updatedAt:event.createdAt,
          sequence:event.sequence
        });
      }
      broadcastEvent(event);
    }
    return created;
  }

  async function handle(req, res, pathname, url, user, readJson, sendJson) {
    if (!pathname.startsWith(API_PREFIX)) return false;
    if (!userKey(user)) {
      sendJson(res, 401, { error:'Inicie sesión para entrar al mundo compartido.' });
      return true;
    }

    if (pathname === `${API_PREFIX}/config` && req.method === 'GET') {
      cleanup();
      sendJson(res, 200, {
        ok:true,
        version:VERSION,
        revision:REVISION,
        build:BUILD,
        strategy:'vr-canonical-single-scene-realtime',
        sameSceneBrowserVr:true,
        browserUsesVrCanonicalEnvironment:true,
        browserToVr:true,
        vrToBrowser:true,
        realtimeSse:true,
        pollingFallback:true,
        persistentAccounts:true,
        persistentAvatars:true,
        participants:participants.size,
        subscribers:subscribers.size,
        latestSequence:sequence
      });
      return true;
    }

    if (pathname === `${API_PREFIX}/stream` && req.method === 'GET') {
      const clientId = String(url.searchParams.get('clientId') || '');
      if (!CLIENT_ID_PATTERN.test(clientId)) {
        sendJson(res, 400, { error:'Identificador de sesión inválido.' });
        return true;
      }
      const room = normalizeRoom(url.searchParams.get('room') || 'Campus');
      const since = Math.max(0, Number(url.searchParams.get('since') || 0));
      res.writeHead(200, {
        'Content-Type':'text/event-stream; charset=utf-8',
        'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0',
        'Connection':'keep-alive',
        'X-Accel-Buffering':'no',
        'X-UCAN-World-Version':VERSION
      });
      res.write(': connected\n\n');
      subscribers.set(clientId, { clientId, userId:userKey(user), room, since, res, connectedAt:now() });
      sseWrite(res, 'ready', { ok:true, version:VERSION, revision:REVISION, clientId, room });
      sseWrite(res, 'snapshot', snapshot(clientId, since, room));
      req.on('close', () => subscribers.delete(clientId));
      return true;
    }

    if (pathname !== `${API_PREFIX}/sync`) {
      sendJson(res, 404, { error:'Ruta V312 no encontrada.' });
      return true;
    }

    if (req.method === 'POST') {
      const body = await readJson(req, 128 * 1024);
      const clientId = String(body.clientId || '');
      if (!CLIENT_ID_PATTERN.test(clientId)) {
        sendJson(res, 400, { error:'Identificador de sesión inválido.' });
        return true;
      }
      cleanup();
      if (!participants.has(clientId) && participants.size >= maxParticipants) {
        sendJson(res, 503, { error:'La capacidad temporal del mundo está completa.' });
        return true;
      }
      const position = body.position && typeof body.position === 'object' ? body.position : {};
      const existing = participants.get(clientId);
      const timestamp = now();
      const device = ['browser','quest','mobile','other'].includes(body.device) ? body.device : 'other';
      const inXR = body.inXR === true;
      const room = normalizeRoom(body.room || body.area || 'Campus');
      const participant = {
        clientId,
        userId:userKey(user),
        username:safeText(user.username, 40),
        displayName:safeText(user.displayName || user.username || 'Participante', 60),
        role:user.role === 'admin' ? 'admin' : 'user',
        avatar:clone(user.avatar),
        position:{ x:clamp(position.x), y:clamp(position.y), z:clamp(position.z) },
        rotationY:Number(body.rotationY) || 0,
        area:safeText(body.area || room, 100),
        room,
        device,
        inXR,
        joinedAt:existing?.joinedAt || timestamp,
        updatedAt:timestamp
      };
      participants.set(clientId, participant);
      const createdEvents = registerActions(user, clientId, device, inXR, room, body.actions);
      const subscriber = subscribers.get(clientId);
      if (subscriber) {
        subscriber.room = room;
        subscriber.since = Math.max(subscriber.since, Number(body.since || 0));
      }
      broadcastSnapshot();
      sendJson(res, 200, {
        ok:true,
        version:VERSION,
        revision:REVISION,
        self:{ clientId, userId:participant.userId, device, inXR, room },
        createdEvents:createdEvents.map(publicEvent),
        ...snapshot(clientId, Math.max(0, Number(body.since || 0)), room)
      });
      return true;
    }

    if (req.method === 'DELETE') {
      const body = await readJson(req, 16 * 1024);
      const clientId = String(body.clientId || url.searchParams.get('clientId') || '');
      const participant = participants.get(clientId);
      if (participant && participant.userId === userKey(user)) participants.delete(clientId);
      subscribers.delete(clientId);
      broadcastSnapshot();
      sendJson(res, 200, { ok:true, version:VERSION, participants:participants.size });
      return true;
    }

    sendJson(res, 405, { error:'Método no permitido.' });
    return true;
  }

  const cleanupTimer = setInterval(cleanup, 5000);
  cleanupTimer.unref?.();
  const keepAliveTimer = setInterval(() => {
    for (const [clientId, subscriber] of subscribers) {
      if (!sseWrite(subscriber.res, 'ping', { at:new Date().toISOString(), version:VERSION })) subscribers.delete(clientId);
    }
  }, 15000);
  keepAliveTimer.unref?.();

  return {
    version:VERSION,
    revision:REVISION,
    build:BUILD,
    apiPrefix:API_PREFIX,
    handle,
    close:() => { clearInterval(cleanupTimer); clearInterval(keepAliveTimer); for (const subscriber of subscribers.values()) subscriber.res.end(); subscribers.clear(); },
    getStatus:() => ({ version:VERSION, revision:REVISION, enabled:true, strategy:'vr-canonical-single-scene-realtime', participants:participants.size, subscribers:subscribers.size, events:events.length, latestSequence:sequence })
  };
}

module.exports = { VERSION, REVISION, BUILD, API_PREFIX, createRealtimeWorld };
