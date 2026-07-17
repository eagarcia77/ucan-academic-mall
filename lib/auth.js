'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SESSION_COOKIE = 'ucan_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PRESENCE_TTL_MS = 25 * 1000;

const AVATAR_OPTIONS = Object.freeze({
  skinTone: ['#f3c6a5','#dca27b','#bd7f58','#955c3f','#6d402d','#3f241b'],
  hairStyle: ['corto','largo','rizado','moño','rapado','sin-cabello'],
  hairColor: ['#17110f','#38251b','#6b4026','#b7793f','#d8b36c','#d9d9d9','#7a263a','#2d4f86'],
  topStyle: ['camiseta','sudadera','chaqueta','formal'],
  topColor: ['#007b5f','#fed141','#173033','#f5f5f5','#8b2332','#244b87','#7b4fa3','#d66c36'],
  bottomStyle: ['pantalón','jeans','falda','deportivo'],
  bottomColor: ['#152d30','#243b5a','#222222','#6a5947','#e7e7e7','#007b5f'],
  shoeStyle: ['tenis','zapatos','botas'],
  shoeColor: ['#ffffff','#111111','#6d402d','#007b5f','#fed141','#8b2332'],
  accessories: ['gafas','gorra','sombrero','mochila','audífonos','bufanda']
});

const DEFAULT_AVATAR = Object.freeze({
  skinTone: '#dca27b',
  hairStyle: 'corto',
  hairColor: '#17110f',
  topStyle: 'camiseta',
  topColor: '#007b5f',
  bottomStyle: 'pantalón',
  bottomColor: '#152d30',
  shoeStyle: 'tenis',
  shoeColor: '#ffffff',
  accessories: []
});

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function safeText(value, max = 120) { return String(value || '').replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function normalizeUsername(value) { return safeText(value, 24).toLowerCase(); }
function normalizeEmail(value) { return safeText(value, 160).toLowerCase(); }
function randomId(prefix) { return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`; }
function timingSafeEqualHex(a, b) {
  try {
    const left = Buffer.from(String(a), 'hex');
    const right = Buffer.from(String(b), 'hex');
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  } catch { return false; }
}
function passwordDigest(password, salt) {
  return crypto.scryptSync(String(password), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }).toString('hex');
}
function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 10) return 'La contraseña debe contener al menos 10 caracteres.';
  const groups = [/[a-záéíóúñ]/i.test(value), /[A-ZÁÉÍÓÚÑ]/.test(value), /\d/.test(value), /[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9]/.test(value)].filter(Boolean).length;
  if (groups < 3) return 'Use una combinación de mayúsculas, minúsculas, números y símbolos.';
  return '';
}
function parseCookies(req) {
  const result = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  }
  return result;
}
function clientIp(req) {
  return safeText(String(req.headers['x-forwarded-for'] || '').split(',')[0] || req.socket.remoteAddress || 'unknown', 80);
}
function secureRequest(req) {
  return Boolean(req.socket.encrypted) || String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
}
function sessionCookie(token, req, maxAgeSeconds) {
  const attrs = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, 'HttpOnly', 'Path=/', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`];
  if (secureRequest(req)) attrs.push('Secure');
  return attrs.join('; ');
}
function sanitizeAvatar(value) {
  const src = value && typeof value === 'object' ? value : {};
  const result = clone(DEFAULT_AVATAR);
  for (const key of ['skinTone','hairStyle','hairColor','topStyle','topColor','bottomStyle','bottomColor','shoeStyle','shoeColor']) {
    if (AVATAR_OPTIONS[key].includes(src[key])) result[key] = src[key];
  }
  const list = Array.isArray(src.accessories) ? src.accessories : [];
  result.accessories = [...new Set(list.filter(item => AVATAR_OPTIONS.accessories.includes(item)))].slice(0, 3);
  return result;
}

function createAuthSystem(options = {}) {
  const dataDir = options.dataDir;
  if (!dataDir) throw new Error('dataDir es requerido para el sistema de usuarios.');
  const usersFile = path.join(dataDir, 'users.json');
  const registrationEnabled = options.registrationEnabled !== false;
  const sessions = new Map();
  const presence = new Map();
  const attempts = new Map();
  let usersData = { version: 1, users: [] };

  fs.mkdirSync(dataDir, { recursive: true });
  if (fs.existsSync(usersFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
      if (Array.isArray(parsed.users)) usersData = parsed;
    } catch (error) {
      console.error('No se pudo leer users.json:', error);
    }
  }

  function saveUsers() {
    const tmp = `${usersFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(usersData, null, 2));
    fs.renameSync(tmp, usersFile);
  }
  let migratedProfiles = false;
  for (const user of usersData.users) {
    if (typeof user.avatarConfigured !== 'boolean') { user.avatarConfigured = Boolean(user.avatar); migratedProfiles = true; }
    if (typeof user.forcePasswordChange !== 'boolean') { user.forcePasswordChange = false; migratedProfiles = true; }
    if (!user.avatar) { user.avatar = clone(DEFAULT_AVATAR); migratedProfiles = true; }
  }
  if (migratedProfiles) saveUsers();
  function findUserById(id) { return usersData.users.find(user => user.id === id) || null; }
  function findUserByLogin(login) {
    const normalized = normalizeUsername(login);
    const email = normalizeEmail(login);
    return usersData.users.find(user => user.username === normalized || user.email === email) || null;
  }
  function publicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      status: user.status,
      forcePasswordChange: Boolean(user.forcePasswordChange),
      avatar: sanitizeAvatar(user.avatar),
      avatarConfigured: Boolean(user.avatarConfigured),
      createdAt: user.createdAt,
      lastLogin: user.lastLogin || null,
      avatarConfiguredAt: user.avatarConfiguredAt || null,
      passwordChangedAt: user.passwordChangedAt || null
    };
  }
  function createUser({ username, displayName, email, password, role = 'user', forcePasswordChange = false, avatarConfigured = false }) {
    const normalizedUsername = normalizeUsername(username);
    const normalizedEmail = normalizeEmail(email);
    if (!/^[a-z0-9._-]{3,24}$/.test(normalizedUsername)) throw new Error('El nombre de usuario debe tener de 3 a 24 caracteres y solo puede incluir letras, números, punto, guion o guion bajo.');
    if (safeText(displayName, 60).length < 2) throw new Error('Escriba el nombre que se mostrará en el campus.');
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error('Escriba un correo electrónico válido.');
    const passwordError = validatePassword(password);
    if (passwordError) throw new Error(passwordError);
    if (usersData.users.some(user => user.username === normalizedUsername)) throw new Error('Ese nombre de usuario ya está registrado.');
    if (usersData.users.some(user => user.email === normalizedEmail)) throw new Error('Ese correo electrónico ya está registrado.');
    const salt = crypto.randomBytes(16).toString('hex');
    const now = new Date().toISOString();
    const user = {
      id: randomId('usr'),
      username: normalizedUsername,
      displayName: safeText(displayName, 60),
      email: normalizedEmail,
      passwordSalt: salt,
      passwordHash: passwordDigest(password, salt),
      role: role === 'admin' ? 'admin' : 'user',
      status: 'active',
      forcePasswordChange: Boolean(forcePasswordChange),
      avatar: clone(DEFAULT_AVATAR),
      avatarConfigured: Boolean(avatarConfigured),
      createdAt: now,
      updatedAt: now,
      lastLogin: null
    };
    usersData.users.push(user);
    saveUsers();
    return user;
  }

  let initialAdminCreated = false;
  if (!usersData.users.some(user => user.role === 'admin')) {
    const initialPassword = String(options.initialAdminPassword || 'Cambiar-UCAN-2026!');
    const admin = createUser({
      username: options.initialAdminUsername || 'admin',
      displayName: options.initialAdminDisplayName || 'Administrador UCAN',
      email: options.initialAdminEmail || 'admin@ucan.local',
      password: initialPassword,
      role: 'admin',
      forcePasswordChange: true,
      avatarConfigured: true
    });
    initialAdminCreated = true;
    console.warn(`UCAN: se creó la cuenta administrativa inicial "${admin.username}". Cambie la contraseña al entrar.`);
  }

  function checkRate(key, limit, windowMs) {
    const now = Date.now();
    const records = (attempts.get(key) || []).filter(time => now - time < windowMs);
    if (records.length >= limit) return false;
    records.push(now);
    attempts.set(key, records);
    return true;
  }
  function issueSession(req, res, user) {
    const token = crypto.randomBytes(32).toString('base64url');
    const key = crypto.createHash('sha256').update(token).digest('hex');
    sessions.set(key, { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
    res.setHeader('Set-Cookie', sessionCookie(token, req, Math.floor(SESSION_TTL_MS / 1000)));
  }
  function destroySession(req, res) {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (token) sessions.delete(crypto.createHash('sha256').update(token).digest('hex'));
    res.setHeader('Set-Cookie', sessionCookie('', req, 0));
  }
  function getSessionUser(req) {
    const token = parseCookies(req)[SESSION_COOKIE];
    if (!token) return null;
    const key = crypto.createHash('sha256').update(token).digest('hex');
    const session = sessions.get(key);
    if (!session || session.expiresAt < Date.now()) { sessions.delete(key); return null; }
    const user = findUserById(session.userId);
    if (!user || user.status !== 'active') { sessions.delete(key); return null; }
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    return user;
  }
  function requireAuth(req, res, sendJson) {
    const user = getSessionUser(req);
    if (!user) { sendJson(res, 401, { error: 'Debe iniciar sesión.' }); return null; }
    return user;
  }
  function requireAdmin(req, res, sendJson) {
    const user = getSessionUser(req);
    if (!user || user.role !== 'admin') { sendJson(res, 403, { error: 'Se requiere una cuenta de administrador.' }); return null; }
    return user;
  }
  function passwordMatches(user, password) {
    return timingSafeEqualHex(passwordDigest(password, user.passwordSalt), user.passwordHash);
  }
  function setPassword(user, password, forcePasswordChange = false) {
    const error = validatePassword(password);
    if (error) throw new Error(error);
    const salt = crypto.randomBytes(16).toString('hex');
    user.passwordSalt = salt;
    user.passwordHash = passwordDigest(password, salt);
    user.forcePasswordChange = Boolean(forcePasswordChange);
    if (!forcePasswordChange) user.passwordChangedAt = new Date().toISOString();
    user.updatedAt = new Date().toISOString();
  }
  function generateTemporaryPassword() {
    return `UCAN-${crypto.randomBytes(4).toString('hex')}-A7!`;
  }
  function presenceSnapshot(viewerId) {
    const now = Date.now();
    const result = [];
    for (const [userId, entry] of presence) {
      if (now - entry.updatedAt > PRESENCE_TTL_MS) { presence.delete(userId); continue; }
      if (userId === viewerId) continue;
      result.push({ ...entry, updatedAt: new Date(entry.updatedAt).toISOString() });
    }
    return result;
  }

  async function handleApi(pathname, req, res, parsed, helpers) {
    const { readJsonBody, sendJson } = helpers;
    if (pathname === '/api/auth/options' && req.method === 'GET') {
      return sendJson(res, 200, { registrationEnabled, avatarOptions: AVATAR_OPTIONS, defaultAvatar: DEFAULT_AVATAR });
    }
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      const user = getSessionUser(req);
      return sendJson(res, user ? 200 : 401, user ? { authenticated: true, user: publicUser(user) } : { authenticated: false, error: 'No hay una sesión activa.' });
    }
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      if (!registrationEnabled) return sendJson(res, 403, { error: 'El registro público está desactivado.' });
      if (!checkRate(`register:${clientIp(req)}`, 5, 30 * 60 * 1000)) return sendJson(res, 429, { error: 'Demasiados intentos de registro. Espere antes de continuar.' });
      const body = await readJsonBody(req, 32 * 1024);
      try {
        const user = createUser({ username: body.username, displayName: body.displayName, email: body.email, password: body.password });
        issueSession(req, res, user);
        return sendJson(res, 201, { ok: true, user: publicUser(user) });
      } catch (error) { return sendJson(res, 400, { error: error.message }); }
    }
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await readJsonBody(req, 16 * 1024);
      const login = safeText(body.login, 160);
      const rateKey = `login:${clientIp(req)}:${normalizeUsername(login)}`;
      if (!checkRate(rateKey, 10, 15 * 60 * 1000)) return sendJson(res, 429, { error: 'Demasiados intentos. Espere 15 minutos.' });
      const user = findUserByLogin(login);
      if (!user || !passwordMatches(user, body.password)) return sendJson(res, 401, { error: 'Usuario, correo o contraseña incorrectos.' });
      if (user.status !== 'active') return sendJson(res, 403, { error: 'Esta cuenta está desactivada. Comuníquese con un administrador.' });
      user.lastLogin = new Date().toISOString();
      user.updatedAt = user.lastLogin;
      saveUsers();
      issueSession(req, res, user);
      return sendJson(res, 200, { ok: true, user: publicUser(user) });
    }
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      const user = getSessionUser(req);
      if (user) presence.delete(user.id);
      destroySession(req, res);
      return sendJson(res, 200, { ok: true });
    }
    if (pathname === '/api/auth/change-password' && req.method === 'POST') {
      const user = requireAuth(req, res, sendJson); if (!user) return;
      const body = await readJsonBody(req, 16 * 1024);
      if (!passwordMatches(user, body.currentPassword)) return sendJson(res, 400, { error: 'La contraseña actual no es correcta.' });
      try { setPassword(user, body.newPassword, false); saveUsers(); return sendJson(res, 200, { ok: true, user: publicUser(user) }); }
      catch (error) { return sendJson(res, 400, { error: error.message }); }
    }
    if (pathname === '/api/profile' && req.method === 'PATCH') {
      const user = requireAuth(req, res, sendJson); if (!user) return;
      const body = await readJsonBody(req, 16 * 1024);
      const displayName = safeText(body.displayName, 60);
      const email = normalizeEmail(body.email);
      if (displayName.length < 2) return sendJson(res, 400, { error: 'Escriba un nombre válido.' });
      if (!/^\S+@\S+\.\S+$/.test(email)) return sendJson(res, 400, { error: 'Escriba un correo electrónico válido.' });
      if (usersData.users.some(item => item.id !== user.id && item.email === email)) return sendJson(res, 409, { error: 'Ese correo ya pertenece a otra cuenta.' });
      user.displayName = displayName; user.email = email; user.updatedAt = new Date().toISOString(); saveUsers();
      return sendJson(res, 200, { ok: true, user: publicUser(user) });
    }
    if (pathname === '/api/profile/avatar' && req.method === 'PUT') {
      const user = requireAuth(req, res, sendJson); if (!user) return;
      const body = await readJsonBody(req, 32 * 1024);
      user.avatar = sanitizeAvatar(body.avatar);
      user.avatarConfigured = true;
      user.avatarConfiguredAt = new Date().toISOString();
      user.updatedAt = new Date().toISOString();
      saveUsers();
      return sendJson(res, 200, { ok: true, avatar: user.avatar, user: publicUser(user) });
    }
    if (pathname === '/api/admin/users' && req.method === 'GET') {
      const admin = requireAdmin(req, res, sendJson); if (!admin) return;
      const users = usersData.users.map(publicUser).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return sendJson(res, 200, { users, stats: { total: users.length, active: users.filter(user => user.status === 'active').length, admins: users.filter(user => user.role === 'admin').length, online: presenceSnapshot('').length } });
    }
    const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([a-zA-Z0-9_]+)$/);
    if (adminUserMatch && req.method === 'PATCH') {
      const admin = requireAdmin(req, res, sendJson); if (!admin) return;
      const target = findUserById(adminUserMatch[1]);
      if (!target) return sendJson(res, 404, { error: 'Usuario no encontrado.' });
      const body = await readJsonBody(req, 16 * 1024);
      if (target.id === admin.id && (body.status === 'disabled' || body.role === 'user')) return sendJson(res, 400, { error: 'No puede desactivar ni degradar su propia cuenta administrativa.' });
      if (['admin','user'].includes(body.role)) target.role = body.role;
      if (['active','disabled'].includes(body.status)) target.status = body.status;
      if (safeText(body.displayName, 60).length >= 2) target.displayName = safeText(body.displayName, 60);
      target.updatedAt = new Date().toISOString(); saveUsers();
      return sendJson(res, 200, { ok: true, user: publicUser(target) });
    }
    const resetMatch = pathname.match(/^\/api\/admin\/users\/([a-zA-Z0-9_]+)\/reset-password$/);
    if (resetMatch && req.method === 'POST') {
      const admin = requireAdmin(req, res, sendJson); if (!admin) return;
      const target = findUserById(resetMatch[1]);
      if (!target) return sendJson(res, 404, { error: 'Usuario no encontrado.' });
      const temporaryPassword = generateTemporaryPassword();
      setPassword(target, temporaryPassword, true); saveUsers();
      return sendJson(res, 200, { ok: true, temporaryPassword, user: publicUser(target) });
    }
    if (pathname === '/api/presence' && req.method === 'GET') {
      const user = requireAuth(req, res, sendJson); if (!user) return;
      return sendJson(res, 200, { participants: presenceSnapshot(user.id), ttlSeconds: Math.floor(PRESENCE_TTL_MS / 1000) });
    }
    if (pathname === '/api/presence' && req.method === 'POST') {
      const user = requireAuth(req, res, sendJson); if (!user) return;
      const body = await readJsonBody(req, 32 * 1024);
      const position = body.position && typeof body.position === 'object' ? body.position : {};
      const clamp = value => Math.max(-600, Math.min(600, Number(value) || 0));
      presence.set(user.id, {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        avatar: sanitizeAvatar(user.avatar),
        position: { x: clamp(position.x), y: clamp(position.y), z: clamp(position.z) },
        rotationY: Number(body.rotationY) || 0,
        area: safeText(body.area, 80),
        updatedAt: Date.now()
      });
      return sendJson(res, 200, { ok: true, online: presenceSnapshot('').length });
    }
    if (pathname === '/api/presence' && req.method === 'DELETE') {
      const user = requireAuth(req, res, sendJson); if (!user) return;
      presence.delete(user.id);
      return sendJson(res, 200, { ok: true });
    }
    return false;
  }

  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, session] of sessions) if (session.expiresAt < now) sessions.delete(key);
    for (const [userId, entry] of presence) if (now - entry.updatedAt > PRESENCE_TTL_MS) presence.delete(userId);
    for (const [key, records] of attempts) {
      const recent = records.filter(time => now - time < 30 * 60 * 1000);
      if (recent.length) attempts.set(key, recent); else attempts.delete(key);
    }
  }, 30 * 1000);
  cleanupTimer.unref?.();

  return {
    usersFile,
    avatarOptions: AVATAR_OPTIONS,
    defaultAvatar: DEFAULT_AVATAR,
    registrationEnabled,
    initialAdminCreated,
    getSessionUser,
    publicUser,
    requireAuth,
    requireAdmin,
    handleApi,
    stats() {
      return {
        enabled: true,
        totalUsers: usersData.users.length,
        activeUsers: usersData.users.filter(user => user.status === 'active').length,
        admins: usersData.users.filter(user => user.role === 'admin').length,
        online: presenceSnapshot('').length,
        registrationEnabled,
        persistent: true,
        avatarCustomization: true,
        multiplayerPresence: true
      };
    }
  };
}

module.exports = { createAuthSystem, AVATAR_OPTIONS, DEFAULT_AVATAR, sanitizeAvatar };
