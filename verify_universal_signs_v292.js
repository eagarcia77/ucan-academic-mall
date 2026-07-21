'use strict';

const fs = require('fs');

const source = fs.readFileSync('public/js/ucan_v292_universal_sign_window.js', 'utf8');
const auth = fs.readFileSync('auth-compat-v287.js', 'utf8');
const main = fs.readFileSync('public/js/ucan_babylon_mall_v265_accounts_avatars.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let syntaxError = null;
try {
  new Function(source);
  syntaxValid = true;
} catch (error) {
  syntaxError = error.message;
}

const essential = {
  syntaxValid,
  version:source.includes("const VERSION = 'V292'"),
  build:source.includes('V292-20260721-UNIVERSAL-SIGN-WINDOW-CLOCK'),
  universalWindow:source.includes("new B.TransformNode('Ventana universal V292'"),
  separateFrontSurface:source.includes("CreatePlane('ventana universal frente V292'") && source.includes('sideOrientation:B.Mesh.FRONTSIDE'),
  separateBackSurface:source.includes("CreatePlane('ventana universal reverso V292'") && source.includes('back.rotation.y = Math.PI'),
  closeButtonFront:source.includes("['frente', -0.04, 0]"),
  closeButtonBack:source.includes("['reverso', 0.04, Math.PI]"),
  closeMetadata:source.includes('ucanUniversalCloseV292:true'),
  desktopCloseButton:source.includes('id="ucanUniversalCloseV292"'),
  escapeClose:source.includes("event.key === 'Escape'"),
  triggerActivation:source.includes('const triggerPressed = Boolean'),
  joystickClickActivation:source.includes('const joystickPressed = Boolean') && source.includes('pad?.buttons?.[3]'),
  primaryButtonActivation:source.includes('const primaryPressed = Boolean') && source.includes('pad?.buttons?.[4]'),
  livePanelDetection:source.includes('metadata.livePanel || metadata.livePanelKey'),
  livePanelCopiesActualCanvas:source.includes('texture?.getContext?.()?.canvas') && source.includes('ctx.drawImage(info.canvas'),
  celestialInformation:source.includes('function celestialInfo') && source.includes('allCelestialEntries'),
  longControllerRay:source.includes('const RAY_LENGTH = 265'),
  angularCelestialFallback:source.includes('function angularCelestialPick'),
  legacyWindowsSuppressed:source.includes('Ventana información XR V290') && source.includes('Ventana celeste compacta V288'),
  browserPointerSupport:source.includes('scene.onPointerObservable.add'),
  xrControllerSupport:source.includes('function pollControllers'),
  clockRelocated:source.includes('new B.Vector3(-17, LEVEL_ROOFTOP + 4.55, 49.0)'),
  clockMeshesUpdated:source.includes('clock.meshes.front.position.copyFrom') && source.includes('clock.meshes.back.position.copyFrom'),
  authLoadsV292:auth.includes('ucan_v292_universal_sign_window.js'),
  authVersionFlag:auth.includes("data.universalSignVersion = 'V292'"),
  authMirroredFlag:auth.includes('data.mirroredInformationFixed = true'),
  authClockFlag:auth.includes('data.rooftopClockRelocated = true'),
  headerFlag:auth.includes("'X-UCAN-XR-UI':'V292'") && auth.includes("nextHeaders['X-UCAN-XR-UI'] = 'V292'"),
  packageCheck:pkg.scripts?.check?.includes('ucan_v292_universal_sign_window.js') === true,
  packageAudit:pkg.scripts?.['audit:universal-signs'] === 'node verify_universal_signs_v292.js'
};

const diagnostics = {
  originalClockWasFloorOne:main.includes("'Reloj San Germán', 5.8, 2.8, new BABYLON.Vector3(0, LEVEL.one + 5.1, 51.2)"),
  noDoubleSidedInformationPlane:!source.includes("ventana universal frente V292', { width:3.05, height:1.92, sideOrientation:B.Mesh.DOUBLESIDE"),
  universalAuditObject:source.includes('window.__UCAN_UNIVERSAL_SIGN_AUDIT__'),
  universalApiObject:source.includes('window.__UCAN_UNIVERSAL_SIGN_WINDOW__')
};

const ok = Object.values(essential).every(Boolean);
console.log(JSON.stringify({ ok, version:'V292', build:'V292-20260721-UNIVERSAL-SIGN-WINDOW-CLOCK', essential, diagnostics, syntaxError }, null, 2));
if (!ok) process.exit(1);
