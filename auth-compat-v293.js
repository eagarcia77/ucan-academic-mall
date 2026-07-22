'use strict';

const http = require('http');
const { patchBrowserXrEmulation, VERSION, BUILD } = require('./lib/browser-xr-emulation-v298');

const QUEST_RUNTIME_VERSION = VERSION;
const QUEST_RUNTIME_BUILD = BUILD;
const QUEST_RUNTIME_PATH = '/js/ucan_v298_browser_emulation_xr.js';
const QUEST_RUNTIME_SCRIPT = `${QUEST_RUNTIME_PATH}?build=${QUEST_RUNTIME_BUILD}`;

const nativeWriteHead = http.ServerResponse.prototype.writeHead;
const nativeEnd = http.ServerResponse.prototype.end;

function normalizeBranding(text) {
  return String(text)
    .replace(/UCAN Academic Mall V\d+/g, 'UCAN Academic')
    .replace(/UCAN Academic Mall/g, 'UCAN Academic')
    .replace(/COMPILACIÓN V\d+ ACTIVA/g, 'ENTORNO ACTIVO')
    .replace(/<title>[^<]*<\/title>/i, '<title>UCAN Academic</title>');
}

function stripLegacyQuestLayers(html) {
  const patterns = [
    /\s*<script src="\/js\/ucan_v283_unified_xr_runtime\.js[^"]*"><\/script>/g,
    /\s*<script src="\/js\/ucan_v290_quest_controls_interaction\.js[^"]*"><\/script>/g,
    /\s*<script src="\/js\/ucan_v293_quest_controls_interaction\.js[^"]*"><\/script>/g,
    /\s*<script src="\/js\/ucan_v296_quest_controls_interaction\.js[^"]*"><\/script>/g,
    /\s*<script src="\/js\/ucan_v291_quest_celestial_glass\.js[^"]*"><\/script>/g,
    /\s*<script src="\/js\/ucan_v294_quest_terrace_stability\.js[^"]*"><\/script>/g,
    /\s*<script src="\/js\/ucan_v295_quest_desktop_parity_terrace\.js[^"]*"><\/script>/g,
    /\s*<script src="\/js\/ucan_v296_quest_signs_selection\.js[^"]*"><\/script>/g,
    /\s*<script src="\/js\/ucan_v297_quest_room_signs_speed\.js[^"]*"><\/script>/g,
    /\s*<script src="\/js\/ucan_v298_browser_emulation_xr\.js[^"]*"><\/script>/g
  ];
  let result = String(html);
  for (const pattern of patterns) result = result.replace(pattern, '');
  return result;
}

function transformCampusHtml(text) {
  let html = stripLegacyQuestLayers(text);
  const runtimeTag = `<script src="${QUEST_RUNTIME_SCRIPT}"></script>`;
  const universalTag = html.match(/<script src="\/js\/ucan_v292_universal_sign_window\.js\?build=[^"]+"><\/script>/)?.[0];
  const mainTag = html.match(/<script src="\/js\/ucan_babylon_mall_v265_accounts_avatars\.js\?build=[^"]+"><\/script>/)?.[0];
  if (universalTag) html = html.replace(universalTag, `${universalTag}\n  ${runtimeTag}`);
  else if (mainTag) html = html.replace(mainTag, `${runtimeTag}\n  ${mainTag}`);
  else html = html.replace('</body>', `  ${runtimeTag}\n</body>`);

  html = html
    .replaceAll('Meta Quest V290:', 'Meta Quest V298:')
    .replaceAll('Meta Quest V293:', 'Meta Quest V298:')
    .replaceAll('Meta Quest V296:', 'Meta Quest V298:')
    .replaceAll('V297: rótulos frontales legibles y velocidad del navegador con aceleración en Meta Quest.', 'V298: Meta Quest emula directamente la escena y el comportamiento del browser.')
    .replaceAll('V296: movimiento igual a computadora, letreros de salas legibles y selección directa de planetas y pantallas en Meta Quest.', 'V298: Meta Quest emula directamente la escena y el comportamiento del browser.')
    .replaceAll('V295: Meta Quest utiliza la misma iluminación y materiales de la computadora, con planetas y pantallas de terraza visibles.', 'V298: Meta Quest emula directamente la escena y el comportamiento del browser.');
  return normalizeBranding(html);
}

function updateVersionData(data) {
  if (!data || typeof data !== 'object') return data;
  const versionPayload = Object.prototype.hasOwnProperty.call(data, 'version') || Object.prototype.hasOwnProperty.call(data, 'build') || Object.prototype.hasOwnProperty.call(data, 'unifiedXrVersion') || Object.prototype.hasOwnProperty.call(data, 'questControlsVersion');
  if (!versionPayload) return data;
  data.productName = 'UCAN Academic';
  data.visibleVersionInProductName = false;
  data.legacyProductNameRemoved = true;
  data.questExperienceVersion = QUEST_RUNTIME_VERSION;
  data.unifiedXrScript = QUEST_RUNTIME_SCRIPT;
  data.unifiedXrVersion = QUEST_RUNTIME_VERSION;
  data.unifiedXrBuild = QUEST_RUNTIME_BUILD;
  data.questControlsVersion = QUEST_RUNTIME_VERSION;
  data.questControlsBuild = QUEST_RUNTIME_BUILD;
  data.questArchitecture = 'single-browser-scene-emulation';
  data.questSingleAuthoritativeRuntime = true;
  data.questLegacyRuntimeLayersLoaded = false;
  data.questRuntimeScript = QUEST_RUNTIME_SCRIPT;
  data.questRuntimeVersion = QUEST_RUNTIME_VERSION;
  data.questRuntimeBuild = QUEST_RUNTIME_BUILD;
  data.questUsesBrowserScene = true;
  data.questUsesBrowserMeshes = true;
  data.questUsesBrowserMaterials = true;
  data.questUsesBrowserLighting = true;
  data.questUsesBrowserImageProcessing = true;
  data.questUsesBrowserRoomSigns = true;
  data.questGeneratedRoomSignClones = false;
  data.questGeneratedRoomSignOverlays = false;
  data.questVisualOverrides = false;
  data.questBrowserCollisionCameraProxy = true;
  data.questBrowserMovementLoopSuppressed = true;
  data.questNormalSpeed = 5.0;
  data.questComfortSpeed = 3.4;
  data.questBrowserSprintSpeed = 7.0;
  data.questSmoothTurn = true;
  data.questSmoothTurnNaturalSpeed = 1.9;
  data.questSmoothTurnComfortSpeed = 1.2;
  data.questSnapTurn = false;
  data.questDefaultTeleportation = false;
  data.questAutomaticEscalatorsUseBrowserRoutes = true;
  data.questRooftopStairsAutomatic = false;
  data.questRooftopStairsJoystickTraversal = true;
  data.questRooftopStairsContinuousSlope = true;
  data.questRooftopFloorStickyCommit = true;
  data.questBrowserPointerDispatch = true;
  data.questDirectTouchControllerTrigger = true;
  data.questSelectionRayLength = 300;
  data.questTerracePanelsSelectable = true;
  data.questCelestialObjectsSelectable = true;
  data.questUniversalWindowIntegration = true;
  data.desktopVisualsUnchanged = true;
  return data;
}

function transformResponseText(text) {
  let value = String(text);
  const trimmed = value.trim();
  if (/^\s*[\[{]/.test(trimmed)) {
    try { return JSON.stringify(updateVersionData(JSON.parse(value))); }
    catch (_) {}
  }
  if (value.includes('__UCAN_FLOOR_STATE_V287__') && value.includes('function setupReliableMovement')) {
    return patchBrowserXrEmulation(value).code;
  }
  if (/<html|<body|<script/i.test(value)) return transformCampusHtml(value);
  return normalizeBranding(value);
}

http.ServerResponse.prototype.writeHead = function writeHeadV298(statusCode, statusMessage, headers) {
  let message = statusMessage;
  let nextHeaders = headers;
  if (statusMessage && typeof statusMessage === 'object') {
    nextHeaders = statusMessage;
    message = undefined;
  }
  if (nextHeaders && typeof nextHeaders === 'object') {
    nextHeaders = { ...nextHeaders };
    for (const key of Object.keys(nextHeaders)) {
      if (key.toLowerCase() === 'content-length') delete nextHeaders[key];
    }
    nextHeaders['X-UCAN-XR-Controls'] = QUEST_RUNTIME_VERSION;
    nextHeaders['X-UCAN-XR-Emulation'] = QUEST_RUNTIME_VERSION;
    nextHeaders['X-UCAN-XR-Mode'] = 'browser-scene';
    nextHeaders['X-UCAN-XR-UI'] = 'V292';
    nextHeaders['X-UCAN-XR-Entry'] = 'V289';
    nextHeaders['X-UCAN-Product'] = 'UCAN Academic';
  }
  if (message === undefined) return nativeWriteHead.call(this, statusCode, nextHeaders);
  return nativeWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.end = function endV298(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      const buffer = Buffer.isBuffer(body);
      const text = buffer ? body.toString(typeof encoding === 'string' ? encoding : 'utf8') : body;
      const transformed = transformResponseText(text);
      body = buffer ? Buffer.from(transformed, 'utf8') : transformed;
    }
  } catch (error) {
    console.error('[UCAN V298 response compatibility]', error);
  }
  return nativeEnd.call(this, body, encoding, callback);
};

require('./auth-compat-v287.js');

console.info(`[UCAN ${QUEST_RUNTIME_VERSION}] Emulación única del entorno browser para Meta Quest cargada.`);
