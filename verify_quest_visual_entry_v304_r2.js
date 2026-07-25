'use strict';

const fs = require('fs');

const runtime = fs.readFileSync('public/js/ucan_v304_quest_visual_entry_r2.js', 'utf8');
const loader = fs.readFileSync('public/js/ucan_v266_keyboard_jump.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let syntaxError = null;
try {
  new Function(runtime);
  syntaxValid = true;
} catch (error) {
  syntaxError = error.message;
}

const checks = {
  syntaxValid,
  version:runtime.includes("const VERSION = 'V304'") && runtime.includes("const REVISION = 'R2'"),
  build:runtime.includes('V304-20260724-QUEST-GLASS-SIGNS-VR-R2'),
  questOnlyVisuals:runtime.includes('questOnlyVisualChanges:true') && runtime.includes('desktopVisualsUnchanged:true'),
  transparentGlassColor:runtime.includes("FromHexString('#9bc8d3')") && runtime.includes('material.alpha = 0.34'),
  noBlackDepthPrepass:runtime.includes('material.needDepthPrePass = false') && runtime.includes('material.disableDepthWrite = true'),
  alphaBlend:runtime.includes('MATERIAL_ALPHABLEND'),
  restoresV303Glass:runtime.includes("'dark-glass-global'") && runtime.includes("'rooftop-stair-glass'") && runtime.includes("'floor2-escalator-front-glass'"),
  excludesCentralTerrace:runtime.includes('centralTerraceFeature') && runtime.includes('tragaluz'),
  frontSideSigns:runtime.includes('sideOrientation:B.Mesh.FRONTSIDE'),
  uprightSigns:runtime.includes('replacement.billboardMode = B.Mesh.BILLBOARDMODE_Y') && runtime.includes("orientation:'upright'"),
  floorOneOnly:runtime.includes('FLOOR_TWO_Y = 8.2') && runtime.includes('absoluteY(mesh) >= FLOOR_TWO_Y - 0.2'),
  directVrEntry:runtime.includes("enterModeDirect('immersive-vr')") && runtime.includes("base.enterXRAsync(mode, 'local-floor', renderTarget, { optionalFeatures })"),
  renderTarget:runtime.includes('state.helper.renderTarget || base.renderTarget'),
  synchronousFallback:runtime.includes("base.enterXRAsync(mode, 'local-floor')") && runtime.includes('vrSynchronousFallback:true'),
  buttonRebound:runtime.includes("dataset.ucanV304R2Bound = 'true'") && runtime.includes("dataset.ucanV304XrBound = 'direct-user-gesture'"),
  waitsForV303:runtime.includes("window.__UCAN_QUEST_V303__?.installed === true"),
  auditObject:runtime.includes('__UCAN_QUEST_V304_R2__'),
  loaderPresent:loader.includes('/js/ucan_v304_quest_visual_entry_r2.js?build=V304-20260724-QUEST-GLASS-SIGNS-VR-R2'),
  loaderSingleMarker:loader.includes('data-ucan-v304-quest-r2'),
  packageCheck:pkg.scripts?.check?.includes('public/js/ucan_v304_quest_visual_entry_r2.js') === true,
  packageAudit:pkg.scripts?.['audit:quest-v304-r2'] === 'node verify_quest_visual_entry_v304_r2.js',
  packageTest:pkg.scripts?.test?.includes('audit:quest-v304-r2') === true
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
