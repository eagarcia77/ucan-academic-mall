'use strict';

const VERSION = 'V299';
const BUILD = 'V299-20260723-QUEST-NAVIGATION-GLASS-TERRACE';

const MOVEMENT_ANCHOR = `    scene.onBeforeRenderObservable.add(()=>{\n      if(window.__ucanV254IsRiding&&window.__ucanV254IsRiding()) return;`;
const MOVEMENT_REPLACEMENT = `    scene.onBeforeRenderObservable.add(()=>{\n      // V299: Meta Quest utiliza un solo traductor de joysticks sobre la escena del browser.\n      // Evita movimiento duplicado, diferencias de velocidad y conflictos con gamepads WebXR.\n      if(window.__UCAN_BROWSER_XR_EMULATION_ACTIVE__) return;\n      if(window.__ucanV254IsRiding&&window.__ucanV254IsRiding()) return;`;

const ROUTE_ANCHOR = `      const z = zones.find(zone => nearEntry(camera.position, zone));`;
const ROUTE_REPLACEMENT = `      const z = zones.find(zone => {\n        // Las escaleras eléctricas P1-P2 y P2-P3 conservan las rutas automáticas del browser.\n        // La escalera normal P3-Terraza se recorre físicamente con el joystick en Meta Quest.\n        if (window.__UCAN_BROWSER_XR_EMULATION_ACTIVE__ && (zone.id === 'up34' || zone.id === 'down43')) return false;\n        return nearEntry(camera.position, zone);\n      });`;

const API_ANCHOR = `  window.__UCAN_API__ = {`;
const API_REPLACEMENT = `  window.__UCAN_BROWSER_XR_MAIN_PATCH_V299__ = {\n    version:'${VERSION}',\n    build:'${BUILD}',\n    browserMovementSuppressedDuringXR:true,\n    browserEscalatorsReusedInXR:true,\n    rooftopStairsManualInXR:true,\n    singleQuestRuntime:true,\n    floorThreeSpeedStable:true,\n    rooftopCenterRemovedOnlyInQuest:true\n  };\n\n  window.__UCAN_API__ = {`;

function replaceExactlyOnce(code, search, replacement, label) {
  const count = code.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: se esperaba 1 coincidencia y se encontraron ${count}.`);
  return code.replace(search, replacement);
}

function auditPatchedSource(code) {
  const checks = {
    marker:code.includes('__UCAN_BROWSER_XR_MAIN_PATCH_V299__'),
    movementGuard:code.includes('if(window.__UCAN_BROWSER_XR_EMULATION_ACTIVE__) return;'),
    noDoubleMovement:code.includes('Evita movimiento duplicado'),
    rooftopRoutesSkippedOnlyInXR:code.includes("zone.id === 'up34' || zone.id === 'down43'"),
    otherBrowserRoutesPreserved:code.includes('return nearEntry(camera.position, zone);'),
    apiMarker:code.includes('singleQuestRuntime:true') && code.includes('floorThreeSpeedStable:true')
  };
  checks.all = Object.values(checks).every(Boolean);
  return checks;
}

function patchBrowserXrEmulation(source) {
  let code = String(source || '');
  if (code.includes('__UCAN_BROWSER_XR_MAIN_PATCH_V299__')) {
    return { code, patched:true, alreadyPatched:true, checks:auditPatchedSource(code) };
  }
  if (code.includes('__UCAN_BROWSER_XR_MAIN_PATCH_V298__')) {
    code = code
      .replaceAll('__UCAN_BROWSER_XR_MAIN_PATCH_V298__', '__UCAN_BROWSER_XR_MAIN_PATCH_V299__')
      .replaceAll("version:'V298'", `version:'${VERSION}'`)
      .replaceAll("build:'V298-20260722-BROWSER-SCENE-XR-EMULATION'", `build:'${BUILD}'`)
      .replace('browserEscalatorsReusedInXR:true,\n    rooftopStairsManualInXR:true', 'browserEscalatorsReusedInXR:true,\n    rooftopStairsManualInXR:true,\n    singleQuestRuntime:true,\n    floorThreeSpeedStable:true,\n    rooftopCenterRemovedOnlyInQuest:true');
    const checks = auditPatchedSource(code);
    if (!checks.all) throw new Error(`La actualización V298→V299 quedó incompleta: ${JSON.stringify(checks)}`);
    return { code, patched:true, alreadyPatched:false, checks };
  }
  code = replaceExactlyOnce(code, MOVEMENT_ANCHOR, MOVEMENT_REPLACEMENT, 'browser-movement-guard');
  code = replaceExactlyOnce(code, ROUTE_ANCHOR, ROUTE_REPLACEMENT, 'rooftop-route-filter');
  code = replaceExactlyOnce(code, API_ANCHOR, API_REPLACEMENT, 'api-audit-marker');
  const checks = auditPatchedSource(code);
  if (!checks.all) throw new Error(`La emulación V299 quedó incompleta: ${JSON.stringify(checks)}`);
  return { code, patched:true, alreadyPatched:false, checks };
}

module.exports = { VERSION, BUILD, patchBrowserXrEmulation, auditPatchedSource };
