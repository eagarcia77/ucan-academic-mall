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
    `  function insideRooftopStairXZ(p) {\n    return Boolean(p && p.x >= 38.0 && p.x <= 50.0 && p.z >= 7.5 && p.z <= 42.0);\n  }\n\n  function commitRooftopFloor(state, reason) {\n    if (!state.rooftopCommitted) state.manualStairArrivals += 1;\n    state.rooftopCommitted = true;\n    state.floor = LEVEL.roof;\n    setStableFloor(LEVEL.roof, reason);\n  }\n\n  function commitFloorThree(state, reason) {\n    if (state.rooftopCommitted) state.manualStairArrivals += 1;\n    state.rooftopCommitted = false;\n    state.floor = LEVEL.three;\n    setStableFloor(LEVEL.three, reason);\n  }\n\n  function rooftopStairGround(state, p) {\n    if (!insideRooftopStairXZ(p)) return null;\n    const bottomZ = 39.0;\n    const topZ = 10.5;\n    const progress = clamp((bottomZ - p.z) / (bottomZ - topZ), 0, 1);\n    const ground = lerp(LEVEL.three, LEVEL.roof, progress);\n    state.manualStairFrames += 1;\n    state.manualStairProgress = progress;\n    if (progress >= 0.86) {\n      commitRooftopFloor(state, 'xr-manual-stairs:arrive-rooftop-v294');\n      status('Llegó a la terraza. El nivel quedó fijado y no regresará automáticamente al Piso 3.');\n    } else if (progress <= 0.06 && state.rooftopCommitted) {\n      commitFloorThree(state, 'xr-manual-stairs:arrive-floor-3-v294');\n      status('Llegó al Piso 3.');\n    }\n    return ground;\n  }\n\n  function floorGround(state) {\n    const p = state.xr?.position;\n    if (!p) return state.floor;\n    const rooftopGround = rooftopStairGround(state, p);\n    if (rooftopGround != null) return rooftopGround;\n    if (Math.abs(state.floor - LEVEL.three) <= 0.35) {\n      const center = p.x > -4.8 && p.x < 1.2 && p.z > -14 && p.z < 18.8;\n      const side = p.x > 18.2 && p.x < 22.8 && p.z > -8 && p.z < 18.8;\n      if (center || side) {\n        const z0 = center ? -12 : -7;\n        const z1 = 17.4;\n        const rise = center ? 2.38 : 2.04;\n        return LEVEL.three + rise * clamp((p.z - z0) / (z1 - z0), 0, 1);\n      }\n    }\n    return state.floor;\n  }`,
    'superficie manual y estado estable de terraza'
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

  code = replaceOnce(
    code,
    `  function syncHeightAndDesktop(state) {\n    state.eyeHeight = eyeHeight(state.xr, state.eyeHeight);\n    const explicit = stableFloor();\n    if (explicit != null && !state.transition) state.floor = explicit;\n    const ground = floorGround(state);\n    state.xr.position.y = ground + state.eyeHeight;\n    if (state.desktop?.position) {\n      state.desktop.position.x = state.xr.position.x;\n      state.desktop.position.z = state.xr.position.z;\n      state.desktop.position.y = ground + PLAYER_HEIGHT;\n    }\n  }`,
    `  function syncHeightAndDesktop(state) {\n    state.eyeHeight = eyeHeight(state.xr, state.eyeHeight);\n    const explicit = stableFloor();\n    const onRooftopStairs = insideRooftopStairXZ(state.xr?.position);\n    const terraceHeight = Number(state.xr?.position?.y || 0) >= LEVEL.roof - 2.4;\n    if (state.rooftopCommitted && (onRooftopStairs || terraceHeight) && !state.transition) {\n      state.floor = LEVEL.roof;\n      setStableFloor(LEVEL.roof, 'xr-terrace-sticky-v294');\n    } else if (state.rooftopCommitted && explicit != null && Math.abs(explicit - LEVEL.roof) > 0.4 && !onRooftopStairs) {\n      state.rooftopCommitted = false;\n      state.floor = explicit;\n    } else if (explicit != null && !state.transition) {\n      state.floor = explicit;\n    }\n    const ground = floorGround(state);\n    state.xr.position.y = ground + state.eyeHeight;\n    if (state.desktop?.position) {\n      state.desktop.position.x = state.xr.position.x;\n      state.desktop.position.z = state.xr.position.z;\n      state.desktop.position.y = ground + PLAYER_HEIGHT;\n    }\n  }`,
    'anclaje persistente de terraza'
  );

  code = replaceOnce(
    code,
    `    state.floor = explicit != null ? explicit : nearestFloor(desktopY - PLAYER_HEIGHT);`,
    `    state.floor = explicit != null ? explicit : nearestFloor(desktopY - PLAYER_HEIGHT);\n    state.rooftopCommitted = Math.abs(state.floor - LEVEL.roof) <= 0.4;`,
    'estado inicial de terraza'
  );

  code = replaceOnce(code, `      rooftopStairsExpandedTriggers:true,\n      rooftopStairsTriggerMarkers:true,\n      rooftopStairsBidirectional:true,`, `      rooftopStairsExpandedTriggers:false,\n      rooftopStairsTriggerMarkers:false,\n      rooftopStairsBidirectional:true,\n      automaticRooftopStairs:false,\n      manualRooftopStairs:true,\n      rooftopStairsManualJoystickTraversal:true,\n      rooftopStairsContinuousSlope:true,\n      rooftopStairsLoopPrevention:true,\n      rooftopStairsNoActivationButton:true,\n      rooftopFloorStickyCommit:true,\n      rooftopFloorCommitProgress:0.86,\n      rooftopCommitted:state.rooftopCommitted,\n      blockedAutomaticStairStarts:state.blockedAutomaticStairStarts,\n      manualStairFrames:state.manualStairFrames,\n      manualStairArrivals:state.manualStairArrivals,\n      manualStairProgress:state.manualStairProgress,`, 'auditoría manual');
  code = replaceOnce(code, `      routeStarts:0,`, `      routeStarts:0,\n      rooftopCommitted:false,\n      blockedAutomaticStairStarts:0,\n      manualStairFrames:0,\n      manualStairArrivals:0,\n      manualStairProgress:0,`, 'contadores manuales');
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
    earlyRooftopCommit:code.includes('progress >= 0.86') && code.includes("commitRooftopFloor(state, 'xr-manual-stairs:arrive-rooftop-v294')"),
    stickyRooftopFloor:code.includes("setStableFloor(LEVEL.roof, 'xr-terrace-sticky-v294')") && code.includes('state.rooftopCommitted'),
    floorThreeArrival:code.includes("commitFloorThree(state, 'xr-manual-stairs:arrive-floor-3-v294')"),
    automaticStairsBlocked:code.includes("if (route.kind === 'stairs')") && code.includes('blockedAutomaticStairStarts'),
    noRouteMarkers:code.includes('no se crean activadores para las escaleras caminables'),
    noAutomaticStairZoneStart:!code.includes("ROUTES.find(route => nearRouteEntry(state, route))"),
    auditFlags:code.includes('automaticRooftopStairs:false') && code.includes('rooftopStairsLoopPrevention:true') && code.includes('rooftopFloorStickyCommit:true')
  };
  checks.all = Object.values(checks).every(Boolean);
  return checks;
}

module.exports = { VERSION, BUILD, patchQuestControls, auditPatchedSource };
