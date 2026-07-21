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
const QUEST_TERRACE_VERSION = 'V294';
const QUEST_TERRACE_BUILD = 'V294-20260721-QUEST-TERRACE-LIGHT-SIGNS';
const QUEST_TERRACE_PATH = '/js/ucan_v294_quest_terrace_stability.js';
const QUEST_TERRACE_SCRIPT = `${QUEST_TERRACE_PATH}?build=${QUEST_TERRACE_BUILD}`;

const nativeWriteHead = http.ServerResponse.prototype.writeHead;
const nativeEnd = http.ServerResponse.prototype.end;
const nativeCreateServer = http.createServer;

function insertQuestTerraceScript(text) {
  let html = String(text);
  if (html.includes(QUEST_TERRACE_PATH)) return html;
  const universalPattern = /<script src="\/js\/ucan_v292_universal_sign_window\.js\?build=[^"]+"><\/script>/;
  const universalTag = html.match(universalPattern)?.[0];
  const terraceTag = `<script src="${QUEST_TERRACE_SCRIPT}"></script>`;
  if (universalTag) return html.replace(universalTag, `${universalTag}\n  ${terraceTag}`);
  const mainPattern = /<script src="\/js\/ucan_babylon_mall_v265_accounts_avatars\.js\?build=[^"]+"><\/script>/;
  const mainTag = html.match(mainPattern)?.[0];
  if (mainTag) return html.replace(mainTag, `${terraceTag}\n  ${mainTag}`);
  return html;
}

function replaceV290References(text) {
  const updated = String(text)
    .replaceAll(`${V290_PATH}?build=${V290_BUILD}`, CONTROLS_SCRIPT)
    .replaceAll(V290_PATH, CONTROLS_PATH)
    .replaceAll(V290_BUILD, BUILD)
    .replaceAll('Meta Quest V290:', 'Meta Quest V293:')
    .replaceAll('V292: planetas, calendarios, mapas, agenda, clima y reloj usan una ventana universal legible y cerrable en todos los entornos.', 'V294: Meta Quest utiliza iluminación calibrada, terraza estable y carteles visibles; la computadora conserva su presentación original.');
  return insertQuestTerraceScript(updated);
}

function updateVersionData(data) {
  if (!data || typeof data !== 'object') return data;
  if (data.unifiedXrVersion !== 'V290' && data.questControlsVersion !== 'V290' && data.questControlsVersion !== 'V293') return data;
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
  data.questExposure = 0.72;
  data.questContrast = 1.08;
  data.questEnvironmentIntensity = 0.65;
  data.questLightScale = 0.82;
  data.questTerraceFloorLock = true;
  data.questTerraceDropPrevention = true;
  data.questDistantLabelsAlwaysActive = true;
  data.questCelestialLabelScale = 1.65;
  data.questTerracePanelsReadable = true;
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
      'X-UCAN-XR-Terrace':QUEST_TERRACE_VERSION
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
    console.error('[UCAN V293/V294 response compatibility]', error);
  }
  return nativeEnd.call(this, body, encoding, callback);
};

require('./auth-compat-v287.js');

console.info(`[UCAN ${VERSION}/${QUEST_TERRACE_VERSION}] Escaleras caminables, terraza estable, iluminación calibrada y carteles Quest cargados.`);
