const fs=require('fs');
const path=require('path');
const js=fs.readFileSync(path.join(__dirname,'public/js/ucan_babylon_mall_v265_accounts_avatars.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'public/campus.html'),'utf8');
const checks={
  automaticQuality:/setupPerformanceManager/.test(js)&&/getFps\(\)/.test(js)&&/setHardwareScalingLevel/.test(js),
  environmentLOD:/setupEnvironmentLOD/.test(js)&&/detailedPattern/.test(js),
  locationAwareness:/setupLocationAwareness/.test(js)&&/nearestAreaKey/.test(js),
  reducedMotion:/reducedMotion/.test(js)&&/motionBtn/.test(html),
  highContrast:/high-contrast/.test(html)&&/contrastBtn/.test(html),
  largeText:/large-text/.test(html)&&/textSizeBtn/.test(html),
  groupedNavigation:/nav-group/.test(html)&&/destinationSelect/.test(html),
  architecturalAudit:/__UCAN_ARCHITECTURE_AUDIT__/.test(js),
  directories:/buildWayfindingDirectories/.test(js)
};
const ok=Object.values(checks).every(Boolean);
console.log(JSON.stringify({ok,version:'V265',checks},null,2));
process.exit(ok?0:1);
