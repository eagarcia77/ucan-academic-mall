'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const files = {
  preloader:path.join(root, 'auth-compat-v313-parallel.js'),
  v315Preloader:path.join(root, 'auth-compat-v315-floors-joystick.js'),
  loader:path.join(root, 'public/js/ucan_v266_keyboard_jump.js'),
  scene:path.join(root, 'public/js/ucan_v313_parallel_scene.js'),
  interaction:path.join(root, 'public/js/ucan_v313_parallel_interaction.js'),
  xrEntry:path.join(root, 'public/js/ucan_v313_xr_entry.js'),
  realtime:path.join(root, 'public/js/ucan_v312_realtime_world.js'),
  realtimeServer:path.join(root, 'lib/realtime-world-v312.js'),
  persistence:path.join(root, 'lib/persistent-identity-v311.js'),
  docker:path.join(root, 'Dockerfile'),
  package:path.join(root, 'package.json')
};

const text = Object.fromEntries(Object.entries(files).map(([key,file]) => [key, fs.readFileSync(file, 'utf8')]));
const pkg = JSON.parse(text.package);
const runtimeChain = text.loader.match(/function loadParallelRuntime\(\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] || '';

const forbiddenServerRequires = [
  "require('./auth-compat-v304-r6.js')",
  "require('./auth-compat-v306-voice.js')",
  "require('./auth-compat-v307-presence.js')",
  "require('./auth-compat-v308-world.js')",
  "require('./auth-compat-v309-parity.js')",
  "require('./auth-compat-v311-unified.js')",
  "require('./auth-compat-v312-vr-canonical.js')"
];

const startsThroughV313 = text.v315Preloader.includes("require('./auth-compat-v313-parallel.js')");
const checks = {
  filesExist:Object.values(files).every(fs.existsSync),
  preloaderSyntax:true,
  v315PreloaderSyntax:true,
  loaderSyntax:true,
  sceneSyntax:true,
  interactionSyntax:true,
  xrEntrySyntax:true,
  cleanServerBase:text.preloader.includes("require('./auth-compat-v271.js')") && forbiddenServerRequires.every(item => !text.preloader.includes(item)),
  v315PreservesV313Server:startsThroughV313,
  onePresenceServer:(text.preloader.match(/createRealtimeWorld\(\)/g) || []).length === 1,
  oldVisualScriptsRemovedFromHtml:text.preloader.includes('ucan_v304_xr_entry_mr_fix') && text.preloader.includes('ucan_v309_strict_visual_parity') && text.preloader.includes('ucan_v310_visual_validation'),
  loaderUsesParallelScene:text.loader.includes('/js/ucan_v313_parallel_scene.js?build=V313-20260729-PARALLEL-CANONICAL-SCENE-R17'),
  loaderUsesParallelInteraction:text.loader.includes('/js/ucan_v313_parallel_interaction.js?build=V313-20260729-PARALLEL-INTERACTION-R17'),
  loaderUsesParallelXrEntry:text.loader.includes('/js/ucan_v313_xr_entry.js?build=V313-20260729-PARALLEL-XR-ENTRY-R17'),
  loaderDoesNotLoadV309:!text.loader.includes('ucan_v309_strict_visual_parity.js'),
  loaderDoesNotLoadOldXrEntry:!text.loader.includes('ucan_v304_xr_entry_mr_fix.js'),
  loaderDoesNotLoadV312Scene:!text.loader.includes('ucan_v312_vr_canonical_scene.js'),
  loadOrderCorrect:runtimeChain.indexOf('chain(loadParallelSceneV313') >= 0 && runtimeChain.indexOf('chain(loadParallelInteractionV313') > runtimeChain.indexOf('chain(loadParallelSceneV313') && runtimeChain.indexOf('loadXrEntryV313') > runtimeChain.indexOf('chain(loadParallelInteractionV313'),
  oneCanonicalScene:/sameSceneBrowserMobileVrMr:true/.test(text.scene) && /sameGeometryEveryEnvironment:true/.test(text.scene),
  sameFloor3Stairs:/sameFloor3StairsEveryEnvironment:true/.test(text.scene) && /buildCanonicalStairs/.test(text.scene),
  canonicalHashAudit:/canonicalHash/.test(text.scene) && /currentHash/.test(text.scene) && /hashesMatch/.test(text.scene),
  repairRunsEveryMode:/function repairCanonical/.test(text.scene) && !/function repairCanonical[\s\S]{0,220}if \(!state\.inXR\)/.test(text.scene),
  modeSpecificGeometryForbidden:/modeSpecificGeometryAllowed:false/.test(text.scene) && /modeSpecificMeshHidingAllowed:false/.test(text.scene),
  oneInteractionPipeline:/oneInteractionPipeline:true/.test(text.interaction) && /sameActionManagerEveryEnvironment:true/.test(text.interaction),
  controllerRayAndGaze:/controllerRayFallback:true/.test(text.interaction) && /gazeFallback:true/.test(text.interaction) && /processTrigger/.test(text.interaction),
  browserMobilePointer:/browserPointer:true/.test(text.interaction) && /mobileTouch:true/.test(text.interaction),
  xrEntryDoesNotModifyScene:/sceneModifiedOnEntry:false/.test(text.xrEntry) && /geometryHiddenForMr:false/.test(text.xrEntry) && /skyHiddenForMr:false/.test(text.xrEntry),
  xrEntryHasNoLegacyMrHiding:!text.xrEntry.includes('hiddenForMR') && !text.xrEntry.includes('isSkyOrBackground') && !text.xrEntry.includes('clearColor = new B.Color4'),
  realtimeBidirectional:/browserToVr:true/.test(text.realtime) && /vrToBrowser:true/.test(text.realtime) && /new EventSource/.test(text.realtime),
  persistencePreserved:/MAX_BACKUPS = 60/.test(text.persistence) && text.preloader.includes('installPersistentIdentity'),
  dockerStartsParallelStack:text.docker.includes('./auth-compat-v315-floors-joystick.js') && startsThroughV313,
  packageStartsParallelStack:String(pkg.scripts?.start || '').includes('auth-compat-v315-floors-joystick.js') && startsThroughV313,
  packageChecksV313:String(pkg.scripts?.check || '').includes('ucan_v313_parallel_scene.js') && String(pkg.scripts?.check || '').includes('ucan_v313_parallel_interaction.js') && String(pkg.scripts?.check || '').includes('ucan_v313_xr_entry.js'),
  packageTestsV313:String(pkg.scripts?.test || '').includes('audit:v313')
};

for (const key of ['preloader','v315Preloader','loader','scene','interaction','xrEntry']) {
  try { new Function(text[key]); }
  catch (error) {
    checks[`${key}Syntax`] = false;
    checks[`${key}SyntaxError`] = error.message;
  }
}

const failed = Object.entries(checks).filter(([,value]) => value !== true);
const report = {
  version:'V313',
  revision:'R17',
  activeUpperLayer:'V315 R19',
  build:'V313-20260729-PARALLEL-ENVIRONMENTS-R17',
  ok:failed.length === 0,
  checks,
  failed:failed.map(([name,value]) => ({ name,value }))
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
