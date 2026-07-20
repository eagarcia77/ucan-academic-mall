const fs = require('fs');

const parity = fs.readFileSync('public/js/ucan_v279_xr_visual_parity.js', 'utf8');
const server = fs.readFileSync('auth-compat-v271.js', 'utf8');
const main = fs.readFileSync('public/js/ucan_babylon_mall_v265_accounts_avatars.js', 'utf8');

const checks = {
  version: /const VERSION = 'V279'/.test(parity) && /V279-20260720-XR-FULL-VISUAL-PARITY/.test(parity),
  loadedByServer: /UCAN_PARITY_SCRIPT/.test(server) && /ucan_v279_xr_visual_parity\.js/.test(server),
  loadedAfterLocomotion: /UCAN_XR_SCRIPT}[\s\S]*UCAN_BLOCKER_SCRIPT}[\s\S]*UCAN_PARITY_SCRIPT}/.test(server),
  snapshotBeforeImmersive: /ENTERING_XR/.test(parity) && /before-immersive-camera-switch/.test(parity),
  sceneObjectParity: /snapshot\.meshes/.test(parity) && /mesh\.isVisible = item\.isVisible/.test(parity) && /mesh\.material = item\.material/.test(parity),
  lightingParity: /snapshot\.lights/.test(parity) && /light\.intensity = item\.intensity/.test(parity),
  environmentParity: /environmentTexture/.test(parity) && /environmentIntensity/.test(parity) && /fogEnabled/.test(parity),
  imageProcessingParity: /image\.exposure = snapshot\.image\.exposure/.test(parity) && /image\.contrast = snapshot\.image\.contrast/.test(parity),
  stereoRigParity: /rigCameras/.test(parity) && /stereoRigCameraParity:true/.test(parity),
  hardwareScalingLock: /__ucanV279OriginalSetHardwareScalingLevel/.test(parity) && /hardwareScalingLockedInXR:true/.test(parity),
  transparentMaterialProtection: /needDepthPrePass = false/.test(parity) && /disableDepthWrite = true/.test(parity) && /MATERIAL_ALPHABLEND/.test(parity),
  blackMaterialRegressionDetected: /needDepthPrePass = true/.test(main) && /blackMaterialProtection:true/.test(parity),
  noUnsafeFramebufferOverride: !/outputCanvasOptions/.test(parity) && !/ignoreNativeCameraTransformation/.test(parity),
  locomotionPreserved: /locomotionControllerPreserved:'V277'/.test(parity) && /ucan_v277_xr_navigation_recovery\.js/.test(server),
  publicAudit: /window\.__UCAN_XR_VISUAL_PARITY__/.test(parity) && /compare:\(\) => compareParity/.test(parity)
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V279', checks }, null, 2));
if (!ok) process.exit(1);
