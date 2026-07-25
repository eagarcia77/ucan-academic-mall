'use strict';

const fs = require('fs');

const runtime = fs.readFileSync('public/js/ucan_v304_global_glass_signs_r5.js', 'utf8');
const loader = fs.readFileSync('public/js/ucan_v266_keyboard_jump.js', 'utf8');
const preloader = fs.readFileSync('auth-compat-v304-r5.js', 'utf8');
const r4Preloader = fs.readFileSync('auth-compat-v304-r4.js', 'utf8');
const docker = fs.readFileSync('Dockerfile', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let syntaxError = null;
try {
  new Function(runtime);
  new Function(loader);
  new Function(preloader);
  syntaxValid = true;
} catch (error) {
  syntaxError = error.message;
}

const checks = {
  syntaxValid,
  version:runtime.includes("const REVISION = 'R5'") && runtime.includes('V304-20260725-GLOBAL-GLASS-UPRIGHT-SIGNS-R5'),
  globalGlass:runtime.includes("FromHexString('#a9dce6')") && runtime.includes('material.alpha = 0.52'),
  lightingIndependent:runtime.includes('material.disableLighting = true'),
  noBlackDepth:runtime.includes('material.needDepthPrePass = false') && runtime.includes('material.disableDepthWrite = true'),
  browserEnabled:runtime.includes('browserGlassCorrected:true') && runtime.includes('normalizeGlass()'),
  questR4Preserved:runtime.includes("if (questDetected() && currentXRState() === XR_STATE.IN_XR) return"),
  glassBatching:runtime.includes('GLASS_BATCH_SIZE = 48') && runtime.includes('processGlassBatch(candidates, end)'),
  seasonalSourceTargeting:runtime.includes("metadata.livePanelKey === 'season-current-v304'") && runtime.includes("metadata.livePanelKey === 'pr-celebration-v304'") && runtime.includes("metadata.livePanelKey === 'four-seasons-v304'"),
  twoFrontFaces:runtime.includes('sideOrientation:B.Mesh.FRONTSIDE') && runtime.includes("'hacia centro'") && runtime.includes("'hacia exterior'"),
  noBillboard:runtime.includes('face.billboardMode = B.Mesh.BILLBOARDMODE_NONE') && runtime.includes('seasonalBoardsBillboardDisabled:true'),
  upright:runtime.includes('face.rotation.set(0, angle, 0)') && runtime.includes('seasonalBoardsUpright:true'),
  sourceHidden:runtime.includes('Fuente oculta cartel global R5') && runtime.includes('source.setEnabled?.(false)'),
  r4DuplicatePrevented:runtime.includes('holidayBoardPuertoRicoV304R4') && runtime.includes('globalBoardSourceV304R5'),
  noPerFrameScan:!runtime.includes('scene.onBeforeRenderObservable.add'),
  loaderOrderByEvents:loader.includes("runtime.addEventListener('load', loadProtectionAndR5)") && loader.includes("protection.addEventListener('load', loadGlobalVisualR5)"),
  loaderR5:loader.includes('/js/ucan_v304_global_glass_signs_r5.js?build=V304-20260725-GLOBAL-GLASS-UPRIGHT-SIGNS-R5'),
  preloaderChain:preloader.includes("require('./auth-compat-v304-r4.js')") && r4Preloader.includes("require('./auth-compat-v293.js')"),
  preloaderCacheBust:preloader.includes('V304-20260725-GLOBAL-R5-LOADER'),
  versionFlags:preloader.includes('browserGlassCorrected') && preloader.includes('seasonalBoardsTwoFrontFaces'),
  packageStart:pkg.scripts?.start === 'node -r ./auth-compat-v304-r5.js server.js',
  packageCheck:pkg.scripts?.check?.includes('public/js/ucan_v304_global_glass_signs_r5.js') === true,
  packageAudit:pkg.scripts?.['audit:global-v304-r5'] === 'node verify_global_visual_v304_r5.js',
  packageTest:pkg.scripts?.test?.includes('audit:global-v304-r5') === true,
  dockerPreloader:docker.includes('"./auth-compat-v304-r5.js"')
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
