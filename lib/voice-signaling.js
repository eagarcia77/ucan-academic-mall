'use strict';

const DEFAULT_ROOMS = Object.freeze(['SV-201', 'SV-202', 'SV-203', 'SV-204', 'SV-205', 'ANF-301']);
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{6,120}$/;

function createVoiceSystem(options = {}) {
  const allowedRooms = new Set(Array.isArray(options.rooms) && options.rooms.length ? options.rooms : DEFAULT_ROOMS);
  const roomLimit = Math.max(2, Math.min(50, Number(options.roomLimit || process.env.VOICE_ROOM_LIMIT || 12)));
  const heartbeatTtlMs = Math.max(30000, Number(options.heartbeatTtlMs || 70000));
  const cleanupIntervalMs = Math.max(10000, Math.min(30000, Math.floor(heartbeatTtlMs / 3)));
  const maxSignalBytes = Math.max(65536, Math.min(1024 * 1024, Number(options.maxSignalBytes || 256 * 1024)));
  const iceServers = normalizeIceServers(options.iceServers || loadIceServersFromEnvironment());
  const clients = new Map();
  const rooms = new Map([...allowedRooms].map(room => [room, new Set()]));
  let sequence = 0;

  function now() {
    return Date.now();
  }

  function userKey(user) {
    return String(user?.id || user?.username || user?.email || '').slice(0, 160);
  }

  function cleanName(value, fallback = 'Participante') {
    const text = String(value || fallback)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 40);
    return text || fallback;
  }

  function validClientId(value) {
    return CLIENT_ID_PATTERN.test(String(value || ''));
  }

  function publicParticipant(client) {
    return {
      id:client.id,
      name:client.name,
      room:client.room,
      joinedAt:client.joinedAt
    };
  }

  function roomParticipants(room, excludeId = '') {
    const members = rooms.get(room) || new Set();
    return [...members]
      .filter(id => id !== excludeId)
      .map(id => clients.get(id))
      .filter(Boolean)
      .map(publicParticipant);
  }

  function writeSse(res, payload, eventName = '') {
    if (!res || res.writableEnded || res.destroyed) return false;
    try {
      if (eventName) res.write(`event: ${eventName}\n`);
      res.write(`id: ${++sequence}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      return true;
    } catch (_) {
      return false;
    }
  }

  function sendToClient(clientId, payload) {
    const client = clients.get(clientId);
    if (!client) return false;
    if (writeSse(client.response, payload)) return true;
    client.queue.push(payload);
    if (client.queue.length > 80) client.queue.splice(0, client.queue.length - 80);
    return false;
  }

  function broadcastRoom(room, payload, excludeId = '') {
    const members = rooms.get(room) || new Set();
    for (const id of members) {
      if (id !== excludeId) sendToClient(id, payload);
    }
  }

  function detachClient(client, notify = true) {
    if (!client) return;
    const room = client.room;
    const members = rooms.get(room);
    members?.delete(client.id);
    clients.delete(client.id);
    if (client.response && !client.response.writableEnded) {
      try { client.response.end(); } catch (_) {}
    }
    client.response = null;
    if (notify && room) {
      broadcastRoom(room, { type:'peer-left', peerId:client.id, room }, client.id);
    }
  }

  function roomCounts() {
    const result = {};
    for (const room of allowedRooms) result[room] = rooms.get(room)?.size || 0;
    return result;
  }

  async function handleConfig(req, res, sendJson) {
    if (req.method !== 'GET') return false;
    sendJson(res, 200, {
      ok:true,
      version:'V306',
      transport:'webrtc-mesh-sse-signaling',
      iceServers,
      roomLimit,
      rooms:[...allowedRooms],
      turnConfigured:iceServers.some(server => urlsOf(server).some(url => /^turns?:/i.test(url)))
    });
    return true;
  }

  async function handleRooms(req, res, sendJson) {
    if (req.method !== 'GET') return false;
    sendJson(res, 200, {
      ok:true,
      version:'V306',
      rooms:roomCounts(),
      roomLimit,
      activeClients:clients.size
    });
    return true;
  }

  async function handleJoin(req, res, user, readJson, sendJson) {
    if (req.method !== 'POST') return false;
    const body = await readJson(req, maxSignalBytes);
    const id = String(body.clientId || '');
    const room = String(body.room || '');
    if (!validClientId(id)) {
      sendJson(res, 400, { error:'Identificador de audio inválido.' });
      return true;
    }
    if (!allowedRooms.has(room)) {
      sendJson(res, 400, { error:'La sala de audio no existe.' });
      return true;
    }
    const identity = userKey(user);
    if (!identity) {
      sendJson(res, 401, { error:'Inicie sesión para usar el audio.' });
      return true;
    }

    const existing = clients.get(id);
    if (existing && existing.userKey !== identity) {
      sendJson(res, 409, { error:'El identificador de audio ya está en uso.' });
      return true;
    }
    if (existing && existing.room !== room) detachClient(existing, true);

    const members = rooms.get(room);
    if (!clients.has(id) && members.size >= roomLimit) {
      sendJson(res, 409, { error:`${room} alcanzó el máximo de ${roomLimit} participantes.` });
      return true;
    }

    const participant = clients.get(id) || {
      id,
      queue:[],
      response:null,
      joinedAt:new Date().toISOString()
    };
    participant.name = cleanName(body.name, user?.displayName || user?.username || 'Participante');
    participant.room = room;
    participant.userKey = identity;
    participant.lastSeen = now();
    clients.set(id, participant);
    members.add(id);

    const others = roomParticipants(room, id);
    broadcastRoom(room, { type:'peer-joined', room, peer:publicParticipant(participant) }, id);
    sendJson(res, 200, {
      ok:true,
      room,
      self:publicParticipant(participant),
      participants:others,
      roomLimit,
      iceServers
    });
    return true;
  }

  async function handleEvents(req, res, url, user, sendJson) {
    if (req.method !== 'GET') return false;
    const id = String(url.searchParams.get('clientId') || '');
    const client = clients.get(id);
    if (!validClientId(id) || !client) {
      sendJson(res, 404, { error:'La sesión de audio no está activa.' });
      return true;
    }
    if (client.userKey !== userKey(user)) {
      sendJson(res, 403, { error:'Esta sesión de audio pertenece a otra cuenta.' });
      return true;
    }

    if (client.response && client.response !== res && !client.response.writableEnded) {
      try { client.response.end(); } catch (_) {}
    }

    res.writeHead(200, {
      'Content-Type':'text/event-stream; charset=utf-8',
      'Cache-Control':'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Connection':'keep-alive',
      'X-Accel-Buffering':'no',
      'Access-Control-Allow-Credentials':'true'
    });
    res.flushHeaders?.();
    res.socket?.setTimeout?.(0);
    res.socket?.setNoDelay?.(true);
    client.response = res;
    client.lastSeen = now();

    writeSse(res, {
      type:'connected',
      room:client.room,
      self:publicParticipant(client),
      participants:roomParticipants(client.room, client.id)
    });
    for (const queued of client.queue.splice(0)) writeSse(res, queued);

    const ping = setInterval(() => {
      if (res.writableEnded || res.destroyed) return clearInterval(ping);
      try { res.write(`: ping ${Date.now()}\n\n`); } catch (_) { clearInterval(ping); }
    }, 15000);
    ping.unref?.();

    req.on('close', () => {
      clearInterval(ping);
      const latest = clients.get(id);
      if (latest?.response === res) latest.response = null;
    });
    return true;
  }

  async function handleSignal(req, res, user, readJson, sendJson) {
    if (req.method !== 'POST') return false;
    const body = await readJson(req, maxSignalBytes);
    const from = String(body.from || '');
    const to = String(body.to || '');
    const source = clients.get(from);
    const target = clients.get(to);
    if (!source || source.userKey !== userKey(user)) {
      sendJson(res, 403, { error:'La sesión de origen no es válida.' });
      return true;
    }
    if (!target || target.room !== source.room) {
      sendJson(res, 404, { error:'El participante de destino no está en la misma sala.' });
      return true;
    }
    source.lastSeen = now();
    sendToClient(to, {
      type:'signal',
      room:source.room,
      from:source.id,
      name:source.name,
      data:body.data || null
    });
    sendJson(res, 200, { ok:true });
    return true;
  }

  async function handleHeartbeat(req, res, user, readJson, sendJson) {
    if (req.method !== 'POST') return false;
    const body = await readJson(req, 32 * 1024);
    const id = String(body.clientId || '');
    const client = clients.get(id);
    if (!client || client.userKey !== userKey(user)) {
      sendJson(res, 404, { error:'La sesión de audio no está activa.' });
      return true;
    }
    client.lastSeen = now();
    sendJson(res, 200, { ok:true, room:client.room, participants:rooms.get(client.room)?.size || 0 });
    return true;
  }

  async function handleLeave(req, res, user, readJson, sendJson) {
    if (req.method !== 'POST') return false;
    const body = await readJson(req, 32 * 1024);
    const id = String(body.clientId || '');
    const client = clients.get(id);
    if (client && client.userKey === userKey(user)) detachClient(client, true);
    sendJson(res, 200, { ok:true });
    return true;
  }

  async function handle(req, res, pathname, url, user, readJson, sendJson) {
    if (!pathname.startsWith('/api/voice/')) return false;
    if (!user) {
      sendJson(res, 401, { error:'Inicie sesión para usar el audio de las salas.' });
      return true;
    }
    if (pathname === '/api/voice/config') return handleConfig(req, res, sendJson);
    if (pathname === '/api/voice/rooms') return handleRooms(req, res, sendJson);
    if (pathname === '/api/voice/join') return handleJoin(req, res, user, readJson, sendJson);
    if (pathname === '/api/voice/events') return handleEvents(req, res, url, user, sendJson);
    if (pathname === '/api/voice/signal') return handleSignal(req, res, user, readJson, sendJson);
    if (pathname === '/api/voice/heartbeat') return handleHeartbeat(req, res, user, readJson, sendJson);
    if (pathname === '/api/voice/leave') return handleLeave(req, res, user, readJson, sendJson);
    sendJson(res, 404, { error:'Ruta de audio no encontrada.' });
    return true;
  }

  function getStatus() {
    return {
      version:'V306',
      enabled:true,
      transport:'webrtc-mesh-sse-signaling',
      rooms:[...allowedRooms],
      roomLimit,
      activeClients:clients.size,
      roomCounts:roomCounts(),
      iceServerCount:iceServers.length,
      turnConfigured:iceServers.some(server => urlsOf(server).some(url => /^turns?:/i.test(url))),
      singleInstanceSignaling:true
    };
  }

  const cleanupTimer = setInterval(() => {
    const cutoff = now() - heartbeatTtlMs;
    for (const client of [...clients.values()]) {
      if (client.lastSeen < cutoff) detachClient(client, true);
    }
  }, cleanupIntervalMs);
  cleanupTimer.unref?.();

  return { handle, getStatus, close:() => clearInterval(cleanupTimer) };
}

function urlsOf(server) {
  const urls = server?.urls;
  if (Array.isArray(urls)) return urls.map(String);
  return urls ? [String(urls)] : [];
}

function normalizeIceServers(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(server => {
      if (!server || typeof server !== 'object') return null;
      const urls = urlsOf(server).filter(url => /^(stun|turn|turns):/i.test(url));
      if (!urls.length) return null;
      const normalized = { urls:urls.length === 1 ? urls[0] : urls };
      if (server.username) normalized.username = String(server.username);
      if (server.credential) normalized.credential = String(server.credential);
      return normalized;
    })
    .filter(Boolean)
    .slice(0, 8);
}

function loadIceServersFromEnvironment() {
  const configured = String(process.env.VOICE_ICE_SERVERS_JSON || '').trim();
  if (configured) {
    try {
      const parsed = JSON.parse(configured);
      if (Array.isArray(parsed)) return parsed;
    } catch (error) {
      console.warn('[UCAN Voice] VOICE_ICE_SERVERS_JSON no contiene JSON válido:', error.message);
    }
  }

  const servers = [{
    urls:[
      'stun:stun.l.google.com:19302',
      'stun:stun1.l.google.com:19302'
    ]
  }];
  const turnUrls = String(process.env.VOICE_TURN_URLS || '').split(',').map(value => value.trim()).filter(Boolean);
  if (turnUrls.length) {
    servers.push({
      urls:turnUrls,
      username:String(process.env.VOICE_TURN_USERNAME || ''),
      credential:String(process.env.VOICE_TURN_CREDENTIAL || '')
    });
  }
  return servers;
}

module.exports = { createVoiceSystem, loadIceServersFromEnvironment };
