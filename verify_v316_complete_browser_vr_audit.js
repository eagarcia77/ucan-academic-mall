'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const files = {
  preloader:path.join(root, 'auth-compat-v316-complete-audit.js'),
  runtime:path.join(root, 'public/js/ucan_v316_complete_browser_vr_audit.js'),
  loader:path.join(root, 'public/js/ucan_v316_social_loader.js'),
  parallelPreloader:path.join(root, 'auth-compat-v313-parallel.js'),
  parallelScene:path.join(root, 'public/js/ucan_v313_parallel_scene.js'),
  interaction:path.join(root, 'public/js/ucan_v313_parallel_interaction.js'),
  realtime:path.join(root, 'public/js/ucan_v312_realtime_world.js'),
  renderParity:path.join(root, 'public/js/ucan_v314_render_parity.js'),
  persistence:path.join(root, 'lib/persistent-identity-v311.js'),
  docker:path.join(root, 'Dockerfile'),
  package:path.join(root, 'package.json')
};

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
const pkg = JSON.parse(text.package);

const checks = {
  filesExist:Object.values(files).every(fs.existsSync),
  preloaderSyntax:true,
  runtimeSyntax:true,
  loaderSyntax:true,
  cleanServerBase:text.preloader.includes("require('./auth-compat-v313-parallel.js')") && !text.preloader.includes("require('./auth-compat-v315-floors-joystick.js')"),
  runtimeInsertedBeforeScene:text.preloader.includes('ucan_babylon_mall_v265_accounts_avatars.js') && text.preloader.includes('data-ucan-v316-complete-audit'),
  oldLocomotionRemoved:['ucan_v272_xr_desktop_parity.js','ucan_v304_xr_entry_mr_fix.js','ucan_v315_unified_floors_joystick.js','ucan_v266_keyboard_jump.js'].every(item => text.preloader.includes(item)),
  duplicateXrEntryRemoved:text.preloader.includes('ucan_v313_xr_entry.js') && !text.loader.includes('ucan_v313_xr_entry.js'),
  defaultXrUiDisabled:/disableDefaultUI:true/.test(text.runtime) && /enterExitUI\?\.dispose/.test(text.runtime),
  greenButtonRemoval:/webxr-enter-exit-button/.test(text.runtime) && /ucanParallelXrV313/.test(text.runtime),
  oneLocomotionRig:/oneLocomotionRig:true/.test(text.runtime) && /architecture:'one-scene-one-rig-one-panel'/.test(text.runtime),
  fasterNaturalMovement:/natural:6\.4/.test(text.runtime) && /fast:9\.0/.test(text.runtime) && /DEAD_ZONE = 0\.12/.test(text.runtime),
  continuousStairs:/continuousStairMovement:true/.test(text.runtime) && /scriptedStairTransitions:false/.test(text.runtime) && /function rampGround/.test(text.runtime),
  noTimedStairRoute:!text.runtime.includes('duration:5200') && !text.runtime.includes('updateRoute()'),
  cameraAvatarPresenceSync:/avatarCameraPresenceSynchronized:true/.test(text.runtime) && /function synchronizeCameras/.test(text.runtime) && /getAvatarPose/.test(text.runtime),
  joystickMove:/leftJoystickMove:true/.test(text.runtime) && /leftJoystickStrafe:true/.test(text.runtime),
  joystickTurn:/rightJoystickSmoothTurn:true/.test(text.runtime) && /rightJoystickSnapTurn:true/.test(text.runtime),
  joystickTeleport:/rightJoystickTeleport:true/.test(text.runtime) && /function updateTeleport/.test(text.runtime),
  controllerButtons:/xr-standard-trigger/.test(text.runtime) && /a-button/.test(text.runtime) && /b-button/.test(text.runtime) && /xr-standard-squeeze/.test(text.runtime),
  panelCapture:/function installPanelController/.test(text.runtime) && /event\.stopImmediatePropagation/.test(text.runtime),
  panelNavigation:/destinationGo/.test(text.runtime) && /getAttribute\('data-go'\)/.test(text.runtime) && /goToArea/.test(text.runtime),
  uniformQuality:/Calidad: uniforme/.test(text.runtime) && /setHardwareScalingLevel\?\.\(1\)/.test(text.runtime),
  fullFloorAudit:/floorCounts/.test(text.runtime) && /hiddenCounts/.test(text.runtime) && /allCameraLayers/.test(text.runtime),
  socialLoaderPreservesScene:text.loader.includes('ucan_v313_parallel_scene.js') && text.loader.includes('ucan_v312_realtime_world.js'),
  socialLoaderPreservesInteraction:text.loader.includes('ucan_v313_parallel_interaction.js') && text.loader.includes('ucan_v306_voice_xr_bridge.js'),
  persistencePreserved:/MAX_BACKUPS = 60/.test(text.persistence) && text.parallelPreloader.includes('installPersistentIdentity'),
  renderParityPreserved:/VERSION='V314'/.test(text.renderParity) && /fullMeshTransformAudit:true/.test(text.renderParity),
  realtimePreserved:/browserToVr:true/.test(text.realtime) && /vrToBrowser:true/.test(text.realtime),
  packageStartsV316:String(pkg.scripts?.start || '').includes('auth-compat-v316-complete-audit.js'),
  dockerStartsV316:text.docker.includes('auth-compat-v316-complete-audit.js'),
  packageChecksV316:String(pkg.scripts?.check || '').includes('ucan_v316_complete_browser_vr_audit.js') && String(pkg.scripts?.check || '').includes('ucan_v316_social_loader.js'),
  packageTestsV316:String(pkg.scripts?.test || '').includes('audit:v316')
};

for (const key of ['preloader','runtime','loader']) {
  try { new Function(text[key]); }
  catch (error) {
    checks[`${key}Syntax`] = false;
    checks[`${key}SyntaxError`] = error.message;
  }
}

const failed = Object.entries(checks).filter(([, value]) => value !== true);
const report = {
  version:'V316',
  revision:'R20',
  build:'V316-20260729-COMPLETE-BROWSER-VR-AUDIT-R20',
  ok:failed.length === 0,
  checks,
  failed:failed.map(([name, value]) => ({ name, value })),
  physicalValidationRequired:[
    'Desplegar V316 en Render con limpieza de caché.',
    'Comparar los pisos 1, 2 y 3 desde la misma posición en browser y Meta Quest.',
    'Caminar por las cinco rutas entre niveles sin transición automática.',
    'Confirmar que el avatar remoto no queda atrasado al terminar una escalera.',
    'Probar todos los botones del panel izquierdo.',
    'Confirmar que no aparece el botón verde automático de Babylon.'
  ]
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
