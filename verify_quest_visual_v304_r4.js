'use strict';

const fs = require('fs');

const runtime = fs.readFileSync('public/js/ucan_v304_quest_glass_rails_holiday_r4.js', 'utf8');
const protection = fs.readFileSync('public/js/ucan_v304_r4_geometry_protection.js', 'utf8');
const loader = fs.readFileSync('public/js/ucan_v266_keyboard_jump.js', 'utf8');
const preloader = fs.readFileSync('auth-compat-v304-r4.js', 'utf8');
const r5Preloader = fs.readFileSync('auth-compat-v304-r5.js', 'utf8');
const docker = fs.readFileSync('Dockerfile', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let syntaxError = null;
try {
  new Function(runtime);
  new Function(protection);
  new Function(loader);
  syntaxValid = true;
} catch (error) {
  syntaxError = error.message;
}

const startsR4 = pkg.scripts?.start === 'node -r ./auth-compat-v304-r4.js server.js';
const startsR5 = pkg.scripts?.start === 'node -r ./auth-compat-v304-r5.js server.js' && r5Preloader.includes("require('./auth-compat-v304-r4.js')");
const dockerR4 = docker.includes('"./auth-compat-v304-r4.js"');
const dockerR5 = docker.includes('"./auth-compat-v304-r5.js"') && r5Preloader.includes("require('./auth-compat-v304-r4.js')");

const checks = {
  syntaxValid,
  version:runtime.includes("const REVISION = 'R4'") && runtime.includes('V304-20260725-QUEST-GLASS-RAILS-HOLIDAY-R4'),
  nonBlocking:runtime.includes("current === XR_STATE.ENTERING_XR") && runtime.includes('scheduleVisualFixes()'),
  batchedGlass:runtime.includes('GLASS_BATCH_SIZE = 36') && runtime.includes('processGlassCandidates(candidates, end)'),
  glassColor:runtime.includes("FromHexString('#b8e2ea')"),
  glassCompatibility:runtime.includes('material.alpha = 0.965') && runtime.includes('mesh.visibility = GLASS_VISIBILITY'),
  noBlackDepth:runtime.includes('material.needDepthPrePass = false') && runtime.includes('material.disableDepthWrite = true'),
  restoresHiddenGlass:runtime.includes("'dark-glass-global'") && runtime.includes("'rooftop-stair-glass'") && runtime.includes("'floor2-escalator-front-glass'"),
  neutralGlassName:runtime.includes('UCAN translúcido R4') && runtime.includes('ucanQuestTransparentSurfaceV304R4'),
  hidesOldRails:runtime.includes('hideOldStairRails()') && runtime.includes('questCorrectedStairRailV301'),
  railCoordinates:runtime.includes('STAIR.minX + 0.34') && runtime.includes('STAIR.maxX - 0.34'),
  railStructure:runtime.includes('stairRailPost:true') && runtime.includes('stairTopRail:true') && runtime.includes('stairLowerRail:true'),
  railGlass:runtime.includes('superficie translúcida lateral R4') && runtime.includes('railPanes'),
  holidayExactTarget:runtime.includes("metadata.livePanelKey === 'pr-celebration-v304'"),
  holidayTwoFaces:runtime.includes("'hacia edificio'") && runtime.includes("'hacia exterior'"),
  holidayFrontSide:runtime.includes('sideOrientation:B.Mesh.FRONTSIDE') && runtime.includes('B.Mesh.BILLBOARDMODE_NONE'),
  directVr:runtime.includes("base.enterXRAsync('immersive-vr', 'local-floor')"),
  protectionMarker:protection.includes('questProtectedTransparentSurfaceV304R4:true'),
  protectionRestores:protection.includes('mesh.setEnabled?.(true)') && protection.includes('mesh.visibility = 0.46'),
  protectionAudit:protection.includes('__UCAN_QUEST_V304_R4_PROTECTION__') && protection.includes('v303RehidePrevented:true'),
  loaderR4:loader.includes('/js/ucan_v304_quest_glass_rails_holiday_r4.js?build=V304-20260725-QUEST-GLASS-RAILS-HOLIDAY-R4'),
  loaderProtection:loader.includes('/js/ucan_v304_r4_geometry_protection.js?build=V304-20260725-R4-GEOMETRY-PROTECTION'),
  loaderOrder:loader.indexOf('ucan_v304_quest_glass_rails_holiday_r4.js') < loader.indexOf('ucan_v304_r4_geometry_protection.js'),
  noR3Loader:!loader.includes('ucan_v304_quest_visual_entry_r3.js?build='),
  preloaderChain:preloader.includes("require('./auth-compat-v293.js')"),
  r5PreservesR4:!startsR5 || r5Preloader.includes("require('./auth-compat-v304-r4.js')"),
  preloaderVersion:preloader.includes('questHolidayBoardTwoReadableFaces') && preloader.includes('questStairRailingsRebuiltOnSideEdges'),
  packageStart:startsR4 || startsR5,
  packageCheckRuntime:pkg.scripts?.check?.includes('public/js/ucan_v304_quest_glass_rails_holiday_r4.js') === true,
  packageCheckProtection:pkg.scripts?.check?.includes('public/js/ucan_v304_r4_geometry_protection.js') === true,
  packageAudit:pkg.scripts?.['audit:quest-v304-r4'] === 'node verify_quest_visual_v304_r4.js',
  packageTest:pkg.scripts?.test?.includes('audit:quest-v304-r4') === true,
  dockerPreloader:dockerR4 || dockerR5
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks, syntaxError, chain:{ startsR4, startsR5, dockerR4, dockerR5 } }, null, 2));
if (!ok) process.exit(1);
