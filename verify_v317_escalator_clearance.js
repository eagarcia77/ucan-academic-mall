'use strict';
// Rama temporal de validación V317.

const fs = require('fs');
const path = require('path');

const root = __dirname;
const files = {
  preloader:path.join(root, 'auth-compat-v316-complete-audit.js'),
  locomotion:path.join(root, 'public/js/ucan_v316_complete_browser_vr_audit.js'),
  loader:path.join(root, 'public/js/ucan_v316_social_loader.js'),
  clearance:path.join(root, 'public/js/ucan_v317_escalator_clearance.js'),
  parallelScene:path.join(root, 'public/js/ucan_v313_parallel_scene.js'),
  renderParity:path.join(root, 'public/js/ucan_v314_render_parity.js'),
  package:path.join(root, 'package.json'),
  docker:path.join(root, 'Dockerfile')
};

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
const pkg = JSON.parse(text.package);
const loaderChain = text.loader.match(/chain\(loadExternalPatio[\s\S]*?\n\s*\);\n\}\)\(\);/)?.[0] || text.loader;

const checks = {
  filesExist:Object.values(files).every(fs.existsSync),
  preloaderSyntax:true,
  loaderSyntax:true,
  clearanceSyntax:true,
  version:/const VERSION = 'V317'/.test(text.clearance) && /const REVISION = 'R21'/.test(text.clearance),
  fourEscalatorRoutes:(text.clearance.match(/id:'P[12]-P[23] (?:oeste|este)'/g) || []).length === 4,
  endpointGlassDetection:/function endpointFor/.test(text.clearance) && /function isGlass/.test(text.clearance),
  frontGlassDisabled:/escalatorFrontGlassRemovedV317:true/.test(text.clearance) && /mesh\.setEnabled\?\.\(false\)/.test(text.clearance) && /mesh\.isVisible = false/.test(text.clearance) && /mesh\.visibility = 0/.test(text.clearance),
  frontGlassNoCollision:/mesh\.checkCollisions = false/.test(text.clearance) && /mesh\.isPickable = false/.test(text.clearance),
  excludedFromV313Capture:/dynamicSharedV313:true/.test(text.clearance) && /metadata\.dynamicSharedV313/.test(text.parallelScene),
  topLandingCollisionClearance:/function topExitFor/.test(text.clearance) && /escalatorTopCollisionClearedV317:true/.test(text.clearance),
  walkableSurfacesPreserved:/function structuralWalkable/.test(text.clearance) && /meta\.walkable/.test(text.clearance),
  antiStuckRequiresInput:/magnitude < 0\.22/.test(text.clearance) && /directionZ >= -0\.05/.test(text.clearance),
  antiStuckRequiresStationary:/RELEASE_DELAY_MS = 420/.test(text.clearance) && /moved > 0\.0009/.test(text.clearance),
  antiStuckCooldown:/RELEASE_COOLDOWN_MS = 1200/.test(text.clearance) && /lastReleaseAt/.test(text.clearance),
  rigSynchronizedOnRelease:/function synchronizeRelease/.test(text.clearance) && /desktop\.position\.set/.test(text.clearance) && /xr\.position\.set/.test(text.clearance),
  continuousLocomotionPreserved:/continuousStairMovement:true/.test(text.locomotion) && /scriptedStairTransitions:false/.test(text.locomotion),
  loaderLoadsClearance:text.loader.includes('/js/ucan_v317_escalator_clearance.js?build=V317-20260729-ESCALATOR-CLEARANCE-R21'),
  clearanceLoadsAfterScene:loaderChain.indexOf('chain(loadParallelScene') >= 0 && loaderChain.indexOf('chain(loadEscalatorClearance') > loaderChain.indexOf('chain(loadParallelScene'),
  clearanceLoadsBeforeVoice:loaderChain.indexOf('chain(loadVoiceBridge') > loaderChain.indexOf('chain(loadEscalatorClearance'),
  preloaderPublishesV317:/const VERSION = 'V317'/.test(text.preloader) && /escalatorTopLandingClearance:true/.test(text.preloader) && /frontEscalatorGlassRemoved:true/.test(text.preloader),
  cacheBusted:/SOCIAL-LOADER-ESCALATOR-CLEARANCE-R21/.test(text.preloader),
  renderParityCapturesAfterInstall:/setTimeout\(\(\)=>\{try\{capture\(\)/.test(text.renderParity) && /4200/.test(text.renderParity),
  packageChecksV317:String(pkg.scripts?.check || '').includes('ucan_v317_escalator_clearance.js') && String(pkg.scripts?.check || '').includes('verify_v317_escalator_clearance.js'),
  packageRunsV317:String(pkg.scripts?.test || '').includes('audit:v317'),
  dockerKeepsV317Preloader:text.docker.includes('auth-compat-v316-complete-audit.js')
};

for (const key of ['preloader','loader','clearance']) {
  try { new Function(text[key]); }
  catch (error) {
    checks[`${key}Syntax`] = false;
    checks[`${key}SyntaxError`] = error.message;
  }
}

const failed = Object.entries(checks).filter(([, value]) => value !== true);
const report = {
  version:'V317',
  revision:'R21',
  build:'V317-20260729-ESCALATOR-CLEARANCE-R21',
  ok:failed.length === 0,
  checks,
  failed:failed.map(([name, value]) => ({ name, value })),
  physicalValidationRequired:[
    'Desplegar el commit actual con limpieza de caché.',
    'Subir por las cuatro escaleras eléctricas desde el browser.',
    'Confirmar que el avatar cruza el descanso superior sin quedar encajado.',
    'Confirmar que no quedan cristales frente a las entradas o salidas.',
    'Repetir la prueba en Meta Quest para verificar la misma geometría.'
  ]
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
