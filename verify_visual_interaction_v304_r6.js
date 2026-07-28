'use strict';

const fs = require('fs');

const runtime = fs.readFileSync('public/js/ucan_v304_signs_terrace_interaction_r6.js', 'utf8');
const loader = fs.readFileSync('public/js/ucan_v266_keyboard_jump.js', 'utf8');
const preloader = fs.readFileSync('auth-compat-v304-r6.js', 'utf8');
const r5Preloader = fs.readFileSync('auth-compat-v304-r5.js', 'utf8');
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
  version:runtime.includes("const REVISION = 'R6'") && runtime.includes('V304-20260728-UPRIGHT-SIGNS-TERRACE-XR-INTERACTION-R6'),
  copiedCanvas:runtime.includes('ctx.drawImage(source, 0, 0, size.width, size.height)') && runtime.includes('record.texture.update(true)'),
  sourceTexturePreserved:runtime.includes('findSourceTexture(record.source)') && runtime.includes('sourceCanvas(sourceTexture)'),
  twoFrontFaces:runtime.includes('sideOrientation:B.Mesh.FRONTSIDE') && runtime.includes("'hacia centro'") && runtime.includes("'hacia exterior'"),
  noBillboard:runtime.includes('face.billboardMode = B.Mesh.BILLBOARDMODE_NONE') && runtime.includes('signsBillboardDisabled:true'),
  uprightRotation:runtime.includes('face.rotation.set(0, angle, 0)') && runtime.includes('face.rotation.x = 0') && runtime.includes('face.rotation.z = 0'),
  legacyFacesSuppressed:runtime.includes('globalBoardFaceV304R5') && runtime.includes('holidayBoardPuertoRicoV304R4') && runtime.includes('hiddenByCorrectedBoardV304R6'),
  allThreeBoards:runtime.includes("'season-current-v304'") && runtime.includes("'pr-celebration-v304'") && runtime.includes("'four-seasons-v304'"),
  triggerSelection:runtime.includes("selectFromController(controller, 'trigger')"),
  joystickSelection:runtime.includes("selectFromController(controller, 'joystick')"),
  primarySelection:runtime.includes("selectFromController(controller, 'primary')"),
  controllerRay:runtime.includes('controllerRay(controller)') && runtime.includes('pickFromRay(controllerRay(controller))'),
  gazeFallback:runtime.includes('headGazeRay()') && runtime.includes('gazeFallbackSelections'),
  wideCelestialCone:runtime.includes("type === 'celestial' ? 21 * Math.PI / 180 : 13 * Math.PI / 180"),
  ownXRPanel:runtime.includes("new B.TransformNode('Panel información terraza R6'") && runtime.includes('state.infoTexture.update(true)'),
  panelFrontBack:runtime.includes("['frente', -0.015, 0]") && runtime.includes("['reverso', 0.015, Math.PI]"),
  bYClose:runtime.includes("hand === 'right' ? ['b-button'] : ['y-button']") && runtime.includes('closeR6Info()'),
  skyDataIntegration:runtime.includes("window.__UCAN_INTERACTIVE_SKY__?.getObjects?.()") && runtime.includes('metadata.celestialData = entry'),
  universalIntegration:runtime.includes("window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.openPanelByMesh?.(face)"),
  infoTextureFix:runtime.includes('contenido ventana universal V292|panel cielo optimizado V287') && runtime.includes('texture.update?.(true)'),
  throttledFrame:runtime.includes('CONTROLLER_POLL_MS = 80') && runtime.includes('CANDIDATE_REFRESH_MS = 1700') && runtime.includes('SIGN_REFRESH_MS = 2500'),
  loaderR6:loader.includes('/js/ucan_v304_signs_terrace_interaction_r6.js?build=V304-20260728-UPRIGHT-SIGNS-TERRACE-XR-INTERACTION-R6'),
  loaderOrder:loader.indexOf('ucan_v304_global_glass_signs_r5.js') < loader.indexOf('ucan_v304_signs_terrace_interaction_r6.js'),
  preloaderChain:preloader.includes("require('./auth-compat-v304-r5.js')") && r5Preloader.includes("require('./auth-compat-v304-r4.js')"),
  preloaderCacheBust:preloader.includes('V304-20260728-R6-SIGNS-TERRACE-LOADER'),
  versionFlags:preloader.includes('seasonalSignsDynamicTextureInvertY') && preloader.includes('terraceJoystickSelectionR6'),
  packageStart:pkg.scripts?.start === 'node -r ./auth-compat-v304-r6.js server.js',
  packageCheck:pkg.scripts?.check?.includes('public/js/ucan_v304_signs_terrace_interaction_r6.js') === true,
  packageAudit:pkg.scripts?.['audit:visual-interaction-v304-r6'] === 'node verify_visual_interaction_v304_r6.js',
  packageTest:pkg.scripts?.test?.includes('audit:visual-interaction-v304-r6') === true,
  dockerPreloader:docker.includes('"./auth-compat-v304-r6.js"')
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
