'use strict';

const VERSION = 'V301';
const BUILD = 'V301-20260723-QUEST-RAILS-SELECTION-COMFORT';

const MOVEMENT_ANCHOR = `    scene.onBeforeRenderObservable.add(()=>{\n      if(window.__ucanV254IsRiding&&window.__ucanV254IsRiding()) return;`;
const MOVEMENT_REPLACEMENT = `    scene.onBeforeRenderObservable.add(()=>{\n      // V301: el runtime Meta Quest controla locomoción, giro, salto y confort.\n      if(window.__UCAN_BROWSER_XR_EMULATION_ACTIVE__) return;\n      if(window.__ucanV254IsRiding&&window.__ucanV254IsRiding()) return;`;

const ROUTE_ANCHOR = `      const z = zones.find(zone => nearEntry(camera.position, zone));`;
const ROUTE_REPLACEMENT = `      const z = zones.find(zone => {\n        if (window.__UCAN_BROWSER_XR_EMULATION_ACTIVE__ && (zone.id === 'up34' || zone.id === 'down43')) return false;\n        return nearEntry(camera.position, zone);\n      });`;

const API_ANCHOR = `  window.__UCAN_API__ = {`;
const API_REPLACEMENT = `  window.__UCAN_BROWSER_XR_MAIN_PATCH_V301__ = {\n    version:'${VERSION}',\n    build:'${BUILD}',\n    browserMovementSuppressedDuringXR:true,\n    browserEscalatorsReusedInXR:true,\n    rooftopStairsManualInXR:true,\n    fullTouchControllerMapping:true,\n    rooftopRailingsRebuilt:true,\n    rooftopCenterGlassRemoved:true,\n    rooftopObjectsSelectable:true,\n    defaultComfortMode:true,\n    snapTurnComfort:true,\n    motionVignette:true\n  };\n\n  window.__UCAN_API__ = {`;

function replaceExactlyOnce(code, search, replacement, label) {
  const count = code.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: se esperaba 1 coincidencia y se encontraron ${count}.`);
  return code.replace(search, replacement);
}

function auditPatchedSource(code) {
  const checks = {
    marker:code.includes('__UCAN_BROWSER_XR_MAIN_PATCH_V301__'),
    movementGuard:code.includes('if(window.__UCAN_BROWSER_XR_EMULATION_ACTIVE__) return;'),
    rooftopRoutesSkippedOnlyInXR:code.includes("zone.id === 'up34' || zone.id === 'down43'"),
    otherRoutesPreserved:code.includes('return nearEntry(camera.position, zone);'),
    apiMarker:code.includes('rooftopRailingsRebuilt:true') && code.includes('rooftopObjectsSelectable:true') && code.includes('motionVignette:true')
  };
  checks.all = Object.values(checks).every(Boolean);
  return checks;
}

function patchBrowserXrEmulation(source) {
  let code = String(source || '');
  if (code.includes('__UCAN_BROWSER_XR_MAIN_PATCH_V301__')) {
    return { code, patched:true, alreadyPatched:true, checks:auditPatchedSource(code) };
  }
  code = replaceExactlyOnce(code, MOVEMENT_ANCHOR, MOVEMENT_REPLACEMENT, 'browser-movement-guard');
  code = replaceExactlyOnce(code, ROUTE_ANCHOR, ROUTE_REPLACEMENT, 'rooftop-route-filter');
  code = replaceExactlyOnce(code, API_ANCHOR, API_REPLACEMENT, 'api-audit-marker');
  const checks = auditPatchedSource(code);
  if (!checks.all) throw new Error(`La emulación V301 quedó incompleta: ${JSON.stringify(checks)}`);
  return { code, patched:true, alreadyPatched:false, checks };
}

module.exports = { VERSION, BUILD, patchBrowserXrEmulation, auditPatchedSource };
