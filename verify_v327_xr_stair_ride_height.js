'use strict';

const fs = require('fs');
const path = require('path');
const root = __dirname;
const files = {
  runtime:path.join(root,'public/js/ucan_v327_xr_stair_ride_height.js'),
  preloader:path.join(root,'auth-compat-v325-render-stability.js'),
  stairs:path.join(root,'public/js/ucan_v322_stair_authority.js'),
  xr:path.join(root,'public/js/ucan_v324_xr_stairs_entry.js'),
  landing:path.join(root,'public/js/ucan_v326_xr_landing_release.js'),
  package:path.join(root,'package.json')
};
const exists = Object.fromEntries(Object.entries(files).map(([key,file])=>[key,fs.existsSync(file)]));
const text = Object.fromEntries(Object.entries(files).filter(([key])=>exists[key]).map(([key,file])=>[key,fs.readFileSync(file,'utf8')]));
const pkg = text.package ? JSON.parse(text.package) : {};
const routes = ['up12','down21','up23','down32','up34','down34'];
const checks = {
  filesExist:Object.values(exists).every(Boolean),
  runtimeSyntax:true,
  preloaderSyntax:true,
  allSixRoutes:routes.every(id => text.runtime?.includes(`${id}:`)),
  automaticCarry:/AUTO_SPEED\s*=\s*3\.35/.test(text.runtime||'') && /locomotionRoot\.position\.z \+= route\.direction/.test(text.runtime||''),
  neutralJoystickStillCarries:/La escalera transporta automáticamente aunque el joystick quede en neutral/.test(text.runtime||''),
  interpolatedVerticalRide:/expectedGround\s*=\s*lerp\(route\.fromFloor,route\.toFloor,t\)/.test(text.runtime||''),
  exactFloorSnap:/setFloor\?\.\(route\.toFloor,'v327-exact-completion'\)/.test(text.runtime||''),
  exactLandingClearance:/LANDING_CLEARANCE\s*=\s*2\.6/.test(text.runtime||''),
  preventsBetweenFloors:/preventsBetweenFloors:true/.test(text.runtime||'') && /repairBetweenFloors/.test(text.runtime||''),
  eyeHeightCorrection:/DEFAULT_EYE_HEIGHT\s*=\s*1\.68/.test(text.runtime||'') && /MIN_REASONABLE_LOCAL_EYE\s*=\s*1\.05/.test(text.runtime||'') && /eyeHeightCorrection:true/.test(text.runtime||''),
  onlyCorrectsBadEyeHeight:/localY < MIN_REASONABLE_LOCAL_EYE/.test(text.runtime||''),
  waitsForExistingAuthorities:/__UCAN_XR_STAIRS_ENTRY_V324__/.test(text.runtime||'') && /landingApi\(\)\?\.installed/.test(text.runtime||'') && /stairApi\(\)\?\.installed/.test(text.runtime||''),
  injectedByPreloader:/STAIR_RIDE_SRC/.test(text.preloader||'') && /data-ucan-v327-xr-stair-ride/.test(text.preloader||''),
  cacheBusted:/V327-20260903-XR-AUTO-STAIRS-HEIGHT-R31/.test(text.preloader||''),
  diagnosticApi:/__UCAN_XR_STAIR_RIDE_V327__/.test(text.runtime||'') && /automaticStairRide:true/.test(text.runtime||'') && /exactFloorSnap:true/.test(text.runtime||''),
  packageChecksV327:String(pkg.scripts?.check||'').includes('ucan_v327_xr_stair_ride_height.js'),
  packageAuditsV327:String(pkg.scripts?.test||'').includes('audit:v327')
};
for (const key of ['runtime','preloader']) {
  try { new Function(text[key] || ''); }
  catch (error) { checks[`${key}Syntax`] = false; checks[`${key}SyntaxError`] = error.message; }
}
const failures = Object.entries(checks).filter(([,value]) => value !== true);
const report = {
  version:'V327', revision:'R31', build:'V327-20260903-XR-AUTO-STAIRS-HEIGHT-R31',
  feature:'Altura WebXR correcta, transporte automático y fijación exacta de pisos',
  ok:failures.length===0,
  checks,
  failures:failures.map(([name,value])=>({name,value}))
};
console.log(JSON.stringify(report,null,2));
if (!report.ok) process.exitCode=1;
