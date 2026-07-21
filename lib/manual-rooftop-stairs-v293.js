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
    if (code.includes("const VERSION = 'V293';") && code.includes('manualRooftopStairs:true')) {
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
    `  function triggerPressed(record) {\n    const component = record?.trigger;\n    if (component) {\n      if (typeof component.pressed === 'boolean') return component.pressed;\n      if (finite(component.value)) return Number(component.value) > 0.62;\n    }\n    const gamepad = record?.controller?.inputSource?.gamepad || record?.motionController?.gamepadObject || record?.motionController?.gamepad;\n    return Boolean(gamepad?.buttons?.[0]?.pressed || Number(gamepad?.buttons?.[0]?.value || 0) > 0.62);\n  }`,
    `  function triggerPressed(record) {\n    const component = record?.trigger;\n    const thumbstick = record?.thumbstick;\n    const gamepad = record?.controller?.inputSource?.gamepad || record?.motionController?.gamepadObject || record?.motionController?.gamepad;\n    const trigger = Boolean(\n      component?.pressed ||\n      Number(component?.value || 0) > 0.62 ||\n      gamepad?.buttons?.[0]?.pressed ||\n      Number(gamepad?.buttons?.[0]?.value || 0) > 0.62\n    );\n    const joystick = Boolean(\n      thumbstick?.pressed ||\n      gamepad?.buttons?.[3]?.pressed ||\n      Number(gamepad?.buttons?.[3]?.value || 0) > 0.62\n    );\n    const primary = Boolean(\n      gamepad?.buttons?.[4]?.pressed || gamepad?.buttons?.[5]?.pressed ||\n      Number(gamepad?.buttons?.[4]?.value || 0) > 0.62 || Number(gamepad?.buttons?.[5]?.value || 0) > 0.62\n    );\n    return trigger || joystick || primary;\n  }`,
    'activación manual con control'
  );

  code = replaceOnce(
    code,
    `  function routeEntry(state) {\n    return ROUTES.find(route => nearRouteEntry(state, route)) || null;\n  }`,
    `  function routeEntry(state) {\n    return ROUTES.find(route => route.automatic === true && nearRouteEntry(state, route)) || null;\n  }`,
    'filtro de rutas automáticas'
  );

  code = replaceOnce(
    code,
    `  function beginRoute(state, route, source = 'zona') {\n    if (!route || state.transition) return false;\n    state.transition = {\n      route,\n      source,\n      startedAt:performance.now(),\n      start:state.xr.position.clone(),\n      eyeHeight:state.eyeHeight\n    };\n    state.lastSafe.copyFrom(state.xr.position);\n    state.routeStarts += 1;\n    status(\`${'${route.message}'}. Mantenga la vista al frente; el recorrido será automático.\`);\n    return true;\n  }`,
    `  function beginRoute(state, route, source = 'zona') {\n    if (!route || state.transition) return false;\n    const manualStairs = route.kind === 'stairs';\n    if (manualStairs) {\n      const allowedSource = ['control-manual', 'auditoría'].includes(source);\n      const correctFloor = Math.abs(state.floor - route.fromFloor) <= 0.4;\n      const cooldownReady = performance.now() >= state.routeCooldownUntil;\n      if (!allowedSource || !correctFloor || !cooldownReady) {\n        state.blockedAutomaticStairStarts += 1;\n        status(!correctFloor\n          ? 'Este marcador corresponde al otro extremo de la escalera.'\n          : 'Las escaleras de la terraza solo se activan manualmente con el control.');\n        updateAudit(state);\n        return false;\n      }\n    }\n    state.transition = {\n      route,\n      source,\n      startedAt:performance.now(),\n      start:state.xr.position.clone(),\n      eyeHeight:state.eyeHeight\n    };\n    state.lastSafe.copyFrom(state.xr.position);\n    state.routeStarts += 1;\n    status(manualStairs\n      ? \`${'${route.message}'}. Recorrido manual iniciado; no se activará al caminar sobre la zona.\`\n      : \`${'${route.message}'}. Mantenga la vista al frente; el recorrido será automático.\`);\n    return true;\n  }`,
    'inicio manual de escaleras'
  );

  code = replaceOnce(
    code,
    `      const exitOffset = route.direction === 'up' ? -1.7 : 1.7;`,
    `      const exitOffset = route.kind === 'stairs'\n        ? (route.direction === 'up' ? -9.2 : 9.2)\n        : (route.direction === 'up' ? -1.7 : 1.7);`,
    'salida fuera de zona contraria'
  );
  code = replaceOnce(code, `      state.routeCooldownUntil = performance.now() + 2300;`, `      state.routeCooldownUntil = performance.now() + (route.kind === 'stairs' ? 5200 : 2300);`, 'bloqueo de reentrada');
  code = code.replaceAll("'Gatillo para activar'", "'Gatillo o joystick'" );
  code = replaceOnce(
    code,
    `        summary:'Presione el gatillo sobre este marcador para iniciar el recorrido automático y seguro.',`,
    `        summary:'Apunte al marcador y presione el gatillo o el joystick. La escalera nunca se activa automáticamente al caminar sobre ella.',`,
    'texto informativo manual'
  );
  code = replaceOnce(code, `          beginRoute(state, route, 'gatillo');`, `          beginRoute(state, route, 'control-manual');`, 'fuente manual');
  code = replaceOnce(code, `      automaticEscalators:true,\n      oneWayElectricEscalators:true,`, `      automaticEscalators:true,\n      oneWayElectricEscalators:true,\n      automaticRooftopStairs:false,\n      manualRooftopStairs:true,\n      rooftopStairsLoopPrevention:true,\n      rooftopStairsExitOutsideOppositeTrigger:true,\n      rooftopStairsManualControlButtons:['gatillo','joystick','botón principal'],\n      blockedAutomaticStairStarts:state.blockedAutomaticStairStarts,`, 'auditoría manual');
  code = replaceOnce(code, `      routeStarts:0,`, `      routeStarts:0,\n      blockedAutomaticStairStarts:0,`, 'contador de bloqueos');
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
    manualSourceRequired:code.includes("['control-manual', 'auditoría'].includes(source)"),
    correctFloorRequired:code.includes('Math.abs(state.floor - route.fromFloor) <= 0.4'),
    loopExitOffset:code.includes("route.direction === 'up' ? -9.2 : 9.2"),
    reentryCooldown:code.includes("route.kind === 'stairs' ? 5200 : 2300"),
    joystickActivation:code.includes('gamepad?.buttons?.[3]?.pressed'),
    manualAudit:code.includes('automaticRooftopStairs:false') && code.includes('rooftopStairsLoopPrevention:true'),
    noAutomaticStairZoneStart:!code.includes("ROUTES.find(route => nearRouteEntry(state, route))")
  };
  checks.all = Object.values(checks).every(Boolean);
  return checks;
}

module.exports = { VERSION, BUILD, patchQuestControls, auditPatchedSource };
