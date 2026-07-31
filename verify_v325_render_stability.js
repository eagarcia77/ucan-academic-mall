'use strict';

const fs = require('fs');
const path = require('path');
const root = __dirname;
const files = {
  runtime:path.join(root,'public/js/ucan_v325_render_stability.js'),
  preloader:path.join(root,'auth-compat-v325-render-stability.js'),
  parallel:path.join(root,'public/js/ucan_v313_parallel_scene.js'),
  parity:path.join(root,'public/js/ucan_v314_render_parity.js'),
  visual:path.join(root,'public/js/ucan_v323_visual_comfort.js'),
  stairs:path.join(root,'public/js/ucan_v322_stair_authority.js'),
  package:path.join(root,'package.json'),
  docker:path.join(root,'Dockerfile')
};
const text = Object.fromEntries(Object.entries(files).map(([key,file]) => [key,fs.readFileSync(file,'utf8')]));
const pkg = JSON.parse(text.package);
const checks = {
  allFilesExist:Object.values(files).every(fs.existsSync),
  runtimeSyntax:true,
  preloaderSyntax:true,
  startsAboveV323:text.preloader.includes("require('./auth-compat-v323-browser-panel.js')"),
  injectedBeforeMain:/mainPattern/.test(text.preloader) && /data-ucan-v325-render-stability/.test(text.preloader),
  intervalInterception:/window\.setInterval\s*=/.test(text.runtime) && /isConflictingInterval/.test(text.runtime),
  timeoutInterception:/window\.setTimeout\s*=/.test(text.runtime) && /isConflictingTimeout/.test(text.runtime),
  observerInterception:/B\.Observable\.prototype\.add/.test(text.runtime) && /conflictingObserver/.test(text.runtime),
  v313PeriodicRepairBlocked:/applyVrReferenceToEveryMode/.test(text.runtime) && /repairCanonical/.test(text.runtime),
  v322PeriodicGeometryBlocked:/clearStairGeometry/.test(text.runtime),
  visualPeriodicReapplyBlocked:/apply\\\(state\\\.mode\\\)/.test(text.runtime) || /apply\(state\.mode\)/.test(text.runtime),
  hiddenGlassMaintained:/hiddenByV322/.test(text.runtime) && /noCanonicalRepairV325/.test(text.runtime),
  noCameraMovement:!/(?:camera|desktop|xr)\.position\.(?:set|copyFrom|addInPlace)\s*\(/.test(text.runtime),
  noGroundChanges:!/__UCAN_STAIR_AUTHORITY_V322__\?\.setFloor/.test(text.runtime),
  finiteStartupPasses:/\[0,180,500,1100,2200,3600,5200,7600\]/.test(text.runtime),
  diagnostics:/singleStableVisualAuthority:true/.test(text.runtime) && /periodicCanonicalRepairsDisabled:true/.test(text.runtime),
  oldConflictsActuallyExist:/REPAIR_INTERVAL_MS = 220/.test(text.parallel) && /CHECK_MS=180/.test(text.parity) && /}, 1800\);/.test(text.visual) && /}, 1800\);/.test(text.stairs),
  packageStartsV325:String(pkg.scripts?.start||'').includes('auth-compat-v325-render-stability.js'),
  packagePreservesV323:String(pkg.scripts?.start||'').includes('auth-compat-v323-browser-panel.js'),
  packageChecksV325:String(pkg.scripts?.check||'').includes('ucan_v325_render_stability.js') && String(pkg.scripts?.check||'').includes('auth-compat-v325-render-stability.js'),
  packageRunsV325:String(pkg.scripts?.test||'').includes('audit:v325'),
  dockerStartsV325:text.docker.includes('auth-compat-v325-render-stability.js'),
  dockerPreservesV323:text.docker.includes('auth-compat-v323-browser-panel.js')
};
for (const key of ['runtime','preloader']) {
  try { new Function(text[key]); }
  catch (error) { checks[`${key}Syntax`] = false; checks[`${key}SyntaxError`] = error.message; }
}
const failures = Object.entries(checks).filter(([,value]) => value !== true);
const report = {
  version:'V325',revision:'R29',build:'V325-20260731-STABLE-RENDER-NO-FLICKER-R29',
  feature:'Una sola autoridad visual estable sin reparaciones periódicas conflictivas',
  ok:failures.length===0,checks,failures:failures.map(([name,value])=>({name,value}))
};
console.log(JSON.stringify(report,null,2));
if (!report.ok) process.exitCode=1;