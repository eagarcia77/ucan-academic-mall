(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V322';
  const REVISION = 'R26';
  const BUILD = 'V322-20260730-PURE-STAIR-GROUND-AUTHORITY-R26';
  const LEVELS = Object.freeze([0, 8.2, 16.4, 27.2]);
  const ENTRY_DIRECTION_EPSILON = 0.004;
  const ROUTE_LOCK_MS = 1200;
  const COMPLETION_THRESHOLD = 0.985;

  const ROUTES = Object.freeze([
    { id:'up12',   fromFloor:0,    toFloor:8.2,  centerX:-20, halfWidth:3.45, fromZ:32,   toZ:10,   entryDepth:5.0 },
    { id:'down21', fromFloor:8.2,  toFloor:0,    centerX:-8,  halfWidth:3.45, fromZ:10,   toZ:32,   entryDepth:4.5 },
    { id:'up23',   fromFloor:8.2,  toFloor:16.4, centerX:-34, halfWidth:3.45, fromZ:32,   toZ:10,   entryDepth:5.0 },
    { id:'down32', fromFloor:16.4, toFloor:8.2,  centerX:-26, halfWidth:3.45, fromZ:10,   toZ:32,   entryDepth:4.5 },
    { id:'up34',   fromFloor:16.4, toFloor:27.2, centerX:44,  halfWidth:4.55, fromZ:39,   toZ:10.5, entryDepth:6.0 },
    { id:'down34', fromFloor:27.2, toFloor:16.4, centerX:44,  halfWidth:4.55, fromZ:10.5, toZ:39,   entryDepth:5.5 }
  ]);

  const state = {
    scene:null,
    installed:false,
    stableFloor:0,
    activeRoute:null,
    routeProgress:0,
    routeLockUntil:0,
    routeLockReason:null,
    previousPosition:null,
    completedRoutes:0,
    cancelledRoutes:0,
    rejectedEntries:0,
    explicitFloorChanges:0,
    resolveCalls:0,
    geometryPasses:0,
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
  const routeById = id => ROUTES.find(route => route.id === id) || null;

  function recordError(stage, reason) {
    state.lastError = { stage, message:String(reason?.message || reason), at:new Date().toISOString() };
    console.error(`[UCAN ${VERSION}] ${stage}:`, reason);
    publish();
  }

  function withinLane(route, position, padding = 0) {
    return Math.abs(Number(position?.x) - route.centerX) <= route.halfWidth + padding;
  }

  function routeProgress(route, position) {
    return clamp((Number(position?.z) - route.fromZ) / (route.toZ - route.fromZ), 0, 1);
  }

  function inRouteCorridor(route, position) {
    const minZ = Math.min(route.fromZ, route.toZ) - 2.2;
    const maxZ = Math.max(route.fromZ, route.toZ) + 2.2;
    return withinLane(route, position, 0.85) && Number(position?.z) >= minZ && Number(position?.z) <= maxZ;
  }

  function intendedDirection(route, position) {
    const previous = state.previousPosition;
    if (!previous) return false;
    const deltaZ = Number(position?.z) - Number(previous.z);
    const expected = Math.sign(route.toZ - route.fromZ) || 1;
    return Math.abs(deltaZ) >= ENTRY_DIRECTION_EPSILON && Math.sign(deltaZ) === expected;
  }

  function atEntry(route, position) {
    if (!sameFloor(state.stableFloor, route.fromFloor)) return false;
    if (performance.now() < state.routeLockUntil) return false;
    if (!withinLane(route, position, 0.2)) return false;
    if (Math.abs(Number(position?.z) - route.fromZ) > route.entryDepth) return false;
    if (!intendedDirection(route, position)) {
      state.rejectedEntries += 1;
      return false;
    }
    return true;
  }

  function chooseRoute(position) {
    const matches = ROUTES.filter(route => atEntry(route, position));
    matches.sort((a, b) => Math.abs(Number(position?.x) - a.centerX) - Math.abs(Number(position?.x) - b.centerX));
    return matches[0] || null;
  }

  function beginRoute(route, position) {
    state.activeRoute = route.id;
    state.routeProgress = routeProgress(route, position);
    state.routeLockReason = `active:${route.id}`;
  }

  function endpointReached(route, position, progress) {
    const expected = Math.sign(route.toZ - route.fromZ) || 1;
    const crossed = expected < 0 ? Number(position?.z) <= route.toZ + 0.35 : Number(position?.z) >= route.toZ - 0.35;
    return crossed || progress >= COMPLETION_THRESHOLD;
  }

  function finishRoute(route) {
    state.stableFloor = route.toFloor;
    state.lastGround = route.toFloor;
    state.activeRoute = null;
    state.routeProgress = 1;
    state.completedRoutes += 1;
    state.routeLockUntil = performance.now() + ROUTE_LOCK_MS;
    state.routeLockReason = `completed:${route.id}`;
    return state.stableFloor;
  }

  function cancelRoute(route, progress) {
    state.stableFloor = progress >= 0.5 ? route.toFloor : route.fromFloor;
    state.lastGround = state.stableFloor;
    state.activeRoute = null;
    state.routeProgress = 0;
    state.cancelledRoutes += 1;
    state.routeLockUntil = performance.now() + 500;
    state.routeLockReason = `cancelled:${route.id}`;
    return state.stableFloor;
  }

  function resolveGround(position, currentGround) {
    state.resolveCalls += 1;
    if (!position) return finite(currentGround) ? Number(currentGround) : state.stableFloor;

    let route = routeById(state.activeRoute);
    if (!route) {
      route = chooseRoute(position);
      if (route) beginRoute(route, position);
    }

    let ground = state.stableFloor;
    if (route) {
      const progress = routeProgress(route, position);
      state.routeProgress = progress;
      if (!inRouteCorridor(route, position)) ground = cancelRoute(route, progress);
      else if (endpointReached(route, position, progress)) ground = finishRoute(route);
      else {
        ground = route.fromFloor + (route.toFloor - route.fromFloor) * progress;
        state.lastGround = ground;
      }
    } else {
      state.lastGround = state.stableFloor;
    }

    state.previousPosition = { x:Number(position.x), z:Number(position.z) };
    state.lastPosition = { x:Number(position.x), y:Number(ground), z:Number(position.z) };
    publish();
    return ground;
  }

  function setFloor(floor, reason = 'explicit') {
    state.stableFloor = nearestFloor(Number(floor));
    state.lastGround = state.stableFloor;
    state.activeRoute = null;
    state.routeProgress = 0;
    state.routeLockUntil = performance.now() + 500;
    state.routeLockReason = reason;
    state.explicitFloorChanges += 1;
    publish();
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
      return {
        minX:box.minimumWorld.x, maxX:box.maximumWorld.x,
        minY:box.minimumWorld.y, maxY:box.maximumWorld.y,
        minZ:box.minimumWorld.z, maxZ:box.maximumWorld.z,
        centerZ:(box.minimumWorld.z + box.maximumWorld.z) / 2
      };
    } catch (_) { return null; }
  }

  function intersectsRoute(box, route) {
    const minY = Math.min(route.fromFloor, route.toFloor) - 0.45;
    const maxY = Math.max(route.fromFloor, route.toFloor) + 3.5;
    const minZ = Math.min(route.fromZ, route.toZ) - 3.2;
    const maxZ = Math.max(route.fromZ, route.toZ) + 3.2;
    return Boolean(box &&
      box.maxX >= route.centerX - route.halfWidth - 1.3 && box.minX <= route.centerX + route.halfWidth + 1.3 &&
      box.maxY >= minY && box.minY <= maxY && box.maxZ >= minZ && box.minZ <= maxZ);
  }

  function walkable(mesh) {
    const metadata = metadataChain(mesh);
    const text = String(mesh?.name || '');
    return Boolean(metadata.walkable || metadata.teleportable || metadata.stairSurface || metadata.xrStairSurface ||
      /gran losa|piso|suelo|floor|losa|rampa|peldaño|banda escalera|plataforma (?:inicio|fin)|descanso|ruta avatar|rooftop deck/i.test(text));
  }

  function frontGlass(mesh, box, route) {
    const metadata = metadataChain(mesh);
    const text = `${String(mesh?.name || '')} ${String(mesh?.material?.name || '')}`;
    const glass = metadata.glass || metadata.glassPanel || /cristal|glass|vidrio|mampara|baranda cristal hueco/i.test(text);
    if (!glass || !box) return false;
    return /baranda cristal hueco/i.test(text) || Math.abs(box.centerZ - route.fromZ) <= 4.6 || Math.abs(box.centerZ - route.toZ) <= 4.6;
  }

  function clearStairGeometry() {
    if (!state.scene) return false;
    for (const mesh of [...(state.scene.meshes || [])]) {
      if (!mesh || mesh.isDisposed?.()) continue;
      const box = meshBounds(mesh);
      const route = ROUTES.find(item => intersectsRoute(box, item));
      if (!route) continue;
      if (frontGlass(mesh, box, route)) {
        try { mesh.setEnabled?.(false); } catch (_) {}
        mesh.isVisible = false;
        mesh.visibility = 0;
        mesh.isPickable = false;
        mesh.checkCollisions = false;
        mesh.metadata = { ...(mesh.metadata || {}), hiddenByV322:true, geometryOnlyV322:true, dynamicSharedV313:true };
        state.hiddenFrontGlass.set(mesh.uniqueId, String(mesh.name || ''));
        continue;
      }
      if (!walkable(mesh) && mesh.checkCollisions) {
        mesh.checkCollisions = false;
        mesh.isPickable = false;
        mesh.metadata = { ...(mesh.metadata || {}), collisionClearedByV322:true, geometryOnlyV322:true };
        state.clearedCollisions.set(mesh.uniqueId, `${route.id}:${String(mesh.name || '')}`);
      }
    }
    state.geometryPasses += 1;
    publish();
    return true;
  }

  function getState() {
    return {
      installed:state.installed,
      singleStairAuthority:true,
      pureGroundProvider:true,
      authorityMovesCamera:false,
      authorityOwnsRenderLoop:false,
      forcedLandingTeleport:false,
      legacyV318CameraGuardLoaded:false,
      legacyV319LandingLayerLoaded:false,
      sameRulesBrowserMobileVrMr:true,
      allSixRoutesCovered:ROUTES.length === 6,
      stableFloor:state.stableFloor,
      activeRoute:state.activeRoute,
      routeProgress:state.routeProgress,
      routeLockActive:performance.now() < state.routeLockUntil,
      routeLockReason:state.routeLockReason,
      completedRoutes:state.completedRoutes,
      cancelledRoutes:state.cancelledRoutes,
      rejectedEntries:state.rejectedEntries,
      resolveCalls:state.resolveCalls,
      explicitFloorChanges:state.explicitFloorChanges,
      hiddenFrontGlass:state.hiddenFrontGlass.size,
      clearedCollisions:state.clearedCollisions.size,
      geometryPasses:state.geometryPasses,
      lastGround:state.lastGround,
      lastPosition:state.lastPosition,
      lastError:state.lastError
    };
  }

  function publish() {
    const api = { version:VERSION, revision:REVISION, build:BUILD, ...getState(), resolveGround, setFloor, clearStairGeometry, getState };
    window.__UCAN_STAIR_AUTHORITY_V322__ = api;
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    const camera = window.__UCAN_API__?.getCamera?.() || state.scene?.activeCamera || null;
    if (!state.scene || !camera?.position || !window.__UCAN_COMPLETE_AUDIT_V316__?.installed) return false;
    const eye = Number(camera.position.y) - 1.72;
    state.stableFloor = nearestFloor(eye);
    state.lastGround = state.stableFloor;
    state.previousPosition = { x:Number(camera.position.x), z:Number(camera.position.z) };
    state.installed = true;
    window.__UCAN_STAIR_AUTHORITY_V322_ACTIVE__ = true;
    clearStairGeometry();
    window.setInterval(() => {
      try { clearStairGeometry(); }
      catch (reason) { recordError('geometry-maintenance', reason); }
    }, 1800);
    window.__UCAN_API__?.setStatus?.('V322: una sola resolución de altura controla todas las escaleras; ninguna capa adicional mueve la cámara.');
    console.info('[UCAN V322 R26] Autoridad pura de altura instalada.');
    publish();
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

  publish();
})();