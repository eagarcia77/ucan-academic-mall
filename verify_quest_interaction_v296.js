'use strict';

const fs = require('fs');

const runtime = fs.readFileSync('public/js/ucan_v296_quest_signs_selection.js', 'utf8');
const compat = fs.readFileSync('auth-compat-v293.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let syntaxError = null;
try {
  new Function(runtime);
  syntaxValid = true;
} catch (error) {
  syntaxError = error.message;
}

const checks = {
  syntaxValid,
  version:/const VERSION = 'V296'/.test(runtime),
  build:/V296-20260722-QUEST-MOVEMENT-SIGNS-SELECTION/.test(runtime),
  questOnly:/questOnly:true/.test(runtime) && /detectQuestDevice/.test(runtime),
  roomSignDetection:/SV\[-\\s\]\?20\[1-5\]/.test(runtime) || /SV\[-\\s\]\?20/.test(runtime),
  separateFrontBack:/roomSignsSeparateFrontBack:true/.test(runtime) && /ucanQuestRoomSignBackV296/.test(runtime),
  mirroredFix:/mirroredVirtualRoomSignsFixed:true/.test(runtime),
  materialCloning:/function cloneMaterial/.test(runtime) && /backFaceCulling = true/.test(runtime),
  reversePlane:/back\.rotation\.y \+= Math\.PI/.test(runtime),
  directTrigger:/directTouchControllerTrigger:true/.test(runtime) && /onButtonStateChangedObservable/.test(runtime),
  pollingFallback:/triggerPollingFallback:true/.test(runtime) && /function pollControllers/.test(runtime),
  longRay:/const RAY_LENGTH = 300/.test(runtime) && /selectionRayLength:RAY_LENGTH/.test(runtime),
  angularFallback:/function angularPick/.test(runtime) && /celestialAngularFallbackDegrees:10/.test(runtime) && /panelAngularFallbackDegrees:7/.test(runtime),
  universalWindow:/window\.__UCAN_UNIVERSAL_SIGN_WINDOW__/.test(runtime) && /universalWindowIntegration:true/.test(runtime),
  panelsSelectable:/terracePanelsSelectable:true/.test(runtime),
  planetsSelectable:/celestialObjectsSelectable:true/.test(runtime),
  movementParityAudit:/movementMatchesDesktop:true/.test(runtime) && /desktopNaturalSpeed:5\.0/.test(runtime) && /desktopComfortSpeed:3\.4/.test(runtime),
  smoothTurnAudit:/smoothTurnMatchesDesktop:true/.test(runtime),
  collisionAudit:/desktopCollisionRules:true/.test(runtime),
  controlsDependency:/controlsReady = window\.__UCAN_UNIFIED_XR_AUDIT__\?\.version === 'V296'/.test(runtime),
  compatServes:/QUEST_INTERACTION_VERSION = 'V296'/.test(compat) && /ucan_v296_quest_signs_selection\.js/.test(compat),
  compatControls:/CONTROLS_PATH = '\/js\/ucan_v296_quest_controls_interaction\.js'/.test(compat),
  endpointFlags:/questMirroredVirtualRoomSignsFixed = true/.test(compat) && /questTerracePanelsSelectable = true/.test(compat) && /questCelestialObjectsSelectable = true/.test(compat),
  packageChecksRuntime:pkg.scripts?.check?.includes('ucan_v296_quest_signs_selection.js'),
  packageAudit:pkg.scripts?.['audit:quest-interaction'] === 'node verify_quest_interaction_v296.js'
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V296', checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
