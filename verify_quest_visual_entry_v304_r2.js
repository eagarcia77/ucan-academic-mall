'use strict';

const fs = require('fs');

const runtime = fs.readFileSync('public/js/ucan_v304_quest_visual_entry_r3.js', 'utf8');
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
  version:runtime.includes("const VERSION = 'V304'") && runtime.includes("const REVISION = 'R3'"),
  build:runtime.includes('V304-20260724-QUEST-VR-NONBLOCKING-R3'),
  transparentGlassColor:runtime.includes("FromHexString('#9bc8d3')") && runtime.includes('material.alpha = 0.34'),
  noBlackDepthPrepass:runtime.includes('material.needDepthPrePass = false') && runtime.includes('material.disableDepthWrite = true'),
  alphaBlend:runtime.includes('MATERIAL_ALPHABLEND'),
  restoresV303Glass:runtime.includes("'dark-glass-global'") && runtime.includes("'rooftop-stair-glass'") && runtime.includes("'floor2-escalator-front-glass'"),
  excludesCentralTerrace:runtime.includes('centralTerraceFeature') && runtime.includes('tragaluz'),
  frontSideSigns:runtime.includes('sideOrientation:B.Mesh.FRONTSIDE'),
  uprightSigns:runtime.includes('replacement.billboardMode = B.Mesh.BILLBOARDMODE_Y') && runtime.includes("orientation:'upright'"),
  replacementExcluded:runtime.includes('metadata.questReadableReplacementV304R3 === true') && runtime.includes('/legible Meta Quest V304 R[23]/i'),
  snapshotIteration:runtime.includes("const meshes = [...(state.scene.meshes || [])]") && runtime.includes("const candidates = [...(state.scene.meshes || [])].filter(readableFloorOneSign)"),
  noLiveArraySignLoop:!runtime.includes('for (const mesh of state.scene.meshes || []) createReadableSignReplacement(mesh)'),
  boundedSignCreation:runtime.includes('MAX_SIGN_REPLACEMENTS = 24') && runtime.includes('.slice(0, MAX_SIGN_REPLACEMENTS)'),
  noPerFrameScan:runtime.includes('noPerFrameFullSceneScan:true') && !runtime.includes('state.scene.onBeforeRenderObservable.add'),
  waitsForInXR:runtime.includes('currentXRState() !== XR_STATE.IN_XR') && runtime.includes('VISUAL_START_DELAY_MS = 650'),
  throttledVisuals:runtime.includes('VISUAL_REFRESH_MS = 1500') && runtime.includes('window.setInterval'),
  minimalVrEntry:runtime.includes("base.enterXRAsync('immersive-vr', 'local-floor')") && runtime.includes('vrUsesMinimalTwoArgumentEntry:true'),
  directUserGesture:runtime.includes("dataset.ucanV304R3Bound = 'true'") && runtime.includes("dataset.ucanV304XrBound = 'direct-user-gesture'"),
  waitsForV303:runtime.includes("window.__UCAN_QUEST_V303__?.installed !== true"),
  auditObject:runtime.includes('__UCAN_QUEST_V304_R3__'),
  loaderPresent:loader.includes('/js/ucan_v304_quest_visual_entry_r3.js?build=V304-20260724-QUEST-VR-NONBLOCKING-R3'),
  loaderSingleMarker:loader.includes('data-ucan-v304-quest-r3'),
  oldRuntimeInactive:!loader.includes('/js/ucan_v304_quest_visual_entry_r2.js'),
  packageCheck:pkg.scripts?.check?.includes('public/js/ucan_v304_quest_visual_entry_r3.js') === true,
  packageAudit:pkg.scripts?.['audit:quest-v304-r2'] === 'node verify_quest_visual_entry_v304_r2.js',
  packageTest:pkg.scripts?.test?.includes('audit:quest-v304-r2') === true
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, revision:'R3', checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
