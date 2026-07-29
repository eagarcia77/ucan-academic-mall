'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const files = {
  server:path.join(root, 'lib/realtime-world-v312.js'),
  scene:path.join(root, 'public/js/ucan_v312_vr_canonical_scene.js'),
  client:path.join(root, 'public/js/ucan_v312_realtime_world.js'),
  loader:path.join(root, 'public/js/ucan_v266_keyboard_jump.js'),
  preloader:path.join(root, 'auth-compat-v312-vr-canonical.js'),
  docker:path.join(root, 'Dockerfile'),
  persistence:path.join(root, 'lib/persistent-identity-v311.js'),
  package:path.join(root, 'package.json')
};

const text = Object.fromEntries(Object.entries(files).map(([key,file]) => [key, fs.readFileSync(file, 'utf8')]));
const pkg = JSON.parse(text.package);

const checks = {
  filesExist:Object.values(files).every(fs.existsSync),
  serverSyntax:true,
  sceneSyntax:true,
  clientSyntax:true,
  loaderSyntax:true,
  preloaderSyntax:true,
  vrIsAuthoritative:/authoritativeEnvironment:'VR'/.test(text.scene) && /browserUsesVrEnvironment:true/.test(text.scene),
  canonicalFloor3Stairs:/floor3StairsCanonicalVr:true/.test(text.scene) && /buildCanonicalStairRailings/.test(text.scene),
  exactVrRailCoordinates:/STAIR\.minX \+ 0\.34/.test(text.scene) && /STAIR\.maxX - 0\.34/.test(text.scene),
  canonicalTerrace:/buildCanonicalTerraceFloor/.test(text.scene) && /vrCanonicalTerraceFloorV312:true/.test(text.scene),
  appliesOutsideXr:/function applyCanonicalVrEnvironment/.test(text.scene) && !/if \(!state\.inXR\)/.test(text.scene),
  realtimeSseServer:/text\/event-stream/.test(text.server) && /broadcastSnapshot/.test(text.server) && /broadcastEvent/.test(text.server),
  realtimeSseClient:/new EventSource/.test(text.client) && /pollingFallback:true/.test(text.client),
  crossEnvironmentAvatars:/remoteAvatarV312:true/.test(text.client) && /browserToVr:true/.test(text.client) && /vrToBrowser:true/.test(text.client),
  robustUserFallback:/\/api\/auth\/me/.test(text.client),
  loaderUsesV312Scene:text.loader.includes('/js/ucan_v312_vr_canonical_scene.js?build=V312-20260729-VR-CANONICAL-SCENE-R16'),
  loaderUsesV312Realtime:text.loader.includes('/js/ucan_v312_realtime_world.js?build=V312-20260729-VR-CANONICAL-REALTIME-WORLD-R16'),
  loaderDoesNotUseV311Client:!text.loader.includes('ucan_v311_unified_world.js'),
  v312SceneLoadsBeforeParity:text.loader.indexOf('loadVrCanonicalSceneV312') < text.loader.indexOf('loadStrictParityV309') && text.loader.indexOf('chain(loadVrCanonicalSceneV312') < text.loader.indexOf('chain(loadStrictParityV309'),
  preloaderExposesV312:text.preloader.includes("architecture:'vr-canonical-one-scene-realtime'") && text.preloader.includes('sameFloor3StairsBrowserVr:true'),
  persistencePreserved:text.preloader.includes("require('./auth-compat-v311-unified.js')") && /MAX_BACKUPS = 60/.test(text.persistence),
  dockerStartsV312:text.docker.includes('./auth-compat-v312-vr-canonical.js'),
  packageStartsV312:String(pkg.scripts?.start || '').includes('auth-compat-v312-vr-canonical.js'),
  packageChecksV312:String(pkg.scripts?.check || '').includes('realtime-world-v312.js') && String(pkg.scripts?.check || '').includes('ucan_v312_vr_canonical_scene.js') && String(pkg.scripts?.check || '').includes('ucan_v312_realtime_world.js'),
  packageTestsV312:String(pkg.scripts?.test || '').includes('audit:v312')
};

for (const key of ['server','scene','client','loader','preloader']) {
  try { new Function(text[key]); }
  catch (error) {
    checks[`${key}Syntax`] = false;
    checks[`${key}SyntaxError`] = error.message;
  }
}

const failed = Object.entries(checks).filter(([,value]) => value !== true);
const report = {
  version:'V312',
  revision:'R16',
  build:'V312-20260729-VR-CANONICAL-REALTIME-WORLD-R16',
  ok:failed.length === 0,
  checks,
  failed:failed.map(([name,value]) => ({ name,value }))
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
