'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const files = {
  preloader:path.join(root, 'auth-compat-v318-stairs.js'),
  loader:path.join(root, 'public/js/ucan_v318_social_loader.js'),
  runtime:path.join(root, 'public/js/ucan_v318_stairs_all_environments.js'),
  floorController:path.join(root, 'public/js/ucan_v318_floor_route_controller.js'),
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
  [-22.8, -17.2],
  [-10.8, -5.2],
  [-36.8, -31.2],
  [-28.8, -23.2]
];
const overlap = (a, b) => Math.max(a[0], b[0]) <= Math.min(a[1], b[1]);

const checks = {
  filesExist:Object.values(files).every(fs.existsSync),
  preloaderSyntax:true,
  loaderSyntax:true,
  runtimeSyntax:true,
  floorControllerSyntax:true,
  version:/const VERSION = 'V318'/.test(text.preloader) && /const REVISION = 'R22'/.test(text.preloader),
  preloaderTransformsThreeSources:/ucan_babylon_mall_v265_accounts_avatars\.js/.test(text.preloader) && /ucan_v316_complete_browser_vr_audit\.js/.test(text.preloader) && /ucan_v313_parallel_scene\.js/.test(text.preloader),
  baseSceneWidthPatched:/const width = 5\.2/.test(text.baseScene) && /const width = 8\.4/.test(text.preloader),
  rooftopLandingsPatched:/10\.6, 0\.12, 5\.4/.test(text.preloader),
  frontVoidGlassRemovedAtSource:/baranda cristal hueco norte premium/.test(text.baseScene) && /baranda cristal hueco norte premium/.test(text.preloader) && /baranda cristal hueco sur premium/.test(text.preloader),
  allEnvironmentGlassRuntime:/allFrontEscalatorGlassRemoved:true/.test(text.runtime) && /frontEscalatorGlassRemovedV318:true/.test(text.runtime),
  exactControllerRoutes:(text.floorController.match(/id:'(?:up12|down21|up23|down32)'/g) || []).length === 4,
  controllerRoutesDoNotOverlap:!overlap(routeRanges[0], routeRanges[2]) && !overlap(routeRanges[0], routeRanges[3]) && !overlap(routeRanges[1], routeRanges[2]) && !overlap(routeRanges[1], routeRanges[3]),
  controllerUsesExactRanges:routeRanges.every(([min, max]) => text.floorController.includes(`minX:${min}, maxX:${max}`)),
  oneRouteAtATime:/oneRouteAtATime:true/.test(text.floorController) && /routeSelectionByCurrentFloor:true/.test(text.floorController),
  floorOneOnlyUp12:/fromFloor:0, toFloor:8\.2/.test(text.floorController),
  floorTwoRoutesSeparated:/id:'down21', fromFloor:8\.2, toFloor:0/.test(text.floorController) && /id:'up23', fromFloor:8\.2, toFloor:16\.4/.test(text.floorController),
  automaticP1P3Forbidden:/automaticFloor1ToFloor3:false/.test(text.floorController) && /floor1ToFloor2StopsAtFloor2:true/.test(text.floorController),
  postFrameFloorCorrection:/onBeforeRenderObservable\.add/.test(text.floorController) && /synchronizeCameras/.test(text.floorController),
  oldBroadRoutesPatched:/minX:-25\.8, maxX:-14\.2/.test(text.locomotion) && /minX:-39\.8, maxX:-28\.2/.test(text.locomotion) && /patchLocomotion/.test(text.preloader),
  rooftopCanonicalWidthPatched:/minX:39\.5, maxX:48\.5/.test(text.preloader),
  socialLoadsFloorController:text.loader.includes('/js/ucan_v318_floor_route_controller.js?build=V318-20260730-FLOOR-ROUTE-CONTROLLER-R22'),
  socialLoadOrder:text.loader.indexOf('chain(loadParallelScene') >= 0 && text.loader.indexOf('chain(loadStairRules') > text.loader.indexOf('chain(loadParallelScene') && text.loader.indexOf('chain(loadFloorRouteController') > text.loader.indexOf('chain(loadStairRules') && text.loader.indexOf('chain(loadVoiceBridge') > text.loader.indexOf('chain(loadFloorRouteController'),
  persistencePreserved:/MAX_BACKUPS = 60/.test(text.persistence) && text.preloader.includes("require('./auth-compat-v313-parallel.js')"),
  dockerStartsV318:text.docker.includes('./auth-compat-v318-stairs.js'),
  packageStartsV318:String(pkg.scripts?.start || '').includes('auth-compat-v318-stairs.js'),
  packageChecksV318:String(pkg.scripts?.check || '').includes('ucan_v318_stairs_all_environments.js') && String(pkg.scripts?.check || '').includes('ucan_v318_floor_route_controller.js') && String(pkg.scripts?.check || '').includes('verify_v318_stairs.js'),
  packageRunsV318:String(pkg.scripts?.test || '').includes('audit:v318')
};

for (const key of ['preloader','loader','runtime','floorController']) {
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
