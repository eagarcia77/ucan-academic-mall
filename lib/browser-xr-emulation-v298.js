'use strict';

const VERSION = 'V298';
const BUILD = 'V298-20260722-BROWSER-SCENE-XR-EMULATION';

const MOVEMENT_ANCHOR = `    scene.onBeforeRenderObservable.add(()=>{\n      if(window.__ucanV254IsRiding&&window.__ucanV254IsRiding()) return;`;
const MOVEMENT_REPLACEMENT = `    scene.onBeforeRenderObservable.add(()=>{\n      // V298: durante WebXR el emulador traduce los Touch Controllers y reutiliza\n      // las colisiones de esta misma cámara. Evita que el gamepad XR mueva dos veces.\n      if(window.__UCAN_BROWSER_XR_EMULATION_ACTIVE__) return;\n      if(window.__ucanV254IsRiding&&window.__ucanV254IsRiding()) return;`;

const ROUTE_ANCHOR = `      const z = zones.find(zone => nearEntry(camera.position, zone));`;
const ROUTE_REPLACEMENT = `      const z = zones.find(zone => {\n        // En Meta Quest las escaleras P3-Terraza se recorren caminando.\n        // Las escaleras eléctricas P1-P2 y P2-P3 conservan exactamente la ruta del browser.\n        if (window.__UCAN_BROWSER_XR_EMULATION_ACTIVE__ && (zone.id === 'up34' || zone.id === 'down43')) return false;\n        return nearEntry(camera.position, zone);\n      });`;

const API_ANCHOR = `  window.__UCAN_API__ = {`;
const API_REPLACEMENT = `  window.__UCAN_BROWSER_XR_MAIN_PATCH_V298__ = {\n    version:'${VERSION}',\n    build:'${BUILD}',\n    browserMovementSuppressedDuringXR:true,\n    browserEscalatorsReusedInXR:true,\n    rooftopStairsManualInXR:true\n  };\n\n  window.__UCAN_API__ = {`;

function replaceExactlyOnce(code, search, replacement, label) {
  const count = code.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: se esperaba 1 coincidencia y se encontraron ${count}.`);
  return code.replace(search, replacement);
}

function auditPatchedSource(code) {
  const checks = {
    marker:code.includes('__UCAN_BROWSER_XR_MAIN_PATCH_V298__'),
    movementGuard:code.includes('if(window.__UCAN_BROWSER_XR_EMULATION_ACTIVE__) return;'),
    noDoubleMovement:code.includes('Evita que el gamepad XR mueva dos veces'),
    rooftopRoutesSkippedOnlyInXR:code.includes("zone.id === 'up34' || zone.id === 'down43'"),
    otherBrowserRoutesPreserved:code.includes('return nearEntry(camera.position, zone);'),
    apiMarker:code.includes("browserEscalatorsReusedInXR:true") && code.includes("rooftopStairsManualInXR:true")
  };
  checks.all = Object.values(checks).every(Boolean);
  return checks;
}

function patchBrowserXrEmulation(source) {
  let code = String(source || '');
  if (code.includes('__UCAN_BROWSER_XR_MAIN_PATCH_V298__')) {
    return { code, patched:true, alreadyPatched:true, checks:auditPatchedSource(code) };
  }
  code = replaceExactlyOnce(code, MOVEMENT_ANCHOR, MOVEMENT_REPLACEMENT, 'browser-movement-guard');
  code = replaceExactlyOnce(code, ROUTE_ANCHOR, ROUTE_REPLACEMENT, 'rooftop-route-filter');
  code = replaceExactlyOnce(code, API_ANCHOR, API_REPLACEMENT, 'api-audit-marker');
  const checks = auditPatchedSource(code);
  if (!checks.all) throw new Error(`La emulación V298 quedó incompleta: ${JSON.stringify(checks)}`);
  return { code, patched:true, alreadyPatched:false, checks };
}

module.exports = { VERSION, BUILD, patchBrowserXrEmulation, auditPatchedSource };
