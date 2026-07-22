'use strict';

const fs = require('fs');
const { VERSION, BUILD, patchQuestControls } = require('./lib/manual-rooftop-stairs-v293');

const baseRuntime = fs.readFileSync('public/js/ucan_v290_quest_controls_interaction.js', 'utf8');
const compat = fs.readFileSync('auth-compat-v293.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let transformed = '';
let syntaxValid = false;
let syntaxError = null;
let transformChecks = null;
try {
  const result = patchQuestControls(baseRuntime);
  transformed = result.code;
  transformChecks = result.checks;
  new Function(baseRuntime);
  new Function(transformed);
  syntaxValid = true;
} catch (error) {
  syntaxError = error.message;
}

const controlsIndex = compat.indexOf("const CONTROLS_PATH = '/js/ucan_v296_quest_controls_interaction.js'");
const interactionIndex = compat.indexOf("const QUEST_INTERACTION_PATH = '/js/ucan_v296_quest_signs_selection.js'");
const terraceIndex = compat.indexOf("const QUEST_TERRACE_PATH = '/js/ucan_v295_quest_desktop_parity_terrace.js'");

const checks = {
  syntaxValid,
  baseVersion:/const VERSION = 'V290'/.test(baseRuntime),
  baseBuild:/V290-20260720-QUEST-CONTROLS-STAIRS-INFO/.test(baseRuntime),
  transformedVersion:VERSION === 'V296' && /const VERSION = 'V296'/.test(transformed),
  transformedBuild:BUILD === 'V296-20260722-QUEST-MOVEMENT-SIGNS-SELECTION' && transformed.includes(BUILD),
  transformComplete:transformChecks?.all === true,
  nativeThumbstickComponents:/findComponent\(motionController, 'thumbstick'/.test(transformed),
  triggerComponents:/findComponent\(motionController, 'trigger'/.test(transformed),
  gamepadFallback:/gamepad-\$\{offset\}-\$\{offset \+ 1\}/.test(transformed),
  leftStickMovement:/const left = handRecord\(state, 'left'\)/.test(transformed) && /MOVE_SPEED/.test(transformed),
  desktopSpeeds:/comfort:3\.4, natural:5\.0/.test(transformed),
  rightStickSmoothTurn:/function applySmoothTurn/.test(transformed) && /TURN_SPEED = Object\.freeze\(\{ comfort:1\.2, natural:1\.9 \}\)/.test(transformed),
  noSnapTurn:/rightStickSnapTurn:false/.test(transformed) && !/const SNAP_ANGLE/.test(transformed),
  desktopCollisions:/function moveWithDesktopRules/.test(transformed) && /camera\._collideWithWorld\(step\)/.test(transformed),
  triggerRaySelection:/function selectFromController/.test(transformed) && /pickWithRay/.test(transformed),
  visibleControllerRays:/CreateLines\(`rayo control/.test(transformed),
  celestialInformation:/function celestialInfo/.test(transformed) && /__UCAN_INTERACTIVE_SKY__/.test(transformed),
  readableSigns:/function readableSignInfo/.test(transformed) && /readableSign/.test(transformed),
  rooftopManual:/id:'up34'[\s\S]*automatic:false/.test(transformed) && /id:'down43'[\s\S]*automatic:false/.test(transformed),
  otherEscalatorsAutomatic:/id:'up12'[\s\S]*automatic:true/.test(transformed) && /id:'down32'[\s\S]*automatic:true/.test(transformed),
  noAutomaticRooftopMarkers:/no se crean activadores para las escaleras caminables/.test(transformed),
  v296ControlsServed:controlsIndex >= 0 && /sendV296Controls/.test(compat),
  v296InteractionServed:interactionIndex >= 0,
  v295TerraceServed:terraceIndex >= 0,
  endpointMovement:/questControlsVersion = VERSION/.test(compat) && /questMovementMatchesDesktop = true/.test(compat) && /questSmoothTurn = true/.test(compat),
  endpointSelection:/questInteractionVersion = QUEST_INTERACTION_VERSION/.test(compat) && /questTerracePanelsSelectable = true/.test(compat),
  packageChecksBase:pkg.scripts?.check?.includes('public/js/ucan_v290_quest_controls_interaction.js'),
  packageChecksInteraction:pkg.scripts?.check?.includes('public/js/ucan_v296_quest_signs_selection.js'),
  packageUnifiedAudit:pkg.scripts?.['audit:unified-xr'] === 'node audit_unified_xr_v290.js',
  packageStairAudit:pkg.scripts?.['audit:xr-floor-stairs'] === 'node verify_manual_stairs_v293.js'
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, baseVersion:'V290', servedVersion:VERSION, checks, transformChecks, syntaxError }, null, 2));
if (!ok) process.exit(1);
