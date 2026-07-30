(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V318';
  const REVISION = 'R22';
  const BUILD = 'V318-20260730-FLOOR-ROUTE-CONTROLLER-R22';
  const PLAYER_HEIGHT = 1.72;
  const LEVELS = Object.freeze([0, 8.2, 16.4, 27.2]);
  const EPSILON = 0.001;

  const ROUTES = Object.freeze([
    { id:'up12', fromFloor:0, toFloor:8.2, minX:-22.8, maxX:-17.2, fromZ:32, toZ:10 },
    { id:'down21', fromFloor:8.2, toFloor:0, minX:-10.8, maxX:-5.2, fromZ:10, toZ:32 },
    { id:'up23', fromFloor:8.2, toFloor:16.4, minX:-36.8, maxX:-31.2, fromZ:32, toZ:10 },
    { id:'down32', fromFloor:16.4, toFloor:8.2, minX:-28.8, maxX:-23.2, fromZ:10, toZ:32 },
    { id:'up34', fromFloor:16.4, toFloor:27.2, minX:39.5, maxX:48.5, fromZ:39, toZ:10.5 },
    { id:'down34', fromFloor:27.2, toFloor:16.4, minX:39.5, maxX:48.5, fromZ:10.5, toZ:39 }
  ]);

  const state = {
    scene:null,
    helper:null,
    installed:false,
    stableFloor:0,
    activeRoute:null,
    routeFrames:0,
    floorCorrections:0,
    completedRoutes:0,
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

  function routeContains(route, position) {
    const minZ = Math.min(route.fromZ, route.toZ) - 0.8;
    const maxZ = Math.max(route.fromZ, route.toZ) + 0.8;
    return position.x >= route.minX && position.x <= route.maxX && position.z >= minZ && position.z <= maxZ;
  }

  function eligibleRoute(position) {
    const candidates = ROUTES.filter(route => sameFloor(route.fromFloor, state.stableFloor) && routeContains(route, position));
    if (!candidates.length) return null;
    candidates.sort((a, b) => Math.abs(position.x - (a.minX + a.maxX) / 2) - Math.abs(position.x - (b.minX + b.maxX) / 2));
    return candidates[0];
  }

  function routeProgress(route, position) {
    return clamp((position.z - route.fromZ) / (route.toZ - route.fromZ), 0, 1);
  }

  function routeGround(route, position) {
    const progress = routeProgress(route, position);
    return {
      progress,
      ground:route.fromFloor + (route.toFloor - route.fromFloor) * progress
    };
  }

  function synchronizeCameras(active, ground) {
    const desktop = desktopCamera();
    const xr = xrCamera();
    const activeEye = xrActive() ? eyeHeight() : PLAYER_HEIGHT;
    const desiredActiveY = ground + activeEye;
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

  function updateRouteAndFloor() {
    const camera = activeCamera();
    if (!camera?.position) return;
    const position = camera.position;
    const route = eligibleRoute(position);
    let ground = state.stableFloor;

    if (route) {
      const result = routeGround(route, position);
      ground = result.ground;
      state.activeRoute = route.id;
      state.routeFrames += 1;
      if (result.progress >= 0.975) {
        state.stableFloor = route.toFloor;
        ground = route.toFloor;
        state.completedRoutes += 1;
        state.activeRoute = null;
      }
    } else {
      state.activeRoute = null;
      // Solo se cambia de piso fuera de una ruta cuando el usuario fue colocado explícitamente
      // cerca de un nivel válido mediante navegación o teletransporte.
      const estimated = position.y - eyeHeight();
      const nearest = nearestFloor(estimated);
      if (Math.abs(estimated - nearest) <= 0.45 && Math.abs(nearest - state.stableFloor) >= 7.5) {
        state.stableFloor = nearest;
        ground = nearest;
      }
    }

    synchronizeCameras(camera, ground);
    state.lastPosition = { x:Number(position.x), y:Number(ground), z:Number(position.z) };
    audit();
  }

  function audit() {
    window.__UCAN_FLOOR_ROUTE_CONTROLLER_V318__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      oneRouteAtATime:true,
      routeSelectionByCurrentFloor:true,
      floor1ToFloor2StopsAtFloor2:true,
      automaticFloor1ToFloor3:false,
      routesDoNotOverlap:true,
      stableFloor:state.stableFloor,
      activeRoute:state.activeRoute,
      routeFrames:state.routeFrames,
      floorCorrections:state.floorCorrections,
      completedRoutes:state.completedRoutes,
      lastPosition:state.lastPosition,
      lastError:state.lastError,
      setFloor:floor => {
        const next = nearestFloor(Number(floor));
        state.stableFloor = next;
        updateRouteAndFloor();
        return next;
      },
      getState:() => ({
        installed:state.installed,
        oneRouteAtATime:true,
        routeSelectionByCurrentFloor:true,
        floor1ToFloor2StopsAtFloor2:true,
        automaticFloor1ToFloor3:false,
        routesDoNotOverlap:true,
        stableFloor:state.stableFloor,
        activeRoute:state.activeRoute,
        routeFrames:state.routeFrames,
        floorCorrections:state.floorCorrections,
        completedRoutes:state.completedRoutes,
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
    state.installed = true;
    window.__UCAN_FLOOR_ROUTE_CONTROLLER_V318_ACTIVE__ = true;
    state.scene.onBeforeRenderObservable.add(() => {
      try { updateRouteAndFloor(); }
      catch (reason) { recordError('frame', reason); }
    });
    state.helper?.baseExperience?.onStateChangedObservable?.add?.(() => {
      const active = activeCamera();
      if (active?.position) state.stableFloor = nearestFloor(active.position.y - eyeHeight());
      updateRouteAndFloor();
    });
    window.__UCAN_API__?.setStatus?.('V318: controlador de pisos activo; cada escalera termina en su nivel correspondiente.');
    console.info('[UCAN V318 R22] Controlador de pisos y rutas instalado.');
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
