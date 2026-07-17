const fs=require('fs');
const xr=fs.readFileSync('public/js/ucan_v274_xr_visibility_run_jump.js','utf8');
const compat=fs.readFileSync('auth-compat-v271.js','utf8');
const checks={
 version:/const V='V274'/.test(xr),
 build:/V274-20260717-XR-VISIBLE-RUN-JUMP/.test(xr)&&/V274-20260717-XR-VISIBLE-RUN-JUMP/.test(compat),
 served:/ucan_v274_xr_visibility_run_jump\.js/.test(compat),
 removesUnsafeFramebuffer:/delete safe\.outputCanvasOptions/.test(xr),
 removesUnsafeNativeOverride:/delete safe\.ignoreNativeCameraTransformation/.test(xr),
 localFloor:/referenceSpaceType:'local-floor'/.test(xr),
 relaxedBaseCameraSafety:/st\.ground-1\.25/.test(xr)&&/st\.ground\+4\.5/.test(xr),
 transparentRails:/cristal barandas XR visible V274/.test(xr)&&/disableDepthWrite=true/.test(xr)&&/needDepthPrePass=false/.test(xr),
 run:/RUN_SPEED/.test(xr)&&/runControl/.test(xr)&&/7\.5/.test(xr),
 jump:/jumpControl/.test(xr)&&/jumpVelocity=4\.35/.test(xr)&&/updateJump/.test(xr),
 floorLock:/same\(st\.floor,l\.low\)\|\|same\(st\.floor,l\.high\)/.test(xr),
 noOutputCanvasOverride:!/framebufferScaleFactor/.test(xr)
};
const ok=Object.values(checks).every(Boolean);
console.log(JSON.stringify({ok,version:'V274',checks},null,2));
if(!ok)process.exit(1);
