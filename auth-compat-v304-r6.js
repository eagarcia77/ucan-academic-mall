'use strict';

const http = require('http');

// Conserva autenticación, presencia, voz, interacción y revisiones anteriores.
require('./auth-compat-v304-r5.js');

const previousWriteHead = http.ServerResponse.prototype.writeHead;
const previousWrite = http.ServerResponse.prototype.write;
const previousEnd = http.ServerResponse.prototype.end;

const VERSION = 'V309';
const REVISION = 'R13';
const BUILD = 'V309-20260728-STRICT-BROWSER-VR-VISUAL-PARITY-R13';
const LOADER_BUILD = 'V309-20260728-R13-NO-CACHE-LOADER';
const RUNTIME_PATH = '/js/ucan_v305_floor1_terrace_vr_r9.js';
const RUNTIME_SCRIPT = `${RUNTIME_PATH}?build=V305-20260728-FLOOR1-ADS-TERRACE-XR-R9`;
const BRAND_BUILD = 'V306-20260728-FLOOR1-BRAND-UPRIGHT-VR-R10';
const BRAND_RUNTIME_PATH = '/js/ucan_v306_floor1_brand_orientation_r10.js';
const BRAND_RUNTIME_SCRIPT = `${BRAND_RUNTIME_PATH}?build=${BRAND_BUILD}`;
const PRESENCE_RUNTIME_PATH = '/js/ucan_v307_presence_xr_bridge.js';
const PRESENCE_RUNTIME_SCRIPT = `${PRESENCE_RUNTIME_PATH}?build=V307-20260728-BROWSER-XR-DEVICE-PRESENCE`;
const WORLD_RUNTIME_PATH = '/js/ucan_v308_cross_environment_interaction.js';
const WORLD_RUNTIME_SCRIPT = `${WORLD_RUNTIME_PATH}?build=V308-20260728-SINGLE-SCENE-CROSS-ENV-INTERACTION`;
const PARITY_RUNTIME_PATH = '/js/ucan_v309_strict_visual_parity.js';
const PARITY_RUNTIME_SCRIPT = `${PARITY_RUNTIME_PATH}?build=${BUILD}`;
const BUFFERABLE_CONTENT = /(?:text\/html|application\/javascript|text\/javascript)/i;

function updateVersionData(data) {
  if (!data || typeof data !== 'object') return data;
  const versionPayload = Object.prototype.hasOwnProperty.call(data, 'version') ||
    Object.prototype.hasOwnProperty.call(data, 'build') ||
    Object.prototype.hasOwnProperty.call(data, 'releaseVersion') ||
    Object.prototype.hasOwnProperty.call(data, 'questControlsVersion');
  if (!versionPayload) return data;

  data.releaseVersion = VERSION;
  data.strictVisualParityRevision = REVISION;
  data.strictVisualParityBuild = BUILD;
  data.strictVisualParityRuntime = PARITY_RUNTIME_SCRIPT;
  data.browserSceneAuthoritative = true;
  data.oneBabylonSceneBrowserVr = true;
  data.sameGeometryBrowserVr = true;
  data.sameMeshVisibilityBrowserVr = true;
  data.sameMaterialsBrowserVr = true;
  data.sameLightingBrowserVr = true;
  data.sameFogAndEnvironmentBrowserVr = true;
  data.sameUsersBrowserVr = true;
  data.cameraAndControlsOnlyDifference = true;
  data.questOnlyGeometryDisabled = true;
  data.questOnlyMaterialReplacementDisabled = true;
  data.questOnlyGlassRemovalDisabled = true;
  data.questOnlyRailingReplacementDisabled = true;
  data.questOnlyTerraceReplacementDisabled = true;
  data.questComfortVignetteDisabled = true;
  data.crossEnvironmentRevision = 'R12';
  data.crossEnvironmentBuild = 'V308-20260728-SINGLE-SCENE-CROSS-ENV-INTERACTION-R12';
  data.crossEnvironmentRuntime = WORLD_RUNTIME_SCRIPT;
  data.crossEnvironmentApi = '/api/world-v308';
  data.browserToVrInteraction = true;
  data.vrToBrowserInteraction = true;
  data.sharedVoice = true;
  data.sharedChat = true;
  data.sharedGestures = true;
  data.sharedReactions = true;
  data.sharedObjectFocus = true;
  data.presenceRevision = 'R11';
  data.presenceBuild = 'V307-20260728-BROWSER-XR-DEVICE-PRESENCE-R11';
  data.presenceRuntime = PRESENCE_RUNTIME_SCRIPT;
  data.presenceApi = '/api/presence-v2';
  data.presenceByDeviceSession = true;
  data.sameAccountMultipleDevicesVisible = true;
  data.browserUsersVisibleInVr = true;
  data.vrUsersVisibleInBrowser = true;
  data.realXrCameraPresence = true;
  data.legacyUserIdPresenceDisabledV307 = true;
  data.floor1BrandVrRevision = 'R10';
  data.floor1BrandVrBuild = BRAND_BUILD;
  data.floor1BrandVrRuntime = BRAND_RUNTIME_SCRIPT;
  data.floor1BrandExactMetadataTarget = 'brandLogo';
  data.floor1BrandTwoIndependentFrontFacesR10 = true;
  data.floor1BrandMirroredBackfaceSuppressedR10 = true;
  data.floor1TerraceVrRuntime = RUNTIME_SCRIPT;
  data.questHtmlJsNoCacheR13 = true;
  data.loaderBuild = LOADER_BUILD;
  return data;
}

function patchR5Runtime(value) {
  if (!value.includes('V304-20260725-GLOBAL-GLASS-UPRIGHT-SIGNS-R5')) return value;
  let patched = value;
  patched = patched.replace(
    "function normalizeBoards() {\n    if (!state.scene) return;",
    "function normalizeBoards() {\n    if (window.__UCAN_FLOOR1_BRAND_VR_V306_R10__?.installed === true || window.__UCAN_VR_INTERACTION_V305_R9__?.installed === true || window.__UCAN_VISUAL_INTERACTION_V304_R6__?.installed === true) return;\n    if (!state.scene) return;"
  );
  patched = patched.replace(
    "function maintainBoards() {\n    for (const [source, faces] of state.boardFaces) {",
    "function maintainBoards() {\n    const newerRuntimeOwnsBoards = window.__UCAN_FLOOR1_BRAND_VR_V306_R10__?.installed === true || window.__UCAN_VR_INTERACTION_V305_R9__?.installed === true || window.__UCAN_VISUAL_INTERACTION_V304_R6__?.installed === true;\n    for (const [source, faces] of state.boardFaces) {"
  );
  patched = patched.replace(
    "for (const face of faces) {\n        try {\n          face.setEnabled?.(true);\n          face.isVisible = true;\n          face.visibility = 1;",
    "for (const face of faces) {\n        try {\n          face.setEnabled?.(!newerRuntimeOwnsBoards);\n          face.isVisible = !newerRuntimeOwnsBoards;\n          face.visibility = newerRuntimeOwnsBoards ? 0 : 1;"
  );
  return patched;
}

function normalizeTextureOrientation(value) {
  let patched = value;
  if (patched.includes('V304-20260723-SEASONAL-NATURAL-ECOSYSTEM-PR')) {
    patched = patched.replace(/board\.texture\.update\(true\);/g, 'board.texture.update(false);');
  }
  if (patched.includes('V292-20260721-UNIVERSAL-SIGN-WINDOW-CLOCK')) {
    patched = patched.replace(/state\.texture\.update\(true\);/g, 'state.texture.update(false);');
  }
  if (patched.includes('V287-20260720-FLOOR-STATE-SKY-OPT')) {
    patched = patched.replace(/state\.infoTexture\.update\(true\);/g, 'state.infoTexture.update(false);');
  }
  return patched;
}

function patchQuestVisualDivergence(value) {
  let patched = value;

  if (patched.includes('V301-20260723-QUEST-RAILS-SELECTION-COMFORT')) {
    patched = patched.replace(
      /window\.__UCAN_BROWSER_XR_EMULATION_ACTIVE__ = true;\s*forceComfortDefault\(\);\s*hideIncorrectRooftopGeometry\(\);\s*buildCorrectedStairRailings\(\);\s*buildCompleteTerraceFloor\(\);\s*lockFloorMaterials\(\);\s*decorateRooftopInteractions\(true\);\s*refreshCollisionCache\(true\);\s*createVignette\(\);/m,
      "window.__UCAN_BROWSER_XR_EMULATION_ACTIVE__ = true;\n    decorateRooftopInteractions(true);\n    refreshCollisionCache(true);"
    );
    patched = patched.replace(
      /refreshCollisionCache\(\);\s*hideIncorrectRooftopGeometry\(\);\s*lockFloorMaterials\(\);\s*decorateRooftopInteractions\(\);/m,
      "refreshCollisionCache();\n    decorateRooftopInteractions();"
    );
    patched = patched.replace(/\s*updateVignette\(movementAmount, turning\);/g, '\n    void movementAmount; void turning;');
    patched = patched.replace('Meta Quest V301: barandas corregidas, terraza sólida, selección directa y modo de confort activados.', 'V309: controles Meta Quest activos sin modificar la escena del browser.');
  }

  if (patched.includes('V303-20260723-QUEST-ZONE-GLASS-REAR-RAILS-R2')) {
    patched = patched.replace(
      "function scanAndClean(force = false) {\n    if (!state.scene || !state.inXR || !state.questDevice) return;",
      "function scanAndClean(force = false) {\n    return;"
    );
    patched = patched.replace('Meta Quest V303 R2: cristales negros, cristales frente a las escaleras del Piso 2 y barandas posteriores del Piso 3 eliminados.', 'V309: la geometría del browser se conserva completa en VR.');
  }

  if (patched.includes('V304-20260725-QUEST-GLASS-RAILS-HOLIDAY-R4')) {
    patched = patched.replace(/scheduleVisualFixes\(\);/g, 'state.visualsReady = true; restoreVisuals();');
    patched = patched.replace('Meta Quest V304 R4: cristales, barandas laterales y cartel de feriados corregidos.', 'V309: no se aplican reemplazos visuales exclusivos de Quest.');
  }

  if (patched.includes('V289-20260720-QUEST-XR-COMPAT-DIAGNOSTICS')) {
    patched = patched.replace(
      /\s*if \(isQuest\(\) && engine\?\.setHardwareScalingLevel\) \{\s*const current = Number\(engine\.getHardwareScalingLevel\?\.\(\) \|\| 1\);\s*engine\.setHardwareScalingLevel\(Math\.max\(current, 1\.25\)\);\s*\}/m,
      '\n      // V309 conserva el mismo ajuste visual seleccionado en el browser.'
    );
  }

  return patched;
}

function upgradeLoaderToR13(value) {
  let patched = value;
  patched = patched.replace(
    /\/js\/ucan_v266_keyboard_jump\.js(?:\?build=[^"']+)?/g,
    `/js/ucan_v266_keyboard_jump.js?build=${LOADER_BUILD}`
  );
  patched = patched.replace(/loadFloor1TerraceR8/g, 'loadFloor1TerraceR9');
  patched = patched.replace(
    /\/js\/ucan_v305_floor1_terrace_vr_r8\.js\?build=V305-20260728-FLOOR1-UPRIGHT-TERRACE-JOYSTICK-R8/g,
    RUNTIME_SCRIPT
  );
  patched = patched.replace(/data-ucan-v305-floor1-terrace-r8/g, 'data-ucan-v305-floor1-terrace-r9');
  patched = patched.replace(/\[UCAN V305 R8\][^'"\n]*/g, '[UCAN V305 R9] No se pudo cargar la corrección de terraza XR.');
  return patched;
}

function transformText(text) {
  let value = String(text);
  value = upgradeLoaderToR13(value);
  value = patchR5Runtime(value);
  value = normalizeTextureOrientation(value);
  value = patchQuestVisualDivergence(value);

  const trimmed = value.trim();
  if (/^[\[{]/.test(trimmed)) {
    try { return JSON.stringify(updateVersionData(JSON.parse(value))); }
    catch (_) {}
  }
  return value;
}

function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const key = Object.keys(headers).find(candidate => candidate.toLowerCase() === name.toLowerCase());
  return key ? String(headers[key] || '') : '';
}

function applyDiagnosticHeaders(response, headers, contentType) {
  const noCache = BUFFERABLE_CONTENT.test(contentType || '');
  try {
    response.removeHeader?.('Content-Length');
    response.setHeader?.('X-UCAN-VR-Revision', REVISION);
    response.setHeader?.('X-UCAN-VR-Build', BUILD);
    response.setHeader?.('X-UCAN-Presence-Version', 'V307');
    response.setHeader?.('X-UCAN-World-Version', 'V308');
    response.setHeader?.('X-UCAN-Visual-Parity', VERSION);
    response.setHeader?.('X-UCAN-Quest-Cache', noCache ? 'no-store' : 'default');
    if (noCache) {
      response.setHeader?.('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      response.setHeader?.('Pragma', 'no-cache');
      response.setHeader?.('Expires', '0');
      response.setHeader?.('Surrogate-Control', 'no-store');
    }
  } catch (_) {}

  if (!headers || typeof headers !== 'object') return headers;
  const next = { ...headers };
  for (const key of Object.keys(next)) {
    const lower = key.toLowerCase();
    if (lower === 'content-length') delete next[key];
    if (noCache && ['cache-control', 'pragma', 'expires', 'surrogate-control'].includes(lower)) delete next[key];
  }
  next['X-UCAN-VR-Revision'] = REVISION;
  next['X-UCAN-VR-Build'] = BUILD;
  next['X-UCAN-Presence-Version'] = 'V307';
  next['X-UCAN-World-Version'] = 'V308';
  next['X-UCAN-Visual-Parity'] = VERSION;
  next['X-UCAN-Quest-Cache'] = noCache ? 'no-store' : 'default';
  if (noCache) {
    next['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0';
    next.Pragma = 'no-cache';
    next.Expires = '0';
    next['Surrogate-Control'] = 'no-store';
  }
  return next;
}

http.ServerResponse.prototype.writeHead = function writeHeadV309R13(statusCode, statusMessage, headers) {
  let message = statusMessage;
  let nextHeaders = headers;
  if (statusMessage && typeof statusMessage === 'object') {
    nextHeaders = statusMessage;
    message = undefined;
  }

  const contentType = headerValue(nextHeaders, 'content-type') || String(this.getHeader?.('Content-Type') || '');
  if (BUFFERABLE_CONTENT.test(contentType)) this.__ucanR13TextChunks = [];
  nextHeaders = applyDiagnosticHeaders(this, nextHeaders, contentType);

  if (message === undefined) return previousWriteHead.call(this, statusCode, nextHeaders);
  return previousWriteHead.call(this, statusCode, message, nextHeaders);
};

http.ServerResponse.prototype.write = function writeV309R13(chunk, encoding, callback) {
  if (Array.isArray(this.__ucanR13TextChunks)) {
    if (chunk != null) this.__ucanR13TextChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : 'utf8'));
    if (typeof encoding === 'function') process.nextTick(encoding);
    else if (typeof callback === 'function') process.nextTick(callback);
    return true;
  }
  return previousWrite.call(this, chunk, encoding, callback);
};

http.ServerResponse.prototype.end = function endV309R13(chunk, encoding, callback) {
  let body = chunk;
  try {
    if (Array.isArray(this.__ucanR13TextChunks)) {
      if (body != null) this.__ucanR13TextChunks.push(Buffer.isBuffer(body) ? body : Buffer.from(String(body), typeof encoding === 'string' ? encoding : 'utf8'));
      const combined = Buffer.concat(this.__ucanR13TextChunks).toString('utf8');
      delete this.__ucanR13TextChunks;
      body = Buffer.from(transformText(combined), 'utf8');
    } else if (typeof body === 'string' || Buffer.isBuffer(body)) {
      const isBuffer = Buffer.isBuffer(body);
      const source = isBuffer ? body.toString(typeof encoding === 'string' ? encoding : 'utf8') : body;
      const transformed = transformText(source);
      body = isBuffer ? Buffer.from(transformed, 'utf8') : transformed;
    }
  } catch (error) {
    console.error('[UCAN V309 R13 response compatibility]', error);
  }
  return previousEnd.call(this, body, encoding, callback);
};

console.info(`[UCAN ${VERSION} ${REVISION}] Paridad visual estricta browser/WebXR y caché desactivada.`);
