const fs = require('fs');
const path = require('path');
const jsPath = path.join(__dirname,'public/js/ucan_babylon_mall_v265_accounts_avatars.js');
const htmlPath = path.join(__dirname,'public/campus.html');
const serverPath = path.join(__dirname,'server.js');
const js = fs.readFileSync(jsPath,'utf8');
const html = fs.readFileSync(htmlPath,'utf8');
const server = fs.readFileSync(serverPath,'utf8');
const checks = {
  rooftopLevel: /rooftop:\s*27\.2/.test(js),
  rooftopBuilder: /function buildRooftop\(/.test(js),
  raisedTheaterCeiling: /techo elevado anfiteatro/.test(js),
  sunMoonClouds: /sol natural/.test(js) && /luna natural/.test(js) && /nubes naturales/.test(js),
  fourSeasons: ['spring','summer','autumn','winter'].every(s=>js.includes(`'${s}'`)),
  rooftopSilent: !/createRooftopAmbientController/.test(js) && /rooftopAudio:false/.test(server),
  interiorLighting: /function buildInteriorLighting/.test(js) && /interiorLightsAlwaysOn:true/.test(server),
  floorSeparation: /opaqueFloorSeparation:true/.test(server),
  navigation: /destinationSelect/.test(html) && /currentLocation/.test(html),
  accessibility: /contrastBtn/.test(html) && /textSizeBtn/.test(html) && /motionBtn/.test(html),
  automaticQuality: /function setupPerformanceManager/.test(js) && /autoQualityBtn/.test(html),
  wayfinding: /function buildWayfindingDirectories/.test(js),
  architectureAudit: /function auditArchitecturalIntegrity/.test(js)
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ok,version:'V265',checks},null,2));
process.exit(ok?0:1);
