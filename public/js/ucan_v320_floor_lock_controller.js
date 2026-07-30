(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V320';
  const REVISION = 'R24';
  const BUILD = 'V320-20260730-FLOOR-TWO-STICKY-LOCK-R24';
  const PLAYER_HEIGHT = 1.72;
  const LEVELS = Object.freeze([0, 8.2, 16.4, 27.2]);
  const FLOOR_LOCK_MS = 6500;
  const ENTRY_DIRECTION_EPSILON = 0.012;
  const EXIT_DURATION_MS = 620;

  const ROUTES = Object.freeze([
    { id:'up12', fromFloor:0, toFloor:8.2, minX:-22.8, maxX:-17.2, fromZ:32, toZ:10, entryRadius:5.8, exitX:-20, exitZ:4.8 },
    { id:'down21', fromFloor:8.2, toFloor:0, minX:-10.8, maxX:-5.2, fromZ:10, toZ:32, entryRadius:4.8 },
    { id:'up23', fromFloor:8.2, toFloor:16.4, minX:-36.8, maxX:-31.2, fromZ:32, toZ:10, entryRadius:5.8 },
    { id:'down32', fromFloor:16.4, toFloor:8.2, minX:-28.8, maxX:-23.2, fromZ:10, toZ:32, entryRadius:5.8 },
    { id:'up34', fromFloor:16.4, toFloor:27.2, minX:39.5, maxX:48.5, fromZ:39, toZ:10.5, entryRadius:6.5 },
    { id:'down34', fromFloor:27.2, toFloor:16.4, minX:39.5, maxX:48.5, fromZ:10.5, toZ:39, entryRadius:6.5 }
  ]);

  const state = {
    scene:null,
    helper:null,
    installed:false,
    stableFloor:0,
    activeRoute:null,
    exitAssist:null,
    floorLockUntil:0,
    floorLockReason:null,
    previousPosition:null,
    routeFrames:0,
    completedRoutes:0,
    safeLandingCompletions:0,
    rejectedReverseEntries:0,
    explicitFloorChanges:0,
    lastGround:0,
    lastError:null
  };

  const finite = value => Number.isFinite(Number(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const nearestFloor = value => LEVELS.reduce((best, floor) => Math.abs(value - floor) < Math.abs(value - best) ? floor : best, LEVELS[0]);
  const sameFloor = (a, b) => Math.abs(Number(a) - Number(b)) < 0.15;

  function xrActive() {
    const XR = B.WebXRState || {};
    const value = state.helper?.baseExperience?.state;
    return value === XR.ENTERING_XR || value === XR.IN_XR;
  }

  function desktopCamera() { return window.__UCAN_API__?.getCamera?.() || state.scene?.activeCamera || null; }
  function xrCamera() { return state.helper?.baseExperience?.camera || null; }
  function activeCamera() { return xrActive() ? xrCamera() : desktopCamera(); }

  function eyeHeight() {
    const value = Number(xrCamera()?.realWorldHeight || xrCamera()?._realWorldHeight);
    return xrActive() && finite(value) && value >= 0.8 && value <= 2.4 ? value : PLAYER_HEIGHT;
  }

  function routeById(id) { return ROUTES.find(route => route.id === id) || null; }
  function withinLane(route, position, padding = 0) { return position.x >= route.minX - padding && position.x <= route.maxX + padding; }

  function routeContains(route, position) {
    const minZ = Math.min(route.fromZ, route.toZ) - 1.0;
    const maxZ = Math.max(route.fromZ, route.toZ) + 1.0;
    return withinLane(route, position, 0.25) && position.z >= minZ && position.z <= maxZ;
  }

  function intendedDirection(route, position) {
    const previous = state.previousPosition;
    if (!previous) return false;
    const deltaZ = Number(position.z) - Number(previous.z);
    const expected = Math.sign(route.toZ - route.fromZ) || 1;
    return Math.abs(deltaZ) >= ENTRY_DIRECTION_EPSILON && Math.sign(deltaZ) === expected;
  }

  function atRouteEntry(route, position) {
    if (!sameFloor(route.fromFloor, state.stableFloor)) return false;
    if (!withinLane(route, position, 0.15)) return false;
    if (Math.abs(position.z - route.fromZ) > route.entryRadius) return false;
    if (performance.now() < state.floorLockUntil) return false;
    if (!intendedDirection(route, position)) {
      state.rejectedReverseEntries += 1;
      return false;
    }
    return true;
  }

  function chooseEntryRoute(position) {
    const candidates = ROUTES.filter(route => atRouteEntry(route, position));
    candidates.sort((a, b) => Math.abs(position.x - (a.minX + a.maxX) / 2) - Math.abs(position.x - (b.minX + b.maxX) / 2));
    return candidates[0] || null;
  }

  function routeProgress(route, position) { return clamp((position.z - route.fromZ) / (route.toZ - route.fromZ), 0, 1); }

  function beginRoute(route) {
    state.activeRoute = route.id;
    state.exitAssist = null;
  }

  function beginExitAssist(route, position) {
    if (route.id !== 'up12') return;
    state.exitAssist = {
      startedAt:performance.now(),
      duration:EXIT_DURATION_MS,
      fromX:Number(position.x),
      fromZ:Number(position.z),
      targetX:route.exitX,
      targetZ:route.exitZ
    };
  }

  function finishRoute(route, position) {
    state.stableFloor = route.toFloor;
    state.lastGround = route.toFloor;
    state.completedRoutes += 1;
    state.activeRoute = null;
    state.floorLockUntil = performance.now() + FLOOR_LOCK_MS;
    state.floorLockReason = `${route.id}→${route.toFloor}`;
    beginExitAssist(route, position);
  }

  function activeRouteGround(position) {
    let route = routeById(state.activeRoute);
    if (!route) {
      route = chooseEntryRoute(position);
      if (route) beginRoute(route);
    }
    if (!route) return null;
    if (!routeContains(route, position)) {
      state.activeRoute = null;
      return state.stableFloor;
    }
    const progress = routeProgress(route, position);
    const ground = route.fromFloor + (route.toFloor - route.fromFloor) * progress;
    state.routeFrames += 1;
    if (progress >= 0.94) finishRoute(route, position);
    return state.activeRoute ? ground : state.stableFloor;
  }

  function applyExitAssist(camera) {
    const assist = state.exitAssist;
    if (!assist || !camera?.position) return false;
    const t = clamp((performance.now() - assist.startedAt) / assist.duration, 0, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    camera.position.x = assist.fromX + (assist.targetX - assist.fromX) * eased;
    camera.position.z = assist.fromZ + (assist.targetZ - assist.fromZ) * eased;
    if (t >= 1) {
      camera.position.x = assist.targetX;
      camera.position.z = assist.targetZ;
      state.exitAssist = null;
      state.safeLandingCompletions += 1;
    }
    return true;
  }

  function resolveGround(position, currentGround) {
    if (!position) return finite(currentGround) ? Number(currentGround) : state.stableFloor;
    if (state.exitAssist) return state.stableFloor;
    const routeGround = activeRouteGround(position);
    if (finite(routeGround)) {
      state.lastGround = Number(routeGround);
      return state.lastGround;
    }
    // El nivel estable no se deriva de la altura momentánea de la cámara. Solo cambia al
    // completar una ruta o mediante setFloor(), evitando regresar al Piso 1 por un cuadro XR.
    state.lastGround = state.stableFloor;
    return state.stableFloor;
  }

  function synchronizeCameras(active, ground) {
    const desktop = desktopCamera();
    const xr = xrCamera();
    if (active?.position) active.position.y = ground + (xrActive() ? eyeHeight() : PLAYER_HEIGHT);
    if (desktop?.position && active?.position) desktop.position.set(active.position.x, ground + PLAYER_HEIGHT, active.position.z);
    if (xr?.position && active?.position) xr.position.set(active.position.x, ground + eyeHeight(), active.position.z);
  }

  function setFloor(floor, reason = 'explicit') {
    state.stableFloor = nearestFloor(Number(floor));
    state.lastGround = state.stableFloor;
    state.activeRoute = null;
    state.exitAssist = null;
    state.floorLockUntil = performance.now() + 500;
    state.floorLockReason = reason;
    state.explicitFloorChanges += 1;
    return state.stableFloor;
  }

  function update() {
    const camera = activeCamera();
    if (!camera?.position) return;
    applyExitAssist(camera);
    const ground = resolveGround(camera.position, state.lastGround);
    synchronizeCameras(camera, ground);
    state.previousPosition = { x:Number(camera.position.x), z:Number(camera.position.z) };
    audit();
  }

  function getState() {
    return {
      installed:state.installed,
      singleGroundAuthority:true,
      stableFloorOnlyChangesByRouteOrExplicitNavigation:true,
      intentionalDirectionRequired:true,
      floor1ToFloor2StopsAtFloor2:true,
      automaticReturnToFloor1:false,
      safeLandingExitAssist:true,
      stableFloor:state.stableFloor,
      activeRoute:state.activeRoute,
      exitAssistActive:Boolean(state.exitAssist),
      floorLockActive:performance.now() < state.floorLockUntil,
      floorLockReason:state.floorLockReason,
      routeFrames:state.routeFrames,
      completedRoutes:state.completedRoutes,
      safeLandingCompletions:state.safeLandingCompletions,
      rejectedReverseEntries:state.rejectedReverseEntries,
      explicitFloorChanges:state.explicitFloorChanges,
      lastGround:state.lastGround,
      lastError:state.lastError
    };
  }

  function audit() {
    const api = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      ...getState(),
      resolveGround,
      setFloor,
      getState
    };
    window.__UCAN_FLOOR_ROUTE_CONTROLLER_V320__ = api;
    window.__UCAN_FLOOR_ROUTE_CONTROLLER_V319__ = api;
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    state.helper = window.__UCAN_XR_HELPER__ || null;
    const camera = activeCamera();
    if (!state.scene || !camera?.position || !window.__UCAN_COMPLETE_AUDIT_V316__?.installed) return false;
    state.stableFloor = nearestFloor(camera.position.y - eyeHeight());
    state.lastGround = state.stableFloor;
    state.previousPosition = { x:Number(camera.position.x), z:Number(camera.position.z) };
    state.installed = true;
    window.__UCAN_FLOOR_ROUTE_CONTROLLER_V320_ACTIVE__ = true;
    state.scene.onBeforeRenderObservable.add(() => {
      try { update(); }
      catch (reason) {
        state.lastError = { stage:'frame', message:String(reason?.message || reason), at:new Date().toISOString() };
        audit();
      }
    });
    state.helper?.baseExperience?.onStateChangedObservable?.add?.(() => {
      // Conserva el piso estable al cambiar de browser a VR o viceversa.
      state.activeRoute = null;
      state.exitAssist = null;
      state.floorLockUntil = performance.now() + 1200;
      state.floorLockReason = 'xr-state-change';
      update();
    });
    window.__UCAN_API__?.setStatus?.('V320: Piso 2 bloqueado hasta una bajada intencional.');
    audit();
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 700) window.clearInterval(timer);
    } catch (reason) {
      state.lastError = { stage:'install', message:String(reason?.message || reason), at:new Date().toISOString() };
      audit();
      if (attempts >= 700) window.clearInterval(timer);
    }
  }, 100);

  audit();
})();
