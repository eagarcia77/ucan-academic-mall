'use strict';

require('./auth-compat-v271.js');

const http = require('http');
const fs = require('fs');
const path = require('path');
const { VERSION, BUILD, patchMainScene } = require('./lib/floor-state-machine-v287');

const PREVIOUS_VERSION = 'V283';
const PREVIOUS_BUILD = 'V283-20260720-UNIFIED-XR-DESKTOP-PARITY';
const MAIN_PATH = '/js/ucan_babylon_mall_v265_accounts_avatars.js';
const MAIN_FILE = path.join(__dirname, 'public', 'js', 'ucan_babylon_mall_v265_accounts_avatars.js');
const MAIN_SCRIPT = `${MAIN_PATH}?build=${BUILD}`;
const UNIFIED_XR_BUILD = 'V290-20260720-QUEST-CONTROLS-STAIRS-INFO';
const UNIFIED_XR_SCRIPT = `/js/ucan_v290_quest_controls_interaction.js?build=${UNIFIED_XR_BUILD}`;
const QUEST_XR_BUILD = 'V289-20260720-QUEST-XR-COMPAT-DIAGNOSTICS';
const QUEST_XR_SCRIPT = `/js/ucan_v289_quest_xr_compat.js?build=${QUEST_XR_BUILD}`;
const QUEST_VISUAL_BUILD = 'V291-20260720-QUEST-CELESTIAL-GLASS';
const QUEST_VISUAL_SCRIPT = `/js/ucan_v291_quest_celestial_glass.js?build=${QUEST_VISUAL_BUILD}`;
const UNIVERSAL_SIGN_BUILD = 'V292-20260721-UNIVERSAL-SIGN-WINDOW-CLOCK';
const UNIVERSAL_SIGN_SCRIPT = `/js/ucan_v292_universal_sign_window.js?build=${UNIVERSAL_SIGN_BUILD}`;
const SKY_SCRIPT = `/js/ucan_v287_rooftop_sky.js?build=${BUILD}`;
const CELESTIAL_WINDOW_BUILD = 'V288-20260720-COMPACT-CELESTIAL-WINDOW';
const CELESTIAL_WINDOW_SCRIPT = `/js/ucan_v288_celestial_info_window.js?build=${CELESTIAL_WINDOW_BUILD}`;
let patchAudit = { checked:false, patched:false, reason:'Todavía no solicitado.' };

function sendPatchedMainScene(res) {
  try {
    const source = fs.readFileSync(MAIN_FILE, 'utf8');
    const result = patchMainScene(source);
    patchAudit = {
      checked:true,
      patched:result.patched === true,
      alreadyPatched:result.alreadyPatched === true,
      checks:result.checks || null,
      reason:null,
      servedAt:new Date().toISOString()
    };
    if (!result.patched) throw new Error('No se pudo aplicar el estado explícito de pisos V287.');
    const body = result.code;
    res.writeHead(200, {
      'Content-Type':'application/javascript; charset=utf-8',
      'Content-Length':Buffer.byteLength(body),
      'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma':'no-cache',
      'Expires':'0',
      'X-UCAN-Floor-State':VERSION,
      'X-UCAN-XR-Compat':'V289',
      'X-UCAN-XR-Controls':'V290',
      'X-UCAN-XR-Visuals':'V291',
      'X-UCAN-XR-UI':'V292'
    });
    res.end(body);
  } catch (error) {
    patchAudit = { checked:true, patched:false, reason:error.message, servedAt:new Date().toISOString() };
    const body = `console.error(${JSON.stringify(`[UCAN ${VERSION}] ${error.message}`)});`;
    res.writeHead(500, {
      'Content-Type':'application/javascript; charset=utf-8',
      'Content-Length':Buffer.byteLength(body),
      'Cache-Control':'no-store'
    });
    res.end(body);
  }
}

const priorCreateServer = http.createServer;
http.createServer = function createV287Server(listener) {
  if (typeof listener !== 'function') return priorCreateServer.apply(this, arguments);
  return priorCreateServer.call(this, async (req, res) => {
    try {
      const parsed = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(parsed.pathname);
      if (req.method === 'GET' && pathname === MAIN_PATH) return sendPatchedMainScene(res);
      return await listener(req, res);
    } catch (error) {
      if (!res.headersSent && !res.writableEnded) {
        const body = JSON.stringify({ error:error.message || 'Error interno V287' });
        res.writeHead(500, {
          'Content-Type':'application/json; charset=utf-8',
          'Content-Length':Buffer.byteLength(body),
          'Cache-Control':'no-store'
        });
        res.end(body);
      }
    }
  });
};

function transformCampusHtml(text) {
  let html = text
    .replaceAll(PREVIOUS_BUILD, BUILD)
    .replaceAll(`UCAN Academic Mall ${PREVIOUS_VERSION}`, `UCAN Academic Mall ${VERSION}`)
    .replaceAll(`COMPILACIÓN ${PREVIOUS_VERSION} ACTIVA`, `COMPILACIÓN ${VERSION} ACTIVA`)
    .replace(
      'V283: un solo controlador comparte iluminación, movimiento, altura, colisiones y escaleras entre Meta Quest y el browser.',
      'V292: planetas, calendarios, mapas, agenda, clima y reloj usan una ventana universal legible y cerrable en todos los entornos.'
    );

  html = html.replace(
    /\/js\/ucan_v276_interactive_sky\.js\?build=[^"']+/g,
    SKY_SCRIPT
  );
  html = html.replace(
    /\s*<script src="\/js\/ucan_v276_sky_refresh\.js\?build=[^"]+"><\/script>/g,
    ''
  );
  html = html.replace(
    /\s*<script src="\/js\/ucan_v28[345]_.*?\.js[^"']*"><\/script>/g,
    match => /ucan_v289_quest_xr_compat/.test(match) ? match : ''
  );

  const oldRuntimeTags = [
    /<script src="\/js\/ucan_v283_unified_xr_runtime\.js\?build=[^"]+"><\/script>/g,
    /<script src="\/js\/ucan_v290_quest_controls_interaction\.js\?build=[^"]+"><\/script>/g,
    /<script src="\/js\/ucan_v291_quest_celestial_glass\.js\?build=[^"]+"><\/script>/g,
    /<script src="\/js\/ucan_v292_universal_sign_window\.js\?build=[^"]+"><\/script>/g
  ];
  for (const pattern of oldRuntimeTags) html = html.replace(pattern, '');

  if (!html.includes('/js/ucan_v290_quest_controls_interaction.js')) {
    const questTagExisting = html.match(/<script src="\/js\/ucan_v289_quest_xr_compat\.js\?build=[^"]+"><\/script>/)?.[0];
    const unifiedTag = `<script src="${UNIFIED_XR_SCRIPT}"></script>`;
    if (questTagExisting) html = html.replace(questTagExisting, `${unifiedTag}\n  ${questTagExisting}`);
    else html = html.replace(`<script src="${MAIN_SCRIPT}"></script>`, `${unifiedTag}\n  <script src="${QUEST_XR_SCRIPT}"></script>\n  <script src="${MAIN_SCRIPT}"></script>`);
  }

  if (!html.includes('/js/ucan_v289_quest_xr_compat.js')) {
    const unifiedTag = `<script src="${UNIFIED_XR_SCRIPT}"></script>`;
    const questTag = `<script src="${QUEST_XR_SCRIPT}"></script>`;
    if (html.includes(unifiedTag)) html = html.replace(unifiedTag, `${unifiedTag}\n  ${questTag}`);
    else html = html.replace(`<script src="${MAIN_SCRIPT}"></script>`, `${questTag}\n  <script src="${MAIN_SCRIPT}"></script>`);
  }

  if (!html.includes('/js/ucan_v291_quest_celestial_glass.js')) {
    const questTag = `<script src="${QUEST_XR_SCRIPT}"></script>`;
    const visualTag = `<script src="${QUEST_VISUAL_SCRIPT}"></script>`;
    if (html.includes(questTag)) html = html.replace(questTag, `${questTag}\n  ${visualTag}`);
    else html = html.replace(`<script src="${MAIN_SCRIPT}"></script>`, `${visualTag}\n  <script src="${MAIN_SCRIPT}"></script>`);
  }

  if (!html.includes('/js/ucan_v292_universal_sign_window.js')) {
    const visualTag = `<script src="${QUEST_VISUAL_SCRIPT}"></script>`;
    const universalTag = `<script src="${UNIVERSAL_SIGN_SCRIPT}"></script>`;
    if (html.includes(visualTag)) html = html.replace(visualTag, `${visualTag}\n  ${universalTag}`);
    else html = html.replace(`<script src="${MAIN_SCRIPT}"></script>`, `${universalTag}\n  <script src="${MAIN_SCRIPT}"></script>`);
  }

  if (!html.includes('/js/ucan_v288_celestial_info_window.js')) {
    const skyTag = `<script src="${SKY_SCRIPT}"></script>`;
    const infoTag = `<script src="${CELESTIAL_WINDOW_SCRIPT}"></script>`;
    if (html.includes(skyTag)) html = html.replace(skyTag, `${skyTag}\n  ${infoTag}`);
    else html = html.replace('</body>', `  ${infoTag}\n</body>`);
  }
  return html;
}

function transformVersionData(data) {
  if (!data || data.version !== PREVIOUS_VERSION || data.build !== PREVIOUS_BUILD) return data;
  data.version = VERSION;
  data.build = BUILD;
  data.script = MAIN_SCRIPT;
  data.unifiedXrScript = UNIFIED_XR_SCRIPT;
  data.unifiedXrVersion = 'V290';
  data.unifiedXrBuild = UNIFIED_XR_BUILD;
  data.questControlsVersion = 'V290';
  data.questNativeThumbstickComponents = true;
  data.questLeftStickMovement = true;
  data.questRightStickSnapTurn = true;
  data.questSnapTurnDegrees = 30;
  data.questTriggerRaySelection = true;
  data.questVisibleControllerRays = true;
  data.questReadableSigns = true;
  data.questCelestialInformation = true;
  data.questCompactInformationWindow = true;
  data.rooftopStairsExpandedTriggers = true;
  data.rooftopStairsTriggerMarkers = true;
  data.rooftopStairsBidirectional = true;
  data.questXrScript = QUEST_XR_SCRIPT;
  data.questXrVersion = 'V289';
  data.questXrBuild = QUEST_XR_BUILD;
  data.questDirectUserGestureEntry = true;
  data.questDefaultBabylonXrUiDisabled = true;
  data.questSessionMode = 'immersive-vr';
  data.questReferenceSpace = 'local-floor';
  data.questOptionalFeaturesArray = true;
  data.questPreflightSecureContext = true;
  data.questPreflightTopLevel = true;
  data.questPreflightSessionSupport = true;
  data.questVisibleDiagnostics = true;
  data.questWebglContextRecoveryMessage = true;
  data.permissionsPolicyXrSpatialTracking = true;
  data.questVisualScript = QUEST_VISUAL_SCRIPT;
  data.questVisualVersion = 'V291';
  data.questVisualBuild = QUEST_VISUAL_BUILD;
  data.questCelestialRayLength = 240;
  data.questCelestialMaxDistance = 265;
  data.questCelestialAngularFallback = true;
  data.questCelestialAngleLimitDegrees = 7.5;
  data.questGlassCompatibility = true;
  data.questGlassDepthPrePassDisabled = true;
  data.questGlassAlphaBlend = true;
  data.questGlassBackFacesVisible = true;
  data.questGlassShadowsDisabled = true;
  data.questGlassRestoredAfterXR = true;
  data.universalSignScript = UNIVERSAL_SIGN_SCRIPT;
  data.universalSignVersion = 'V292';
  data.universalSignBuild = UNIVERSAL_SIGN_BUILD;
  data.universalWindowDesktop = true;
  data.universalWindowXR = true;
  data.universalWindowSeparateFrontBack = true;
  data.mirroredInformationFixed = true;
  data.livePanelsOpenActualContent = true;
  data.livePanelsTriggerActivation = true;
  data.livePanelsJoystickClickActivation = true;
  data.livePanelsPrimaryButtonActivation = true;
  data.universalWindowClosableDesktop = true;
  data.universalWindowClosableXR = true;
  data.legacyInformationWindowsSuppressed = true;
  data.rooftopClockRelocated = true;
  data.rooftopClockPosition = { x:-17, y:31.75, z:49 };
  data.skyScript = SKY_SCRIPT;
  data.skyRefreshScript = null;
  data.celestialInfoWindowScript = CELESTIAL_WINDOW_SCRIPT;
  data.celestialInfoWindowVersion = 'V288';
  data.desktopCelestialWindowCompact = true;
  data.xrCelestialWindowCompact = true;
  data.celestialWindowClosableDesktop = true;
  data.celestialWindowClosableXR = true;
  data.legacyLargeCelestialPlaneDisabled = true;
  data.celestialWindowWidthMeters = 2.85;
  data.celestialWindowHeightMeters = 1.78;
  data.mainSceneServedPatched = true;
  data.floorControlStrategy = 'explicit-state-machine';
  data.explicitFloorState = true;
  data.transientHeightInference = false;
  data.onlyExplicitFloorTransitions = true;
  data.floorOneLocked = true;
  data.floorTwoLocked = true;
  data.theaterRampOnlyOnFloorThree = true;
  data.xrFloorSynchronization = true;
  data.accidentalCrossFloorJumpFixed = true;
  data.rooftopSkyOptimized = true;
  data.skyDomeSegments = 20;
  data.skyTextureResolution = '1024x512';
  data.skyStarBudget = 14;
  data.skyLabelledStarBudget = 5;
  data.skyFrameThrottleMs = 250;
  data.skyRefreshIntervalMs = 600000;
  data.duplicateSkyRefreshTimerRemoved = true;
  data.skyReconcilesObjectsInPlace = true;
  data.v283MovementControllerReplaced = true;
  data.v284V285V286Replaced = true;
  data.patchAudit = patchAudit;
  return data;
}

if (!http.ServerResponse.prototype.__ucanV287FloorSkyPatched) {
  const originalWriteHead = http.ServerResponse.prototype.writeHead;
  const originalEnd = http.ServerResponse.prototype.end;

  http.ServerResponse.prototype.writeHead = function patchedWriteHead(statusCode, statusMessage, headers) {
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
      const contentTypeKey = Object.keys(nextHeaders).find(key => key.toLowerCase() === 'content-type');
      const contentType = contentTypeKey ? String(nextHeaders[contentTypeKey]) : '';
      if (/text\/html/i.test(contentType)) {
        nextHeaders['Permissions-Policy'] = 'xr-spatial-tracking=(self)';
        nextHeaders['X-UCAN-XR-Compat'] = 'V289';
        nextHeaders['X-UCAN-XR-Controls'] = 'V290';
        nextHeaders['X-UCAN-XR-Visuals'] = 'V291';
        nextHeaders['X-UCAN-XR-UI'] = 'V292';
      }
    }
    if (message === undefined) return originalWriteHead.call(this, statusCode, nextHeaders);
    return originalWriteHead.call(this, statusCode, message, nextHeaders);
  };

  http.ServerResponse.prototype.end = function patchedEnd(chunk, encoding, callback) {
    let body = chunk;
    try {
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        let text = Buffer.isBuffer(body) ? body.toString(typeof encoding === 'string' ? encoding : 'utf8') : body;
        if (text.includes(`UCAN Academic Mall ${PREVIOUS_VERSION}`)) {
          body = transformCampusHtml(text);
        } else if (/^\s*[\[{]/.test(text)) {
          try {
            body = JSON.stringify(transformVersionData(JSON.parse(text)));
          } catch (_) {}
        }
      }
    } catch (error) {
      console.error('[UCAN V287/V292 response compatibility]', error);
    }
    return originalEnd.call(this, body, encoding, callback);
  };

  http.ServerResponse.prototype.__ucanV287FloorSkyPatched = true;
}

console.info('[UCAN V287/V288/V289/V290/V291/V292] Pisos, cielo, ventanas, controles, visuales y paneles universales cargados.');
