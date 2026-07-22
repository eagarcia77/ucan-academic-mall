'use strict';

const fs = require('fs');
const { patchMainScene } = require('./lib/floor-state-machine-v287');
const { patchBrowserXrEmulation, auditPatchedSource } = require('./lib/browser-xr-emulation-v298');

const runtime = fs.readFileSync('public/js/ucan_v298_browser_emulation_xr.js', 'utf8');
const auth = fs.readFileSync('auth-compat-v293.js', 'utf8');
const main = fs.readFileSync('public/js/ucan_babylon_mall_v265_accounts_avatars.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let syntaxError = null;
try { new Function(runtime); syntaxValid = true; }
catch (error) { syntaxError = error.message; }

let patchedChecks = {};
let patchError = null;
try {
  const floorPatched = patchMainScene(main).code;
  const xrPatched = patchBrowserXrEmulation(floorPatched).code;
  patchedChecks = auditPatchedSource(xrPatched);
} catch (error) {
  patchError = error.message;
}

const checks = {
  syntaxValid,
  version:/const VERSION = 'V298'/.test(runtime),
  build:/V298-20260722-BROWSER-SCENE-XR-EMULATION/.test(runtime),
  singleRuntime:/singleAuthoritativeRuntime:true/.test(runtime),
  sameScene:/sameSceneAsBrowser:true/.test(runtime) && /sameMeshesAsBrowser:true/.test(runtime),
  sameRendering:/sameMaterialsAsBrowser:true/.test(runtime) && /sameLightingAsBrowser:true/.test(runtime) && /sameImageProcessingAsBrowser:true/.test(runtime),
  originalSigns:/sameRoomSignsAsBrowser:true/.test(runtime) && /generatedRoomSignClones:false/.test(runtime) && /generatedRoomSignOverlays:false/.test(runtime),
  collisionProxy:/browserCollisionCameraProxy:true/.test(runtime) && /state\.desktop\._collideWithWorld\(step\)/.test(runtime),
  speeds:/comfort:3\.4, normal:5\.0, sprint:7\.0/.test(runtime),
  turns:/comfort:1\.2, normal:1\.9/.test(runtime),
  browserRide:/function mirrorBrowserRide/.test(runtime) && /browserAutomaticEscalatorRoutes:true/.test(runtime),
  manualRooftop:/function rooftopGround/.test(runtime) && /rooftopStairsManualInXR:true/.test(runtime),
  browserPointer:/function dispatchBrowserPointer/.test(runtime) && /browserPointerEventDispatch:true/.test(runtime),
  controllerTrigger:/onButtonStateChangedObservable/.test(runtime) && /function pollTriggers/.test(runtime),
  panelsAndPlanets:/universalSignWindowIntegration:true/.test(runtime) && /isCelestial/.test(runtime) && /isPanel/.test(runtime),
  noVisualOverrides:/v291VisualOverridesLoaded:false/.test(runtime) && /v295TerraceOverrideLoaded:false/.test(runtime),
  legacyLayersRemovedFromHtml:/stripLegacyQuestLayers/.test(auth) && /ucan_v291_quest_celestial_glass/.test(auth) && /ucan_v297_quest_room_signs_speed/.test(auth),
  onlyV298Injected:/QUEST_RUNTIME_PATH = '\/js\/ucan_v298_browser_emulation_xr\.js'/.test(auth) && /single-browser-scene-emulation/.test(auth),
  versionEndpoint:/questSingleAuthoritativeRuntime = true/.test(auth) && /questLegacyRuntimeLayersLoaded = false/.test(auth),
  responseMainPatch:/patchBrowserXrEmulation\(value\)\.code/.test(auth),
  packageCheck:pkg.scripts?.check?.includes('browser-xr-emulation-v298.js') && pkg.scripts?.check?.includes('ucan_v298_browser_emulation_xr.js'),
  packageAudit:pkg.scripts?.['audit:browser-xr'] === 'node verify_browser_xr_emulation_v298.js',
  mainPatchAll:patchedChecks.all === true
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V298', checks, patchedChecks, syntaxError, patchError }, null, 2));
if (!ok) process.exit(1);
