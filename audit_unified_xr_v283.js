'use strict';
const fs = require('fs');
const vm = require('vm');

const runtime = fs.readFileSync('public/js/ucan_v283_unified_xr_runtime.js', 'utf8');
const compat = fs.readFileSync('auth-compat-v271.js', 'utf8');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const checks = {
  version:/const VERSION = 'V283'/.test(runtime) && /V283-20260720-UNIFIED-XR-DESKTOP-PARITY/.test(runtime),
  singleRuntimeInjected:/UCAN_UNIFIED_XR_SCRIPT/.test(compat) && /ucan_v283_unified_xr_runtime\.js/.test(compat),
  legacyLayersRetired:/deprecatedXrLayersLoaded:false/.test(compat) && !/UCAN_QUEST_PARITY_SCRIPT/.test(compat) && !/UCAN_ENVIRONMENT_PARITY_SCRIPT/.test(compat),
  noQuestExposure:/noQuestSpecificExposure:true/.test(runtime) && /questExposureFactor:1/.test(runtime) && !/DEFAULT_EXPOSURE_FACTOR/.test(runtime),
  sharedMovement:/natural:5\.0/.test(runtime) && /comfort:3\.4/.test(runtime) && /natural:1\.9/.test(runtime) && /comfort:1\.2/.test(runtime),
  immediateDesktopRules:/moveWithDesktopRules/.test(runtime) && /_collideWithWorld/.test(runtime) && /DEAD_ZONE = 0\.18/.test(runtime),
  realWorldHeight:/realWorldHeight/.test(runtime) && /state\.floor \+ state\.eyeHeight/.test(runtime),
  oneWayEscalators:/id:'down21'[\s\S]*direction:'down'/.test(runtime) && /id:'down32'[\s\S]*direction:'down'/.test(runtime) && /wrongWayRoute/.test(runtime) && /blockWrongWay/.test(runtime),
  automaticRoutes:/duration:3600/.test(runtime) && /smoothStep/.test(runtime) && /updateRoute/.test(runtime),
  rooftopBidirectional:/id:'up34'/.test(runtime) && /id:'down43'/.test(runtime),
  compatibleInitialization:/Inicialización XR completa falló/.test(runtime) && /compatibilityFallbackUsed/.test(runtime),
  errorRecovery:/recordError/.test(runtime) && /recoverIfInvalid/.test(runtime) && /lastError/.test(runtime),
  transparentParity:/standardizeTransparentMaterials/.test(runtime) && /disableDepthWrite = true/.test(runtime),
  serverFlags:/singleUnifiedXrController:true/.test(compat) && /sameLightingAcrossEnvironments:true/.test(compat) && /sameMovementAcrossEnvironments:true/.test(compat),
  packageUsesUnifiedAudit:Object.values(packageJson.scripts).filter(value => typeof value === 'string' && /audit_(?:quest|xr_floor|visual_parity|environment_escalator)/.test(value)).length === 0
};

const sandbox = {
  console,
  window:{},
  document:{ getElementById:() => null, addEventListener:() => {} },
  localStorage:{ getItem:() => null, setItem:() => {} },
  performance:{ now:() => 0 },
  setTimeout:() => 0,
  clearTimeout:() => {},
  CustomEvent:function CustomEvent(){}
};
sandbox.window = sandbox;
sandbox.window.setTimeout = sandbox.setTimeout;
sandbox.BABYLON = {
  Scene:function Scene(){},
  WebXRState:{ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 },
  WebXRFeatureName:{ MOVEMENT:'movement', TELEPORTATION:'teleportation' },
  Material:{ MATERIAL_ALPHABLEND:2 },
  Engine:{ ALPHA_COMBINE:2 },
  Vector3:function Vector3(x=0,y=0,z=0){ this.x=x;this.y=y;this.z=z; },
  Quaternion:{ FromEulerAngles:() => ({}) }
};
sandbox.BABYLON.Scene.prototype.createDefaultXRExperienceAsync = async function original(){ return {}; };
sandbox.window.BABYLON = sandbox.BABYLON;
vm.createContext(sandbox);
vm.runInContext(runtime, sandbox);
const boot = sandbox.__UCAN_UNIFIED_XR_BOOT__ || {};
checks.runtimeBoot = boot.version === 'V283' && boot.patched === true && boot.singleController === true && boot.noQuestSpecificExposure === true;
checks.prototypePatched = sandbox.BABYLON.Scene.prototype.createDefaultXRExperienceAsync.__ucanV283UnifiedPatched === true;

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V283', checks }, null, 2));
if (!ok) process.exit(1);