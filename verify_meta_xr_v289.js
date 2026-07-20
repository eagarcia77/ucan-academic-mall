'use strict';

const fs = require('fs');

const quest = fs.readFileSync('public/js/ucan_v289_quest_xr_compat.js', 'utf8');
const compat = fs.readFileSync('auth-compat-v287.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let syntaxError = null;
try {
  new Function(quest);
  syntaxValid = true;
} catch (error) {
  syntaxError = error.message;
}

const xrIndex = compat.indexOf('ucan_v283_unified_xr_runtime.js');
const questIndex = compat.indexOf('ucan_v289_quest_xr_compat.js');
const mainIndex = compat.indexOf('ucan_babylon_mall_v265_accounts_avatars.js');

const checks = {
  syntaxValid,
  version:/const VERSION = 'V289'/.test(quest),
  build:/V289-20260720-QUEST-XR-COMPAT-DIAGNOSTICS/.test(quest),
  secureContextPreflight:/window\.isSecureContext === true/.test(quest),
  topLevelPreflight:/window\.top === window\.self/.test(quest),
  navigatorXrPreflight:/navigator\.xr/.test(quest),
  sessionSupportPreflight:/isSessionSupported\('immersive-vr'\)/.test(quest),
  directUserGesture:/directUserGestureEntry:true/.test(quest),
  customCaptureButton:/addEventListener\('click',[\s\S]*stopImmediatePropagation\(\)[\s\S]*enterOrExitXR\(\)/.test(quest),
  directEnter:/enterXRAsync\('immersive-vr', 'local-floor'\)/.test(quest),
  directExit:/exitXRAsync\(\)/.test(quest),
  defaultUiDisabled:/disableDefaultUI:true/.test(quest),
  teleportationDisabled:/disableTeleportation:true/.test(quest),
  optionalFeaturesArray:/optionalFeatures:\[\]/.test(quest),
  noBooleanOptionalFeatures:!(/optionalFeatures\s*:\s*true/.test(quest)),
  requiredFeaturesArray:/requiredFeatures:\[\]/.test(quest),
  visibleDiagnostics:/ucanQuestDiagV289/.test(quest) && /Diagnóstico Meta Quest/.test(quest),
  diagnosticsClosable:/ucanQuestDiagCloseV289/.test(quest) && /function closePanel/.test(quest),
  friendlyErrors:/SecurityError/.test(quest) && /NotSupportedError/.test(quest) && /NotAllowedError/.test(quest) && /InvalidStateError/.test(quest),
  webglContextLoss:/webglcontextlost/.test(quest),
  questPerformanceGuard:/setHardwareScalingLevel\(Math\.max\(current, 1\.25\)\)/.test(quest),
  auditApi:/__UCAN_QUEST_XR_AUDIT__/.test(quest),
  injectedByServer:/QUEST_XR_SCRIPT/.test(compat) && /questXrVersion = 'V289'/.test(compat),
  permissionsPolicy:/xr-spatial-tracking=\(self\)/.test(compat),
  injectionOrder:xrIndex >= 0 && questIndex > xrIndex && mainIndex >= 0,
  packageChecksScript:pkg.scripts?.check?.includes('public/js/ucan_v289_quest_xr_compat.js'),
  packageQuestAudit:pkg.scripts?.['audit:quest-xr'] === 'node verify_meta_xr_v289.js'
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
