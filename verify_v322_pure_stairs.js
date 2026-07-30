'use strict';

// Segunda ejecución CI limpia de la revisión V322 R26.
const fs = require('fs');
const path = require('path');
const root = __dirname;
const files = {
  authority:path.join(root, 'public/js/ucan_v322_stair_authority.js'),
  visual:path.join(root, 'public/js/ucan_v322_visual_comfort.js'),
  loader:path.join(root, 'public/js/ucan_v322_social_loader.js'),
  preloader:path.join(root, 'auth-compat-v322-pure-stairs.js'),
  base:path.join(root, 'public/js/ucan_babylon_mall_v265_accounts_avatars.js'),
  locomotion:path.join(root, 'public/js/ucan_v316_complete_browser_vr_audit.js'),
  docker:path.join(root, 'Dockerfile'),
  package:path.join(root, 'package.json')
};
const text = Object.fromEntries(Object.entries(files).map(([key,file]) => [key, fs.readFileSync(file, 'utf8')]));
const pkg = JSON.parse(text.package);
const routes = ['up12','down21','up23','down32','up34','down34'];
const cameraWrite = /(?:camera|xr|desktop)\.position(?:\.[xyz])?\s*=(?!=)|(?:camera|xr|desktop)\.position\.(?:set|copyFrom|addInPlace)\s*\(/;

const checks = {
  filesExist:Object.values(files).every(fs.existsSync),
  authoritySyntax:true,
  visualSyntax:true,
  loaderSyntax:true,
  preloaderSyntax:true,
  sixRoutes:routes.every(id => text.authority.includes(`id:'${id}'`)),
  pureGroundProvider:/pureGroundProvider:true/.test(text.authority),
  authorityDoesNotMoveCamera:!cameraWrite.test(text.authority),
  authorityHasNoRenderLoop:!/onBeforeRenderObservable\.add/.test(text.authority),
  noForcedLanding:/forcedLandingTeleport:false/.test(text.authority) && !/pendingLanding/.test(text.authority) && !/applyPendingLanding/.test(text.authority),
  oneGroundResolutionPatch:/groundResolvedOncePerMovementFrame:true/.test(text.preloader) && text.preloader.includes('state.ground ya fue resuelto una vez'),
  runtimeDelegatesOnlyV322:/__UCAN_STAIR_AUTHORITY_V322__/.test(text.preloader) && !/__UCAN_STAIR_AUTHORITY_V321__/.test(text.preloader),
  loaderNoV318:!text.loader.includes('/js/ucan_v318_stairs_all_environments.js'),
  loaderNoV319:!text.loader.includes('/js/ucan_v319_vr_accessibility.js'),
  loaderNoV321:!text.loader.includes('/js/ucan_v321_stair_authority.js'),
  visualDoesNotMoveCamera:/movesCamera:false/.test(text.visual) && !cameraWrite.test(text.visual),
  legacyBaseCallsRemovedAtResponse:text.preloader.includes('setupEscalatorRide(scene, camera);') && text.preloader.includes('__UCAN_LEGACY_ESCALATOR_RIDE_DISABLED_V322__') && text.preloader.includes('__UCAN_LEGACY_RELIABLE_MOVEMENT_DISABLED_V322__') && text.preloader.includes('__UCAN_LEGACY_CLAMP_HEIGHT_DISABLED_V322__'),
  baseStillContainsLegacySource:text.base.includes('setupEscalatorRide(scene, camera);') && text.base.includes('setupReliableMovement(scene, camera);') && text.base.includes('clampCameraHeight(camera)'),
  runtimeSourceContainsDuplicateBeforePatch:text.locomotion.includes('state.ground = groundFor(state.desktop.position);'),
  authorityLoadedBeforeBase:text.preloader.indexOf('data-ucan-v322-stair-authority') < text.preloader.indexOf('$1`'),
  versionFlags:/legacyV318CameraGuardLoaded:false/.test(text.preloader) && /legacyV319LandingLayerLoaded:false/.test(text.preloader) && /legacyV321CameraSynchronizerLoaded:false/.test(text.preloader),
  dockerStartsV322:text.docker.includes('auth-compat-v322-pure-stairs.js'),
  packageStartsV322:String(pkg.scripts?.start || '').includes('auth-compat-v322-pure-stairs.js'),
  packageChecksV322:String(pkg.scripts?.check || '').includes('ucan_v322_stair_authority.js') && String(pkg.scripts?.check || '').includes('ucan_v322_visual_comfort.js') && String(pkg.scripts?.check || '').includes('auth-compat-v322-pure-stairs.js'),
  packageRunsV322:String(pkg.scripts?.test || '').includes('audit:v322')
};

for (const key of ['authority','visual','loader','preloader']) {
  try { new Function(text[key]); }
  catch (error) { checks[`${key}Syntax`] = false; checks[`${key}SyntaxError`] = error.message; }
}

const failures = Object.entries(checks).filter(([,value]) => value !== true);
const report = {
  version:'V322', revision:'R26', build:'V322-20260730-PURE-STAIR-GROUND-AUTHORITY-R26',
  ok:failures.length === 0,
  finding:'V321 todavía cargaba V318, que ejecutaba synchronizeFloorTwo() y movía las cámaras en cada cuadro. V322 elimina V318/V319 y deja una sola llamada de resolveGround dentro del motor V316.',
  checks,
  failures:failures.map(([name,value]) => ({ name,value }))
};
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
