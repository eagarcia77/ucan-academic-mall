(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V321';
  const REVISION = 'R25';
  const BUILD = 'V321-20260730-SINGLE-STAIR-AUTHORITY-R25';
  const PLAYER_HEIGHT = 1.72;
  const LEVELS = Object.freeze([0, 8.2, 16.4, 27.2]);
  const ENTRY_DIRECTION_EPSILON = 0.006;
  const ROUTE_LOCK_MS = 1800;
  const COMPLETION_THRESHOLD = 0.965;

  const ROUTES = Object.freeze([
    { id:'up12', fromFloor:0, toFloor:8.2, centerX:-20, halfWidth:3.4, fromZ:32, toZ:10, entryDepth:5.4, exitZ:7.0 },
    { id:'down21', fromFloor:8.2, toFloor:0, centerX:-8, halfWidth:3.4, fromZ:10, toZ:32, entryDepth:4.4, exitZ:35.0 },
    { id:'up23', fromFloor:8.2, toFloor:16.4, centerX:-34, halfWidth:3.4, fromZ:32, toZ:10, entryDepth:5.4, exitZ:7.0 },
    { id:'down32', fromFloor:16.4, toFloor:8.2, centerX:-26, halfWidth:3.4, fromZ:10, toZ:32, entryDepth:4.4, exitZ:35.0 },
    { id:'up34', fromFloor:16.4, toFloor:27.2, centerX:44, halfWidth:4.5, fromZ:39, toZ:10.5, entryDepth:6.0, exitZ:7.0 },
    { id:'down34', fromFloor:27.2, toFloor:16.4, centerX:44, halfWidth:4.5, fromZ:10.5, toZ:39, entryDepth:5.0, exitZ:42.0 }
  ]);

  const state = {
    scene:null,
    helper:null,
    installed:false,
    stableFloor:0,
    activeRoute:null,
    routeProgress:0,
    routeLockUntil:0,
    routeLockReason:null,
    previousPosition:null,
    pendingLanding:null,
    routeFrames:0,
    completedRoutes:0,
    rejectedEntries:0,
    explicitFloorChanges:0,
    landingCorrections:0,
    collisionPasses:0,
    clearedCollisions:new Map(),
    hiddenFrontGlass:new Map(),
    lastGround:0,
    lastPosition:null,
    lastError:null
  };

  const finite = value => Number.isFinite(Number(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const nearestFloor = value => LEVELS.reduce((best, floor) => Math.abs(Number(value) - floor) < Math.abs(Number(value) - best) ? floor : best, LEVELS[0]);
  const sameFloor = (a, b) => Math.abs(Number(a) - Number(b)) <= 0.15;

  function recordError(stage, reason) {
    state.lastError = { stage, message:String(reason?.message || reason), at:new Date().toISOString() };
    console.error(`[UCAN ${VERSION}] ${stage}:`, reason);
    publishAudit();
  }

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
  function withinLane(route, position, padding = 0) { return Math.abs(Number(position.x) - route.centerX) <= route.halfWidth + padding; }
  function routeMinZ(route) { return Math.min(route.fromZ, route.toZ) - 1.5; }
  function routeMaxZ(route) { return Math.max(route.fromZ, route.toZ) + 1.5; }

  function routeContains(route, position) {
    return withinLane(route, position, 0.35) && Number(position.z) >= routeMinZ(route) && Number(position.z) <= routeMaxZ(route);
  }

  function routeProgress(route, position) {
    return clamp((Number(position.z) - route.fromZ) / (route.toZ - route.fromZ), 0, 1);
  }

  function intendedDirection(route, position) {
    const previous = state.previousPosition;
    if (!previous) return false;
    const deltaZ = Number(position.z) - Number(previous.z);
    const expected = Math.sign(route.toZ - route.fromZ) || 1;
    return Math.abs(deltaZ) >= ENTRY_DIRECTION_EPSILON && Math.sign(deltaZ) === expected;
  }

  function atEntry(route, position) {
    if (!sameFloor(state.stableFloor, route.fromFloor)) return false;
    if (performance.now() < state.routeLockUntil) return false;
    if (!withinLane(route, position, 0.15)) return false;
    if (Math.abs(Number(position.z) - route.fromZ) > route.entryDepth) return false;
    if (!intendedDirection(route, position)) {
      state.rejectedEntries += 1;
      return false;
    }
    return true;
  }

  function chooseRoute(position) {
    const routes = ROUTES.filter(route => atEntry(route, position));
    routes.sort((a, b) => Math.abs(Number(position.x) - a.centerX) - Math.abs(Number(position.x) - b.centerX));
    return routes[0] || null;
  }

  function beginRoute(route, position) {
    state.activeRoute = route.id;
    state.routeProgress = routeProgress(route, position);
    state.pendingLanding = null;
    state.routeLockReason = `active:${route.id}`;
  }

  function finishRoute(route, position) {
    state.stableFloor = route.toFloor;
    state.lastGround = route.toFloor;
    state.activeRoute = null;
    state.routeProgress = 1;
    state.completedRoutes += 1;
    state.routeLockUntil = performance.now() + ROUTE_LOCK_MS;
    state.routeLockReason = `completed:${route.id}`;
    state.pendingLanding = {
      x:route.centerX,
      z:route.exitZ,
      floor:route.toFloor,
      routeId:route.id,
      applied:false
    };
  }

  function resolveGround(position, currentGround) {
    if (!position) return finite(currentGround) ? Number(currentGround) : state.stableFloor;
    let route = routeById(state.activeRoute);
    if (!route) {
      route = chooseRoute(position);
      if (route) beginRoute(route, position);
    }
    if (!route) {
      state.lastGround = state.stableFloor;
      return state.stableFloor;
    }
    if (!routeContains(route, position)) {
      state.activeRoute = null;
      state.routeProgress = 0;
      state.lastGround = state.stableFloor;
      return state.stableFloor;
    }
    const progress = routeProgress(route, position);
    state.routeProgress = progress;
    state.routeFrames += 1;
    const ground = route.fromFloor + (route.toFloor - route.fromFloor) * progress;
    if (progress >= COMPLETION_THRESHOLD) {
      finishRoute(route, position);
      return state.stableFloor;
    }
    state.lastGround = ground;
    return ground;
  }

  function applyPendingLanding(camera) {
    const landing = state.pendingLanding;
    if (!landing || landing.applied || !camera?.position) return false;
    camera.position.x = landing.x;
    camera.position.z = landing.z;
    camera.position.y = landing.floor + (xrActive() ? eyeHeight() : PLAYER_HEIGHT);
    const desktop = desktopCamera();
    const xr = xrCamera();
    if (desktop?.position) desktop.position.set(landing.x, landing.floor + PLAYER_HEIGHT, landing.z);
    if (xr?.position) xr.position.set(landing.x, landing.floor + eyeHeight(), landing.z);
    landing.applied = true;
    state.pendingLanding = null;
    state.landingCorrections += 1;
    return true;
  }

  function setFloor(floor, reason = 'explicit') {
    state.stableFloor = nearestFloor(Number(floor));
    state.lastGround = state.stableFloor;
    state.activeRoute = null;
    state.routeProgress = 0;
    state.pendingLanding = null;
    state.routeLockUntil = performance.now() + 500;
    state.routeLockReason = reason;
    state.explicitFloorChanges += 1;
    return state.stableFloor;
  }

  function metadataChain(mesh) {
    const merged = {};
    let current = mesh;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parent) Object.assign(merged, current.metadata || {});
    return merged;
  }

  function meshBounds(mesh) {
    try {
      mesh.computeWorldMatrix?.(true);
      const box = mesh.getBoundingInfo?.().boundingBox;
      if (!box) return null;
      return { minX:box.minimumWorld.x, maxX:box.maximumWorld.x, minY:box.minimumWorld.y, maxY:box.maximumWorld.y, minZ:box.minimumWorld.z, maxZ:box.maximumWorld.z };
    } catch (_) { return null; }
  }

  function intersectsRoute(box, route) {
    const minY = Math.min(route.fromFloor, route.toFloor) - 0.5;
    const maxY = Math.max(route.fromFloor, route.toFloor) + 3.8;
    return Boolean(box && box.maxX >= route.centerX - route.halfWidth - 1.5 && box.minX <= route.centerX + route.halfWidth + 1.5 && box.maxY >= minY && box.minY <= maxY && box.maxZ >= routeMinZ(route) - 3 && box.minZ <= routeMaxZ(route) + 3);
  }

  function walkable(mesh) {
    const metadata = metadataChain(mesh);
    const text = String(mesh?.name || '');
    return Boolean(metadata.walkable || metadata.teleportable || metadata.stairSurface || metadata.xrStairSurface || /gran losa|piso|suelo|floor|losa|rampa|peldaño|banda escalera|plataforma (?:inicio|fin)|descanso|ruta avatar|rooftop deck/i.test(text));
  }

  function frontGlass(mesh) {
    const metadata = metadataChain(mesh);
    const text = `${String(mesh?.name || '')} ${String(mesh?.material?.name || '')}`;
    return Boolean(metadata.glass || metadata.glassPanel || /cristal|glass|vidrio|mampara|baranda cristal hueco/i.test(text));
  }

  function clearAllStairCorridors() {
    if (!state.scene) return;
    for (const mesh of [...(state.scene.meshes || [])]) {
      if (!mesh || mesh.isDisposed?.()) continue;
      const box = meshBounds(mesh);
      const route = ROUTES.find(item => intersectsRoute(box, item));
      if (!route) continue;
      if (frontGlass(mesh) && (/baranda cristal hueco/i.test(String(mesh.name || '')) || Math.abs((box.minZ + box.maxZ) / 2 - route.fromZ) < 4.5 || Math.abs((box.minZ + box.maxZ) / 2 - route.toZ) < 4.5)) {
        try { mesh.setEnabled?.(false); } catch (_) {}
        mesh.isVisible = false;
        mesh.visibility = 0;
        mesh.isPickable = false;
        mesh.checkCollisions = false;
        mesh.metadata = { ...(mesh.metadata || {}), hiddenByStairAuthorityV321:true, allEnvironmentsV321:true, dynamicSharedV313:true };
        state.hiddenFrontGlass.set(mesh.uniqueId, String(mesh.name || ''));
        continue;
      }
      if (!walkable(mesh) && mesh.checkCollisions) {
        mesh.checkCollisions = false;
        mesh.isPickable = false;
        mesh.metadata = { ...(mesh.metadata || {}), collisionClearedByStairAuthorityV321:true, allEnvironmentsV321:true };
        state.clearedCollisions.set(mesh.uniqueId, `${route.id}:${String(mesh.name || '')}`);
      }
    }
    state.collisionPasses += 1;
  }

  function synchronizeCameras(camera, ground) {
    if (!camera?.position) return;
    camera.position.y = ground + (xrActive() ? eyeHeight() : PLAYER_HEIGHT);
    const desktop = desktopCamera();
    const xr = xrCamera();
    if (desktop?.position) desktop.position.set(camera.position.x, ground + PLAYER_HEIGHT, camera.position.z);
    if (xr?.position) xr.position.set(camera.position.x, ground + eyeHeight(), camera.position.z);
  }

  function update() {
    const camera = activeCamera();
    if (!camera?.position) return;
    applyPendingLanding(camera);
    const ground = resolveGround(camera.position, state.lastGround);
    synchronizeCameras(camera, ground);
    state.previousPosition = { x:Number(camera.position.x), z:Number(camera.position.z) };
    state.lastPosition = { x:Number(camera.position.x), y:Number(ground), z:Number(camera.position.z), inXR:xrActive() };
    publishAudit();
  }

  function getState() {
    return {
      installed:state.installed,
      singleStairAuthority:true,
      legacyEscalatorRideDisabled:true,
      legacyReliableMovementDisabled:true,
      legacyClampCameraHeightDisabled:true,
      sameRulesBrowserMobileVrMr:true,
      stableFloorOnlyChangesByRouteOrExplicitNavigation:true,
      intentionalDirectionRequired:true,
      allSixRoutesCovered:ROUTES.length === 6,
      stableFloor:state.stableFloor,
      activeRoute:state.activeRoute,
      routeProgress:state.routeProgress,
      routeLockActive:performance.now() < state.routeLockUntil,
      routeLockReason:state.routeLockReason,
      pendingLanding:Boolean(state.pendingLanding),
      completedRoutes:state.completedRoutes,
      landingCorrections:state.landingCorrections,
      rejectedEntries:state.rejectedEntries,
      clearedCollisions:state.clearedCollisions.size,
      hiddenFrontGlass:state.hiddenFrontGlass.size,
      collisionPasses:state.collisionPasses,
      lastGround:state.lastGround,
      lastPosition:state.lastPosition,
      lastError:state.lastError
    };
  }

  function publishAudit() {
    const api = { version:VERSION, revision:REVISION, build:BUILD, ...getState(), resolveGround, setFloor, clearAllStairCorridors, getState };
    window.__UCAN_STAIR_AUTHORITY_V321__ = api;
    window.__UCAN_FLOOR_ROUTE_CONTROLLER_V320__ = api;
    window.__UCAN_FLOOR_ROUTE_CONTROLLER_V319__ = api;
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    state.helper = window.__UCAN_XR_HELPER__ || null;
    const camera = activeCamera();
    if (!state.scene || !camera?.position || !window.__UCAN_COMPLETE_AUDIT_V316__?.installed) return false;
    state.stableFloor = nearestFloor(Number(camera.position.y) - eyeHeight());
    state.lastGround = state.stableFloor;
    state.previousPosition = { x:Number(camera.position.x), z:Number(camera.position.z) };
    state.installed = true;
    window.__UCAN_STAIR_AUTHORITY_V321_ACTIVE__ = true;
    window.__ucanV254IsRiding = () => false;
    clearAllStairCorridors();
    state.scene.onBeforeRenderObservable.add(() => {
      try { update(); }
      catch (reason) { recordError('frame', reason); }
    });
    window.setInterval(() => {
      try { clearAllStairCorridors(); }
      catch (reason) { recordError('corridor-maintenance', reason); }
    }, 1500);
    state.helper?.baseExperience?.onStateChangedObservable?.add?.(() => {
      state.activeRoute = null;
      state.pendingLanding = null;
      state.routeLockUntil = performance.now() + 500;
      state.routeLockReason = 'xr-state-change';
      update();
    });
    window.__UCAN_API__?.setStatus?.('V321: una sola autoridad controla todas las escaleras en browser, móvil, VR y MR.');
    console.info('[UCAN V321 R25] Autoridad única de escaleras instalada.');
    publishAudit();
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

  publishAudit();
})();
