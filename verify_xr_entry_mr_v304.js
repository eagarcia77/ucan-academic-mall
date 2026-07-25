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
const enterModeStart = runtime.indexOf('async function enterMode(mode)');
const directVrCall = runtime.indexOf("enterPromise = state.helper.baseExperience.enterXRAsync('immersive-vr', 'local-floor');", enterModeStart);
const firstAwaitAfterEntryStart = runtime.indexOf('await ', enterModeStart);
const supportGateRemoved = !runtime.includes('if (!supported) throw new DOMException');

const checks = {
  syntaxValid,
  version:runtime.includes("const VERSION = 'V304'"),
  build:runtime.includes('V304-20260724-XR-DIRECT-USER-GESTURE-VR-MR'),
  floatingButton:runtime.includes("button.id = 'ucanVrGogglesV304'") && runtime.includes('floatingVrGogglesLowerRight:true'),
  lowerRightPosition:runtime.includes('right:max(18px,env(safe-area-inset-right))') && runtime.includes('bottom:max(18px,env(safe-area-inset-bottom))'),
  vrGogglesSvg:runtime.includes('<svg viewBox="0 0 64 42"') && runtime.includes('<span class="label">VR</span>'),
  helperIntegration:runtime.includes('window.__UCAN_XR_HELPER__') && runtime.includes('state.helper.baseExperience.enterXRAsync('),
  vrMode:runtime.includes("enterMode('immersive-vr')") && runtime.includes("enterXRAsync('immersive-vr', 'local-floor')"),
  mrMode:runtime.includes("enterMode('immersive-ar')") && runtime.includes("enterXRAsync('immersive-ar', 'local-floor'"),
  localFloor:runtime.includes("'local-floor'"),
  renderTarget:runtime.includes('state.helper.renderTarget || state.helper.baseExperience?.renderTarget'),
  directVrCallBeforeAwait:enterModeStart >= 0 && directVrCall > enterModeStart && (firstAwaitAfterEntryStart < 0 || directVrCall < firstAwaitAfterEntryStart),
  supportProbeAdvisoryOnly:runtime.includes('supportCheckAdvisoryOnly:true') && supportGateRemoved,
  buttonNotDisabledByProbe:runtime.includes('vrButtonNeverDisabledBySupportProbe:true') && !runtime.includes('state.floatingButton.disabled = state.entering || !state.helper || state.vrSupported === false'),
  userGestureButtons:runtime.includes('event.stopImmediatePropagation()') && runtime.includes('replaceAndBindButton'),
  oldHandlersRemoved:runtime.includes('const button = existing.cloneNode(true)') && runtime.includes("button.dataset.ucanV304XrBound = 'direct-user-gesture'"),
  diagnostics:runtime.includes('ucanXrDiagnosticV304') && runtime.includes('diagnosticsVisibleOnFailure:true') && runtime.includes('showDiagnostics'),
  activationCaptured:runtime.includes('state.lastUserActivation = Boolean(navigator.userActivation?.isActive)'),
  mrTransparentBackground:runtime.includes('new B.Color4(0, 0, 0, 0)') && runtime.includes('ucan-mr-active-v304'),
  mrSkySuppression:runtime.includes('function isSkyOrBackground') && runtime.includes('state.hiddenForMR.set(mesh'),
  mrRestoration:runtime.includes('function restoreMixedReality') && runtime.includes('state.hiddenForMR.clear()'),
  backgroundSupportDetection:runtime.includes('detectSupportInBackground') && runtime.includes("probeSupport('immersive-vr')") && runtime.includes("probeSupport('immersive-ar')"),
  runtimeAudit:runtime.includes('__UCAN_XR_ENTRY_MR_V304__') && runtime.includes('directUserGestureEntryWithoutAwait:true'),
  campusSingleLoad:occurrences === 1,
  campusAfterMain:mainIndex >= 0 && runtimeIndex > mainIndex,
  campusNewBuild:campus.includes('V304-20260724-XR-DIRECT-USER-GESTURE-VR-MR'),
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
  enterModeStart,
  directVrCall,
  firstAwaitAfterEntryStart,
  syntaxError
}, null, 2));
if (!ok) process.exit(1);
