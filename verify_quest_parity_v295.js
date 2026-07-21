'use strict';

const fs = require('fs');

const runtime = fs.readFileSync('public/js/ucan_v295_quest_desktop_parity_terrace.js', 'utf8');
const compat = fs.readFileSync('auth-compat-v293.js', 'utf8');
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
  version:/const VERSION = 'V295'/.test(runtime),
  build:/V295-20260721-QUEST-DESKTOP-PARITY-TERRACE-ASSETS/.test(runtime),
  questOnly:/questOnly:true/.test(runtime) && /detectQuestDevice/.test(runtime),
  capturesDesktopAppearance:/function captureDesktopAppearance/.test(runtime),
  exactDesktopAppearance:/function applyExactDesktopAppearance/.test(runtime),
  noExposureOverride:/exposureOverride:false/.test(runtime),
  noContrastOverride:/contrastOverride:false/.test(runtime),
  noToneMappingOverride:/toneMappingOverride:false/.test(runtime),
  noFloorMaterialOverride:/floorMaterialOverride:false/.test(runtime),
  originalMaterialsPreserved:/originalMaterialsPreserved:true/.test(runtime),
  terraceSticky:/quest-v295-terrace-sticky/.test(runtime) && /terraceDropToFloorThreePrevented:true/.test(runtime),
  skyForcedEveryFrame:/skyRootForcedEveryFrame:true/.test(runtime) && /forceTerraceAssets\(\)/.test(runtime),
  celestialForced:/celestialMeshesForcedVisible:true/.test(runtime),
  panelsForced:/terracePanelsForcedVisible:true/.test(runtime),
  dynamicTextures:/dynamicPanelTexturesRefreshed:true/.test(runtime) && /texture\.update\(false\)/.test(runtime),
  parentChainsEnabled:/function enableParentChain/.test(runtime),
  hiddenPlanetsVisible:/hiddenPlanetsEducationallyVisibleInXR:true/.test(runtime),
  restoresDesktop:/function restoreDesktopScene/.test(runtime),
  compatServesV295:/QUEST_TERRACE_VERSION = 'V295'/.test(compat) && /ucan_v295_quest_desktop_parity_terrace\.js/.test(compat),
  oldV294NotInjected:/LEGACY_QUEST_TERRACE_PATH/.test(compat) && /ucan_v294_quest_terrace_stability/.test(compat),
  brandingNormalized:/replace\(\/UCAN Academic Mall V\\d\+\/g, 'UCAN Academic'\)/.test(compat) && /productName = 'UCAN Academic'/.test(compat),
  noVisibleVersion:/visibleVersionInProductName = false/.test(compat),
  endpointParity:/sameLightingAcrossEnvironments = true/.test(compat) && /questExposureFactor = 1/.test(compat) && /questFloorMatchesDesktop = true/.test(compat),
  endpointAssets:/questCelestialMeshesForcedVisible = true/.test(compat) && /questTerracePanelsForcedVisible = true/.test(compat),
  packageChecksRuntime:pkg.scripts?.check?.includes('ucan_v295_quest_desktop_parity_terrace.js'),
  packageAudit:pkg.scripts?.['audit:quest-terrace'] === 'node verify_quest_parity_v295.js'
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V295', checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
