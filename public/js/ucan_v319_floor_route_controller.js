(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V319';
  const REVISION = 'R23';
  const BUILD = 'V319-20260730-SINGLE-GROUND-CONTROLLER-SAFE-LANDING-R23';
  const PLAYER_HEIGHT = 1.72;
  const LEVELS = Object.freeze([0, 8.2, 16.4, 27.2]);
  const EPSILON = 0.001;
  const EXIT_DURATION_MS = 720;

  const ROUTES = Object.freeze([
    { id:'up12', fromFloor:0, toFloor:8.2, minX:-22.8, maxX:-17.2, fromZ:32, toZ:10, entryRadius:5.8, exitZ:5.6 },
    { id:'down21', fromFloor:8.2, toFloor:0, minX:-10.8, maxX:-5.2, fromZ:10, toZ:32, entryRadius:5.8 },
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
    activeDirection:0,
    exitAssist:null,
    routeFrames:0,
    floorCorrections:0,
    completedRoutes:0,
    safeLandingCompletions:0,
    lastGround:0,
    lastPosition:null,
    lastError:null
  };

  const finite = value => Number.isFinite(Number(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const nearestFloor = value => LEVELS.reduce((best, floor) => Math.abs(value - floor) < Math.abs(value - best) ? floor : best, LEVELS[0]);
  const sameFloor = (a, b) => Math.abs(Number(a) - Number(b)) < 0.15;

  function recordError(stage, reason) {
    state.lastError = { stage, message:String(reason?.message || reason), at:new Date().toISOString() };
    console.error(`[UCAN ${VERSION}] ${stage}:`, reason);
    audit();
  }

  function xrActive() {
    const XR = B.WebXRState || {};
    const value = state.helper?.baseExperience?.state;
    return value === XR.ENTERING_XR || value === XR.IN_XR;
  }

  function desktopCamera() {
    return window.__UCAN_API__?.getCamera?.() || state.scene?.activeCamera || null;
  }

  function xrCamera() {
    return state.helper?.baseExperience?.camera || null;
  }

  function activeCamera() {
    return xrActive() ? xrCamera() : desktopCamera();
  }

  function eyeHeight() {
    const value = Number(xrCamera()?.realWorldHeight || xrCamera()?._realWorldHeight);
    return xrActive() && finite(value) && value >= 0.8 && value <= 2.4 ? value : PLAYER_HEIGHT;
  }

  function routeById(id) {
    return ROUTES.find(route => route.id === id) || null;
  }

  function withinLane(route, position, padding = 0) {
    return position.x >= route.minX - padding && position.x <= route.maxX + padding;
  }

  function routeContains(route, position) {
    const minZ = Math.min(route.fromZ, route.toZ) - 1.0;
    const maxZ = Math.max(route.fromZ, route.toZ) + 1.0;
    return withinLane(route, position, 0.25) && position.z >= minZ && position.z <= maxZ;
  }

  function atRouteEntry(route, position) {
    return sameFloor(route.fromFloor, state.stableFloor) && withinLane(route, position, 0.15) && Math.abs(position.z - route.fromZ) <= route.entryRadius;
  }

  function chooseEntryRoute(position) {
    const candidates = ROUTES.filter(route => atRouteEntry(route, position));
    if (!candidates.length) return null;
    candidates.sort((a, b) => Math.abs(position.x - (a.minX + a.maxX) / 2) - Math.abs(position.x - (b.minX + b.maxX) / 2));
    return candidates[0];
  }

  function routeProgress(route, position) {
    return clamp((position.z - route.fromZ) / (route.toZ - route.fromZ), 0, 1);
  }

  function beginRoute(route, position) {
    state.activeRoute = route.id;
    state.activeDirection = Math.sign(route.toZ - route.fromZ) || 1;
    state.lastPosition = { x:Number(position.x), z:Number(position.z) };
  }

  function beginExitAssist(route, position) {
    if (route.id !== 'up12') return;
    state.exitAssist = {
      routeId:route.id,
      startedAt:performance.now(),
      duration:EXIT_DURATION_MS,
      fromX:Number(position.x),
      fromZ:Number(position.z),
      targetX:-20,
      targetZ:route.exitZ
    };
  }

  function finishRoute(route, position) {
    state.stableFloor = route.toFloor;
    state.lastGround = route.toFloor;
    state.completedRoutes += 1;
    state.activeRoute = null;
    state.activeDirection = 0;
    beginExitAssist(route, position);
  }

  function activeRouteGround(position) {
    let route = routeById(state.activeRoute);
    if (!route) {
      route = chooseEntryRoute(position);
      if (route) beginRoute(route, position);
    }
    if (!route) return null;

    // Una ruta iniciada permanece activa mientras el usuario esté dentro de su corredor.
    // Salirse lateralmente cancela la ruta y devuelve al último piso estable.
    if (!routeContains(route, position)) {
      state.activeRoute = null;
      state.activeDirection = 0;
      return null;
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
    const elapsed = performance.now() - assist.startedAt;
    const t = clamp(elapsed / assist.duration, 0, 1);
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

    const estimated = Number(position.y || PLAYER_HEIGHT) - eyeHeight();
    const nearest = nearestFloor(estimated);
    if (Math.abs(estimated - nearest) <= 0.45 && Math.abs(nearest - state.stableFloor) >= 7.5) state.stableFloor = nearest;
    state.lastGround = state.stableFloor;
    return state.stableFloor;
  }

  function synchronizeCameras(active, ground) {
    const desktop = desktopCamera();
    const xr = xrCamera();
    const desiredActiveY = ground + (xrActive() ? eyeHeight() : PLAYER_HEIGHT);
    if (Math.abs(Number(active.position.y) - desiredActiveY) > EPSILON) {
      active.position.y = desiredActiveY;
      state.floorCorrections += 1;
    }
    if (desktop?.position) {
      desktop.position.x = active.position.x;
      desktop.position.z = active.position.z;
      desktop.position.y = ground + PLAYER_HEIGHT;
    }
    if (xr?.position) {
      xr.position.x = active.position.x;
      xr.position.z = active.position.z;
      xr.position.y = ground + eyeHeight();
    }
  }

  function update() {
    const camera = activeCamera();
    if (!camera?.position) return;
    applyExitAssist(camera);
    const ground = resolveGround(camera.position, state.lastGround);
    synchronizeCameras(camera, ground);
    state.lastPosition = { x:Number(camera.position.x), y:Number(ground), z:Number(camera.position.z) };
    audit();
  }

  function audit() {
    window.__UCAN_FLOOR_ROUTE_CONTROLLER_V319__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      singleGroundAuthority:true,
      oneRouteAtATime:true,
      entryRequiredAtPhysicalLanding:true,
      floor1ToFloor2StopsAtFloor2:true,
      automaticFloor1ToFloor3:false,
      safeLandingExitAssist:true,
      stableFloor:state.stableFloor,
      activeRoute:state.activeRoute,
      exitAssistActive:Boolean(state.exitAssist),
      routeFrames:state.routeFrames,
      floorCorrections:state.floorCorrections,
      completedRoutes:state.completedRoutes,
      safeLandingCompletions:state.safeLandingCompletions,
      lastGround:state.lastGround,
      lastPosition:state.lastPosition,
      lastError:state.lastError,
      resolveGround,
      setFloor:floor => {
        state.stableFloor = nearestFloor(Number(floor));
        state.activeRoute = null;
        state.exitAssist = null;
        update();
        return state.stableFloor;
      },
      getState:() => ({
        installed:state.installed,
        singleGroundAuthority:true,
        oneRouteAtATime:true,
        entryRequiredAtPhysicalLanding:true,
        floor1ToFloor2StopsAtFloor2:true,
        automaticFloor1ToFloor3:false,
        safeLandingExitAssist:true,
        stableFloor:state.stableFloor,
        activeRoute:state.activeRoute,
        exitAssistActive:Boolean(state.exitAssist),
        routeFrames:state.routeFrames,
        floorCorrections:state.floorCorrections,
        completedRoutes:state.completedRoutes,
        safeLandingCompletions:state.safeLandingCompletions,
        lastGround:state.lastGround,
        lastPosition:state.lastPosition,
        lastError:state.lastError
      })
    };
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    state.helper = window.__UCAN_XR_HELPER__ || null;
    const camera = activeCamera();
    if (!state.scene || !camera?.position || !window.__UCAN_COMPLETE_AUDIT_V316__?.installed) return false;
    state.stableFloor = nearestFloor(camera.position.y - eyeHeight());
    state.lastGround = state.stableFloor;
    state.installed = true;
    window.__UCAN_FLOOR_ROUTE_CONTROLLER_V319_ACTIVE__ = true;
    state.scene.onBeforeRenderObservable.add(() => {
      try { update(); }
      catch (reason) { recordError('frame', reason); }
    });
    state.helper?.baseExperience?.onStateChangedObservable?.add?.(() => {
      const cameraNow = activeCamera();
      if (cameraNow?.position) state.stableFloor = nearestFloor(cameraNow.position.y - eyeHeight());
      state.activeRoute = null;
      state.exitAssist = null;
      update();
    });
    window.__UCAN_API__?.setStatus?.('V319: salida segura al Piso 2 y un solo controlador de altura activos.');
    console.info('[UCAN V319 R23] Controlador único de altura y salida segura instalado.');
    audit();
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 700) window.clearInterval(timer);
    } catch (reason) {
      recordError('install', reason);
      if (attempts >= 700) window.clearInterval(timer);
    }
  }, 100);

  audit();
})();
