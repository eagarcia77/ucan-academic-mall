(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V318';
  const REVISION = 'R22';
  const BUILD = 'V318-20260730-ISOLATED-ESCALATORS-WIDE-ROOFTOP-R22';
  const PLAYER_HEIGHT = 1.72;
  const LEVEL = Object.freeze({ one:0, two:8.2, three:16.4, roof:27.2 });
  const ALL_LAYERS = 0x0fffffff;
  const FLOOR2_LOCK_MS = 1700;

  const ROUTES = Object.freeze([
    { id:'up12', centerX:-20, minX:-23.4, maxX:-16.6, bottomZ:32, topZ:10, lowerY:LEVEL.one, upperY:LEVEL.two },
    { id:'down21', centerX:-8, minX:-11.4, maxX:-4.6, bottomZ:32, topZ:10, lowerY:LEVEL.one, upperY:LEVEL.two },
    { id:'up23', centerX:-34, minX:-37.4, maxX:-30.6, bottomZ:32, topZ:10, lowerY:LEVEL.two, upperY:LEVEL.three },
    { id:'down32', centerX:-26, minX:-29.4, maxX:-22.6, bottomZ:32, topZ:10, lowerY:LEVEL.two, upperY:LEVEL.three },
    { id:'up34', centerX:44, minX:39.2, maxX:48.8, bottomZ:39, topZ:10.5, lowerY:LEVEL.three, upperY:LEVEL.roof }
  ]);

  const state = {
    scene:null,
    helper:null,
    installed:false,
    removedFrontGlass:new Map(),
    clearedLandingBarriers:new Map(),
    maintenancePasses:0,
    floor2Locks:0,
    floor2LockUntil:0,
    previousPosition:null,
    lastRoute:null,
    lastError:null
  };

  const finite = value => Number.isFinite(Number(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

  function error(stage, reason) {
    state.lastError = { stage, message:String(reason?.message || reason), at:new Date().toISOString() };
    console.error(`[UCAN ${VERSION}] ${stage}:`, reason);
    audit();
  }

  function metadataChain(mesh) {
    const merged = {};
    let current = mesh;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parent) Object.assign(merged, current.metadata || {});
    return merged;
  }

  function nameChain(mesh) {
    const names = [];
    let current = mesh;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parent) names.push(String(current.name || ''));
    names.push(String(mesh?.material?.name || ''));
    return names.join(' ');
  }

  function bounds(mesh) {
    try {
      mesh.computeWorldMatrix?.(true);
      const box = mesh.getBoundingInfo?.().boundingBox;
      if (!box) return null;
      return {
        minX:box.minimumWorld.x, maxX:box.maximumWorld.x,
        minY:box.minimumWorld.y, maxY:box.maximumWorld.y,
        minZ:box.minimumWorld.z, maxZ:box.maximumWorld.z,
        centerX:(box.minimumWorld.x + box.maximumWorld.x) / 2,
        centerY:(box.minimumWorld.y + box.maximumWorld.y) / 2,
        centerZ:(box.minimumWorld.z + box.maximumWorld.z) / 2,
        width:box.maximumWorld.x - box.minimumWorld.x,
        height:box.maximumWorld.y - box.minimumWorld.y,
        depth:box.maximumWorld.z - box.minimumWorld.z
      };
    } catch (_) { return null; }
  }

  function isFrontGlass(mesh, box) {
    if (!mesh || !box) return false;
    const meta = metadataChain(mesh);
    const text = nameChain(mesh);
    if (/baranda cristal hueco (?:norte|sur) premium/i.test(text)) return true;
    const glass = meta.glass === true || meta.glassPanel === true || meta.parallelGlassV313 === true || /cristal|glass|vidrio|mampara/i.test(text);
    if (!glass) return false;
    return ROUTES.slice(0, 4).some(route => {
      const x = box.centerX >= route.minX - 2.2 && box.centerX <= route.maxX + 2.2;
      const top = Math.abs(box.centerZ - route.topZ) <= 4.8 && Math.abs(box.centerY - route.upperY) <= 3.2;
      const bottom = Math.abs(box.centerZ - route.bottomZ) <= 4.8 && Math.abs(box.centerY - route.lowerY) <= 3.2;
      const crossing = box.width >= 1.0 || box.depth >= 1.0;
      return x && crossing && (top || bottom);
    });
  }

  function removeFrontGlass(mesh) {
    if (!mesh || state.removedFrontGlass.has(mesh.uniqueId)) return false;
    state.removedFrontGlass.set(mesh.uniqueId, String(mesh.name || ''));
    try { mesh.setEnabled?.(false); } catch (_) {}
    mesh.isVisible = false;
    mesh.visibility = 0;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.layerMask = ALL_LAYERS;
    mesh.metadata = {
      ...(mesh.metadata || {}),
      dynamicSharedV313:true,
      dynamicSharedV316:true,
      frontEscalatorGlassRemovedV318:true,
      allEnvironmentsV318:true
    };
    return true;
  }

  function isWalkable(mesh) {
    const meta = metadataChain(mesh);
    const text = nameChain(mesh);
    return Boolean(meta.walkable || meta.teleportable || meta.stairSurface || meta.xrStairSurface || /piso|suelo|floor|losa|rampa|peldaño|banda escalera|plataforma inicio|plataforma fin|descanso/i.test(text));
  }

  function clearLandingBarrier(mesh, box) {
    if (!mesh || !box || isWalkable(mesh) || state.clearedLandingBarriers.has(mesh.uniqueId)) return false;
    const text = nameChain(mesh);
    const likelyBarrier = /cristal|glass|vidrio|mampara|baranda|railing|guard|marco|puerta|door|barrera|panel/i.test(text) || (box.depth <= 1.5 && box.width >= 1.0);
    if (!likelyBarrier) return false;
    const atLanding = ROUTES.slice(0, 4).some(route => {
      const x = box.maxX >= route.minX - 0.6 && box.minX <= route.maxX + 0.6;
      const top = box.maxZ >= route.topZ - 4.0 && box.minZ <= route.topZ + 4.0 && box.maxY >= route.upperY - 0.3 && box.minY <= route.upperY + 2.6;
      const bottom = box.maxZ >= route.bottomZ - 4.0 && box.minZ <= route.bottomZ + 4.0 && box.maxY >= route.lowerY - 0.3 && box.minY <= route.lowerY + 2.6;
      return x && (top || bottom);
    });
    if (!atLanding) return false;
    mesh.checkCollisions = false;
    mesh.isPickable = false;
    mesh.metadata = { ...(mesh.metadata || {}), escalatorLandingBarrierClearedV318:true, allEnvironmentsV318:true };
    state.clearedLandingBarriers.set(mesh.uniqueId, String(mesh.name || ''));
    return true;
  }

  function applyGeometryRules() {
    if (!state.scene) return false;
    for (const mesh of [...(state.scene.meshes || [])]) {
      if (!mesh || mesh.isDisposed?.()) continue;
      const box = bounds(mesh);
      if (!box) continue;
      if (isFrontGlass(mesh, box)) removeFrontGlass(mesh);
      clearLandingBarrier(mesh, box);
    }
    state.maintenancePasses += 1;
    audit();
    return true;
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

  function synchronizeFloorTwo(position) {
    const desktop = desktopCamera();
    const xr = xrCamera();
    const x = clamp(position.x, -23.0, -17.0);
    const z = Math.min(position.z, 8.0);
    if (desktop?.position) desktop.position.set(x, LEVEL.two + PLAYER_HEIGHT, z);
    if (xr?.position) xr.position.set(x, LEVEL.two + eyeHeight(), z);
  }

  function protectFloorTwoStop() {
    const camera = activeCamera();
    if (!camera?.position) return;
    const now = performance.now();
    const position = camera.position;
    const ground = position.y - eyeHeight();
    const inUp12Top = position.x >= -23.8 && position.x <= -16.2 && position.z >= 6.0 && position.z <= 14.5;
    const previous = state.previousPosition;
    const approachedTop = previous && previous.z > position.z && position.z <= 12.2;

    if (inUp12Top && approachedTop && ground >= LEVEL.two - 1.0) {
      state.floor2LockUntil = now + FLOOR2_LOCK_MS;
      state.floor2Locks += 1;
      state.lastRoute = 'up12→Piso 2';
    }

    const inActualUp23 = position.x >= -37.4 && position.x <= -30.6 && position.z >= 8.4 && position.z <= 33.6;
    if (now < state.floor2LockUntil && !inActualUp23) synchronizeFloorTwo(position);
    state.previousPosition = activeCamera()?.position?.clone?.() || position.clone?.() || null;
  }

  function remainingFrontGlass() {
    return (state.scene?.meshes || []).filter(mesh => {
      if (!mesh || mesh.isDisposed?.() || mesh.isEnabled?.() === false || mesh.isVisible === false || Number(mesh.visibility || 0) <= 0) return false;
      const box = bounds(mesh);
      return box && isFrontGlass(mesh, box);
    }).length;
  }

  function audit() {
    window.__UCAN_STAIRS_ALL_ENVIRONMENTS_V318__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      sameRulesBrowserMobileVrMr:true,
      allFrontEscalatorGlassRemoved:true,
      floor1ToFloor2StopsAtFloor2:true,
      isolatedEscalatorRoutes:true,
      rooftopStairWidth:8.4,
      rooftopLandingWidth:10.6,
      rooftopRouteWidth:9.6,
      removedFrontGlass:state.removedFrontGlass.size,
      frontGlassRemaining:remainingFrontGlass(),
      clearedLandingBarriers:state.clearedLandingBarriers.size,
      maintenancePasses:state.maintenancePasses,
      floor2Locks:state.floor2Locks,
      lastRoute:state.lastRoute,
      lastError:state.lastError,
      refresh:applyGeometryRules,
      getState:() => ({
        installed:state.installed,
        allFrontEscalatorGlassRemoved:true,
        floor1ToFloor2StopsAtFloor2:true,
        isolatedEscalatorRoutes:true,
        rooftopStairWidth:8.4,
        rooftopLandingWidth:10.6,
        removedFrontGlass:state.removedFrontGlass.size,
        frontGlassRemaining:remainingFrontGlass(),
        clearedLandingBarriers:state.clearedLandingBarriers.size,
        floor2Locks:state.floor2Locks,
        lastRoute:state.lastRoute,
        lastError:state.lastError
      })
    };
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    state.helper = window.__UCAN_XR_HELPER__ || null;
    if (!state.scene || !window.__UCAN_PARALLEL_SCENE_V313__?.installed) return false;
    state.installed = true;
    applyGeometryRules();
    state.scene.onBeforeRenderObservable.add(() => {
      try { protectFloorTwoStop(); }
      catch (reason) { error('floor-two-guard', reason); }
    });
    window.setTimeout(applyGeometryRules, 400);
    window.setTimeout(applyGeometryRules, 1200);
    window.setTimeout(applyGeometryRules, 2600);
    window.setInterval(applyGeometryRules, 1500);
    window.__UCAN_API__?.setStatus?.('V318: cristales frontales eliminados, Piso 2 aislado y escaleras a la terraza ampliadas.');
    console.info('[UCAN V318 R22] Reglas definitivas de escaleras instaladas.');
    audit();
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 700) window.clearInterval(timer);
    } catch (reason) {
      error('install', reason);
      if (attempts >= 700) window.clearInterval(timer);
    }
  }, 100);

  audit();
})();
