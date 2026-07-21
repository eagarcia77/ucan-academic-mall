'use strict';

const VERSION = 'V293';
const BUILD = 'V293-20260721-MANUAL-ROOFTOP-STAIRS-NO-LOOP';

function replaceOnce(source, search, replacement, label) {
  const count = source.split(search).length - 1;
  if (count !== 1) throw new Error(`${label}: se esperaba 1 coincidencia y se encontraron ${count}.`);
  return source.replace(search, replacement);
}

function patchQuestControls(source) {
  let code = String(source || '');
  if (!code.includes("const VERSION = 'V290';")) {
    if (code.includes("const VERSION = 'V293';") && code.includes('rooftopStairsManualJoystickTraversal:true')) {
      return { code, patched:true, alreadyPatched:true, checks:auditPatchedSource(code) };
    }
    throw new Error('El controlador base V290 no contiene el marcador esperado.');
  }

  code = replaceOnce(code, "const VERSION = 'V290';", "const VERSION = 'V293';", 'versión');
  code = replaceOnce(code, "const BUILD = 'V290-20260720-QUEST-CONTROLS-STAIRS-INFO';", `const BUILD = '${BUILD}';`, 'build');
  code = code.replaceAll("kind:'escalator', direction:", "kind:'escalator', automatic:true, direction:");
  code = code.replaceAll("kind:'stairs', direction:", "kind:'stairs', automatic:false, direction:");

  code = replaceOnce(
    code,
    `  function floorGround(state) {\n    const p = state.xr?.position;\n    if (!p) return state.floor;\n    if (Math.abs(state.floor - LEVEL.three) <= 0.35) {\n      const center = p.x > -4.8 && p.x < 1.2 && p.z > -14 && p.z < 18.8;\n      const side = p.x > 18.2 && p.x < 22.8 && p.z > -8 && p.z < 18.8;\n      if (center || side) {\n        const z0 = center ? -12 : -7;\n        const z1 = 17.4;\n        const rise = center ? 2.38 : 2.04;\n        return LEVEL.three + rise * clamp((p.z - z0) / (z1 - z0), 0, 1);\n      }\n    }\n    return state.floor;\n  }`,
    `  function rooftopStairGround(state, p) {\n    const inside = p.x >= 40.35 && p.x <= 47.65 && p.z >= 9.4 && p.z <= 40.1;\n    if (!inside) return null;\n    const bottomZ = 39.0;\n    const topZ = 10.5;\n    const progress = clamp((bottomZ - p.z) / (bottomZ - topZ), 0, 1);\n    const ground = lerp(LEVEL.three, LEVEL.roof, progress);\n    state.manualStairFrames += 1;\n    state.manualStairProgress = progress;\n    if (progress >= 0.985 && state.floor !== LEVEL.roof) {\n      state.floor = LEVEL.roof;\n      setStableFloor(LEVEL.roof, 'xr-manual-stairs:arrive-rooftop');\n      state.manualStairArrivals += 1;\n      status('Llegó a la terraza. La escalera no se activará automáticamente.');\n    } else if (progress <= 0.015 && state.floor !== LEVEL.three) {\n      state.floor = LEVEL.three;\n      setStableFloor(LEVEL.three, 'xr-manual-stairs:arrive-floor-3');\n      state.manualStairArrivals += 1;\n      status('Llegó al Piso 3. La escalera no se activará automáticamente.');\n    }\n    return ground;\n  }\n\n  function floorGround(state) {\n    const p = state.xr?.position;\n    if (!p) return state.floor;\n    const rooftopGround = rooftopStairGround(state, p);\n    if (rooftopGround != null) return rooftopGround;\n    if (Math.abs(state.floor - LEVEL.three) <= 0.35) {\n      const center = p.x > -4.8 && p.x < 1.2 && p.z > -14 && p.z < 18.8;\n      const side = p.x > 18.2 && p.x < 22.8 && p.z > -8 && p.z < 18.8;\n      if (center || side) {\n        const z0 = center ? -12 : -7;\n        const z1 = 17.4;\n        const rise = center ? 2.38 : 2.04;\n        return LEVEL.three + rise * clamp((p.z - z0) / (z1 - z0), 0, 1);\n      }\n    }\n    return state.floor;\n  }`,
    'superficie manual de escaleras'
  );

  code = replaceOnce(
    code,
    `  function routeEntry(state) {\n    return ROUTES.find(route => nearRouteEntry(state, route)) || null;\n  }`,
    `  function routeEntry(state) {\n    return ROUTES.find(route => route.automatic === true && nearRouteEntry(state, route)) || null;\n  }`,
    'filtro de rutas automáticas'
  );

  code = replaceOnce(
    code,
    `  function beginRoute(state, route, source = 'zona') {\n    if (!route || state.transition) return false;`,
    `  function beginRoute(state, route, source = 'zona') {\n    if (!route || state.transition) return false;\n    if (route.kind === 'stairs') {\n      state.blockedAutomaticStairStarts += 1;\n      status('Estas escaleras se recorren caminando con el joystick; no tienen movimiento automático.');\n      updateAudit(state);\n      return false;\n    }`,
    'bloqueo absoluto de recorrido automático'
  );

  code = replaceOnce(
    code,
    `  function createRouteMarker(state, route) {\n    if (!['up34', 'down43'].includes(route.id)) return;`,
    `  function createRouteMarker(state, route) {\n    // V293: no se crean activadores para las escaleras caminables de la terraza.\n    return;`,
    'eliminación de marcadores automáticos'
  );

  code = replaceOnce(code, `      rooftopStairsExpandedTriggers:true,\n      rooftopStairsTriggerMarkers:true,\n      rooftopStairsBidirectional:true,`, `      rooftopStairsExpandedTriggers:false,\n      rooftopStairsTriggerMarkers:false,\n      rooftopStairsBidirectional:true,\n      automaticRooftopStairs:false,\n      manualRooftopStairs:true,\n      rooftopStairsManualJoystickTraversal:true,\n      rooftopStairsContinuousSlope:true,\n      rooftopStairsLoopPrevention:true,\n      rooftopStairsNoActivationButton:true,\n      blockedAutomaticStairStarts:state.blockedAutomaticStairStarts,\n      manualStairFrames:state.manualStairFrames,\n      manualStairArrivals:state.manualStairArrivals,\n      manualStairProgress:state.manualStairProgress,`, 'auditoría manual');
  code = replaceOnce(code, `      routeStarts:0,`, `      routeStarts:0,\n      blockedAutomaticStairStarts:0,\n      manualStairFrames:0,\n      manualStairArrivals:0,\n      manualStairProgress:0,`, 'contadores manuales');
  code = code.replaceAll('Meta Quest V290:', 'Meta Quest V293:');
  code = code.replaceAll('[UCAN V290]', '[UCAN V293]');
  code = code.replaceAll('__UCAN_QUEST_CONTROLS_V290__', '__UCAN_QUEST_CONTROLS_V293__');

  const checks = auditPatchedSource(code);
  if (!checks.all) throw new Error(`La transformación V293 quedó incompleta: ${JSON.stringify(checks)}`);
  return { code, patched:true, alreadyPatched:false, checks };
}

function auditPatchedSource(code) {
  const checks = {
    version:code.includes("const VERSION = 'V293';"),
    build:code.includes(BUILD),
    escalatorsRemainAutomatic:code.includes("kind:'escalator', automatic:true"),
    rooftopStairsManual:code.includes("kind:'stairs', automatic:false"),
    automaticRouteFilter:code.includes('route.automatic === true && nearRouteEntry(state, route)'),
    manualSlope:code.includes('function rooftopStairGround(state, p)') && code.includes('lerp(LEVEL.three, LEVEL.roof, progress)'),
    joystickTraversal:code.includes('rooftopStairsManualJoystickTraversal:true'),
    floorThreeArrival:code.includes("setStableFloor(LEVEL.three, 'xr-manual-stairs:arrive-floor-3')"),
    rooftopArrival:code.includes("setStableFloor(LEVEL.roof, 'xr-manual-stairs:arrive-rooftop')"),
    automaticStairsBlocked:code.includes("if (route.kind === 'stairs')") && code.includes('blockedAutomaticStairStarts'),
    noRouteMarkers:code.includes('no se crean activadores para las escaleras caminables'),
    noAutomaticStairZoneStart:!code.includes("ROUTES.find(route => nearRouteEntry(state, route))"),
    auditFlags:code.includes('automaticRooftopStairs:false') && code.includes('rooftopStairsLoopPrevention:true') && code.includes('rooftopStairsNoActivationButton:true')
  };
  checks.all = Object.values(checks).every(Boolean);
  return checks;
}

module.exports = { VERSION, BUILD, patchQuestControls, auditPatchedSource };
