'use strict';

const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{8,120}$/;

function createPresenceSystem(options = {}) {
  const ttlMs = Math.max(8000, Math.min(60000, Number(options.ttlMs || process.env.PRESENCE_V307_TTL_MS || 18000)));
  const updateLimit = Math.max(25, Math.min(500, Number(options.updateLimit || process.env.PRESENCE_V307_LIMIT || 120)));
  const clients = new Map();

  function now() { return Date.now(); }
  function clamp(value) { return Math.max(-1000, Math.min(1000, Number(value) || 0)); }
  function safeText(value, max = 100) {
    return String(value || '').replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  }
  function validClientId(value) { return CLIENT_ID_PATTERN.test(String(value || '')); }
  function userKey(user) { return String(user?.id || user?.username || user?.email || ''); }
  function publicAvatar(user) {
    const avatar = user?.avatar && typeof user.avatar === 'object' ? user.avatar : {};
    return JSON.parse(JSON.stringify(avatar));
  }
  function cleanup() {
    const cutoff = now() - ttlMs;
    for (const [clientId, entry] of clients) if (entry.updatedAt < cutoff) clients.delete(clientId);
  }
  function snapshot(excludeClientId = '') {
    cleanup();
    return [...clients.values()]
      .filter(entry => entry.clientId !== excludeClientId)
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map(entry => ({
        clientId:entry.clientId,
        userId:entry.userId,
        username:entry.username,
        displayName:entry.displayName,
        role:entry.role,
        avatar:entry.avatar,
        position:{ ...entry.position },
        rotationY:entry.rotationY,
        area:entry.area,
        device:entry.device,
        inXR:entry.inXR,
        joinedAt:new Date(entry.joinedAt).toISOString(),
        updatedAt:new Date(entry.updatedAt).toISOString()
      }));
  }
  function counts() {
    cleanup();
    const devices = { browser:0, quest:0, xr:0, other:0 };
    for (const entry of clients.values()) {
      if (entry.inXR) devices.xr += 1;
      if (entry.device === 'quest') devices.quest += 1;
      else if (entry.device === 'browser') devices.browser += 1;
      else devices.other += 1;
    }
    return { total:clients.size, devices };
  }

  async function handle(req, res, pathname, url, user, readJson, sendJson) {
    if (!pathname.startsWith('/api/presence-v2')) return false;
    if (!userKey(user)) {
      sendJson(res, 401, { error:'Inicie sesión para utilizar la presencia multientorno.' });
      return true;
    }

    if (pathname === '/api/presence-v2/config' && req.method === 'GET') {
      sendJson(res, 200, {
        ok:true,
        version:'V307',
        strategy:'device-session-presence',
        ttlMs,
        sameAccountMultipleDevices:true,
        browserToVrVisibility:true,
        vrToBrowserVisibility:true,
        ...counts()
      });
      return true;
    }

    if (pathname !== '/api/presence-v2') {
      sendJson(res, 404, { error:'Ruta de presencia V307 no encontrada.' });
      return true;
    }

    if (req.method === 'GET') {
      const clientId = String(url.searchParams.get('clientId') || '');
      sendJson(res, 200, {
        ok:true,
        version:'V307',
        participants:snapshot(validClientId(clientId) ? clientId : ''),
        ttlSeconds:Math.floor(ttlMs / 1000),
        sameAccountMultipleDevices:true,
        ...counts()
      });
      return true;
    }

    if (req.method === 'POST') {
      const body = await readJson(req, 64 * 1024);
      const clientId = String(body.clientId || '');
      if (!validClientId(clientId)) {
        sendJson(res, 400, { error:'Identificador de dispositivo inválido.' });
        return true;
      }
      cleanup();
      if (!clients.has(clientId) && clients.size >= updateLimit) {
        sendJson(res, 503, { error:'La capacidad temporal de presencia está completa.' });
        return true;
      }
      const position = body.position && typeof body.position === 'object' ? body.position : {};
      const existing = clients.get(clientId);
      const timestamp = now();
      const entry = {
        clientId,
        userId:String(user.id || user.username || ''),
        username:safeText(user.username, 40),
        displayName:safeText(user.displayName || user.username || 'Participante', 60),
        role:user.role === 'admin' ? 'admin' : 'user',
        avatar:publicAvatar(user),
        position:{ x:clamp(position.x), y:clamp(position.y), z:clamp(position.z) },
        rotationY:Number(body.rotationY) || 0,
        area:safeText(body.area || 'Campus', 100),
        device:['browser','quest','mobile','other'].includes(body.device) ? body.device : 'other',
        inXR:body.inXR === true,
        joinedAt:existing?.joinedAt || timestamp,
        updatedAt:timestamp
      };
      clients.set(clientId, entry);
      sendJson(res, 200, {
        ok:true,
        version:'V307',
        self:{ clientId:entry.clientId, userId:entry.userId, device:entry.device, inXR:entry.inXR },
        participants:snapshot(clientId),
        sameAccountMultipleDevices:true,
        ...counts()
      });
      return true;
    }

    if (req.method === 'DELETE') {
      const body = await readJson(req, 16 * 1024);
      const clientId = String(body.clientId || url.searchParams.get('clientId') || '');
      const entry = clients.get(clientId);
      if (entry && entry.userId === userKey(user)) clients.delete(clientId);
      sendJson(res, 200, { ok:true, version:'V307', ...counts() });
      return true;
    }

    sendJson(res, 405, { error:'Método no permitido para presencia V307.' });
    return true;
  }

  const cleanupTimer = setInterval(cleanup, Math.max(4000, Math.floor(ttlMs / 3)));
  cleanupTimer.unref?.();

  return {
    handle,
    close:() => clearInterval(cleanupTimer),
    getStatus:() => ({
      version:'V307',
      enabled:true,
      strategy:'device-session-presence',
      ttlMs,
      sameAccountMultipleDevices:true,
      browserToVrVisibility:true,
      vrToBrowserVisibility:true,
      ...counts()
    })
  };
}

module.exports = { createPresenceSystem };
