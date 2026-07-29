'use strict';
const fs=require('fs'),path=require('path');
const root=__dirname;
const runtime=fs.readFileSync(path.join(root,'public/js/ucan_v314_render_parity.js'),'utf8');
const campus=fs.readFileSync(path.join(root,'public/campus.html'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const checks={
  runtimeSyntax:true,
  version:/VERSION='V314'/.test(runtime)&&/REVISION='R18'/.test(runtime),
  fullTransformAudit:/fullMeshTransformAudit:true/.test(runtime)&&/position:r\.dynamic\?null/.test(runtime)&&/rotation:r\.dynamic\?null/.test(runtime),
  fullMaterialAudit:/fullMaterialPropertyAudit:true/.test(runtime)&&/needDepthPrePass:true/.test(runtime)&&/forceDepthWrite:true/.test(runtime),
  fullLightAudit:/fullLightAudit:true/.test(runtime)&&/function rl\(/.test(runtime),
  fullSceneAudit:/fullSceneEnvironmentAudit:true/.test(runtime)&&/function rs\(/.test(runtime),
  fixedQuality:/fixedHardwareScalingLevel:SCALE/.test(runtime)&&/SCALE=1/.test(runtime),
  equalLod:/environmentLodForcedEqual:true/.test(runtime)&&/DETAIL\.test/.test(runtime),
  glassStable:/glassDoubleTransparencyRemoved:true/.test(runtime)&&/m\.alpha=1/.test(runtime),
  completeHash:/canonicalHash:st\.canon/.test(runtime)&&/currentHash:st\.current/.test(runtime)&&/hashesMatch:st\.match/.test(runtime),
  xrRepair:/setTimeout\(\(\)=>repair\(true\),120\)/.test(runtime)&&/setTimeout\(\(\)=>repair\(true\),650\)/.test(runtime),
  campusLoadsRuntime:campus.includes('/js/ucan_v314_render_parity.js?build=V314-20260729-FULL-RENDER-PARITY-R18'),
  packageChecksRuntime:String(pkg.scripts?.check||'').includes('ucan_v314_render_parity.js'),
  packageRunsAudit:String(pkg.scripts?.test||'').includes('audit:v314')
};
try{new Function(runtime)}catch(error){checks.runtimeSyntax=false;checks.runtimeSyntaxError=error.message}
const failed=Object.entries(checks).filter(([,value])=>value!==true);
const report={version:'V314',revision:'R18',build:'V314-20260729-FULL-RENDER-PARITY-R18',ok:failed.length===0,checks,failed:failed.map(([name,value])=>({name,value})),physicalValidationRequired:['Desplegar el commit actual en Render.','Abrir el mismo punto de observación en browser y Meta Quest.','Confirmar hashesMatch=true en ambos dispositivos.','Comparar geometría, iluminación, cristales y objetos visibles.']};
console.log(JSON.stringify(report,null,2));
if(!report.ok)process.exitCode=1;
