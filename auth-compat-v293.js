'use strict';

const http = require('http');
const { patchBrowserXrEmulation, VERSION, BUILD } = require('./lib/browser-xr-emulation-v301');

const QUEST_RUNTIME_VERSION = VERSION;
const QUEST_RUNTIME_BUILD = BUILD;
const QUEST_RUNTIME_PATH = '/js/ucan_v301_quest_rails_selection_comfort.js';
const QUEST_RUNTIME_SCRIPT = `${QUEST_RUNTIME_PATH}?build=${QUEST_RUNTIME_BUILD}`;
const QUEST_GEOMETRY_VERSION = 'V303';
const QUEST_GEOMETRY_REVISION = 'R2';
const QUEST_GEOMETRY_BUILD = 'V303-20260723-QUEST-ZONE-GLASS-REAR-RAILS-R2';
const QUEST_GEOMETRY_PATH = '/js/ucan_v303_quest_zone_geometry_cleanup_r2.js';
const QUEST_GEOMETRY_SCRIPT = `${QUEST_GEOMETRY_PATH}?build=${QUEST_GEOMETRY_BUILD}`;

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
    /\s*<script src="\/js\/ucan_v298_browser_emulation_xr\.js[^"]*"><\/script>/g,
    /\s*<script src="\/js\/ucan_v299_quest_navigation_glass_terrace\.js[^"]*"><\/script>/g,
    /\s*<script src="\/js\/ucan_v300_disable_v299_movement\.js[^"]*"><\/script>/g,
    /\s*<script src="\/js\/ucan_v300_quest_full_controls_floor_lock\.js[^"]*"><\/script>/g,
    /\s*<script src="\/js\/ucan_v301_quest_rails_selection_comfort\.js[^"]*"><\/script>/g,
    /\s*<script src="\/js\/ucan_v302_remove_stair_glass\.js[^"]*"><\/script>/g,
    /\s*<script src="\/js\/ucan_v303_quest_zone_geometry_cleanup\.js[^"]*"><\/script>/g,
    /\s*<script src="\/js\/ucan_v303_quest_zone_geometry_cleanup_r2\.js[^"]*"><\/script>/g
  ];
  let result = String(html);
  for (const pattern of patterns) result = result.replace(pattern, '');
  return result;
}

function transformCampusHtml(text) {
  let html = stripLegacyQuestLayers(text);
  const runtimeTag = `<script src="${QUEST_RUNTIME_SCRIPT}"></script>`;
  const geometryTag = `<script src="${QUEST_GEOMETRY_SCRIPT}"></script>`;
  const questTags = `${runtimeTag}\n  ${geometryTag}`;
  const universalTag = html.match(/<script src="\/js\/ucan_v292_universal_sign_window\.js\?build=[^"]+"><\/script>/)?.[0];
  const mainTag = html.match(/<script src="\/js\/ucan_babylon_mall_v265_accounts_avatars\.js\?build=[^"]+"><\/script>/)?.[0];
  if (universalTag) html = html.replace(universalTag, `${universalTag}\n  ${questTags}`);
  else if (mainTag) html = html.replace(mainTag, `${questTags}\n  ${mainTag}`);
  else html = html.replace('</body>', `  ${questTags}\n</body>`);

  html = html
    .replaceAll('Meta Quest V290:', 'Meta Quest V303 R2:')
    .replaceAll('Meta Quest V293:', 'Meta Quest V303 R2:')
    .replaceAll('Meta Quest V296:', 'Meta Quest V303 R2:')
    .replaceAll('Meta Quest V298:', 'Meta Quest V303 R2:')
    .replaceAll('Meta Quest V299:', 'Meta Quest V303 R2:')
    .replaceAll('Meta Quest V300:', 'Meta Quest V303 R2:')
    .replaceAll('Meta Quest V301:', 'Meta Quest V303 R2:')
    .replaceAll('Meta Quest V302:', 'Meta Quest V303 R2:')
    .replaceAll('Meta Quest V303:', 'Meta Quest V303 R2:')
    .replaceAll('V302: escalera sin cristales negros, barandas metálicas, terraza sólida y modo de confort en Meta Quest.', 'V303 R2: limpieza ampliada de cristales negros, las cuatro rutas del Piso 2 y barandas posteriores del Piso 3 en Meta Quest.')
    .replaceAll('V301: barandas correctas, terraza sólida, selección directa y modo de confort en Meta Quest.', 'V303 R2: limpieza ampliada de cristales negros, las cuatro rutas del Piso 2 y barandas posteriores del Piso 3 en Meta Quest.')
    .replaceAll('V303: limpieza por zonas de cristales negros, paneles del Piso 2 y barandas traseras del Piso 3 en Meta Quest.', 'V303 R2: limpieza ampliada de cristales negros, las cuatro rutas del Piso 2 y barandas posteriores del Piso 3 en Meta Quest.');
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
  data.questRuntimeScript = QUEST_RUNTIME_SCRIPT;
  data.questRuntimeVersion = QUEST_RUNTIME_VERSION;
  data.questRuntimeBuild = QUEST_RUNTIME_BUILD;
  data.questArchitecture = 'single-v301-quest-runtime-with-v303-r2-zone-geometry-cleanup';
  data.questSingleAuthoritativeRuntime = true;
  data.questLegacyRuntimeLayersLoaded = false;
  data.questUsesBrowserScene = true;
  data.questUsesBrowserMeshes = true;
  data.questBrowserMovementLoopSuppressed = true;

  data.questFullTouchControllerMapping = true;
  data.questLeftStickMovement = true;
  data.questLeftStickClickSprint = true;
  data.questLeftGripSprint = true;
  data.questRightStickSnapTurnInComfort = true;
  data.questRightStickSmoothTurnOutsideComfort = true;
  data.questRightStickClickJump = true;
  data.questPrimaryButtonSelectOrJump = true;
  data.questSecondaryButtonClosesWindow = true;
  data.questTriggerSelection = true;

  data.questCorrectedSlopedStairRailings = true;
  data.questStairGlassFrontBackVisible = false;
  data.questOriginalHorizontalStairRailsHidden = true;
  data.questRooftopCenterGlassRemoved = true;
  data.questRooftopCenterGlassRailingsRemoved = true;
  data.questRooftopFullSolidFloor = true;
  data.questRooftopStairOpeningPreserved = true;

  data.questRooftopSignsSelectable = true;
  data.questRooftopCelestialSelectable = true;
  data.questRooftopSaucersSelectable = true;
  data.questRooftopTelescopesSelectable = true;
  data.questUniversalWindowIntegration = true;
  data.questSelectionRayLength = 350;

  data.questDefaultComfortMode = true;
  data.questComfortWalkSpeed = 3.0;
  data.questComfortRunSpeed = 4.8;
  data.questNormalWalkSpeed = 5.0;
  data.questNormalRunSpeed = 7.0;
  data.questSnapTurnDegrees = 30;
  data.questSnapTurnCooldownMs = 320;
  data.questAccelerationSmoothing = true;
  data.questMotionVignette = true;
  data.questReducedJumpHeightInComfort = true;
  data.questLowFpsMovementCompensation = true;
  data.questMovementSubstepsEnabled = true;
  data.questMaximumMoveSubstep = 0.14;
  data.questFloorThreeSpeedStable = true;

  data.questStableFloorMaterial = true;
  data.questStableFloorColor = '#687174';
  data.questFloorReceivesAvatarShadows = false;
  data.questFloorColorStableDuringMovement = true;
  data.desktopVisualsUnchanged = true;

  data.questReleaseVersion = QUEST_GEOMETRY_VERSION;
  data.questGeometryCleanupVersion = QUEST_GEOMETRY_VERSION;
  data.questGeometryCleanupRevision = QUEST_GEOMETRY_REVISION;
  data.questGeometryCleanupBuild = QUEST_GEOMETRY_BUILD;
  data.questGeometryCleanupScript = QUEST_GEOMETRY_SCRIPT;
  data.questBoundingBoxZoneDetection = true;
  data.questParentNameAndMetadataDetection = true;
  data.questDarkGlassRemovedGlobally = true;
  data.questFloor2EscalatorFrontGlassRemoved = true;
  data.questFloor2EscalatorAllRoutesCovered = true;
  data.questFloor2EscalatorRouteX = [-34, -26, -20, -8];
  data.questRooftopStairGlassRemoved = true;
  data.questFloor3RearRailingsRemoved = true;
  data.questRooftopRearRailingsRemoved = true;
  data.questRearRailingsRemovedWithoutOrientationDependency = true;
  data.questCorrectedMetalSideRailingsPreserved = true;
  data.questRemovedGeometryCollisionsDisabled = true;
  data.questRemovedGeometryPickingDisabled = true;
  data.questDesktopGeometryUnchanged = true;
  data.questStairGlassVersion = QUEST_GEOMETRY_VERSION;
  data.questStairGlassRemoved = true;
  data.questStairMetalOnly = true;
  return data;
}

function transformResponseText(text) {
  const value = String(text);
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

http.ServerResponse.prototype.writeHead = function writeHeadV303R2(statusCode, statusMessage, headers) {
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
    nextHeaders['X-UCAN-XR-Mode'] = 'single-v301-quest-runtime';
    nextHeaders['X-UCAN-XR-Railings'] = QUEST_RUNTIME_VERSION;
    nextHeaders['X-UCAN-XR-Terrace'] = QUEST_RUNTIME_VERSION;
    nextHeaders['X-UCAN-XR-Selection'] = QUEST_RUNTIME_VERSION;
    nextHeaders['X-UCAN-XR-Comfort'] = QUEST_RUNTIME_VERSION;
    nextHeaders['X-UCAN-XR-Geometry'] = QUEST_GEOMETRY_VERSION;
    nextHeaders['X-UCAN-XR-Geometry-Revision'] = QUEST_GEOMETRY_REVISION;
    nextHeaders['X-UCAN-XR-Stair-Glass'] = QUEST_GEOMETRY_VERSION;
    nextHeaders['X-UCAN-XR-Release'] = QUEST_GEOMETRY_VERSION;
    nextHeaders['X-UCAN-XR-UI'] = 'V292';
    nextHeaders['X-UCAN-XR-Entry'] = 'V289';
    nextHeaders['X-UCAN-Product'] = 'UCAN Academic';
  }
  if (message === undefined) return nativeWriteHead.call(this, statusCode, nextHeaders);
  return nativeWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.end = function endV303R2(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      const buffer = Buffer.isBuffer(body);
      const text = buffer ? body.toString(typeof encoding === 'string' ? encoding : 'utf8') : body;
      const transformed = transformResponseText(text);
      body = buffer ? Buffer.from(transformed, 'utf8') : transformed;
    }
  } catch (error) {
    console.error('[UCAN V303 R2 response compatibility]', error);
  }
  return nativeEnd.call(this, body, encoding, callback);
};

require('./auth-compat-v287.js');

console.info(`[UCAN ${QUEST_RUNTIME_VERSION}/${QUEST_GEOMETRY_VERSION} ${QUEST_GEOMETRY_REVISION}] Limpieza geométrica ampliada Meta Quest cargada.`);