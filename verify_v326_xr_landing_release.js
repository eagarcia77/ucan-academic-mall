'use strict';

const fs = require('fs');
const path = require('path');
const root = __dirname;
const files = {
  runtime:path.join(root,'public/js/ucan_v326_xr_landing_release.js'),
  preloader:path.join(root,'auth-compat-v325-render-stability.js'),
  package:path.join(root,'package.json')
};
const text = Object.fromEntries(Object.entries(files).map(([key,file]) => [key,fs.readFileSync(file,'utf8')]));
const pkg = JSON.parse(text.package);
const routes = ['up12','down21','up23','down32','up34','down34'];
const checks = {
  filesExist:Object.values(files).every(fs.existsSync),
  runtimeSyntax:true,
  preloaderSyntax:true,
  allRoutes:routes.every(id => text.runtime.includes(`${id}:`)),
  detectsCompletedRoute:/completed > state\.previousCompleted/.test(text.runtime),
  createsLanding:/function beginLanding\(/.test(text.runtime),
  smoothCarry:/function carry\(/.test(text.runtime) && /CARRY_SPEED/.test(text.runtime),
  collisionFreeExit:/clearExit\(routeId\)/.test(text.runtime) && /collisionClearedByV326Landing/.test(text.runtime),
  hidesGlass:/hiddenByV326Landing/.test(text.runtime),
  synchronizesDesktop:/function syncDesktop\(/.test(text.runtime),
  noTeleportBetweenFloors:!/setWorldXZ|teleportTarget/.test(text.runtime),
  diagnostics:/__UCAN_XR_LANDING_RELEASE_V326__/.test(text.runtime) && /landingActive/.test(text.runtime),
  injectedBeforeMain:text.preloader.includes('data-ucan-v326-xr-landing-release="true"') && text.preloader.includes('LANDING_SRC'),
  cacheBusted:text.preloader.includes('V326-20260806-XR-LANDING-RELEASE-R30'),
  packageChecks:String(pkg.scripts?.check||'').includes('ucan_v326_xr_landing_release.js'),
  packageAudits:String(pkg.scripts?.test||'').includes('audit:v326')
};
for (const [key,source] of [['runtimeSyntax',text.runtime],['preloaderSyntax',text.preloader]]) {
  try { new Function(source); } catch (error) { checks[key]=false; checks[`${key}Error`]=error.message; }
}
const failures = Object.entries(checks).filter(([,value]) => value !== true);
const report = { version:'V326',revision:'R30',feature:'Liberación del descanso superior en Meta Quest',ok:failures.length===0,checks,failures:failures.map(([name,value])=>({name,value})) };
console.log(JSON.stringify(report,null,2));
if(!report.ok) process.exitCode=1;
