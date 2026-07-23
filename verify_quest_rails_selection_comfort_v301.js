'use strict';

const fs = require('fs');
const { patchMainScene } = require('./lib/floor-state-machine-v287');
const { patchBrowserXrEmulation, auditPatchedSource } = require('./lib/browser-xr-emulation-v301');

const runtime = fs.readFileSync('public/js/ucan_v301_quest_rails_selection_comfort.js', 'utf8');
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
  version:/const VERSION = 'V301'/.test(runtime),
  build:/V301-20260723-QUEST-RAILS-SELECTION-COMFORT/.test(runtime),
  singleRuntime:/singleAuthoritativeRuntime:true/.test(runtime) && /single-v301-quest-runtime/.test(auth),
  stairBounds:/minX:40\.8, maxX:47\.2, minZ:9\.0, maxZ:40\.5/.test(runtime),
  originalRailsHidden:/baranda hueco escalera terraza/.test(runtime) && /originalHorizontalStairRailsHidden:true/.test(runtime),
  centerGlassRemoved:/baranda tragaluz rooftop/.test(runtime) && /rooftopCenterGlassRailingsRemoved:true/.test(runtime),
  slopedRails:/function stairGroundAtZ/.test(runtime) && /buildCorrectedStairRailings/.test(runtime) && /questCorrectedStairRailV301/.test(runtime),
  doubleSidedGlass:/backFaceCulling:false/.test(runtime) && /stairGlassFrontBackVisible:true/.test(runtime),
  terracePanels:/terraza completa Quest V301 oeste/.test(runtime) && /terraza completa Quest V301 este/.test(runtime) && /terraza completa Quest V301 sur/.test(runtime) && /terraza completa Quest V301 norte/.test(runtime),
  stairOpening:/rooftopStairOpeningPreserved:true/.test(runtime) && /STAIR\.minX, STAIR\.maxX/.test(runtime),
  signs:/rooftopSignsSelectable:true/.test(runtime) && /cartel\|letrero\|rótulo/.test(runtime),
  saucers:/rooftopSaucersSelectable:true/.test(runtime) && /platillo\|ovni\|ufo\|saucer/.test(runtime),
  telescopes:/rooftopTelescopesSelectable:true/.test(runtime) && /telescopio\|refractor\|dobson/.test(runtime),
  triggerSelection:/triggerSelection:true/.test(runtime) && /function selectFromController/.test(runtime),
  universalWindow:/universalWindowIntegration:true/.test(runtime) && /openPanelByMesh/.test(runtime),
  comfortDefault:/defaultComfortMode:true/.test(runtime) && /forceComfortDefault/.test(runtime),
  snapTurn:/rightStickSnapTurnInComfort:true/.test(runtime) && /snapDegrees:30/.test(runtime),
  vignette:/motionVignette:true/.test(runtime) && /createVignette/.test(runtime),
  acceleration:/accelerationSmoothing:true/.test(runtime) && /approach\(state\.currentSpeed/.test(runtime),
  lowFps:/lowFpsMovementCompensation:true/.test(runtime) && /MAX_FRAME_DT = 0\.12/.test(runtime) && /MAX_MOVE_SUBSTEP = 0\.14/.test(runtime),
  stableFloor:/piso estable Meta Quest V301/.test(runtime) && /floorColorStableDuringMovement:true/.test(runtime),
  questOnly:/if \(!state\.questDevice\) return;/.test(runtime) && /desktopVisualsUnchanged:true/.test(runtime),
  authUsesV301:/browser-xr-emulation-v301/.test(auth) && /ucan_v301_quest_rails_selection_comfort/.test(auth),
  authStripsLegacy:/ucan_v299_quest_navigation_glass_terrace/.test(auth) && /ucan_v300_quest_full_controls_floor_lock/.test(auth) && /stripLegacyQuestLayers/.test(auth),
  endpointFlags:/questCorrectedSlopedStairRailings = true/.test(auth) && /questRooftopSaucersSelectable = true/.test(auth) && /questMotionVignette = true/.test(auth),
  packageCheck:pkg.scripts?.check?.includes('browser-xr-emulation-v301.js') && pkg.scripts?.check?.includes('ucan_v301_quest_rails_selection_comfort.js'),
  packageAudit:pkg.scripts?.['audit:browser-xr'] === 'node verify_quest_rails_selection_comfort_v301.js',
  mainPatchAll:patchedChecks.all === true
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V301', checks, patchedChecks, syntaxError, patchError }, null, 2));
if (!ok) process.exit(1);
