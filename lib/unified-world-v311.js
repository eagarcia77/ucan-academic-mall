'use strict';

const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,120}$/;
const ALLOWED_TYPES = new Set(['chat','gesture','reaction','focus','object-state']);
const ALLOWED_GESTURES = new Set(['wave','raise-hand','clap','point']);
const ALLOWED_REACTIONS = new Set(['👍','👏','❤️','🎉','❓']);

const VERSION = 'V311';
const REVISION = 'R15';
const BUILD = 'V311-20260729-ONE-SCENE-ONE-WORLD-R15';
const API_PREFIX = '/api/unified-world-v311';

function createUnifiedWorld(options = {}) {
  const participantTtlMs = Math.max(8000, Math.min(60000, Number(options.participantTtlMs || 20000)));
  const eventTtlMs = Math.max(30000, Math.min(300000, Number(options.eventTtlMs || 120000)));
  const maxParticipants = Math.max(25, Math.min(1000, Number(options.maxParticipants || 250)));
  const maxEvents = Math.max(100, Math.min(4000, Number(options.maxEvents || 1200)));
  const participants = new Map();
  const events = [];
  const objectStates = new Map();
  const rate = new Map();
  let sequence = 0;

  const now = () => Date.now();
  const clamp = value => Math.max(-1200, Math.min(1200, Number(value) || 0));
  const safeText = (value, max = 160) => String(value || '').replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const userKey = user => String(user?.id || user?.username || user?.email || '');
  const clone = value => JSON.parse(JSON.stringify(value || {}));

  function normalizeRoom(value) {
    const text = safeText(value || 'Campus', 100);
    const match = text.match(/^(SV-20[1-5]|ANF-301|CAFETER[IÍ]A|BIBLIOTECA|TERRAZA|PISO [123]|PATIO)/i);
    return match ? match[1].toUpperCase().replace('CAFETERIA','CAFETERÍA') : 'CAMPUS';
  }

  function cleanup() {
    const timestamp = now();
    for (const [clientId, participant] of participants) if (timestamp - participant.updatedAt > participantTtlMs) participants.delete(clientId);
    const cutoff = timestamp - eventTtlMs;
    while (events.length && events[0].createdAt < cutoff) events.shift();
    while (events.length > maxEvents) events.shift();
    for (const [key, state] of objectStates) if (state.updatedAt < cutoff) objectStates.delete(key);
    for (const [key, stamps] of rate) {
      const recent = stamps.filter(item => timestamp - item < 10000);
      if (recent.length) rate.set(key, recent); else rate.delete(key);
    }
  }

  function allow(clientId, count = 1) {
    const timestamp = now();
    const recent = (rate.get(clientId) || []).filter(item => timestamp - item < 10000);
    if (recent.length + count > 36) return false;
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

  function snapshot(excludeClientId, since, room) {
    cleanup();
    const normalizedRoom = normalizeRoom(room);
    return {
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
      room:normalizedRoom
    };
  }

  function registerActions(user, clientId, device, inXR, room, actions) {
    const clean = Array.isArray(actions) ? actions.slice(0, 12) : [];
    if (!clean.length) return;
    if (!allow(clientId, clean.length)) return;
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
    }
  }

  async function handle(req, res, pathname, url, user, readJson, sendJson) {
    if (!pathname.startsWith(API_PREFIX)) return false;
    if (!userKey(user)) {
      sendJson(res, 401, { error:'Inicie sesión para entrar al mundo unificado.' });
      return true;
    }

    if (pathname === `${API_PREFIX}/config` && req.method === 'GET') {
      cleanup();
      sendJson(res, 200, {
        ok:true,
        version:VERSION,
        revision:REVISION,
        build:BUILD,
        strategy:'one-scene-one-world',
        sameSceneBrowserVr:true,
        sameGeometryBrowserVr:true,
        sameUsersBrowserVr:true,
        browserToVr:true,
        vrToBrowser:true,
        persistentAccounts:true,
        persistentAvatars:true,
        participants:participants.size,
        latestSequence:sequence
      });
      return true;
    }

    if (pathname !== `${API_PREFIX}/sync`) {
      sendJson(res, 404, { error:'Ruta V311 no encontrada.' });
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
      registerActions(user, clientId, device, inXR, room, body.actions);
      const data = snapshot(clientId, Math.max(0, Number(body.since || 0)), room);
      sendJson(res, 200, {
        ok:true,
        version:VERSION,
        revision:REVISION,
        self:{ clientId, userId:participant.userId, device, inXR, room },
        ...data
      });
      return true;
    }

    if (req.method === 'DELETE') {
      const body = await readJson(req, 16 * 1024);
      const clientId = String(body.clientId || url.searchParams.get('clientId') || '');
      const participant = participants.get(clientId);
      if (participant && participant.userId === userKey(user)) participants.delete(clientId);
      sendJson(res, 200, { ok:true, version:VERSION, participants:participants.size });
      return true;
    }

    sendJson(res, 405, { error:'Método no permitido.' });
    return true;
  }

  const timer = setInterval(cleanup, 5000);
  timer.unref?.();

  return {
    version:VERSION,
    revision:REVISION,
    build:BUILD,
    apiPrefix:API_PREFIX,
    handle,
    close:() => clearInterval(timer),
    getStatus:() => ({ version:VERSION, revision:REVISION, enabled:true, strategy:'one-scene-one-world', participants:participants.size, events:events.length, latestSequence:sequence })
  };
}

module.exports = { VERSION, REVISION, BUILD, API_PREFIX, createUnifiedWorld };
