(() => {
  'use strict';

  const VERSION = 'V282';
  const BUILD = 'V282-20260720-QUEST-BROWSER-ONE-WAY-ESCALATOR-PARITY';
  const B = window.BABYLON;
  if (!B?.Scene?.prototype?.createDefaultXRExperienceAsync) return;

  const LEVEL = Object.freeze({ one:0, two:8.2, three:16.4, roof:27.2 });
  const PLAYER_HEIGHT = 1.72;
  const NATURAL_SPEED = 5.0;
  const COMFORT_SPEED = 3.4;
  const SMOOTH_TURN_SPEED = 1.9;
  const WRONG_ENTRY_DEPTH = 5.2;
  const EXIT_COOLDOWN_MS = 2800;

  const ESCALATORS = Object.freeze([
    {
      id:'up12', laneId:'p1-p2-oeste', direction:'up',
      low:LEVEL.one, high:LEVEL.two,
      minX:-24.8, maxX:-15.2, zLow:34.4, zHigh:7.6,
      forbiddenFloor:LEVEL.two, forbiddenSide:'high'
    },
    {
      id:'down21', laneId:'p2-p1-este', direction:'down',
      low:LEVEL.one, high:LEVEL.two,
      minX:-12.8, maxX:-3.2, zLow:34.4, zHigh:7.6,
      forbiddenFloor:LEVEL.one, forbiddenSide:'low'
    },
    {
      id:'up23', laneId:'p2-p3-oeste', direction:'up',
      low:LEVEL.two, high:LEVEL.three,
      minX:-38.8, maxX:-29.2, zLow:34.4, zHigh:7.6,
      forbiddenFloor:LEVEL.three, forbiddenSide:'high'
    },
    {
      id:'down32', laneId:'p3-p2-este', direction:'down',
      low:LEVEL.two, high:LEVEL.three,
      minX:-30.8, maxX:-21.2, zLow:34.4, zHigh:7.6,
      forbiddenFloor:LEVEL.two, forbiddenSide:'low'
    }
  ]);

  const states = new WeakMap();
  const finite = value => Number.isFinite(Number(value));
  const near = (a, b, epsilon = 0.58) => Math.abs(Number(a) - Number(b)) <= epsilon;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function status(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const element = document.getElementById('status');
    if (element && !window.__UCAN_API__?.setStatus) element.textContent = message;
  }

  function eyeHeight(camera) {
    const values = [camera?.realWorldHeight, camera?._realWorldHeight, PLAYER_HEIGHT];
    return values.map(Number).find(value => finite(value) && value >= 0.8 && value <= 2.4) || PLAYER_HEIGHT;
  }

  function nearestFloor(value) {
    return [LEVEL.one, LEVEL.two, LEVEL.three, LEVEL.roof]
      .reduce((best, floor) => Math.abs(value - floor) < Math.abs(value - best) ? floor : best, LEVEL.one);
  }

  function questState() {
    try { return window.__UCAN_QUEST_XR_AUDIT__?.getState?.() || null; }
    catch (_) { return null; }
  }

  function desktopRideActive() {
    try { return Boolean(window.__ucanV254IsRiding?.()); }
    catch (_) { return false; }
  }

  function activeFloor(state) {
    if (state.inXR) {
      const navigation = questState();
      if (finite(navigation?.floor)) return Number(navigation.floor);
      return nearestFloor(Number(state.xr?.position?.y || 0) - eyeHeight(state.xr));
    }
    return nearestFloor(Number(state.desktop?.position?.y || PLAYER_HEIGHT) - PLAYER_HEIGHT);
  }

  function activeCamera(state) {
    return state.inXR ? state.xr : state.desktop;
  }

  function transitionActive(state) {
    if (state.inXR) return Boolean(questState()?.transition);
    return desktopRideActive();
  }

  function insideX(position, escalator, margin = 0.2) {
    return position.x >= escalator.minX - margin && position.x <= escalator.maxX + margin;
  }

  function wrongEntry(position, floor, escalator) {
    if (!position || !near(floor, escalator.forbiddenFloor, 0.65) || !insideX(position, escalator, 0.25)) return false;
    if (escalator.forbiddenSide === 'high') {
      return position.z >= escalator.zHigh - 0.28 && position.z <= escalator.zHigh + WRONG_ENTRY_DEPTH;
    }
    return position.z <= escalator.zLow + 0.28 && position.z >= escalator.zLow - WRONG_ENTRY_DEPTH;
  }

  function safeZ(escalator) {
    return escalator.forbiddenSide === 'high' ? escalator.zHigh - 0.78 : escalator.zLow + 0.78;
  }

  function gatePosition(escalator) {
    return {
      x:(escalator.minX + escalator.maxX) / 2,
      y:escalator.forbiddenFloor + 1.25,
      z:escalator.forbiddenSide === 'high' ? escalator.zHigh + 0.12 : escalator.zLow - 0.12
    };
  }

  function createGates(scene, state) {
    const material = new B.StandardMaterial('material barrera unidireccional V282', scene);
    material.alpha = 0.001;
    material.disableLighting = true;
    material.backFaceCulling = false;

    state.gates = ESCALATORS.map(escalator => {
      const position = gatePosition(escalator);
      const gate = B.MeshBuilder.CreateBox(`barrera sentido único ${escalator.id}`, {
        width:Math.max(1.5, escalator.maxX - escalator.minX - 0.35),
        height:2.5,
        depth:0.34
      }, scene);
      gate.position.set(position.x, position.y, position.z);
      gate.material = material;
      gate.visibility = 0.001;
      gate.isVisible = true;
      gate.isPickable = true;
      gate.checkCollisions = true;
      gate.alwaysSelectAsActiveMesh = true;
      gate.metadata = {
        xrUnderStairBlocker:true,
        oneWayEscalatorGate:true,
        escalatorId:escalator.id,
        laneId:escalator.laneId,
        allowedDirection:escalator.direction,
        forbiddenSide:escalator.forbiddenSide
      };
      return { escalator, gate };
    });
  }

  function setGateEnabled(item, enabled) {
    const gate = item.gate;
    gate.checkCollisions = enabled;
    gate.isPickable = enabled;
    gate.visibility = enabled ? 0.001 : 0;
    gate.setEnabled(enabled);
  }

  function updateRideCooldown(state) {
    const riding = desktopRideActive();
    const navigation = questState();
    const transitioning = Boolean(navigation?.transition);

    if (state.lastDesktopRide && !riding) state.exitCooldownUntil = performance.now() + EXIT_COOLDOWN_MS;
    if (state.lastXRTransition && !transitioning) state.exitCooldownUntil = performance.now() + EXIT_COOLDOWN_MS;

    state.lastDesktopRide = riding;
    state.lastXRTransition = transitioning;
  }

  function updateGates(state) {
    updateRideCooldown(state);
    const temporarilyOpen = transitionActive(state) || performance.now() < state.exitCooldownUntil;
    for (const item of state.gates) setGateEnabled(item, !temporarilyOpen);
  }

  function stopResidualMotion(camera) {
    try { camera?.cameraDirection?.set?.(0, 0, 0); } catch (_) {}
    try { camera?.direction?.set?.(0, 0, 0); } catch (_) {}
  }

  function guardWrongWayEntry(state) {
    if (transitionActive(state) || performance.now() < state.exitCooldownUntil) return;
    const camera = activeCamera(state);
    if (!camera?.position) return;
    const floor = activeFloor(state);

    const blocked = ESCALATORS.find(escalator => wrongEntry(camera.position, floor, escalator));
    if (!blocked) {
      state.lastSafePosition.copyFrom(camera.position);
      return;
    }

    camera.position.z = safeZ(blocked);
    camera.position.x = clamp(camera.position.x, blocked.minX + 0.42, blocked.maxX - 0.42);
    stopResidualMotion(camera);
    state.wrongWayAttempts[blocked.id] = (state.wrongWayAttempts[blocked.id] || 0) + 1;
    state.lastBlockedEscalator = blocked.id;

    const now = performance.now();
    if (now - state.lastWarningAt > 1100) {
      state.lastWarningAt = now;
      status(blocked.direction === 'down'
        ? 'Esta escalera eléctrica es únicamente para bajar. Use la escalera de subida correspondiente.'
        : 'Esta escalera eléctrica es únicamente para subir. Use la escalera de bajada correspondiente.');
    }
  }

  function directionAllowed(escalator, floor, requestedDirection) {
    if (requestedDirection !== escalator.direction) return false;
    return escalator.direction === 'up' ? near(floor, escalator.low, 0.1) : near(floor, escalator.high, 0.1);
  }

  function runSelfTest() {
    const results = {};
    for (const escalator of ESCALATORS) {
      results[`${escalator.id}:correct`] = directionAllowed(
        escalator,
        escalator.direction === 'up' ? escalator.low : escalator.high,
        escalator.direction
      );
      results[`${escalator.id}:reverse-blocked`] = !directionAllowed(
        escalator,
        escalator.direction === 'up' ? escalator.high : escalator.low,
        escalator.direction === 'up' ? 'down' : 'up'
      );
    }
    results.down21CannotAscend = !directionAllowed(ESCALATORS[1], ESCALATORS[1].low, 'up');
    results.down32CannotAscend = !directionAllowed(ESCALATORS[3], ESCALATORS[3].low, 'up');
    results.up12CannotDescend = !directionAllowed(ESCALATORS[0], ESCALATORS[0].high, 'down');
    results.up23CannotDescend = !directionAllowed(ESCALATORS[2], ESCALATORS[2].high, 'down');
    return {
      passed:Object.values(results).every(Boolean),
      checks:results,
      escalatorCount:ESCALATORS.length
    };
  }

  function updateAudit(state) {
    const selfTest = runSelfTest();
    window.__UCAN_ENVIRONMENT_PARITY_AUDIT__ = {
      version:VERSION,
      build:BUILD,
      installed:true,
      inXR:state.inXR,
      browserAndQuestSameEscalatorDirections:true,
      oneWayElectricEscalators:true,
      downEscalatorsCannotAscend:selfTest.checks.down21CannotAscend && selfTest.checks.down32CannotAscend,
      upEscalatorsCannotDescend:selfTest.checks.up12CannotDescend && selfTest.checks.up23CannotDescend,
      rooftopStairsRemainBidirectional:true,
      sharedNaturalSpeed:NATURAL_SPEED,
      sharedComfortSpeed:COMFORT_SPEED,
      sharedSmoothTurnSpeed:SMOOTH_TURN_SPEED,
      visualParityLayer:window.__UCAN_QUEST_VISUAL_ROOFTOP_PARITY__?.version || null,
      heightAndFloorLayer:window.__UCAN_XR_FLOOR_STAIR_AUDIT__?.version || null,
      gateCount:state.gates.length,
      enabledGates:state.gates.filter(item => item.gate.isEnabled()).map(item => item.escalator.id),
      wrongWayAttempts:{ ...state.wrongWayAttempts },
      lastBlockedEscalator:state.lastBlockedEscalator,
      selfTest,
      runSelfTest
    };
  }

  function install(scene, helper) {
    if (!helper || helper.__ucanV282EnvironmentEscalatorParity) return helper;
    helper.__ucanV282EnvironmentEscalatorParity = true;

    const state = {
      scene,
      helper,
      xr:helper.baseExperience.camera,
      desktop:scene.activeCamera,
      inXR:false,
      gates:[],
      lastSafePosition:new B.Vector3(0, PLAYER_HEIGHT, 42),
      exitCooldownUntil:0,
      lastDesktopRide:false,
      lastXRTransition:false,
      wrongWayAttempts:{ up12:0, down21:0, up23:0, down32:0 },
      lastBlockedEscalator:null,
      lastWarningAt:0,
      auditFrame:0
    };
    states.set(scene, state);
    createGates(scene, state);

    helper.baseExperience.onStateChangedObservable.add(xrState => {
      state.inXR = xrState === B.WebXRState.IN_XR;
      if (state.inXR) {
        state.lastSafePosition.copyFrom(state.xr.position);
        status('V282: Meta Quest y browser usan las mismas direcciones de escaleras eléctricas.');
      } else if (xrState === B.WebXRState.NOT_IN_XR) {
        state.lastSafePosition.copyFrom(state.desktop.position);
      }
      updateGates(state);
      updateAudit(state);
    });

    scene.onBeforeRenderObservable.add(() => {
      updateRideCooldown(state);
      guardWrongWayEntry(state);
    }, -1, true);

    scene.onBeforeRenderObservable.add(() => {
      updateGates(state);
      if (++state.auditFrame % 30 === 0) updateAudit(state);
    });

    updateGates(state);
    updateAudit(state);
    console.info('[UCAN V282] Paridad de entornos y escaleras eléctricas unidireccionales instalada.');
    return helper;
  }

  const original = B.Scene.prototype.createDefaultXRExperienceAsync;
  if (original.__ucanV282EnvironmentEscalatorPatched) return;
  async function patched(options = {}) {
    const helper = await original.call(this, options);
    return install(this, helper);
  }
  patched.__ucanV282EnvironmentEscalatorPatched = true;
  patched.__ucanOriginal = original;
  B.Scene.prototype.createDefaultXRExperienceAsync = patched;

  window.__UCAN_ENVIRONMENT_PARITY_BOOT__ = {
    version:VERSION,
    build:BUILD,
    patched:true,
    browserQuestEscalatorParity:true,
    oneWayElectricEscalators:true,
    downEscalatorsCannotAscend:true,
    rooftopStairsBidirectional:true
  };
})();
