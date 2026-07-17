const fs=require('fs');
const xr=fs.readFileSync('public/js/ucan_v271_xr_parity_floor_lock.js','utf8');
const campus=fs.readFileSync('public/campus.html','utf8');
const server=fs.readFileSync('server.js','utf8');
const checks={
  version:/VERSION='V271'/.test(xr)&&/UCAN_VERSION = 'V271'/.test(server),
  build:/V271-20260717-XR-PARITY-FLOOR-LOCK/.test(xr)&&/V271-20260717-XR-PARITY-FLOOR-LOCK/.test(campus),
  loaded:/ucan_v271_xr_parity_floor_lock\.js/.test(campus),
  noHeightInference:!/inferredBase/.test(xr)&&/floorInferenceDisabled:true/.test(xr),
  auditoriumFloor3Only:/if\(!same\(state\.stableFloor,LEVEL\.three\)\)return null/.test(xr),
  compatibleStairs:/same\(state\.stableFloor,l\.low\)\|\|same\(state\.stableFloor,l\.high\)/.test(xr),
  explicitTransition:/origin:state\.stableFloor/.test(xr)&&/state\.transition/.test(xr),
  snapshotBeforeXR:/WebXRState\.ENTERING_XR/.test(xr)&&/before-xr-camera-switch/.test(xr),
  stereoParity:/rigCameras/.test(xr)&&/stereoRigCameraParity:true/.test(xr),
  fullSceneParity:/fullSceneParity:true/.test(xr)&&/capturedLights/.test(xr),
  naturalSpeed:/natural:3\.15/.test(xr),
  verticalDisabled:/state\.velocity\.y=0/.test(xr)
};
console.log(JSON.stringify(checks,null,2));if(Object.values(checks).some(v=>!v))process.exit(1);
