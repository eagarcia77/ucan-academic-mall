'use strict';

const fs = require('fs');
const path = require('path');
const root = __dirname;
const files = {
  runtime:path.join(root,'public/js/ucan_v328_xr_final_authority.js'),
  preloader:path.join(root,'auth-compat-v325-render-stability.js'),
  adapter:path.join(root,'auth-compat-v323-browser-panel.js'),
  v324:path.join(root,'public/js/ucan_v324_xr_stairs_entry.js'),
  authority:path.join(root,'public/js/ucan_v322_stair_authority.js'),
  package:path.join(root,'package.json'),
  docker:path.join(root,'Dockerfile')
};
const exists = Object.fromEntries(Object.entries(files).map(([key,file]) => [key,fs.existsSync(file)]));
const text = Object.fromEntries(Object.entries(files).filter(([key]) => exists[key]).map(([key,file]) => [key,fs.readFileSync(file,'utf8')]));
const pkg = text.package ? JSON.parse(text.package) : {};
const routes = ['up12','down21','up23','down32','up34','down34'];
const checks = {
  filesExist:Object.values(exists).every(Boolean),
  runtimeSyntax:true,
  preloaderSyntax:true,
  adapterSyntax:true,
  allSixRoutes:routes.every(id => text.runtime?.includes(`${id}:`)),
  singleFinalVerticalAuthority:/singleFinalVerticalAuthority:true/.test(text.runtime||'') && /ownsVertical:true/.test(text.runtime||''),
  automaticWithoutJoystick:/automaticStairsWithoutJoystick:true/.test(text.runtime||'') && /function entryRoute/.test(text.runtime||'') && /function updateRide/.test(text.runtime||''),
  exactLanding:/exactFloorLanding:true/.test(text.runtime||'') && /v328-exact-landing/.test(text.runtime||'') && /LANDING_CLEARANCE\s*=\s*2\.7/.test(text.runtime||''),
  desktopEyeParity:/TARGET_EYE_HEIGHT\s*=\s*1\.72/.test(text.runtime||'') && /desktopEyeHeightParity:true/.test(text.runtime||'') && /calibrationFrame/.test(text.runtime||''),
  betweenFloorRepair:/preventsBetweenFloors:true/.test(text.runtime||'') && /repairBetweenFloors/.test(text.runtime||''),
  underStairProtection:/underStairSafetyVolumes:true/.test(text.runtime||'') && /guardUnderStairs/.test(text.runtime||'') && /bajo-terraza/.test(text.runtime||''),
  jumpEnabled:/jumpEnabled:true/.test(text.runtime||'') && /JUMP_VELOCITY\s*=\s*4\.4/.test(text.runtime||''),
  directNavigation:/directImmersiveNavigation:true/.test(text.runtime||'') && /function teleportTo/.test(text.runtime||''),
  rollbackAvailable:/function rollback\(\)/.test(text.runtime||'') && /rollbackPressed/.test(text.runtime||''),
  visualSnapshot:/visualParitySnapshot:true/.test(text.runtime||'') && /captureVisual/.test(text.runtime||'') && /ensureVisualParity/.test(text.runtime||''),
  lastObserverStrategy:/ensureLastObserver/.test(text.runtime||'') && /removeLegacyVerticalObservers/.test(text.runtime||''),
  v328Injected:/FINAL_XR_SRC/.test(text.preloader||'') && /data-ucan-v328-xr-final-authority/.test(text.preloader||''),
  v326NotInjected:!/(?:LANDING_SRC|data-ucan-v326-xr-landing-release)/.test(text.preloader||''),
  v327NotInjected:!/(?:STAIR_RIDE_SRC|data-ucan-v327-xr-stair-ride)/.test(text.preloader||''),
  versionEndpointV328:/version:VERSION/.test(text.preloader||'') && /singleFinalVerticalAuthority:true/.test(text.preloader||''),
  finalReleaseMarker:/global\.__UCAN_ACTIVE_RELEASE__\s*=/.test(text.preloader||'') && /version:VERSION/.test(text.preloader||''),
  v323PreservesFinalRelease:/global\.__UCAN_ACTIVE_RELEASE__/.test(text.adapter||'') && /activeRelease\.version \|\| VERSION/.test(text.adapter||''),
  v324ResponseTransformed:/ucan_v324_xr_stairs_entry\.js/.test(text.adapter||'') && /function patchXrAdapter/.test(text.adapter||''),
  v324DesktopSpeedParity:/comfort:3\.4, natural:5\.0, fast:7\.0/.test(text.adapter||'') && /const TURN_SPEED = 1\.9/.test(text.adapter||''),
  v324DefersVertical:/finalAuthority\?\.ownsVertical/.test(text.adapter||'') && /__UCAN_XR_FINAL_AUTHORITY_V328__/.test(text.adapter||''),
  pureStairProvider:/pureGroundProvider:true/.test(text.authority||'') && /authorityMovesCamera:false/.test(text.authority||''),
  dockerLoadsStability:text.docker?.includes('auth-compat-v325-render-stability.js') === true,
  packageChecksV328:String(pkg.scripts?.check||'').includes('ucan_v328_xr_final_authority.js'),
  packageAuditsV328:String(pkg.scripts?.test||'').includes('audit:v328')
};
for (const key of ['runtime','preloader','adapter']) {
  try { new Function(text[key] || ''); }
  catch (error) { checks[`${key}Syntax`] = false; checks[`${key}SyntaxError`] = error.message; }
}
const failures = Object.entries(checks).filter(([,value]) => value !== true);
const report = {
  version:'V328',
  revision:'R32',
  build:'V328-20260903-XR-FINAL-HEIGHT-STAIRS-R32',
  feature:'Una autoridad vertical final, altura equivalente a escritorio, escaleras automáticas y aterrizaje exacto',
  ok:failures.length===0,
  checks,
  failures:failures.map(([name,value])=>({name,value}))
};
console.log(JSON.stringify(report,null,2));
if (!report.ok) process.exitCode=1;
