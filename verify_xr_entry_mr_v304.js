'use strict';

const fs = require('fs');

const runtime = fs.readFileSync('public/js/ucan_v304_xr_entry_mr_fix.js', 'utf8');
const campus = fs.readFileSync('public/campus.html', 'utf8');
const auth = fs.readFileSync('auth-compat-v293.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let syntaxError = null;
try {
  new Function(runtime);
  syntaxValid = true;
} catch (error) {
  syntaxError = error.message;
}

const scriptName = 'ucan_v304_xr_entry_mr_fix.js';
const occurrences = (campus.match(new RegExp(scriptName.replace('.', '\\.'), 'g')) || []).length;
const mainIndex = campus.indexOf('ucan_babylon_mall_v265_accounts_avatars.js');
const runtimeIndex = campus.indexOf(scriptName);

const checks = {
  syntaxValid,
  version:runtime.includes("const VERSION = 'V304'"),
  build:runtime.includes("V304-20260723-XR-FLOATING-VR-MR-BETA"),
  floatingButton:runtime.includes("button.id = 'ucanVrGogglesV304'") && runtime.includes('floatingVrGogglesLowerRight:true'),
  lowerRightPosition:runtime.includes('right:max(18px,env(safe-area-inset-right))') && runtime.includes('bottom:max(18px,env(safe-area-inset-bottom))'),
  vrGogglesSvg:runtime.includes('<svg viewBox="0 0 64 42"') && runtime.includes('<span class="label">VR</span>'),
  helperIntegration:runtime.includes('window.__UCAN_XR_HELPER__') && runtime.includes('state.helper.baseExperience.enterXRAsync('),
  vrMode:runtime.includes("enterMode('immersive-vr')") && runtime.includes("'immersive-vr',"),
  mrMode:runtime.includes("enterMode('immersive-ar')") && runtime.includes("'immersive-ar',"),
  localFloor:runtime.includes("'local-floor',"),
  renderTarget:runtime.includes('state.helper.renderTarget || state.helper.baseExperience?.renderTarget'),
  userGestureButtons:runtime.includes('event.stopImmediatePropagation()') && runtime.includes('replaceAndBindButton'),
  oldHandlersRemoved:runtime.includes('const button = existing.cloneNode(true)') && runtime.includes("button.dataset.ucanV289Bound = 'true'"),
  mrTransparentBackground:runtime.includes('new B.Color4(0, 0, 0, 0)') && runtime.includes('ucan-mr-active-v304'),
  mrSkySuppression:runtime.includes('function isSkyOrBackground') && runtime.includes('state.hiddenForMR.set(mesh'),
  mrRestoration:runtime.includes('function restoreMixedReality') && runtime.includes('state.hiddenForMR.clear()'),
  supportDetection:runtime.includes("sessionSupported('immersive-vr')") && runtime.includes("sessionSupported('immersive-ar')"),
  runtimeAudit:runtime.includes('__UCAN_XR_ENTRY_MR_V304__') && runtime.includes('mrUsesBabylonExperienceHelper:true'),
  campusSingleLoad:occurrences === 1,
  campusAfterMain:mainIndex >= 0 && runtimeIndex > mainIndex,
  authDoesNotStripFix:!auth.includes('ucan_v304_xr_entry_mr_fix'),
  packageCheck:pkg.scripts?.check?.includes('public/js/ucan_v304_xr_entry_mr_fix.js') === true,
  packageAudit:pkg.scripts?.['audit:xr-entry-mr'] === 'node verify_xr_entry_mr_v304.js',
  packageTest:pkg.scripts?.test?.includes('audit:xr-entry-mr') === true
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({
  ok,
  checks,
  occurrences,
  mainIndex,
  runtimeIndex,
  syntaxError
}, null, 2));
if (!ok) process.exit(1);
