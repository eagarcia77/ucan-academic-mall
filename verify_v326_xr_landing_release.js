'use strict';
const fs=require('fs'),path=require('path');
const root=__dirname;
const runtime=fs.readFileSync(path.join(root,'public/js/ucan_v326_xr_landing_release.js'),'utf8');
const preloader=fs.readFileSync(path.join(root,'auth-compat-v325-render-stability.js'),'utf8');
const finalAuthority=fs.readFileSync(path.join(root,'public/js/ucan_v328_xr_final_authority.js'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const checks={
  archivedRuntimeExists:runtime.length>100,
  archivedRuntimeSyntax:true,
  legacyLandingNotInjected:!preloader.includes('data-ucan-v326-xr-landing-release')&&!preloader.includes('LANDING_SRC'),
  finalAuthorityInjected:preloader.includes('data-ucan-v328-xr-final-authority')&&preloader.includes('FINAL_XR_SRC'),
  finalAuthorityOwnsLanding:/singleFinalVerticalAuthority:true/.test(finalAuthority)&&/settleExactLanding/.test(finalAuthority),
  productionStillChecksArchive:String(pkg.scripts?.check||'').includes('ucan_v326_xr_landing_release.js'),
  auditRetainedForRegression:String(pkg.scripts?.test||'').includes('audit:v326')
};
try{new Function(runtime);}catch(error){checks.archivedRuntimeSyntax=error.message;}
const failures=Object.entries(checks).filter(([,v])=>v!==true);
console.log(JSON.stringify({version:'V326',status:'archived-not-loaded',supersededBy:'V328-R39/V330',ok:failures.length===0,checks,failures},null,2));
if(failures.length)process.exit(1);
