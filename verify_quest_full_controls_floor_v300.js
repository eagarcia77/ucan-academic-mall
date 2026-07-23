'use strict';

const fs = require('fs');
const { patchMainScene } = require('./lib/floor-state-machine-v287');
const { patchBrowserXrEmulation, auditPatchedSource } = require('./lib/browser-xr-emulation-v300');

const runtime = fs.readFileSync('public/js/ucan_v300_quest_full_controls_floor_lock.js', 'utf8');
const disableRuntime = fs.readFileSync('public/js/ucan_v300_disable_v299_movement.js', 'utf8');
const baseRuntime = fs.readFileSync('public/js/ucan_v299_quest_navigation_glass_terrace.js', 'utf8');
const auth = fs.readFileSync('auth-compat-v293.js', 'utf8');
const main = fs.readFileSync('public/js/ucan_babylon_mall_v265_accounts_avatars.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let disableSyntaxValid = false;
let syntaxError = null;
try { new Function(runtime); syntaxValid = true; }
catch (error) { syntaxError = error.message; }
try { new Function(disableRuntime); disableSyntaxValid = true; }
catch (error) { syntaxError = `${syntaxError || ''} disable: ${error.message}`.trim(); }

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
  disableSyntaxValid,
  version:/const VERSION = 'V300'/.test(runtime),
  build:/V300-20260723-FULL-CONTROLS-FLOOR-LOCK/.test(runtime),
  supersedesV299:/__UCAN_QUEST_V300_SUPERSEDES_V299__ = true/.test(runtime),
  singleMovementAuthority:/singleMovementAuthority:true/.test(runtime) && /v299MovementSuperseded:true/.test(runtime),
  leftStickMovement:/leftStickMovement:true/.test(runtime) && /controllerAxes\(left, 'move'\)/.test(runtime),
  rightStickTurn:/rightStickSmoothTurn:true/.test(runtime) && /controllerAxes\(right, 'turn'\)/.test(runtime),
  sprintMapping:/leftStickClickSprint:true/.test(runtime) && /leftGripSprint:true/.test(runtime) && /fullStickSprint:true/.test(runtime),
  jumpMapping:/rightStickClickJump:true/.test(runtime) && /primaryButtonJump:true/.test(runtime) && /function requestJump/.test(runtime),
  closeMapping:/secondaryButtonClosesWindow:true/.test(runtime) && /__UCAN_UNIVERSAL_SIGN_WINDOW__\?\.close/.test(runtime),
  jumpPhysics:/JUMP_DURATION_MS = 720/.test(runtime) && /JUMP_HEIGHT = 0\.92/.test(runtime) && /4 \* JUMP_HEIGHT \* t \* \(1 - t\)/.test(runtime),
  browserSpeeds:/comfort:3\.4, normal:5\.0, sprint:7\.0/.test(runtime),
  lowFpsCompensation:/MAX_FRAME_DT = 0\.12/.test(runtime) && /MAX_MOVE_SUBSTEP = 0\.14/.test(runtime) && /movementSubstepsEnabled:true/.test(runtime),
  floorThreeStable:/floorThreeSpeedStable:true/.test(runtime) && /floorThreeMovementFrames/.test(runtime),
  cachedCollisions:/function refreshCollisionCache/.test(runtime) && /function blockedAt/.test(runtime),
  stableFloorMaterial:/piso estable Meta Quest V300/.test(runtime) && /floorMaterialLockedInXR:true/.test(runtime),
  stableFloorColor:/#7f898d/.test(runtime) && /floorColorStableDuringMovement:true/.test(runtime),
  noFloorShadows:/floorReceivesAvatarShadows:false/.test(runtime) && /mesh\.receiveShadows = false/.test(runtime),
  completeTerrace:/terraza completa Quest V300 oeste/.test(runtime) && /terraza completa Quest V300 este/.test(runtime) && /terraza completa Quest V300 sur/.test(runtime) && /terraza completa Quest V300 norte/.test(runtime),
  centerRemoved:/rooftopCenterRemoved:true/.test(runtime) && /tragaluz/.test(runtime),
  stairOpening:/rooftopStairOpeningPreserved:true/.test(runtime) && /STAIR\.minX/.test(runtime) && /STAIR\.maxX/.test(runtime),
  glassPreserved:/function stabilizeGlass/.test(runtime) && /material\.needDepthPrePass = false/.test(runtime),
  v299SelectionPreserved:/triggerSelectionPreservedFromV299:true/.test(runtime) && /function selectFromController/.test(baseRuntime),
  observerRemoval:/function callbackLooksLikeV299/.test(disableRuntime) && /observable\.remove\(target\)/.test(disableRuntime),
  disableAudit:/__UCAN_V299_MOVEMENT_DISABLED_BY_V300__/.test(disableRuntime) && /v299MovementObserverRemoved:true/.test(disableRuntime),
  authLoadsBaseDisableV300:/QUEST_BASE_VERSION = 'V299'/.test(auth) && /ucan_v300_disable_v299_movement/.test(auth) && /ucan_v300_quest_full_controls_floor_lock/.test(auth),
  authOrder:/const tags = `\$\{baseTag\}\\n  \$\{disableTag\}\\n  \$\{runtimeTag\}`/.test(auth),
  endpointFlags:/questFullTouchControllerMapping = true/.test(auth) && /questJumpEnabled = true/.test(auth) && /questFloorMaterialLockedInXR = true/.test(auth) && /questV299MovementObserverRemovedByV300 = true/.test(auth),
  packageCheck:pkg.scripts?.check?.includes('browser-xr-emulation-v300.js') && pkg.scripts?.check?.includes('ucan_v300_disable_v299_movement.js') && pkg.scripts?.check?.includes('ucan_v300_quest_full_controls_floor_lock.js'),
  packageAudit:pkg.scripts?.['audit:browser-xr'] === 'node verify_quest_full_controls_floor_v300.js',
  mainPatchAll:patchedChecks.all === true
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V300', checks, patchedChecks, syntaxError, patchError }, null, 2));
if (!ok) process.exit(1);
