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

const checks = {
  syntaxValid,
  version:/const VERSION = 'V292'/.test(source),
  build:/V292-20260721-UNIVERSAL-SIGN-WINDOW-CLOCK/.test(source),
  universalWindow:/Ventana universal V292/.test(source),
  separateFrontSurface:/ventana universal frente V292/.test(source) && /sideOrientation:B\.Mesh\.FRONTSIDE/.test(source),
  separateBackSurface:/ventana universal reverso V292/.test(source) && /back\.rotation\.y = Math\.PI/.test(source),
  noDoubleSidedInformationPlane:!(/ventana universal frente V292[\s\S]{0,250}DOUBLESIDE/.test(source)),
  closeButtonFront:/botón cerrar universal frente V292/.test(source),
  closeButtonBack:/botón cerrar universal reverso V292/.test(source),
  closeMetadata:/ucanUniversalCloseV292:true/.test(source),
  desktopCloseButton:/id="ucanUniversalCloseV292"/.test(source),
  escapeClose:/event\.key === 'Escape'/.test(source),
  triggerActivation:/triggerPressed/.test(source) && /buttons\?\.\[0\]/.test(source),
  joystickClickActivation:/joystickPressed/.test(source) && /buttons\?\.\[3\]/.test(source),
  primaryButtonActivation:/primaryPressed/.test(source) && /buttons\?\.\[4\]/.test(source),
  livePanelDetection:/metadata\.livePanel \|\| metadata\.livePanelKey/.test(source),
  livePanelCopiesActualCanvas:/texture\?\.getContext\?\.\(\)\?\.canvas/.test(source) && /ctx\.drawImage\(info\.canvas/.test(source),
  celestialInformation:/function celestialInfo/.test(source) && /allCelestialEntries/.test(source),
  longControllerRay:/const RAY_LENGTH = 265/.test(source),
  angularCelestialFallback:/function angularCelestialPick/.test(source),
  legacyWindowsSuppressed:/Ventana información XR V290/.test(source) && /Ventana celeste compacta V288/.test(source),
  browserPointerSupport:/scene\.onPointerObservable\.add/.test(source),
  xrControllerSupport:/function pollControllers/.test(source),
  clockRelocated:/new B\.Vector3\(-17, LEVEL_ROOFTOP \+ 4\.55, 49\.0\)/.test(source),
  clockMeshesUpdated:/clock\.meshes\.front\.position\.copyFrom/.test(source) && /clock\.meshes\.back\.position\.copyFrom/.test(source),
  originalClockWasFloorOne:/Reloj San Germán'[\s\S]{0,180}LEVEL\.one \+ 5\.1/.test(main),
  authLoadsV292:/ucan_v292_universal_sign_window\.js/.test(auth),
  authVersionFlag:/universalSignVersion = 'V292'/.test(auth),
  authMirroredFlag:/mirroredInformationFixed = true/.test(auth),
  authClockFlag:/rooftopClockRelocated = true/.test(auth),
  headerFlag:/X-UCAN-XR-UI/.test(auth),
  packageCheck:pkg.scripts?.check?.includes('ucan_v292_universal_sign_window.js') === true,
  packageAudit:pkg.scripts?.['audit:universal-signs'] === 'node verify_universal_signs_v292.js'
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V292', build:'V292-20260721-UNIVERSAL-SIGN-WINDOW-CLOCK', checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
