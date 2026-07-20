const fs = require('fs');
const sky = fs.readFileSync('public/js/ucan_v276_interactive_sky.js','utf8');
const refresh = fs.readFileSync('public/js/ucan_v276_sky_refresh.js','utf8');
const compat = fs.readFileSync('auth-compat-v271.js','utf8');
const unified = fs.readFileSync('public/js/ucan_v283_unified_xr_runtime.js','utf8');
const planets = ['Mercurio','Venus','Marte','Júpiter','Saturno','Urano','Neptuno'];
const checks = {
  version:/const VERSION = 'V276'/.test(sky),
  layerBuild:/V276-20260717-INTERACTIVE-TERRACE-SKY/.test(sky),
  currentServerBuild:/V283-20260720-UNIFIED-XR-DESKTOP-PARITY/.test(compat),
  sevenPlanets:planets.every(name => sky.includes(name)),
  liveSkyData:/__UCAN_SAN_GERMAN__/.test(sky) && /skySnapshot/.test(sky),
  improvedDome:/cielo interactivo terraza V276/.test(sky) && /DynamicTexture/.test(sky),
  selectableMeshes:/OnPickTrigger/.test(sky) && /POINTERPICK/.test(sky) && /celestialObject:true/.test(sky),
  selectableLabels:/etiqueta celeste/.test(sky) && /attachSelection\(label, entry\)/.test(sky),
  vrInformationPanel:/panel flotante información celeste/.test(sky) && /BILLBOARDMODE_ALL/.test(sky),
  browserInformationPanel:/ucanSkyExplorer/.test(sky) && /ucanSkySelect/.test(sky),
  sunMoonIss:/id:'sun'/.test(sky) && /id:'moon'/.test(sky) && /id:'iss'/.test(sky),
  autoRefresh:/setInterval/.test(refresh) && /sky\.refresh/.test(refresh),
  servedAfterCampus:/UCAN_SKY_SCRIPT/.test(compat) && /UCAN_SKY_REFRESH_SCRIPT/.test(compat) && /mainWithSky/.test(compat),
  unifiedRooftopNavigation:/UCAN_UNIFIED_XR_SCRIPT/.test(compat) && /id:'up34'/.test(unified) && /id:'down43'/.test(unified) && /rooftopStairsBidirectional:true/.test(unified),
  terraceOnly:/terraceOnly:true/.test(sky) && /onTerrace/.test(sky),
  auditAvailable:/__UCAN_SKY_AUDIT__/.test(sky) && /allVisibleObjectsPickable/.test(sky)
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ok,layerVersion:'V276',serverVersion:'V283',checks},null,2));
if (!ok) process.exit(1);