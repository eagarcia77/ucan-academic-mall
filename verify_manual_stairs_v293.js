'use strict';

const fs = require('fs');
const { VERSION, BUILD, patchQuestControls } = require('./lib/manual-rooftop-stairs-v293');

const base = fs.readFileSync('public/js/ucan_v290_quest_controls_interaction.js', 'utf8');
const preloader = fs.readFileSync('auth-compat-v293.js', 'utf8');
const dockerfile = fs.readFileSync('Dockerfile', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let result = null;
let syntaxValid = false;
let error = null;
try {
  result = patchQuestControls(base);
  new Function(result.code);
  syntaxValid = true;
} catch (caught) {
  error = caught.message;
}

const code = result?.code || '';
const checks = {
  version:VERSION === 'V296',
  build:BUILD === 'V296-20260722-QUEST-MOVEMENT-SIGNS-SELECTION',
  patchApplied:result?.patched === true,
  transformChecks:result?.checks?.all === true,
  syntaxValid,
  desktopSpeeds:/comfort:3\.4, natural:5\.0/.test(code),
  smoothTurn:/function applySmoothTurn/.test(code) && /TURN_SPEED = Object\.freeze\(\{ comfort:1\.2, natural:1\.9 \}\)/.test(code),
  desktopCollisions:/function moveWithDesktopRules/.test(code) && /camera\._collideWithWorld\(step\)/.test(code),
  movementAudit:/desktopMovementParity:true/.test(code) && /desktopCollisionParity:true/.test(code),
  rooftopRoutesManual:/id:'up34'[\s\S]*automatic:false/.test(code) && /id:'down43'[\s\S]*automatic:false/.test(code),
  escalatorsStillAutomatic:/id:'up12'[\s\S]*automatic:true/.test(code) && /id:'down32'[\s\S]*automatic:true/.test(code),
  automaticFilter:/route\.automatic === true && nearRouteEntry\(state, route\)/.test(code),
  noAutomaticStairZoneStart:!code.includes('ROUTES.find(route => nearRouteEntry(state, route))'),
  manualSlope:/function rooftopStairGround\(state, p\)/.test(code) && /lerp\(LEVEL\.three, LEVEL\.roof, progress\)/.test(code),
  joystickTraversal:/rooftopStairsManualJoystickTraversal:true/.test(code),
  automaticStairsBlocked:/if \(route\.kind === 'stairs'\)/.test(code) && /no tienen movimiento automático/.test(code),
  noActivationMarkers:/no se crean activadores para las escaleras caminables/.test(code),
  floorSynchronization:/xr-manual-stairs:arrive-rooftop-v296/.test(code) && /xr-manual-stairs:arrive-floor-3-v296/.test(code),
  auditFlags:/automaticRooftopStairs:false/.test(code) && /rooftopStairsLoopPrevention:true/.test(code) && /rooftopStairsNoActivationButton:true/.test(code),
  virtualPath:/\/js\/ucan_v296_quest_controls_interaction\.js/.test(preloader),
  preloaderTransforms:/patchQuestControls\(source\)/.test(preloader),
  versionFlags:/questRooftopStairsAutomatic = false/.test(preloader) && /rooftopStairsActivationMode = 'manual-walk-with-joystick'/.test(preloader),
  movementFlags:/questMovementMatchesDesktop = true/.test(preloader) && /questNaturalSpeed = 5\.0/.test(preloader) && /questSmoothTurn = true/.test(preloader),
  noButtonFlags:/questRooftopStairsNoActivationButton = true/.test(preloader) && /questRooftopStairsTriggerActivation = false/.test(preloader),
  startUsesCompat:pkg.scripts?.start === 'node -r ./auth-compat-v293.js server.js',
  packageAudit:pkg.scripts?.['audit:manual-rooftop-stairs'] === 'node verify_manual_stairs_v293.js',
  dockerUsesCompat:/auth-compat-v293\.js/.test(dockerfile)
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:VERSION, build:BUILD, checks, transform:result?.checks || null, error }, null, 2));
if (!ok) process.exit(1);
