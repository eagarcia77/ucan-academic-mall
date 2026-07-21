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
  version:VERSION === 'V293',
  build:BUILD === 'V293-20260721-MANUAL-ROOFTOP-STAIRS-NO-LOOP',
  patchApplied:result?.patched === true,
  transformChecks:result?.checks?.all === true,
  syntaxValid,
  rooftopRoutesManual:/id:'up34'[\s\S]*automatic:false/.test(code) && /id:'down43'[\s\S]*automatic:false/.test(code),
  escalatorsStillAutomatic:/id:'up12'[\s\S]*automatic:true/.test(code) && /id:'down32'[\s\S]*automatic:true/.test(code),
  automaticFilter:/route\.automatic === true && nearRouteEntry\(state, route\)/.test(code),
  noAutomaticStairZoneStart:!code.includes('ROUTES.find(route => nearRouteEntry(state, route))'),
  manualControlSource:/beginRoute\(state, route, 'control-manual'\)/.test(code),
  correctFloorRequired:/Math\.abs\(state\.floor - route\.fromFloor\) <= 0\.4/.test(code),
  triggerJoystickPrimary:/buttons\?\.\[0\]/.test(code) && /buttons\?\.\[3\]/.test(code) && /buttons\?\.\[4\]/.test(code),
  exitOutsideOppositeZone:/route\.direction === 'up' \? -9\.2 : 9\.2/.test(code),
  longCooldown:/route\.kind === 'stairs' \? 5200 : 2300/.test(code),
  auditFlags:/automaticRooftopStairs:false/.test(code) && /manualRooftopStairs:true/.test(code) && /rooftopStairsLoopPrevention:true/.test(code),
  virtualPath:/\/js\/ucan_v293_quest_controls_interaction\.js/.test(preloader),
  preloaderTransforms:/patchQuestControls\(source\)/.test(preloader),
  versionFlags:/questRooftopStairsAutomatic = false/.test(preloader) && /rooftopStairsActivationMode = 'manual-control-only'/.test(preloader),
  startUsesV293:pkg.scripts?.start === 'node -r ./auth-compat-v293.js server.js',
  packageAudit:pkg.scripts?.['audit:manual-rooftop-stairs'] === 'node verify_manual_stairs_v293.js',
  dockerUsesV293:/auth-compat-v293\.js/.test(dockerfile)
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:VERSION, build:BUILD, checks, transform:result?.checks || null, error }, null, 2));
if (!ok) process.exit(1);
