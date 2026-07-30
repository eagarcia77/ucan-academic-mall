'use strict';

const fs = require('fs');
const path = require('path');
const root = __dirname;
const files = {
  xr:path.join(root,'public/js/ucan_v324_xr_stairs_entry.js'),
  loader:path.join(root,'public/js/ucan_v323_social_loader.js'),
  authority:path.join(root,'public/js/ucan_v322_stair_authority.js'),
  locomotion:path.join(root,'public/js/ucan_v316_complete_browser_vr_audit.js'),
  package:path.join(root,'package.json')
};
const text = Object.fromEntries(Object.entries(files).map(([key,file]) => [key,fs.readFileSync(file,'utf8')]));
const pkg = JSON.parse(text.package);
const routes = ['up12','down21','up23','down32','up34','down34'];
const checks = {
  filesExist:Object.values(files).every(fs.existsSync),
  xrSyntax:true,
  loaderSyntax:true,
  parentTransformNode:/new B\.TransformNode\('UCAN XR locomotion root V324'/.test(text.xr),
  xrCameraParented:/state\.xr\.parent = state\.root/.test(text.xr),
  globalPositionUsed:/state\.xr\.globalPosition/.test(text.xr),
  v316FrameLocated:/callback\?\.name === 'frame'/.test(text.xr) && /updateMovement\\\(dt\\\)/.test(text.xr),
  v316SuspendedOnlyInXr:/stopV316Frame\(\)/.test(text.xr) && /startV316Frame\(\)/.test(text.xr) && /function deactivate/.test(text.xr),
  dedicatedXrFrame:/state\.xrObserver = state\.scene\.onBeforeRenderObservable\.add\(frame\)/.test(text.xr),
  stairAuthorityUsed:/__UCAN_STAIR_AUTHORITY_V322__/.test(text.xr) && /resolveGround/.test(text.xr),
  allRoutesConstrained:routes.every(id => text.xr.includes(`${id}:`)),
  routeCollisionBypass:/if \(stair\.activeRoute\) return false/.test(text.xr),
  routeCompletionTracked:/completedExits/.test(text.xr),
  desktopPresenceSynchronized:/function syncDesktop/.test(text.xr) && /state\.desktop\.position\.x = world\.x/.test(text.xr),
  joystickMovement:/axes\('left'\)/.test(text.xr) && /axes\('right'\)/.test(text.xr),
  sprintClick:/pressed\('left',3\)/.test(text.xr),
  turnModes:/SNAP_ANGLE/.test(text.xr) && /TURN_SPEED/.test(text.xr),
  teleportPreserved:/function updateTeleport/.test(text.xr) && /getWorldPointerRay/.test(text.xr),
  rightButtonCreated:/ucanV324VrEntry/.test(text.xr) && /right:max\(18px/.test(text.xr),
  rightButtonSupportGated:/isSessionSupported\('immersive-vr'\)/.test(text.xr) && /state\.supported === true && !state\.inXR/.test(text.xr),
  ordinaryDesktopHidden:/button\.style\.display = visible \? 'inline-flex' : 'none'/.test(text.xr),
  entryUsesSharedRig:/rigApi\(\).*enterVr/.test(text.xr),
  loaderIncludesV324:/ucan_v324_xr_stairs_entry\.js/.test(text.loader),
  loaderOrdersBeforeVoice:text.loader.indexOf('loadXrStairsEntry') < text.loader.indexOf('loadVoiceBridge'),
  loaderReportsV324:/xrStairsEntryLoaded/.test(text.loader),
  pureAuthorityPreserved:/pureGroundProvider:true/.test(text.authority) && !/onBeforeRenderObservable\.add/.test(text.authority),
  packageChecksV324:String(pkg.scripts?.check||'').includes('ucan_v324_xr_stairs_entry.js'),
  packageRunsV324:String(pkg.scripts?.test||'').includes('audit:v324')
};
for (const key of ['xr','loader']) {
  try { new Function(text[key]); }
  catch (error) { checks[`${key}Syntax`]=false; checks[`${key}SyntaxError`]=error.message; }
}
const failures = Object.entries(checks).filter(([,value]) => value !== true);
const report = {
  version:'V324',revision:'R28',build:'V324-20260730-XR-PARENT-RIG-QUEST-ENTRY-R28',
  feature:'Locomoción Meta Quest mediante nodo padre y botón derecho condicionado a soporte immersive-vr',
  ok:failures.length===0,checks,failures:failures.map(([name,value])=>({name,value}))
};
console.log(JSON.stringify(report,null,2));
if (!report.ok) process.exitCode=1;