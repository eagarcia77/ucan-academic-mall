'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');

const VERSION = 'V310';
const REVISION = 'R14';
const BUILD = 'V310-20260728-BROWSER-WEBXR-VISUAL-VALIDATION-R14';
const API_PREFIX = '/api/visual-validation-v310';
const MAX_REPORT_BYTES = 24 * 1024 * 1024;
const MAX_REPORTS = 120;

function safeId(value, fallback = '') {
  const result = String(value || '').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return result || fallback;
}

function safeFileName(value) {
  return String(value || 'captura.png').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);
}

function writeJsonAtomic(file, data) {
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, file);
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (_) { return fallback; }
}

async function readRequestJson(req, limit = MAX_REPORT_BYTES) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('El reporte visual excede el límite permitido.');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch (_) {
    const error = new Error('El reporte visual no contiene JSON válido.');
    error.statusCode = 400;
    throw error;
  }
}

function sendJson(res, status, data, extraHeaders = {}) {
  if (res.headersSent || res.writableEnded) return;
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type':'application/json; charset=utf-8',
    'Content-Length':Buffer.byteLength(body),
    'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma':'no-cache',
    'Expires':'0',
    'X-UCAN-Visual-Validation':VERSION,
    'X-UCAN-Visual-Validation-Revision':REVISION,
    ...extraHeaders
  });
  res.end(body);
}

function sendPng(res, file) {
  try {
    const stat = fs.statSync(file);
    res.writeHead(200, {
      'Content-Type':'image/png',
      'Content-Length':stat.size,
      'Cache-Control':'private, no-store, max-age=0',
      'X-Content-Type-Options':'nosniff',
      'X-UCAN-Visual-Validation':VERSION
    });
    fs.createReadStream(file).pipe(res);
  } catch (error) {
    sendJson(res, error.code === 'ENOENT' ? 404 : 500, { error:error.code === 'ENOENT' ? 'Captura no encontrada.' : 'No se pudo leer la captura.' });
  }
}

function sessionUser(req) {
  const auth = global.__UCAN_AUTH_SYSTEM_V283__;
  try { return auth?.getUserFromRequest?.(req) || auth?.getSessionUser?.(req) || null; }
  catch (_) { return null; }
}

function userKey(user) {
  return safeId(user?.id || user?.username || user?.email, 'usuario');
}

function isAdmin(user) {
  return String(user?.role || '').toLowerCase() === 'admin';
}

function decodePngDataUrl(value) {
  const match = String(value || '').match(/^data:image\/png;base64,([a-z0-9+/=\r\n]+)$/i);
  if (!match) return null;
  const buffer = Buffer.from(match[1].replace(/\s+/g, ''), 'base64');
  if (buffer.length < 8 || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') return null;
  return buffer;
}

function publicConfig() {
  return {
    ok:true,
    version:VERSION,
    revision:REVISION,
    build:BUILD,
    api:API_PREFIX,
    browserBaseline:true,
    webxrComparison:true,
    canonicalCameraRenderTargets:true,
    pixelComparison:true,
    structuralSceneComparison:true,
    screenshotsPersisted:true,
    reportPersistence:true,
    passThreshold:0.03,
    warningThreshold:0.07,
    maximumAreas:32,
    maximumReportBytes:MAX_REPORT_BYTES
  };
}

function versionPayload() {
  return {
    version:VERSION,
    build:BUILD,
    releaseVersion:VERSION,
    visualValidationRevision:REVISION,
    visualValidationBuild:BUILD,
    visualValidationRuntime:`/js/ucan_v310_visual_validation.js?build=${BUILD}`,
    visualValidationApi:API_PREFIX,
    visualValidationBrowserBaseline:true,
    visualValidationWebXRCapture:true,
    visualValidationCanonicalCameras:true,
    visualValidationPixelComparison:true,
    visualValidationStructuralComparison:true,
    visualValidationScreenshots:true,
    visualValidationPersistentReports:true,
    strictVisualParityRevision:'R13',
    browserSceneAuthoritative:true,
    oneBabylonSceneBrowserVr:true,
    sameGeometryBrowserVr:true,
    sameMeshVisibilityBrowserVr:true,
    sameMaterialsBrowserVr:true,
    sameLightingBrowserVr:true,
    sameFogAndEnvironmentBrowserVr:true,
    cameraAndControlsOnlyDifference:true,
    browserToVrInteraction:true,
    vrToBrowserInteraction:true,
    browserUsersVisibleInVr:true,
    vrUsersVisibleInBrowser:true,
    sharedVoice:true
  };
}

function createVisualValidationSystem(options = {}) {
  const dataDir = path.resolve(options.dataDir || path.join(__dirname, '..', 'data'));
  const root = path.join(dataDir, 'visual-validation-v310');
  const indexFile = path.join(root, 'index.json');
  fs.mkdirSync(root, { recursive:true });
  if (!fs.existsSync(indexFile)) writeJsonAtomic(indexFile, { version:VERSION, reports:[] });

  function reportPath(id) { return path.join(root, safeId(id), 'report.json'); }
  function reportDirectory(id) { return path.join(root, safeId(id)); }

  function authorizeReport(user, report) {
    return Boolean(user && report && (isAdmin(user) || String(report.ownerKey) === userKey(user)));
  }

  function loadReport(id) {
    return readJson(reportPath(id), null);
  }

  function saveImage(reportId, areaId, mode, dataUrl) {
    const buffer = decodePngDataUrl(dataUrl);
    if (!buffer) return null;
    const directory = reportDirectory(reportId);
    fs.mkdirSync(directory, { recursive:true });
    const fileName = safeFileName(`${safeId(areaId, 'area')}-${mode}.png`);
    fs.writeFileSync(path.join(directory, fileName), buffer);
    return `${API_PREFIX}/image/${reportId}/${encodeURIComponent(fileName)}`;
  }

  function updateIndex(summary) {
    const index = readJson(indexFile, { version:VERSION, reports:[] });
    const reports = Array.isArray(index.reports) ? index.reports.filter(item => item.id !== summary.id) : [];
    reports.unshift(summary);
    index.version = VERSION;
    index.updatedAt = new Date().toISOString();
    index.reports = reports.slice(0, MAX_REPORTS);
    writeJsonAtomic(indexFile, index);
  }

  async function createReport(req, res, user) {
    if (!user) return sendJson(res, 401, { error:'Inicie sesión para guardar la validación visual.' });
    const body = await readRequestJson(req);
    const createdAt = new Date().toISOString();
    const id = safeId(body.runId, `${Date.now()}-${crypto.randomBytes(5).toString('hex')}`);
    const directory = reportDirectory(id);
    fs.mkdirSync(directory, { recursive:true });

    const areas = Array.isArray(body.areas) ? body.areas.slice(0, 32).map((area, index) => {
      const areaId = safeId(area?.id, `area-${index + 1}`);
      return {
        id:areaId,
        label:String(area?.label || areaId).slice(0, 120),
        status:['pass','warning','fail','not-run'].includes(area?.status) ? area.status : 'not-run',
        pixelDifference:Number.isFinite(Number(area?.pixelDifference)) ? Number(area.pixelDifference) : null,
        browserVisibleMeshes:Number.isFinite(Number(area?.browserVisibleMeshes)) ? Number(area.browserVisibleMeshes) : null,
        vrVisibleMeshes:Number.isFinite(Number(area?.vrVisibleMeshes)) ? Number(area.vrVisibleMeshes) : null,
        browserSignature:String(area?.browserSignature || '').slice(0, 120),
        vrSignature:String(area?.vrSignature || '').slice(0, 120),
        structuralMatch:Boolean(area?.structuralMatch),
        notes:Array.isArray(area?.notes) ? area.notes.map(item => String(item).slice(0, 240)).slice(0, 12) : [],
        browserImage:saveImage(id, areaId, 'browser', area?.browserImage),
        vrImage:saveImage(id, areaId, 'vr', area?.vrImage)
      };
    }) : [];

    const counts = areas.reduce((acc, area) => {
      acc[area.status] = (acc[area.status] || 0) + 1;
      return acc;
    }, { pass:0, warning:0, fail:0, 'not-run':0 });

    const report = {
      id,
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      ownerKey:userKey(user),
      ownerUsername:String(user.username || user.email || 'usuario').slice(0, 120),
      ownerRole:String(user.role || 'user').slice(0, 30),
      createdAt,
      browserCapturedAt:body.browserCapturedAt || null,
      vrCapturedAt:body.vrCapturedAt || null,
      userAgent:String(body.userAgent || req.headers['user-agent'] || '').slice(0, 600),
      environment:body.environment && typeof body.environment === 'object' ? body.environment : {},
      diagnostics:body.diagnostics && typeof body.diagnostics === 'object' ? body.diagnostics : {},
      summary:{
        overallStatus:['pass','warning','fail','not-run'].includes(body?.summary?.overallStatus) ? body.summary.overallStatus : (counts.fail ? 'fail' : counts.warning ? 'warning' : counts.pass ? 'pass' : 'not-run'),
        totalAreas:areas.length,
        ...counts,
        maximumPixelDifference:Number.isFinite(Number(body?.summary?.maximumPixelDifference)) ? Number(body.summary.maximumPixelDifference) : null,
        averagePixelDifference:Number.isFinite(Number(body?.summary?.averagePixelDifference)) ? Number(body.summary.averagePixelDifference) : null
      },
      areas
    };

    writeJsonAtomic(path.join(directory, 'report.json'), report);
    updateIndex({ id, ownerKey:report.ownerKey, ownerUsername:report.ownerUsername, createdAt, summary:report.summary });
    return sendJson(res, 201, { ok:true, id, reportUrl:`${API_PREFIX}/report/${id}`, summary:report.summary });
  }

  async function handle(req, res, pathname, url) {
    if (pathname === '/version') return sendJson(res, 200, versionPayload());
    if (pathname === `${API_PREFIX}/config` && req.method === 'GET') return sendJson(res, 200, publicConfig());

    const user = sessionUser(req);
    if (pathname === `${API_PREFIX}/report` && req.method === 'POST') return createReport(req, res, user);

    if (pathname === `${API_PREFIX}/reports` && req.method === 'GET') {
      if (!user) return sendJson(res, 401, { error:'Inicie sesión.' });
      const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || 20)));
      const index = readJson(indexFile, { version:VERSION, reports:[] });
      const reports = (Array.isArray(index.reports) ? index.reports : [])
        .filter(item => isAdmin(user) || item.ownerKey === userKey(user))
        .slice(0, limit);
      return sendJson(res, 200, { ok:true, version:VERSION, reports });
    }

    const reportMatch = pathname.match(new RegExp(`^${API_PREFIX}/report/([a-z0-9_-]+)$`));
    if (reportMatch && req.method === 'GET') {
      if (!user) return sendJson(res, 401, { error:'Inicie sesión.' });
      const report = loadReport(reportMatch[1]);
      if (!report) return sendJson(res, 404, { error:'Reporte no encontrado.' });
      if (!authorizeReport(user, report)) return sendJson(res, 403, { error:'No tiene autorización para abrir este reporte.' });
      return sendJson(res, 200, report);
    }

    const imageMatch = pathname.match(new RegExp(`^${API_PREFIX}/image/([a-z0-9_-]+)/([a-zA-Z0-9._-]+)$`));
    if (imageMatch && req.method === 'GET') {
      if (!user) return sendJson(res, 401, { error:'Inicie sesión.' });
      const report = loadReport(imageMatch[1]);
      if (!report) return sendJson(res, 404, { error:'Reporte no encontrado.' });
      if (!authorizeReport(user, report)) return sendJson(res, 403, { error:'No tiene autorización para abrir esta captura.' });
      const file = path.join(reportDirectory(imageMatch[1]), safeFileName(imageMatch[2]));
      if (!file.startsWith(reportDirectory(imageMatch[1]))) return sendJson(res, 403, { error:'Ruta inválida.' });
      return sendPng(res, file);
    }

    return false;
  }

  return { version:VERSION, revision:REVISION, build:BUILD, apiPrefix:API_PREFIX, handle, config:publicConfig(), versionPayload };
}

function installVisualValidationSystem(options = {}) {
  if (global.__UCAN_VISUAL_VALIDATION_SERVER_V310__) return global.__UCAN_VISUAL_VALIDATION_SERVER_V310__;
  const system = createVisualValidationSystem(options);
  const previousCreateServer = http.createServer;
  http.createServer = function createServerWithVisualValidationV310(listener) {
    if (typeof listener !== 'function') return previousCreateServer.apply(this, arguments);
    return previousCreateServer.call(this, async (req, res) => {
      try {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const pathname = decodeURIComponent(url.pathname);
        if (pathname === '/version' || pathname.startsWith(API_PREFIX)) {
          const handled = await system.handle(req, res, pathname, url);
          if (handled !== false) return;
        }
        return await listener(req, res);
      } catch (error) {
        console.error('[UCAN Visual Validation V310]', error);
        if (!res.headersSent && !res.writableEnded) sendJson(res, error.statusCode || 500, { error:error.message || 'Error interno de validación visual.' });
      }
    });
  };
  global.__UCAN_VISUAL_VALIDATION_SERVER_V310__ = system;
  return system;
}

module.exports = {
  VERSION,
  REVISION,
  BUILD,
  API_PREFIX,
  createVisualValidationSystem,
  installVisualValidationSystem
};
