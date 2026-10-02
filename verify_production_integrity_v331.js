'use strict';
const fs=require('fs');
const path=require('path');
const root=__dirname;
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const pkg=JSON.parse(read('package.json'));
const docker=read('Dockerfile');
const server=read('server.js');
const preload=read('auth-compat-v329-vr-innovation.js');
const adapter=read('auth-compat-v325-render-stability.js');
const horizontal=read('public/js/ucan_v324_xr_stairs_entry.js');
const vertical=read('public/js/ucan_v328_xr_final_authority.js');
const guard=read('public/js/ucan_v331_xr_single_authority_guard.js');
const main=read('public/js/ucan_babylon_mall_v265_accounts_avatars.js');

const checks={
  node24Runtime:/^FROM node:24-bookworm-slim/m.test(docker),
  dockerUsesNpmStart:/CMD \["npm", "start"\]/.test(docker),
  persistentDataContract:/ENV DATA_DIR=\/app\/data/.test(docker)&&/VOLUME \["\/app\/data"\]/.test(docker),
  renderPort:/process\.env\.PORT \|\| 3000/.test(server)&&/0\.0\.0\.0/.test(server),
  releaseV331:/const VERSION = 'V331'/.test(preload)&&/V331-20261002-XR-SINGLE-VERTICAL-AUTHORITY-R40/.test(preload),
  revisionR40:/revision: 'R40'/.test(preload)&&/const REVISION = 'R40'/.test(vertical),
  cacheBusted:/V331-20261002-XR-SINGLE-VERTICAL-AUTHORITY-R40/.test(adapter),
  guardInjected:/ucan_v331_xr_single_authority_guard\.js/.test(preload),
  oneVerticalWriter:/verticalAuthorityDelegatedToV328:true/.test(horizontal)&&/singleFinalVerticalAuthority:true/.test(vertical),
  automaticRideLocksLocomotion:/automaticRideInputLocked:true/.test(horizontal)&&/activeRide/.test(horizontal),
  noHorizontalVerticalOverwrite:/if \(verticalDelegated\)[\s\S]*?else \{[\s\S]*?state\.root\.position\.y = state\.ground/.test(horizontal),
  desktopSpeedParity:/comfort:3\.4, natural:5\.0, fast:7\.0/.test(horizontal),
  exactLanding:/settleExactLanding/.test(vertical)&&/\[80, 240, 650, 1100\]/.test(vertical),
  visualStereoSafety:/needDepthPrePass = false/.test(main)&&/disableDepthWrite = true/.test(main)&&/repairRig/.test(guard),
  packageChecksV331:String(pkg.scripts?.check||'').includes('ucan_v331_xr_single_authority_guard.js'),
  packageAuditsV331:String(pkg.scripts?.test||'').includes('audit:v331'),
  packageAuditsProduction:String(pkg.scripts?.test||'').includes('audit:production')
};
const failures=Object.entries(checks).filter(([,v])=>v!==true);
const report={version:'V331',revision:'R40',audit:'production-integrity',ok:failures.length===0,checks,failures:failures.map(([name,value])=>({name,value}))};
console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exit(1);
