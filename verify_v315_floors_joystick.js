'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const files = {
  runtime:path.join(root,'public/js/ucan_v315_unified_floors_joystick.js'),
  preloader:path.join(root,'auth-compat-v315-floors-joystick.js'),
  docker:path.join(root,'Dockerfile'),
  package:path.join(root,'package.json'),
  campus:path.join(root,'public/campus.html')
};

const text = Object.fromEntries(Object.entries(files).map(([key,file]) => [key,fs.readFileSync(file,'utf8')]));
const pkg = JSON.parse(text.package);

const checks = {
  filesExist:Object.values(files).every(fs.existsSync),
  runtimeSyntax:true,
  preloaderSyntax:true,
  oneLocomotionEngine:/oneLocomotionEngine:true/.test(text.runtime),
  sameMovement:/sameMovementBrowserVr:true/.test(text.runtime),
  floor1Parity:/sameFloor1:true/.test(text.runtime),
  floor2Parity:/sameFloor2:true/.test(text.runtime),
  floor3Parity:/sameFloor3:true/.test(text.runtime),
  floorHashes:/floorHashes/.test(text.runtime) && /floorCurrentHashes/.test(text.runtime) && /floorHashesMatch/.test(text.runtime),
  floorTransforms:/position:clone\(mesh\.position\)/.test(text.runtime) && /rotation:clone\(mesh\.rotation\)/.test(text.runtime) && /scaling:clone\(mesh\.scaling\)/.test(text.runtime),
  leftStickMove:/axesFromController\('left'\)/.test(text.runtime),
  leftStickSprint:/leftJoystickClickSprint:true/.test(text.runtime) && /state\.sprintPressed/.test(text.runtime),
  rightStickTurn:/axesFromController\('right'\)/.test(text.runtime) && /rightJoystickTurn:true/.test(text.runtime),
  rightStickClick:/rightJoystickClickTurnMode:true/.test(text.runtime),
  joystickTeleport:/rightJoystickForwardTeleport:true/.test(text.runtime) && /commitTeleport/.test(text.runtime),
  smoothAndSnap:/smoothTurn:true/.test(text.runtime) && /snapTurn30:true/.test(text.runtime),
  headAndHandRelative:/headRelative:true/.test(text.runtime) && /handRelative:true/.test(text.runtime),
  componentBindings:/xr-standard-thumbstick/.test(text.runtime) && /touchpad/.test(text.runtime),
  primaryButtons:/a-button/.test(text.runtime) && /x-button/.test(text.runtime),
  secondaryButtons:/b-button/.test(text.runtime) && /y-button/.test(text.runtime),
  automaticRoutes:/automaticEscalators:true/.test(text.runtime) && /ROUTES/.test(text.runtime),
  collisionProbes:/rayBlocked/.test(text.runtime) && /collisionCandidate/.test(text.runtime),
  legacyV272Removed:/ucan_v272_xr_desktop_parity/.test(text.preloader) && /replace/.test(text.preloader),
  legacyV304Removed:/ucan_v304_xr_entry_mr_fix/.test(text.preloader) && /replace/.test(text.preloader),
  injectedBeforeScene:/mainPattern/.test(text.preloader) && /ucan_v315_unified_floors_joystick/.test(text.preloader),
  dockerStartsV315:text.docker.includes('./auth-compat-v315-floors-joystick.js'),
  packageStartsV315:String(pkg.scripts?.start||'').includes('auth-compat-v315-floors-joystick.js'),
  packageChecksV315:String(pkg.scripts?.check||'').includes('ucan_v315_unified_floors_joystick.js') && String(pkg.scripts?.check||'').includes('auth-compat-v315-floors-joystick.js'),
  packageTestsV315:String(pkg.scripts?.test||'').includes('audit:v315')
};

for (const key of ['runtime','preloader']) {
  try { new Function(text[key]); }
  catch (error) {
    checks[`${key}Syntax`] = false;
    checks[`${key}SyntaxError`] = error.message;
  }
}

const failed = Object.entries(checks).filter(([,value]) => value !== true);
const report = {
  version:'V315',
  revision:'R19',
  build:'V315-20260729-FLOORS-JOYSTICK-ONE-LOCOMOTION-R19',
  ok:failed.length===0,
  checks,
  failed:failed.map(([name,value])=>({name,value}))
};

console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exitCode=1;
