'use strict';
const fs=require('fs');
const path=require('path');
const root=__dirname;
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const horizontal=read('public/js/ucan_v324_xr_stairs_entry.js');
const vertical=read('public/js/ucan_v328_xr_final_authority.js');
const guard=read('public/js/ucan_v331_xr_single_authority_guard.js');
const preload=read('auth-compat-v329-vr-innovation.js');
const adapter=read('auth-compat-v325-render-stability.js');
const overlay=read('public/js/ucan_v329_vr_innovation_overlay.js');
const main=read('public/js/ucan_babylon_mall_v265_accounts_avatars.js');
const pkg=JSON.parse(read('package.json'));

const checks={
  releaseBuild:/V331-20261002-XR-SINGLE-VERTICAL-AUTHORITY-R40/.test(preload)&&/V331-20261002-XR-SINGLE-VERTICAL-AUTHORITY-R40/.test(vertical),
  releaseRevision:/revision: 'R40'/.test(preload)&&/const REVISION = 'R40'/.test(vertical),
  oneVerticalWriter:/verticalAuthorityDelegatedToV328:true/.test(horizontal)&&/singleFinalVerticalAuthority:true/.test(vertical),
  horizontalDoesNotWriteYWhenDelegated:/if \(verticalDelegated\)[\s\S]*?else \{[\s\S]*?state\.root\.position\.y = state\.ground/.test(horizontal),
  rideLocksHorizontal:/const automaticRide = Boolean\(verticalDelegated && finalState\?\.activeRide\)/.test(horizontal)&&/if \(!automaticRide\)/.test(horizontal),
  teleportDelegatesFloor:/final\.forceFloor\(state\.ground\)/.test(horizontal),
  desktopSpeedParity:/comfort:3\.4, natural:5\.0, fast:7\.0/.test(horizontal),
  desktopPresenceYDelegated:/if \(!\(final\?\.installed && finalState\?\.inXR\)\) state\.desktop\.position\.y/.test(horizontal),
  calibratedEyeHeight:/TARGET_EYE_HEIGHT = 1\.72/.test(vertical)&&/MAX_UP_CORRECTION = 0\.65/.test(vertical)&&/MAX_DOWN_CORRECTION = 0\.65/.test(vertical),
  autoStairs:/automaticStairsWithoutJoystick:true/.test(vertical)&&/function beginRide/.test(vertical)&&/function updateRide/.test(vertical),
  exactLanding:/settleExactLanding/.test(vertical)&&/\[80, 240, 650, 1100\]/.test(vertical),
  underStairGuard:/const HAZARDS/.test(vertical)&&/guardUnderStairs/.test(vertical),
  jumpOwnedByVertical:/function updateJump/.test(vertical)&&/JUMP_VELOCITY = 4\.4/.test(vertical),
  rootInvariantExposed:/rootY:Number\(root\(\)\?\.position\?\.y\)/.test(vertical)&&/expectedRootY:/.test(vertical),
  runtimeGuard:/__UCAN_XR_STABILITY_V331__/.test(guard)&&/singleVerticalWriter:true/.test(guard)&&/enforceSingleVerticalWriter/.test(guard),
  visualGuard:/repairVisuals/.test(guard)&&/repairRig/.test(guard)&&/MATERIAL_ALPHABLEND/.test(guard),
  transparentStereoSafe:/needDepthPrePass = false/.test(main)&&/disableDepthWrite = true/.test(main),
  preloadInjectsGuard:/ucan_v331_xr_single_authority_guard\.js/.test(preload)&&/singleVerticalAuthority: true/.test(preload),
  adapterBustsCache:/V331-20261002-XR-SINGLE-VERTICAL-AUTHORITY-R40/.test(adapter),
  overlayAligned:/const VERSION = 'V331'/.test(overlay)&&/const REVISION = 'R40'/.test(overlay),
  packageChecksGuard:String(pkg.scripts?.check||'').includes('ucan_v331_xr_single_authority_guard.js'),
  packageRunsAudit:String(pkg.scripts?.test||'').includes('audit:v331')
};
for(const [name,src] of [['horizontal',horizontal],['vertical',vertical],['guard',guard],['preload',preload],['adapter',adapter],['overlay',overlay]]){
  try{new Function(src);}catch(error){checks[name+'Syntax']=error.message;}
}
const failures=Object.entries(checks).filter(([,value])=>value!==true);
const report={version:'V331',revision:'R40',audit:'single-vertical-authority',ok:failures.length===0,checks,failures:failures.map(([name,value])=>({name,value}))};
console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exit(1);
