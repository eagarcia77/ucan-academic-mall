'use strict';

const fs = require('fs');
const { patchMainScene } = require('./lib/floor-state-machine-v287');
const { patchBrowserXrEmulation, auditPatchedSource } = require('./lib/browser-xr-emulation-v299');

const runtime = fs.readFileSync('public/js/ucan_v299_quest_navigation_glass_terrace.js', 'utf8');
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
  version:/const VERSION = 'V299'/.test(runtime),
  build:/V299-20260723-QUEST-NAVIGATION-GLASS-TERRACE/.test(runtime),
  singleRuntime:/singleAuthoritativeRuntime:true/.test(runtime) && /single-browser-scene-quest-compatible/.test(runtime),
  robustAxes:/function controllerAxes/.test(runtime) && /gamepad-0-1/.test(runtime) && /gamepad-2-3/.test(runtime) && /joystickAxisPairAutoDetection:true/.test(runtime),
  browserSpeeds:/comfort:3\.4, normal:5\.0, sprint:7\.0/.test(runtime),
  synchronousCollision:/function pathClear/.test(runtime) && /function moveWithSceneCollision/.test(runtime) && /synchronousCollisionChecks:true/.test(runtime),
  noAsyncProxy:/asynchronousCameraCollisionProxy:false/.test(runtime) && !/state\.desktop\._collideWithWorld\(step\)/.test(runtime),
  floorThreeStable:/floorThreeSpeedStable:true/.test(runtime) && /floorThreeMovementFrames/.test(runtime),
  stairBypass:/function moveOnRooftopStairs/.test(runtime) && /stairBypassFrames/.test(runtime),
  stairRampDisabled:/function disableRooftopRampCollision/.test(runtime) && /rooftopStairRampCollisionDisabled:true/.test(runtime),
  stairMidpoint:/rooftopStairMidpointBlockPrevented:true/.test(runtime) && /progress >= 0\.82/.test(runtime),
  glassCompatibility:/function applyQuestGlassCompatibility/.test(runtime) && /material\.needDepthPrePass = false/.test(runtime) && /material\.disableDepthWrite = true/.test(runtime),
  glassBlend:/MATERIAL_ALPHABLEND/.test(runtime) && /questGlassAlphaBlend:true/.test(runtime) && /questGlassBackFacesVisible:true/.test(runtime),
  terraceCenter:/tragaluz cristal ampliado/.test(runtime) && /rooftopCenterRemoved:true/.test(runtime),
  terraceSolidFloor:/function setupCompleteTerraceFloor/.test(runtime) && /terraza piso completo Quest V299 principal/.test(runtime) && /rooftopSolidFloor:true/.test(runtime),
  stairOpeningPreserved:/40\.55/.test(runtime) && /8\.75/.test(runtime) && /rooftopStairOpeningPreserved:true/.test(runtime),
  browserRide:/function mirrorBrowserRide/.test(runtime) && /browserAutomaticEscalatorRoutes:true/.test(runtime),
  browserPointer:/function dispatchBrowserPointer/.test(runtime) && /browserPointerEventDispatch:true/.test(runtime),
  interaction:/universalSignWindowIntegration:true/.test(runtime) && /isCelestial/.test(runtime) && /isPanel/.test(runtime),
  authV299:/browser-xr-emulation-v299/.test(auth) && /ucan_v299_quest_navigation_glass_terrace/.test(auth),
  authStripsV298:/ucan_v298_browser_emulation_xr/.test(auth) && /stripLegacyQuestLayers/.test(auth),
  endpointFlags:/questSynchronousSceneCollision = true/.test(auth) && /questGlassDepthPrePassDisabled = true/.test(auth) && /questRooftopSolidFloor = true/.test(auth),
  packageCheck:pkg.scripts?.check?.includes('browser-xr-emulation-v299.js') && pkg.scripts?.check?.includes('ucan_v299_quest_navigation_glass_terrace.js'),
  packageAudit:pkg.scripts?.['audit:browser-xr'] === 'node verify_quest_navigation_glass_terrace_v299.js',
  mainPatchAll:patchedChecks.all === true
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V299', checks, patchedChecks, syntaxError, patchError }, null, 2));
if (!ok) process.exit(1);
