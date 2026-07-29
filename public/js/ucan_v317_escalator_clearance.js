(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V317';
  const REVISION = 'R21';
  const BUILD = 'V317-20260729-ESCALATOR-CLEARANCE-R21';
  const PLAYER_HEIGHT = 1.72;
  const ALL_LAYERS = 0x0fffffff;
  const RELEASE_DELAY_MS = 420;
  const RELEASE_COOLDOWN_MS = 1200;

  const ESCALATORS = Object.freeze([
    { id:'P1-P2 oeste', minX:-25.8, maxX:-14.2, bottomZ:32, topZ:10, lowerY:0, upperY:8.2 },
    { id:'P1-P2 este', minX:-13.8, maxX:-2.2, bottomZ:32, topZ:10, lowerY:0, upperY:8.2 },
    { id:'P2-P3 oeste', minX:-39.8, maxX:-28.2, bottomZ:32, topZ:10, lowerY:8.2, upperY:16.4 },
    { id:'P2-P3 este', minX:-31.8, maxX:-20.2, bottomZ:32, topZ:10, lowerY:8.2, upperY:16.4 }
  ]);

  const state = {
    scene:null,
    helper:null,
    installed:false,
    removedGlass:new Map(),
    clearedCollisions:new Map(),
    topReleaseCount:0,
    maintenancePasses:0,
    lastReleaseAt:0,
    stationarySince:0,
    lastPosition:null,
    lastError:null,
    lastTopZone:null
  };

  const finite = value => Number.isFinite(Number(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

  function recordError(stage, error) {
    state.lastError = { stage, message:String(error?.message || error), at:new Date().toISOString() };
    console.error(`[UCAN ${VERSION}] ${stage}:`, error);
    updateAudit();
  }

  function metadataChain(mesh) {
    const merged = {};
    let current = mesh;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parent) Object.assign(merged, current.metadata || {});
    return merged;
  }

  function nameChain(mesh) {
    const values = [];
    let current = mesh;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parent) values.push(String(current.name || ''));
    values.push(String(mesh?.material?.name || ''));
    return values.join(' ');
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

  function isGlass(mesh) {
    const meta = metadataChain(mesh);
    const text = nameChain(mesh);
    const material = mesh?.material;
    const alpha = Number(material?.alpha ?? 1);
    return Boolean(
      meta.glass === true || meta.glassPanel === true || meta.stairGlassPanel === true || meta.parallelGlassV313 === true ||
      /cristal|glass|vidrio|mampara/i.test(text) ||
      (alpha < 0.98 && /panel|baranda|railing|guard|puerta|ventana/i.test(text))
    );
  }

  function endpointFor(meshBounds) {
    if (!meshBounds) return null;
    for (const escalator of ESCALATORS) {
      if (meshBounds.centerX < escalator.minX - 1.2 || meshBounds.centerX > escalator.maxX + 1.2) continue;
      const nearTop = Math.abs(meshBounds.centerZ - escalator.topZ) <= 4.4 && Math.abs(meshBounds.centerY - escalator.upperY) <= 3.6;
      const nearBottom = Math.abs(meshBounds.centerZ - escalator.bottomZ) <= 4.4 && Math.abs(meshBounds.centerY - escalator.lowerY) <= 3.6;
      if (nearTop || nearBottom) return { escalator, end:nearTop ? 'superior' : 'inferior' };
    }
    return null;
  }

  function hideFrontGlass(mesh, endpoint) {
    if (!mesh || state.removedGlass.has(mesh.uniqueId)) return false;
    state.removedGlass.set(mesh.uniqueId, {
      name:String(mesh.name || ''),
      escalator:endpoint.escalator.id,
      end:endpoint.end
    });
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
      escalatorFrontGlassRemovedV317:true,
      escalatorClearanceV317:endpoint.escalator.id,
      escalatorEndV317:endpoint.end
    };
    return true;
  }

  function structuralWalkable(mesh) {
    const meta = metadataChain(mesh);
    const text = nameChain(mesh);
    return Boolean(
      meta.walkable || meta.teleportable || meta.stairSurface || meta.xrStairSurface ||
      /piso|losa|suelo|floor|rampa|escal[oó]n|peldaño|banda escalera|plataforma transitable|ruta avatar/i.test(text)
    );
  }

  function topExitFor(meshBounds) {
    if (!meshBounds) return null;
    for (const escalator of ESCALATORS) {
      const xOverlap = meshBounds.maxX >= escalator.minX - 0.8 && meshBounds.minX <= escalator.maxX + 0.8;
      const zOverlap = meshBounds.maxZ >= escalator.topZ - 3.8 && meshBounds.minZ <= escalator.topZ + 3.8;
      const yOverlap = meshBounds.maxY >= escalator.upperY - 0.4 && meshBounds.minY <= escalator.upperY + 2.5;
      if (xOverlap && zOverlap && yOverlap) return escalator;
    }
    return null;
  }

  function clearTopCollision(mesh, escalator, meshBounds) {
    if (!mesh || state.clearedCollisions.has(mesh.uniqueId) || structuralWalkable(mesh)) return false;
    const text = nameChain(mesh);
    const thinCrossing = meshBounds && meshBounds.depth <= 1.8 && meshBounds.width >= 0.8;
    const likelyBarrier = /cristal|glass|vidrio|mampara|baranda|railing|guard|marco|puerta|door|barrera|panel/i.test(text) || thinCrossing;
    if (!likelyBarrier) return false;
    state.clearedCollisions.set(mesh.uniqueId, { name:String(mesh.name || ''), escalator:escalator.id });
    mesh.checkCollisions = false;
    mesh.isPickable = false;
    mesh.metadata = {
      ...(mesh.metadata || {}),
      escalatorTopCollisionClearedV317:true,
      escalatorClearanceV317:escalator.id
    };
    return true;
  }

  function applyClearance() {
    if (!state.scene) return false;
    for (const mesh of [...(state.scene.meshes || [])]) {
      if (!mesh || mesh.isDisposed?.()) continue;
      const meshBounds = bounds(mesh);
      if (!meshBounds) continue;
      const endpoint = endpointFor(meshBounds);
      if (endpoint && isGlass(mesh)) hideFrontGlass(mesh, endpoint);
      const top = topExitFor(meshBounds);
      if (top) clearTopCollision(mesh, top, meshBounds);
    }
    state.maintenancePasses += 1;
    updateAudit();
    return true;
  }

  function xrActive() {
    const XR = B.WebXRState || {};
    const current = state.helper?.baseExperience?.state;
    return current === XR.ENTERING_XR || current === XR.IN_XR;
  }

  function controllerCamera() {
    return window.__UCAN_API__?.getCamera?.() || state.scene?.activeCamera || null;
  }

  function xrCamera() {
    return state.helper?.baseExperience?.camera || null;
  }

  function activeCamera() {
    return xrActive() ? xrCamera() : controllerCamera();
  }

  function eyeHeight() {
    const value = Number(xrCamera()?.realWorldHeight || xrCamera()?._realWorldHeight);
    return xrActive() && finite(value) && value >= 0.8 && value <= 2.4 ? value : PLAYER_HEIGHT;
  }

  function topZone(position) {
    if (!position) return null;
    for (const escalator of ESCALATORS) {
      if (position.x < escalator.minX - 0.5 || position.x > escalator.maxX + 0.5) continue;
      if (position.z < escalator.topZ - 2.0 || position.z > escalator.topZ + 2.4) continue;
      const ground = position.y - eyeHeight();
      if (Math.abs(ground - escalator.upperY) <= 1.0) return escalator;
    }
    return null;
  }

  function intendedWorldZ(camera, input) {
    if (!camera || !input) return 0;
    let forward = null;
    try { forward = camera.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward) return 0;
    forward.y = 0;
    if (forward.lengthSquared() < 0.0001) return 0;
    forward.normalize();
    const right = new B.Vector3(forward.z, 0, -forward.x).normalize();
    return forward.z * Number(input.forward || 0) + right.z * Number(input.strafe || 0);
  }

  function synchronizeRelease(escalator, x, z) {
    const desktop = controllerCamera();
    const xr = xrCamera();
    const desktopY = escalator.upperY + PLAYER_HEIGHT;
    const xrY = escalator.upperY + eyeHeight();
    if (desktop?.position) desktop.position.set(x, desktopY, z);
    if (xr?.position) xr.position.set(x, xrY, z);
    state.lastPosition = new B.Vector3(x, xrActive() ? xrY : desktopY, z);
  }

  function antiStuckFrame() {
    const camera = activeCamera();
    if (!camera?.position) return;
    const zone = topZone(camera.position);
    state.lastTopZone = zone?.id || null;
    const input = window.__UCAN_COMPLETE_AUDIT_V316__?.lastInput || null;
    const magnitude = Number(input?.magnitude || 0);
    const directionZ = intendedWorldZ(camera, input);
    const now = performance.now();

    if (!zone || magnitude < 0.22 || directionZ >= -0.05) {
      state.stationarySince = 0;
      state.lastPosition = camera.position.clone();
      return;
    }

    const moved = state.lastPosition ? B.Vector3.DistanceSquared(camera.position, state.lastPosition) : Infinity;
    state.lastPosition = camera.position.clone();
    if (moved > 0.0009) {
      state.stationarySince = now;
      return;
    }
    if (!state.stationarySince) state.stationarySince = now;
    if (now - state.stationarySince < RELEASE_DELAY_MS || now - state.lastReleaseAt < RELEASE_COOLDOWN_MS) return;

    const x = clamp(camera.position.x, zone.minX + 0.5, zone.maxX - 0.5);
    const z = zone.topZ - 2.35;
    synchronizeRelease(zone, x, z);
    state.topReleaseCount += 1;
    state.lastReleaseAt = now;
    state.stationarySince = 0;
    window.__UCAN_API__?.setStatus?.(`Salida superior de ${zone.id} despejada.`);
    updateAudit();
  }

  function updateAudit() {
    window.__UCAN_ESCALATOR_CLEARANCE_V317__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      browserVrSameClearance:true,
      frontEscalatorGlassRemoved:true,
      topEscalatorCollisionCleared:true,
      antiStuckTopRelease:true,
      scriptedStairTransition:false,
      removedGlass:state.removedGlass.size,
      clearedCollisions:state.clearedCollisions.size,
      topReleaseCount:state.topReleaseCount,
      maintenancePasses:state.maintenancePasses,
      lastTopZone:state.lastTopZone,
      lastError:state.lastError,
      refresh:applyClearance,
      getState:() => ({
        installed:state.installed,
        removedGlass:state.removedGlass.size,
        clearedCollisions:state.clearedCollisions.size,
        topReleaseCount:state.topReleaseCount,
        maintenancePasses:state.maintenancePasses,
        lastTopZone:state.lastTopZone,
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
    applyClearance();
    state.scene.onBeforeRenderObservable.add(() => {
      try { antiStuckFrame(); }
      catch (error) { recordError('frame', error); }
    });
    window.setTimeout(applyClearance, 500);
    window.setTimeout(applyClearance, 1400);
    window.setTimeout(applyClearance, 2400);
    window.setInterval(applyClearance, 1600);
    window.__UCAN_API__?.setStatus?.('V317: salidas de escaleras eléctricas despejadas y cristales frontales eliminados.');
    console.info('[UCAN V317 R21] Despeje de escaleras eléctricas instalado.');
    updateAudit();
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 600) window.clearInterval(timer);
    } catch (error) {
      recordError('install', error);
      if (attempts >= 600) window.clearInterval(timer);
    }
  }, 100);
  updateAudit();
})();