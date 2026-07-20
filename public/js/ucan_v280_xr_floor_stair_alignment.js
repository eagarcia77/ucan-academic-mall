(() => {
  'use strict';

  const VERSION = 'V280';
  const BUILD = 'V280-20260720-XR-HEIGHT-STAIRS-FLOOR-SNAP';
  const B = window.BABYLON;
  if (!B?.Scene?.prototype?.createDefaultXRExperienceAsync) return;

  const LEVEL = Object.freeze({ one:0, two:8.2, three:16.4, roof:27.2 });
  const FLOORS = Object.freeze([LEVEL.one, LEVEL.two, LEVEL.three, LEVEL.roof]);
  const DEFAULT_EYE_HEIGHT = 1.72;
  const ENTRY_DEPTH = 6.4;
  const ENTRY_MARGIN_X = 1.05;
  const FLOOR_EPSILON = 0.42;
  const HEIGHT_MIN = 0.85;
  const HEIGHT_MAX = 2.35;
  const ENTRY_COOLDOWN_MS = 1800;

  const LANES = Object.freeze([
    { id:'p1-p2-oeste', minX:-24.8, maxX:-15.2, zLow:34.4, zHigh:7.6, low:LEVEL.one, high:LEVEL.two },
    { id:'p2-p1-este', minX:-12.8, maxX:-3.2, zLow:34.4, zHigh:7.6, low:LEVEL.one, high:LEVEL.two },
    { id:'p2-p3-oeste', minX:-38.8, maxX:-29.2, zLow:34.4, zHigh:7.6, low:LEVEL.two, high:LEVEL.three },
    { id:'p3-p2-este', minX:-30.8, maxX:-21.2, zLow:34.4, zHigh:7.6, low:LEVEL.two, high:LEVEL.three },
    { id:'p3-terraza', minX:38.7, maxX:49.3, zLow:41.2, zHigh:8.0, low:LEVEL.three, high:LEVEL.roof }
  ]);

  const states = new WeakMap();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const finite = value => Number.isFinite(Number(value));
  const nearestFloor = y => FLOORS.reduce((best, floor) => Math.abs(y - floor) < Math.abs(y - best) ? floor : best, FLOORS[0]);
  const near = (a, b, epsilon = FLOOR_EPSILON) => Math.abs(Number(a) - Number(b)) <= epsilon;

  function status(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const element = document.getElementById('status');
    if (element && !window.__UCAN_API__?.setStatus) element.textContent = message;
  }

  function readEyeHeight(camera, fallback = DEFAULT_EYE_HEIGHT) {
    const candidates = [camera?.realWorldHeight, camera?._realWorldHeight, fallback];
    const value = candidates.map(Number).find(item => finite(item) && item >= HEIGHT_MIN && item <= HEIGHT_MAX);
    return value ?? DEFAULT_EYE_HEIGHT;
  }

  function feetY(state) {
    return Number(state.xr?.position?.y || 0) - state.eyeHeight;
  }

  function setFeetY(state, value) {
    if (!state.xr?.position || !finite(value)) return;
    state.xr.position.y = Number(value) + state.eyeHeight;
    state.lastFeetY = Number(value);
  }

  function laneProgress(position, lane) {
    return clamp((lane.zLow - position.z) / (lane.zLow - lane.zHigh), 0, 1);
  }

  function laneAt(position, marginX = ENTRY_MARGIN_X, marginZ = 1.7) {
    return LANES.find(lane =>
      position.x >= lane.minX - marginX && position.x <= lane.maxX + marginX &&
      position.z >= Math.min(lane.zLow, lane.zHigh) - marginZ &&
      position.z <= Math.max(lane.zLow, lane.zHigh) + marginZ
    ) || null;
  }

  function activeStairGround(state) {
    const lane = laneAt(state.xr.position, 0.75, 1.9);
    if (!lane) return null;
    const progress = laneProgress(state.xr.position, lane);
    if (progress <= 0.015 || progress >= 0.985) return null;
    return { lane, progress, ground:lerp(lane.low, lane.high, progress) };
  }

  function correctHeadHeight(state) {
    const camera = state.xr;
    if (!camera?.position) return;

    const measured = readEyeHeight(camera, state.eyeHeight);
    if (Math.abs(measured - state.eyeHeight) > 0.015) state.eyeHeight = measured;

    const stair = activeStairGround(state);
    if (stair) {
      const expected = stair.ground + state.eyeHeight;
      if (Math.abs(camera.position.y - expected) > 0.025) camera.position.y = expected;
      state.lastFeetY = stair.ground;
      state.lastLane = stair.lane.id;
      return;
    }

    const rawY = Number(camera.position.y);
    const currentFeet = rawY - state.eyeHeight;
    const headWrittenAsFloor = FLOORS.find(floor => near(rawY, floor, 0.48));
    if (headWrittenAsFloor !== undefined && !near(currentFeet, headWrittenAsFloor, 0.7)) {
      setFeetY(state, headWrittenAsFloor);
      state.corrections += 1;
      state.lastCorrection = 'head-written-as-floor';
      return;
    }

    const floor = nearestFloor(currentFeet);
    if (near(currentFeet, floor, 0.16)) {
      const expected = floor + state.eyeHeight;
      if (Math.abs(rawY - expected) > 0.025) camera.position.y = expected;
      state.lastFeetY = floor;
    }
  }

  function widenStairEntry(state) {
    const now = performance.now();
    if (now < state.entryCooldownUntil || !state.xr?.position) return;

    const position = state.xr.position;
    const currentFeet = feetY(state);
    for (const lane of LANES) {
      const withinX = position.x >= lane.minX - ENTRY_MARGIN_X && position.x <= lane.maxX + ENTRY_MARGIN_X;
      if (!withinX) continue;

      const lowEntry = near(currentFeet, lane.low, 0.72) && Math.abs(position.z - lane.zLow) <= ENTRY_DEPTH;
      const highEntry = near(currentFeet, lane.high, 0.72) && Math.abs(position.z - lane.zHigh) <= ENTRY_DEPTH;
      if (!lowEntry && !highEntry) continue;

      const centerX = (lane.minX + lane.maxX) / 2;
      position.x = lerp(position.x, centerX, 0.58);
      position.z = lowEntry
        ? clamp(position.z, lane.zHigh + 0.35, lane.zLow - 0.22)
        : clamp(position.z, lane.zHigh + 0.22, lane.zLow - 0.35);
      state.entryCooldownUntil = now + ENTRY_COOLDOWN_MS;
      state.entryAssists += 1;
      state.lastLane = lane.id;
      status(lowEntry ? 'Escalera detectada: ascenso automático activado.' : 'Escalera detectada: descenso automático activado.');
      break;
    }
  }

  function floorSnapRecovery(state) {
    if (!state.xr?.position) return;
    const currentFeet = feetY(state);
    const closest = nearestFloor(currentFeet);
    const onLane = laneAt(state.xr.position, 0.8, 2.2);
    if (onLane) return;

    const rawY = Number(state.xr.position.y);
    const rawClosest = nearestFloor(rawY);
    if (near(rawY, rawClosest, 0.5) && !near(currentFeet, rawClosest, 0.8)) {
      setFeetY(state, rawClosest);
      state.floorSnaps += 1;
      state.lastCorrection = 'post-transition-floor-snap';
      status(`Nivel ${FLOORS.indexOf(rawClosest) + 1} alineado correctamente en VR.`);
      return;
    }

    if (Math.abs(currentFeet - closest) <= 0.22) setFeetY(state, closest);
  }

  function updateAudit(state) {
    const currentFeet = state.xr ? feetY(state) : null;
    window.__UCAN_XR_FLOOR_STAIR_AUDIT__ = {
      version:VERSION,
      build:BUILD,
      installed:true,
      inXR:state.inXR,
      eyeHeight:Number(state.eyeHeight.toFixed(3)),
      cameraY:state.xr ? Number(state.xr.position.y.toFixed(3)) : null,
      feetY:finite(currentFeet) ? Number(currentFeet.toFixed(3)) : null,
      nearestFloor:finite(currentFeet) ? nearestFloor(currentFeet) : null,
      lastLane:state.lastLane,
      corrections:state.corrections,
      floorSnaps:state.floorSnaps,
      entryAssists:state.entryAssists,
      lastCorrection:state.lastCorrection,
      separatesHeadHeightFromFloor:true,
      automaticStairEntryExpanded:true,
      postTransitionSnap:true
    };
  }

  function update(state) {
    if (!state.inXR || !state.xr?.position) return;
    correctHeadHeight(state);
    floorSnapRecovery(state);
    widenStairEntry(state);
    if (++state.auditFrame % 20 === 0) updateAudit(state);
  }

  function install(scene, helper) {
    if (!helper || helper.__ucanV280FloorStairAlignment) return helper;
    helper.__ucanV280FloorStairAlignment = true;

    const xr = helper.baseExperience.camera;
    const state = {
      scene, helper, xr,
      inXR:false,
      eyeHeight:DEFAULT_EYE_HEIGHT,
      lastFeetY:0,
      lastLane:null,
      entryCooldownUntil:0,
      corrections:0,
      floorSnaps:0,
      entryAssists:0,
      lastCorrection:null,
      auditFrame:0
    };
    states.set(scene, state);

    helper.baseExperience.onInitialXRPoseSetObservable.add(camera => {
      state.eyeHeight = readEyeHeight(camera, state.eyeHeight);
      state.lastFeetY = nearestFloor(Number(camera.position.y || 0));
      updateAudit(state);
    });

    helper.baseExperience.onStateChangedObservable.add(value => {
      state.inXR = value === B.WebXRState.IN_XR;
      if (state.inXR) {
        state.eyeHeight = readEyeHeight(xr, state.eyeHeight);
        state.entryCooldownUntil = performance.now() + 450;
        setTimeout(() => {
          if (!state.inXR) return;
          correctHeadHeight(state);
          floorSnapRecovery(state);
          updateAudit(state);
        }, 120);
        status('V280: altura del avatar y escaleras VR alineadas con los pisos del entorno.');
      } else if (value === B.WebXRState.NOT_IN_XR) {
        state.lastLane = null;
      }
      updateAudit(state);
    });

    scene.onBeforeRenderObservable.add(() => update(state));
    updateAudit(state);
    console.info('[UCAN V280] Alineación de altura, pisos y escaleras WebXR instalada.');
    return helper;
  }

  const original = B.Scene.prototype.createDefaultXRExperienceAsync;
  if (original.__ucanV280FloorStairPatched) return;
  async function patched(options = {}) {
    const helper = await original.call(this, options);
    return install(this, helper);
  }
  patched.__ucanV280FloorStairPatched = true;
  patched.__ucanOriginal = original;
  B.Scene.prototype.createDefaultXRExperienceAsync = patched;

  window.__UCAN_XR_FLOOR_STAIR_BOOT__ = {
    version:VERSION,
    build:BUILD,
    patched:true,
    eyeHeightAware:true,
    expandedStairEntry:true,
    floorSnapRecovery:true
  };
})();
