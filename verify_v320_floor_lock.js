'use strict';

// Validación CI temporal del bloqueo estable del Piso 2.
const fs = require('fs');
const path = require('path');
const root = __dirname;
const files = {
  controller:path.join(root, 'public/js/ucan_v320_floor_lock_controller.js'),
  loader:path.join(root, 'public/js/ucan_v320_social_loader.js'),
  preloader:path.join(root, 'auth-compat-v320-floor-lock.js'),
  accessibility:path.join(root, 'public/js/ucan_v319_vr_accessibility.js'),
  docker:path.join(root, 'Dockerfile'),
  package:path.join(root, 'package.json')
};
const text = Object.fromEntries(Object.entries(files).map(([key,file]) => [key,fs.readFileSync(file,'utf8')]));
const pkg = JSON.parse(text.package);
const checks = {
  filesExist:Object.values(files).every(fs.existsSync),
  controllerSyntax:true,loaderSyntax:true,preloaderSyntax:true,
  stickyFloorState:/stableFloorOnlyChangesByRouteOrExplicitNavigation:true/.test(text.controller),
  noAutomaticHeightFloorReset:!text.controller.includes('state.stableFloor = nearestFloor(estimated)'),
  intentionalDirection:/intentionalDirectionRequired:true/.test(text.controller) && /intendedDirection/.test(text.controller),
  floorTwoLock:/FLOOR_LOCK_MS = 6500/.test(text.controller) && /floorLockUntil/.test(text.controller),
  automaticReturnDisabled:/automaticReturnToFloor1:false/.test(text.controller),
  safeLandingTarget:/exitX:-20, exitZ:4.8/.test(text.controller),
  xrStatePreservesFloor:/Conserva el piso estable al cambiar de browser a VR/.test(text.controller),
  legacyAliasForAccessibility:/__UCAN_FLOOR_ROUTE_CONTROLLER_V319__ = api/.test(text.controller),
  loaderUsesV320:/ucan_v320_floor_lock_controller\.js\?build=V320/.test(text.loader),
  loaderDoesNotLoadOldControllers:!text.loader.includes('ucan_v318_floor_route_controller.js?') && !text.loader.includes('ucan_v319_floor_route_controller.js?'),
  locomotionDelegatesToV320:/__UCAN_FLOOR_ROUTE_CONTROLLER_V320__\?\.resolveGround/.test(text.preloader),
  explicitPanelNavigation:/setFloor\?\.\(state\.ground, 'panel-navigation'\)/.test(text.preloader),
  explicitTeleport:/setFloor\?\.\(state\.floor, 'teleport'\)/.test(text.preloader),
  explicitReset:/setFloor\?\.\(floor, 'reset'\)/.test(text.preloader),
  versionFlags:/floorTwoStickyLock:true/.test(text.preloader) && /automaticReturnToFloor1:false/.test(text.preloader),
  dockerStartsV320:text.docker.includes('auth-compat-v320-floor-lock.js'),
  packageStartsV320:String(pkg.scripts?.start || '').includes('auth-compat-v320-floor-lock.js'),
  packageChecksV320:String(pkg.scripts?.check || '').includes('ucan_v320_floor_lock_controller.js') && String(pkg.scripts?.check || '').includes('auth-compat-v320-floor-lock.js'),
  packageTestsV320:String(pkg.scripts?.test || '').includes('audit:v320')
};
for (const key of ['controller','loader','preloader']) { try { new Function(text[key]); } catch (error) { checks[`${key}Syntax`]=false; checks[`${key}SyntaxError`]=error.message; } }
const failed=Object.entries(checks).filter(([,value])=>value!==true);
const report={version:'V320',revision:'R24',build:'V320-20260730-FLOOR-TWO-STICKY-LOCK-R24',ok:failed.length===0,checks,failed:failed.map(([name,value])=>({name,value}))};
console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exitCode=1;
