'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const files = {
  preloader:path.join(root, 'auth-compat-v318-stairs.js'),
  loader:path.join(root, 'public/js/ucan_v318_social_loader.js'),
  runtime:path.join(root, 'public/js/ucan_v318_stairs_all_environments.js'),
  locomotion:path.join(root, 'public/js/ucan_v316_complete_browser_vr_audit.js'),
  baseScene:path.join(root, 'public/js/ucan_babylon_mall_v265_accounts_avatars.js'),
  canonicalScene:path.join(root, 'public/js/ucan_v313_parallel_scene.js'),
  persistence:path.join(root, 'lib/persistent-identity-v311.js'),
  docker:path.join(root, 'Dockerfile'),
  package:path.join(root, 'package.json')
};

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
const pkg = JSON.parse(text.package);
const routeRanges = [
  [-23.4, -16.6],
  [-11.4, -4.6],
  [-37.4, -30.6],
  [-29.4, -22.6]
];
const overlap = (a, b) => Math.max(a[0], b[0]) <= Math.min(a[1], b[1]);

const checks = {
  filesExist:Object.values(files).every(fs.existsSync),
  preloaderSyntax:true,
  loaderSyntax:true,
  runtimeSyntax:true,
  version:/const VERSION = 'V318'/.test(text.preloader) && /const REVISION = 'R22'/.test(text.preloader),
  preloaderTransformsThreeSources:/ucan_babylon_mall_v265_accounts_avatars\.js/.test(text.preloader) && /ucan_v316_complete_browser_vr_audit\.js/.test(text.preloader) && /ucan_v313_parallel_scene\.js/.test(text.preloader),
  baseSceneWidthPatched:/const width = 5\.2/.test(text.baseScene) && /const width = 8\.4/.test(text.preloader),
  rooftopLandingsPatched:/10\.6, 0\.12, 5\.4/.test(text.preloader),
  frontVoidGlassRemovedAtSource:/baranda cristal hueco norte premium/.test(text.baseScene) && /baranda cristal hueco norte premium/.test(text.preloader) && /baranda cristal hueco sur premium/.test(text.preloader),
  allEnvironmentGlassRuntime:/allFrontEscalatorGlassRemoved:true/.test(text.runtime) && /frontEscalatorGlassRemovedV318:true/.test(text.runtime),
  fourExactEscalatorRoutes:(text.runtime.match(/id:'(?:up12|down21|up23|down32)'/g) || []).length === 4,
  p1p2DoesNotOverlapP2p3:!overlap(routeRanges[0], routeRanges[2]) && !overlap(routeRanges[0], routeRanges[3]) && !overlap(routeRanges[1], routeRanges[2]) && !overlap(routeRanges[1], routeRanges[3]),
  locomotionRangesPatched:routeRanges.every(([min, max]) => text.preloader.includes(`minX:${min}, maxX:${max}`)),
  oldBroadRangesRejected:/minX:-25\.8, maxX:-14\.2/.test(text.locomotion) && /minX:-39\.8, maxX:-28\.2/.test(text.locomotion),
  floorTwoGuard:/FLOOR2_LOCK_MS = 1700/.test(text.runtime) && /protectFloorTwoStop/.test(text.runtime) && /floor1ToFloor2StopsAtFloor2:true/.test(text.runtime),
  actualUp23Required:/inActualUp23/.test(text.runtime) && /-37\.4/.test(text.runtime) && /-30\.6/.test(text.runtime),
  rooftopCanonicalWidthPatched:/minX:39\.5, maxX:48\.5/.test(text.preloader),
  socialLoadOrder:text.loader.indexOf('chain(loadParallelScene') >= 0 && text.loader.indexOf('chain(loadStairRules') > text.loader.indexOf('chain(loadParallelScene') && text.loader.indexOf('chain(loadVoiceBridge') > text.loader.indexOf('chain(loadStairRules'),
  persistencePreserved:/MAX_BACKUPS = 60/.test(text.persistence) && text.preloader.includes("require('./auth-compat-v313-parallel.js')"),
  dockerStartsV318:text.docker.includes('./auth-compat-v318-stairs.js'),
  packageStartsV318:String(pkg.scripts?.start || '').includes('auth-compat-v318-stairs.js'),
  packageChecksV318:String(pkg.scripts?.check || '').includes('ucan_v318_stairs_all_environments.js') && String(pkg.scripts?.check || '').includes('verify_v318_stairs.js'),
  packageRunsV318:String(pkg.scripts?.test || '').includes('audit:v318')
};

for (const key of ['preloader','loader','runtime']) {
  try { new Function(text[key]); }
  catch (error) {
    checks[`${key}Syntax`] = false;
    checks[`${key}SyntaxError`] = error.message;
  }
}

const failed = Object.entries(checks).filter(([, value]) => value !== true);
const report = {
  version:'V318',
  revision:'R22',
  build:'V318-20260730-ISOLATED-ESCALATORS-WIDE-ROOFTOP-R22',
  ok:failed.length === 0,
  checks,
  failed:failed.map(([name, value]) => ({ name, value })),
  physicalValidationRequired:[
    'Subir por up12 y confirmar que termina en Piso 2.',
    'Caminar fuera del descanso de up12 y confirmar que la altura permanece en Piso 2.',
    'Confirmar que up23 solo se activa al entrar en la escalera centrada en x=-34.',
    'Confirmar que no existen cristales atravesando entradas o salidas.',
    'Subir Piso 3→Terraza y comprobar el ancho ampliado.'
  ]
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
