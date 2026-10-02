'use strict';
const fs=require('fs');
const path=require('path');
const root=__dirname;
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const xr=read('public/js/ucan_v328_xr_final_authority.js');
const main=read('public/js/ucan_babylon_mall_v265_accounts_avatars.js');
const guard=read('public/js/ucan_v330_xr_stability_guard.js');
const preload=read('auth-compat-v329-vr-innovation.js');
const pkg=JSON.parse(read('package.json'));
const checks={
  revisionR39:/const REVISION = 'R39'/.test(xr),
  releaseBuild:/V330-20261002-XR-IMMERSIVE-STABILITY-R39/.test(xr)&&/V330-20261002-XR-IMMERSIVE-STABILITY-R39/.test(preload),
  physicalHeightPriority:/realWorldHeight, state\.xr\?\._realWorldHeight/.test(xr)&&/position\?\.y/.test(xr),
  boundedCalibration:/MAX_UP_CORRECTION = 0\.45/.test(xr)&&/MAX_DOWN_CORRECTION = 0\.45/.test(xr),
  inXROnly:/value===X\.ENTERING_XR\) captureVisual\(\)/.test(xr)&&/value===X\.IN_XR\) enterXR\(\)/.test(xr),
  delayedCalibration:/setTimeout\(\(\)=>\{if\(state\.inXR\) beginCalibration\(true\);\},220\)/.test(xr),
  landingSettlement:/function settleExactLanding/.test(xr)&&/v330-landing-settle/.test(xr)&&/\[80, 240, 650\]/.test(xr),
  widerQuestEntry:/ENTRY_DEPTH = 7\.0/.test(xr)&&/ENTRY_WIDTH_ASSIST = 1\.8/.test(xr),
  forceFloorApi:/forceFloor:floor=>/.test(xr)&&/assistedRide,/.test(xr),
  transparentStereoSafe:/needDepthPrePass = false/.test(main)&&/disableDepthWrite = true/.test(main)&&/MATERIAL_ALPHABLEND/.test(main),
  guardExists:/__UCAN_XR_STABILITY_V330__/.test(guard)&&/betweenFloorRecovery:true/.test(guard),
  rigParity:/function repairRig/.test(guard)&&/rigCameras/.test(guard),
  blackScreenGuard:/lightsEnabled/.test(guard)&&/texturesEnabled/.test(guard)&&/exposure<0\.35/.test(guard),
  preloadInjectsGuard:/ucan_v330_xr_stability_guard\.js/.test(preload)&&/xrImmersiveStabilityGuard: true/.test(preload),
  packageChecksGuard:String(pkg.scripts?.check||'').includes('ucan_v330_xr_stability_guard.js'),
  packageRunsAudit:String(pkg.scripts?.test||'').includes('audit:v330')
};
for(const [file,src] of [['xr',xr],['main',main],['guard',guard],['preload',preload]]){
 try{new Function(src);}catch(error){checks[file+'Syntax']=error.message;}
}
const failures=Object.entries(checks).filter(([,v])=>v!==true);
const report={version:'V330',revision:'R39',ok:failures.length===0,checks,failures:failures.map(([name,value])=>({name,value}))};
console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exit(1);
