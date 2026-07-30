'use strict';

const fs = require('fs');
const path = require('path');
const root = __dirname;
const files = {
  authority:path.join(root, 'public/js/ucan_v321_stair_authority.js'),
  loader:path.join(root, 'public/js/ucan_v321_social_loader.js'),
  preloader:path.join(root, 'auth-compat-v321-stair-authority.js'),
  base:path.join(root, 'public/js/ucan_babylon_mall_v265_accounts_avatars.js'),
  locomotion:path.join(root, 'public/js/ucan_v316_complete_browser_vr_audit.js'),
  docker:path.join(root, 'Dockerfile'),
  package:path.join(root, 'package.json')
};
const text = Object.fromEntries(Object.entries(files).map(([key,file]) => [key, fs.readFileSync(file, 'utf8')]));
const pkg = JSON.parse(text.package);
const routeIds = ['up12','down21','up23','down32','up34','down34'];

const checks = {
  filesExist:Object.values(files).every(fs.existsSync),
  authoritySyntax:true,
  loaderSyntax:true,
  preloaderSyntax:true,
  sixRoutes:routeIds.every(id => text.authority.includes(`id:'${id}'`)),
  oneAuthority:/singleStairAuthority:true/.test(text.authority),
  stableFloorOnly:/stableFloorOnlyChangesByRouteOrExplicitNavigation:true/.test(text.authority),
  intentionalDirection:/intentionalDirectionRequired:true/.test(text.authority) && /intendedDirection/.test(text.authority),
  routeCompletion:/COMPLETION_THRESHOLD = 0\.965/.test(text.authority) && /finishRoute\(route, position\)/.test(text.authority),
  landingCorrection:/pendingLanding/.test(text.authority) && /applyPendingLanding/.test(text.authority),
  allCorridorsCleared:/clearAllStairCorridors/.test(text.authority) && /hiddenFrontGlass/.test(text.authority) && /clearedCollisions/.test(text.authority),
  aliasesPreserved:/__UCAN_FLOOR_ROUTE_CONTROLLER_V320__ = api/.test(text.authority) && /__UCAN_FLOOR_ROUTE_CONTROLLER_V319__ = api/.test(text.authority),
  loaderUsesAuthority:/ucan_v321_stair_authority\.js\?build=V321/.test(text.loader),
  loaderNoOldFloorController:!text.loader.includes('ucan_v320_floor_lock_controller.js?') && !text.loader.includes('ucan_v319_floor_route_controller.js?') && !text.loader.includes('ucan_v318_floor_route_controller.js?'),
  sourcePatchDisablesEscalatorRide:/setupEscalatorRide\(scene, camera\);[\s\S]*__UCAN_LEGACY_ESCALATOR_RIDE_DISABLED_V321__/.test(text.preloader),
  sourcePatchDisablesReliableMovement:/setupReliableMovement\(scene, camera\);[\s\S]*__UCAN_LEGACY_RELIABLE_MOVEMENT_DISABLED_V321__/.test(text.preloader),
  sourcePatchDisablesClamp:/clampCameraHeight\(camera\)[\s\S]*__UCAN_LEGACY_CLAMP_HEIGHT_DISABLED_V321__/.test(text.preloader),
  locomotionDelegates:/__UCAN_STAIR_AUTHORITY_V321__\?\.resolveGround/.test(text.preloader),
  explicitNavigation:/setFloor\?\.\(state\.ground, 'panel-navigation'\)/.test(text.preloader),
  explicitTeleport:/setFloor\?\.\(state\.floor, 'teleport'\)/.test(text.preloader),
  explicitReset:/setFloor\?\.\(floor, 'reset'\)/.test(text.preloader),
  versionFlags:/legacyEscalatorRideDisabled:true/.test(text.preloader) && /legacyReliableMovementDisabled:true/.test(text.preloader) && /legacyClampCameraHeightDisabled:true/.test(text.preloader),
  dockerStartsV321:text.docker.includes('auth-compat-v321-stair-authority.js'),
  packageStartsV321:String(pkg.scripts?.start || '').includes('auth-compat-v321-stair-authority.js'),
  packageChecksV321:String(pkg.scripts?.check || '').includes('ucan_v321_stair_authority.js') && String(pkg.scripts?.check || '').includes('auth-compat-v321-stair-authority.js'),
  packageRunsV321:String(pkg.scripts?.test || '').includes('audit:v321'),
  baseActuallyContainsLegacyConflict:text.base.includes('setupEscalatorRide(scene, camera);') && text.base.includes('setupReliableMovement(scene, camera);') && text.base.includes('clampCameraHeight(camera)'),
  runtimeActuallyContainsSecondEngine:/function updateMovement/.test(text.locomotion) && /moveHorizontal\(camera, step\)/.test(text.locomotion)
};

for (const key of ['authority','loader','preloader']) {
  try { new Function(text[key]); }
  catch (error) { checks[`${key}Syntax`] = false; checks[`${key}SyntaxError`] = error.message; }
}

const failed = Object.entries(checks).filter(([,value]) => value !== true);
const report = {
  version:'V321',
  revision:'R25',
  build:'V321-20260730-SINGLE-STAIR-AUTHORITY-R25',
  ok:failed.length === 0,
  finding:'El archivo base ejecutaba setupEscalatorRide, setupReliableMovement y clampCameraHeight al mismo tiempo que V316/V320.',
  checks,
  failed:failed.map(([name,value]) => ({ name,value })),
  physicalValidationRequired:[
    'Recorrer up12 y down21 en browser.',
    'Recorrer up23 y down32 en browser.',
    'Recorrer up34 y down34 en browser.',
    'Repetir las seis rutas en Meta Quest.',
    'Confirmar que no hay movimiento automático al acercarse a una escalera.',
    'Confirmar que cada ruta termina en su piso correcto y permite continuar caminando.'
  ]
};
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
