'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const files = {
  parallelPreloader:path.join(root, 'auth-compat-v313-parallel.js'),
  upperPreloader:path.join(root, 'auth-compat-v316-complete-audit.js'),
  socialLoader:path.join(root, 'public/js/ucan_v316_social_loader.js'),
  scene:path.join(root, 'public/js/ucan_v313_parallel_scene.js'),
  interaction:path.join(root, 'public/js/ucan_v313_parallel_interaction.js'),
  realtime:path.join(root, 'public/js/ucan_v312_realtime_world.js'),
  realtimeServer:path.join(root, 'lib/realtime-world-v312.js'),
  persistence:path.join(root, 'lib/persistent-identity-v311.js'),
  docker:path.join(root, 'Dockerfile'),
  package:path.join(root, 'package.json')
};

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
const pkg = JSON.parse(text.package);
const forbiddenServerRequires = [
  "require('./auth-compat-v304-r6.js')",
  "require('./auth-compat-v306-voice.js')",
  "require('./auth-compat-v307-presence.js')",
  "require('./auth-compat-v308-world.js')",
  "require('./auth-compat-v309-parity.js')",
  "require('./auth-compat-v311-unified.js')",
  "require('./auth-compat-v312-vr-canonical.js')"
];

const startsThroughV313 = text.upperPreloader.includes("require('./auth-compat-v313-parallel.js')");
const checks = {
  filesExist:Object.values(files).every(fs.existsSync),
  parallelPreloaderSyntax:true,
  upperPreloaderSyntax:true,
  socialLoaderSyntax:true,
  sceneSyntax:true,
  interactionSyntax:true,
  cleanServerBase:text.parallelPreloader.includes("require('./auth-compat-v271.js')") && forbiddenServerRequires.every(item => !text.parallelPreloader.includes(item)),
  v316PreservesV313Server:startsThroughV313,
  onePresenceServer:(text.parallelPreloader.match(/createRealtimeWorld\(\)/g) || []).length === 1,
  oneCanonicalScene:/sameSceneBrowserMobileVrMr:true/.test(text.scene) && /sameGeometryEveryEnvironment:true/.test(text.scene),
  sameFloor3Stairs:/sameFloor3StairsEveryEnvironment:true/.test(text.scene) && /buildCanonicalStairs/.test(text.scene),
  canonicalHashAudit:/canonicalHash/.test(text.scene) && /currentHash/.test(text.scene) && /hashesMatch/.test(text.scene),
  repairRunsEveryMode:/function repairCanonical/.test(text.scene) && !/function repairCanonical[\s\S]{0,220}if \(!state\.inXR\)/.test(text.scene),
  modeSpecificGeometryForbidden:/modeSpecificGeometryAllowed:false/.test(text.scene) && /modeSpecificMeshHidingAllowed:false/.test(text.scene),
  oneInteractionPipeline:/oneInteractionPipeline:true/.test(text.interaction) && /sameActionManagerEveryEnvironment:true/.test(text.interaction),
  controllerRayAndGaze:/controllerRayFallback:true/.test(text.interaction) && /gazeFallback:true/.test(text.interaction) && /processTrigger/.test(text.interaction),
  browserMobilePointer:/browserPointer:true/.test(text.interaction) && /mobileTouch:true/.test(text.interaction),
  realtimeBidirectional:/browserToVr:true/.test(text.realtime) && /vrToBrowser:true/.test(text.realtime) && /new EventSource/.test(text.realtime),
  socialLoaderUsesParallelScene:text.socialLoader.includes('ucan_v313_parallel_scene.js'),
  socialLoaderUsesParallelInteraction:text.socialLoader.includes('ucan_v313_parallel_interaction.js'),
  socialLoaderDoesNotLoadDuplicateXrEntry:!text.socialLoader.includes('ucan_v313_xr_entry.js'),
  upperLayerOwnsXrEntry:text.upperPreloader.includes('legacyV313XrEntryLoaded:false') && text.upperPreloader.includes('defaultBabylonXrButtonDisabled:true'),
  persistencePreserved:/MAX_BACKUPS = 60/.test(text.persistence) && text.parallelPreloader.includes('installPersistentIdentity'),
  dockerStartsParallelStack:text.docker.includes('./auth-compat-v316-complete-audit.js') && startsThroughV313,
  packageStartsParallelStack:String(pkg.scripts?.start || '').includes('auth-compat-v316-complete-audit.js') && startsThroughV313,
  packageChecksV313:String(pkg.scripts?.check || '').includes('ucan_v313_parallel_scene.js') && String(pkg.scripts?.check || '').includes('ucan_v313_parallel_interaction.js'),
  packageTestsV313:String(pkg.scripts?.test || '').includes('audit:v313')
};

for (const key of ['parallelPreloader','upperPreloader','socialLoader','scene','interaction']) {
  try { new Function(text[key]); }
  catch (error) {
    checks[`${key}Syntax`] = false;
    checks[`${key}SyntaxError`] = error.message;
  }
}

const failed = Object.entries(checks).filter(([, value]) => value !== true);
const report = {
  version:'V313',
  revision:'R17',
  activeUpperLayer:'V316 R20',
  build:'V313-20260729-PARALLEL-ENVIRONMENTS-R17',
  ok:failed.length === 0,
  checks,
  failed:failed.map(([name, value]) => ({ name, value }))
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
