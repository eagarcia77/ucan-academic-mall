'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const files = {
  runtime:path.join(root, 'public/js/ucan_v309_strict_visual_parity.js'),
  loader:path.join(root, 'public/js/ucan_v266_keyboard_jump.js'),
  responseCompat:path.join(root, 'auth-compat-v304-r6.js'),
  preloader:path.join(root, 'auth-compat-v309-parity.js'),
  docker:path.join(root, 'Dockerfile'),
  package:path.join(root, 'package.json')
};

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
const pkg = JSON.parse(text.package);

const checks = {
  runtimeSyntax:true,
  responseCompatSyntax:true,
  preloaderSyntax:true,
  browserAuthoritativeSnapshot:text.runtime.includes('function captureCanonical()') && text.runtime.includes('browserSceneIsAuthoritative:true'),
  restoresMeshVisibility:text.runtime.includes('mesh.isVisible = record.isVisible') && text.runtime.includes('mesh.visibility = record.visibility'),
  restoresMaterials:text.runtime.includes('mesh.material = record.material'),
  restoresLighting:text.runtime.includes('function restoreLights') && text.runtime.includes('light.intensity = record.intensity'),
  restoresSceneAtmosphere:text.runtime.includes('function restoreScene') && text.runtime.includes('scene.environmentTexture = visual.environmentTexture'),
  restoresCameraLayers:text.runtime.includes('function restoreCamera') && text.runtime.includes('camera.layerMask = canonical.camera.layerMask'),
  suppressesQuestOnlyGeometry:text.runtime.includes('function suppressQuestOnly') && text.runtime.includes('questCorrectedStairRailV301') && text.runtime.includes('questSolidFloorV301'),
  disablesQuestVignette:text.runtime.includes('viñeta confort Meta Quest V301') && text.runtime.includes('questComfortVignetteDisabled:true'),
  loaderIncludesV309:text.loader.includes('/js/ucan_v309_strict_visual_parity.js?build=V309-20260728-STRICT-BROWSER-VR-VISUAL-PARITY-R13'),
  loaderRunsV309AfterV308:text.loader.includes("runtime.addEventListener('load', loadStrictParityV309") && text.loader.includes("runtime.addEventListener('error', loadStrictParityV309"),
  responsePatchesV301:text.responseCompat.includes("patched.includes('V301-20260723-QUEST-RAILS-SELECTION-COMFORT')") && text.responseCompat.includes('decorateRooftopInteractions(true)'),
  responseDisablesV303Cleanup:text.responseCompat.includes("patched.includes('V303-20260723-QUEST-ZONE-GLASS-REAR-RAILS-R2')") && text.responseCompat.includes('function scanAndClean(force = false)'),
  responseDisablesR4Replacement:text.responseCompat.includes("patched.includes('V304-20260725-QUEST-GLASS-RAILS-HOLIDAY-R4')") && text.responseCompat.includes('state.visualsReady = true; restoreVisuals();'),
  responsePreservesBrowserScaling:text.responseCompat.includes("patched.includes('V289-20260720-QUEST-XR-COMPAT-DIAGNOSTICS')") && text.responseCompat.includes('mismo ajuste visual seleccionado en el browser'),
  versionReportsStrictParity:text.responseCompat.includes('sameGeometryBrowserVr = true') && text.responseCompat.includes('cameraAndControlsOnlyDifference = true'),
  noCacheR13:text.responseCompat.includes('V309-20260728-R13-NO-CACHE-LOADER') && text.responseCompat.includes('no-store, no-cache, must-revalidate'),
  preloaderChainsV308:text.preloader.includes("require('./auth-compat-v308-world.js')"),
  dockerStartsV309:text.docker.includes('auth-compat-v309-parity.js'),
  packageStartsV309:String(pkg.scripts?.start || '').includes('auth-compat-v309-parity.js'),
  packageChecksV309:String(pkg.scripts?.check || '').includes('ucan_v309_strict_visual_parity.js') && String(pkg.scripts?.check || '').includes('verify_strict_visual_parity_v309.js'),
  packageAuditsV309:String(pkg.scripts?.test || '').includes('audit:strict-visual-parity-v309')
};

for (const [name, source] of [['runtime', text.runtime], ['responseCompat', text.responseCompat], ['preloader', text.preloader]]) {
  try { new Function(source); }
  catch (error) {
    checks[`${name}Syntax`] = false;
    checks[`${name}SyntaxError`] = error.message;
  }
}

const failed = Object.entries(checks).filter(([, value]) => value !== true);
const report = {
  version:'V309',
  revision:'R13',
  build:'V309-20260728-STRICT-BROWSER-VR-VISUAL-PARITY-R13',
  ok:failed.length === 0,
  checks,
  failed:failed.map(([name, value]) => ({ name, value }))
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
