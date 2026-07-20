const fs=require('fs');
const xr=fs.readFileSync('public/js/ucan_v277_xr_navigation_recovery.js','utf8');
const compat=fs.readFileSync('auth-compat-v271.js','utf8');
const checks={
 version:/const VERSION = 'V277'/.test(xr),
 xrBuild:/V277-20260720-XR-NAV-ROLLBACK-PERSISTENCE/.test(xr),
 currentServerBuild:/V282-20260720-QUEST-BROWSER-ONE-WAY-ESCALATOR-PARITY/.test(compat),
 xrLayerLoaded:/UCAN_XR_SCRIPT/.test(compat)&&/ucan_v277_xr_navigation_recovery\.js/.test(compat),
 terraceDestination:/rooftop:\{ floor:LEVEL\.roof/.test(xr),
 immersiveButtonCapture:/stopImmediatePropagation\(\)/.test(xr)&&/destinationGo/.test(xr),
 apiNavigation:/api\.goToArea=key=>state\.inXR\?teleportTo/.test(xr),
 stateSync:/state\.floor=target\.floor/.test(xr)&&/state\.appliedGround=target\.floor/.test(xr),
 automaticEscalator:/AUTO_ESCALATOR_SPEED/.test(xr)&&/Subiendo automáticamente hacia la terraza/.test(xr),
 jump:/joystickJump:true/.test(xr)&&/jumpVelocity=4\.45/.test(xr),
 verticalRecovery:/manualVerticalRecovery/.test(xr)&&/joystickVerticalRecovery:true/.test(xr),
 positionRollback:/rollbackPosition/.test(xr)&&/Rollback posición/.test(xr),
 blockers:/createBlockers/.test(xr)&&/terraceProtected:true/.test(xr),
 persistenceRepair:/repairCompletionFile/.test(compat)&&/passwordChangedAt/.test(compat)&&/avatarConfiguredAt/.test(compat)
};
const ok=Object.values(checks).every(Boolean);
console.log(JSON.stringify({ok,layerVersion:'V277',serverVersion:'V282',checks},null,2));
if(!ok)process.exit(1);
