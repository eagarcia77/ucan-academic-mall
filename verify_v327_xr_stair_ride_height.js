'use strict';
const fs=require('fs'),path=require('path');
const root=__dirname;
const runtime=fs.readFileSync(path.join(root,'public/js/ucan_v327_xr_stair_ride_height.js'),'utf8');
const preloader=fs.readFileSync(path.join(root,'auth-compat-v325-render-stability.js'),'utf8');
const finalAuthority=fs.readFileSync(path.join(root,'public/js/ucan_v328_xr_final_authority.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const checks={
  archivedRuntimeExists:runtime.length>100,
  archivedRuntimeSyntax:true,
  legacyRideNotInjected:!preloader.includes('data-ucan-v327-xr-stair-ride')&&!preloader.includes('STAIR_RIDE_SRC'),
  finalAuthorityInjected:preloader.includes('data-ucan-v328-xr-final-authority')&&preloader.includes('FINAL_XR_SRC'),
  automaticRideOwnedByFinal:/automaticStairsWithoutJoystick:true/.test(finalAuthority)&&/function updateRide/.test(finalAuthority),
  exactLandingOwnedByFinal:/settleExactLanding/.test(finalAuthority)&&/v330-landing-settle/.test(finalAuthority),
  productionStillChecksArchive:String(pkg.scripts?.check||'').includes('ucan_v327_xr_stair_ride_height.js'),
  auditRetainedForRegression:String(pkg.scripts?.test||'').includes('audit:v327')
};
try{new Function(runtime);}catch(error){checks.archivedRuntimeSyntax=error.message;}
const failures=Object.entries(checks).filter(([,v])=>v!==true);
console.log(JSON.stringify({version:'V327',status:'archived-not-loaded',supersededBy:'V328-R39/V330',ok:failures.length===0,checks,failures},null,2));
if(failures.length)process.exit(1);
