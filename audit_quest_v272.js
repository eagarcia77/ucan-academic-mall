const fs=require('fs');
const xr=fs.readFileSync('public/js/ucan_v272_xr_desktop_parity.js','utf8');
const campus=fs.readFileSync('public/campus.html','utf8');
const checks={
  version:/const VERSION = 'V272'/.test(xr),
  build:/V272-20260717-XR-DESKTOP-PARITY-SPEED/.test(xr)&&/V272-20260717-XR-DESKTOP-PARITY-SPEED/.test(campus),
  loaded:/ucan_v272_xr_desktop_parity\.js/.test(campus),
  desktopSpeedParity:/comfort: 3\.4/.test(xr)&&/natural: 5\.0/.test(xr)&&/fast: 7\.0/.test(xr)&&/desktopSpeedParity: true/.test(xr),
  speedMigration:/ucanVrSpeedBuild/.test(xr)&&/initialSpeedMode = 'natural'/.test(xr),
  fastResponse:/ACCELERATION = 22/.test(xr)&&/BRAKING = 26/.test(xr),
  noHeightInference:!/inferredBase/.test(xr)&&/floorInferenceDisabled: true/.test(xr),
  auditoriumFloor3Only:/if \(!same\(state\.stableFloor, LEVEL\.three\)\) return null/.test(xr),
  compatibleStairs:/same\(state\.stableFloor, lane\.low\) \|\| same\(state\.stableFloor, lane\.high\)/.test(xr),
  snapshotBeforeXR:/WebXRState\.ENTERING_XR/.test(xr)&&/before-xr-camera-switch/.test(xr),
  desktopPoseAlignment:/setTransformationFromNonVRCamera/.test(xr)&&/desktopPoseAlignment: true/.test(xr),
  stereoParity:/rigCameras/.test(xr)&&/stereoRigCameraParity: true/.test(xr),
  sameScene:/sameAssetsAsDesktop: true/.test(xr)&&/sameLightingAsDesktop: true/.test(xr),
  materialParity:/capturedMaterials/.test(xr)&&/state\.materials/.test(xr),
  verticalDisabled:/state\.velocity\.y = 0/.test(xr)
};
const ok=Object.values(checks).every(Boolean);
console.log(JSON.stringify({ok,version:'V272',checks},null,2));
if(!ok)process.exit(1);
