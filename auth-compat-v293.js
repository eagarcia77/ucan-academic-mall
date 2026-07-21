'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { VERSION, BUILD, patchQuestControls } = require('./lib/manual-rooftop-stairs-v293');

const CONTROLS_PATH = '/js/ucan_v293_quest_controls_interaction.js';
const CONTROLS_FILE = path.join(__dirname, 'public', 'js', 'ucan_v290_quest_controls_interaction.js');
const CONTROLS_SCRIPT = `${CONTROLS_PATH}?build=${BUILD}`;
const V290_BUILD = 'V290-20260720-QUEST-CONTROLS-STAIRS-INFO';
const V290_PATH = '/js/ucan_v290_quest_controls_interaction.js';
const QUEST_TERRACE_VERSION = 'V295';
const QUEST_TERRACE_BUILD = 'V295-20260721-QUEST-DESKTOP-PARITY-TERRACE-ASSETS';
const QUEST_TERRACE_PATH = '/js/ucan_v295_quest_desktop_parity_terrace.js';
const QUEST_TERRACE_SCRIPT = `${QUEST_TERRACE_PATH}?build=${QUEST_TERRACE_BUILD}`;
const LEGACY_QUEST_TERRACE_PATH = '/js/ucan_v294_quest_terrace_stability.js';

const nativeWriteHead = http.ServerResponse.prototype.writeHead;
const nativeEnd = http.ServerResponse.prototype.end;
const nativeCreateServer = http.createServer;

function normalizeBranding(text) {
  return String(text)
    .replace(/UCAN Academic Mall V\d+/g, 'UCAN Academic')
    .replace(/UCAN Academic Mall/g, 'UCAN Academic')
    .replace(/COMPILACIÓN V\d+ ACTIVA/g, 'ENTORNO ACTIVO')
    .replace(/<title>[^<]*<\/title>/i, '<title>UCAN Academic</title>');
}

function insertQuestTerraceScript(text) {
  let html = String(text)
    .replace(/\s*<script src="\/js\/ucan_v294_quest_terrace_stability\.js\?build=[^"]+"><\/script>/g, '');
  if (html.includes(QUEST_TERRACE_PATH)) return normalizeBranding(html);
  const universalPattern = /<script src="\/js\/ucan_v292_universal_sign_window\.js\?build=[^"]+"><\/script>/;
  const universalTag = html.match(universalPattern)?.[0];
  const terraceTag = `<script src="${QUEST_TERRACE_SCRIPT}"></script>`;
  if (universalTag) return normalizeBranding(html.replace(universalTag, `${universalTag}\n  ${terraceTag}`));
  const mainPattern = /<script src="\/js\/ucan_babylon_mall_v265_accounts_avatars\.js\?build=[^"]+"><\/script>/;
  const mainTag = html.match(mainPattern)?.[0];
  if (mainTag) return normalizeBranding(html.replace(mainTag, `${terraceTag}\n  ${mainTag}`));
  return normalizeBranding(html);
}

function replaceV290References(text) {
  const updated = String(text)
    .replaceAll(`${V290_PATH}?build=${V290_BUILD}`, CONTROLS_SCRIPT)
    .replaceAll(V290_PATH, CONTROLS_PATH)
    .replaceAll(V290_BUILD, BUILD)
    .replaceAll('Meta Quest V290:', 'Meta Quest V293:')
    .replaceAll('V292: planetas, calendarios, mapas, agenda, clima y reloj usan una ventana universal legible y cerrable en todos los entornos.', 'V295: Meta Quest utiliza la misma iluminación y materiales de la computadora, con planetas y pantallas de terraza visibles.');
  return insertQuestTerraceScript(updated);
}

function updateVersionData(data) {
  if (!data || typeof data !== 'object') return data;
  if (data.unifiedXrVersion !== 'V290' && data.questControlsVersion !== 'V290' && data.questControlsVersion !== 'V293') return data;
  data.productName = 'UCAN Academic';
  data.visibleVersionInProductName = false;
  data.legacyProductNameRemoved = true;
  data.unifiedXrScript = CONTROLS_SCRIPT;
  data.unifiedXrVersion = VERSION;
  data.unifiedXrBuild = BUILD;
  data.questControlsVersion = VERSION;
  data.questControlsBuild = BUILD;
  data.questRooftopStairsAutomatic = false;
  data.questRooftopStairsManualActivation = false;
  data.questRooftopStairsTriggerActivation = false;
  data.questRooftopStairsJoystickClickActivation = false;
  data.questRooftopStairsPrimaryButtonActivation = false;
  data.questRooftopStairsJoystickTraversal = true;
  data.questRooftopStairsContinuousSlope = true;
  data.questRooftopStairsLoopPrevention = true;
  data.questRooftopStairsNoActivationButton = true;
  data.questRooftopStairsFloorSynchronization = true;
  data.questRooftopFloorStickyCommit = true;
  data.questRooftopFloorCommitProgress = 0.86;
  data.questAutomaticEscalatorsOtherFloors = true;
  data.rooftopStairsExpandedTriggers = false;
  data.rooftopStairsTriggerMarkers = false;
  data.rooftopStairsBidirectional = true;
  data.rooftopStairsActivationMode = 'manual-walk-with-joystick';
  data.questTerraceScript = QUEST_TERRACE_SCRIPT;
  data.questTerraceVersion = QUEST_TERRACE_VERSION;
  data.questTerraceBuild = QUEST_TERRACE_BUILD;
  data.questOnlyVisualCorrections = true;
  data.desktopVisualsUnchanged = true;
  data.sameLightingAcrossEnvironments = true;
  data.noQuestSpecificExposure = true;
  data.questExposureFactor = 1;
  data.questExposureOverride = false;
  data.questContrastOverride = false;
  data.questToneMappingOverride = false;
  data.questEnvironmentIntensityOverride = false;
  data.questLightIntensityOverride = false;
  data.questFloorMaterialOverride = false;
  data.questFloorMatchesDesktop = true;
  data.questTerraceFloorLock = true;
  data.questTerraceDropPrevention = true;
  data.questTerraceAssetsForcedEveryFrame = true;
  data.questSkyRootForcedEveryFrame = true;
  data.questCelestialMeshesForcedVisible = true;
  data.questHiddenPlanetsEducationallyVisibleInXR = true;
  data.questTerracePanelsForcedVisible = true;
  data.questDynamicPanelTexturesRefreshed = true;
  data.questOriginalMaterialsPreserved = true;
  return data;
}

function sendV293Controls(res) {
  try {
    const source = fs.readFileSync(CONTROLS_FILE, 'utf8');
    const result = patchQuestControls(source);
    const body = result.code;
    res.writeHead(200, {
      'Content-Type':'application/javascript; charset=utf-8',
      'Content-Length':Buffer.byteLength(body),
      'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma':'no-cache',
      'Expires':'0',
      'X-UCAN-XR-Controls':VERSION,
      'X-UCAN-XR-Stairs':VERSION,
      'X-UCAN-XR-Terrace':QUEST_TERRACE_VERSION,
      'X-UCAN-Product':'UCAN Academic'
    });
    res.end(body);
  } catch (error) {
    const body = `console.error(${JSON.stringify(`[UCAN ${VERSION}] ${error.message}`)});`;
    res.writeHead(500, {
      'Content-Type':'application/javascript; charset=utf-8',
      'Content-Length':Buffer.byteLength(body),
      'Cache-Control':'no-store'
    });
    res.end(body);
  }
}

http.createServer = function createV293BaseServer(listener) {
  if (typeof listener !== 'function') return nativeCreateServer.apply(this, arguments);
  return nativeCreateServer.call(this, async (req, res) => {
    try {
      const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (req.method === 'GET' && decodeURIComponent(parsed.pathname) === CONTROLS_PATH) return sendV293Controls(res);
      return await listener(req, res);
    } catch (error) {
      if (!res.headersSent && !res.writableEnded) {
        const body = JSON.stringify({ error:error.message || 'Error interno V293' });
        nativeWriteHead.call(res, 500, {
          'Content-Type':'application/json; charset=utf-8',
          'Content-Length':Buffer.byteLength(body),
          'Cache-Control':'no-store'
        });
        nativeEnd.call(res, body);
      }
    }
  });
};

http.ServerResponse.prototype.writeHead = function writeHeadV293(statusCode, statusMessage, headers) {
  let message = statusMessage;
  let nextHeaders = headers;
  if (statusMessage && typeof statusMessage === 'object') {
    nextHeaders = statusMessage;
    message = undefined;
  }
  if (nextHeaders && typeof nextHeaders === 'object') {
    nextHeaders = { ...nextHeaders };
    const controlKey = Object.keys(nextHeaders).find(key => key.toLowerCase() === 'x-ucan-xr-controls');
    if (controlKey) nextHeaders[controlKey] = VERSION;
    else nextHeaders['X-UCAN-XR-Controls'] = VERSION;
    nextHeaders['X-UCAN-XR-Stairs'] = VERSION;
    nextHeaders['X-UCAN-XR-Terrace'] = QUEST_TERRACE_VERSION;
    nextHeaders['X-UCAN-Product'] = 'UCAN Academic';
  }
  if (message === undefined) return nativeWriteHead.call(this, statusCode, nextHeaders);
  return nativeWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.end = function endV293(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      const buffer = Buffer.isBuffer(body);
      let text = buffer ? body.toString(typeof encoding === 'string' ? encoding : 'utf8') : body;
      const trimmed = text.trim();
      if (/^\s*[\[{]/.test(trimmed)) {
        try { text = JSON.stringify(updateVersionData(JSON.parse(text))); } catch (_) { text = replaceV290References(text); }
      } else {
        text = replaceV290References(text);
      }
      body = buffer ? Buffer.from(text, 'utf8') : text;
    }
  } catch (error) {
    console.error('[UCAN V293/V295 response compatibility]', error);
  }
  return nativeEnd.call(this, body, encoding, callback);
};

require('./auth-compat-v287.js');

console.info(`[UCAN ${VERSION}/${QUEST_TERRACE_VERSION}] UCAN Academic, escaleras caminables, paridad visual y terraza Quest cargados.`);