(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V326';
  const REVISION = 'R30';
  const BUILD = 'V326-20260806-XR-LANDING-RELEASE-R30';
  const CLEARANCE = 3.2;
  const CARRY_SPEED = 2.8;
  const TIMEOUT_MS = 5500;

  const ROUTES = Object.freeze({
    up12:  { centerX:-20, halfWidth:3.45, toZ:10,   toFloor:8.2,  direction:-1 },
    down21:{ centerX:-8,  halfWidth:3.45, toZ:32,   toFloor:0,    direction:1 },
    up23:  { centerX:-34, halfWidth:3.45, toZ:10,   toFloor:16.4, direction:-1 },
    down32:{ centerX:-26, halfWidth:3.45, toZ:32,   toFloor:8.2,  direction:1 },
    up34:  { centerX:44,  halfWidth:4.55, toZ:10.5, toFloor:27.2, direction:-1 },
    down34:{ centerX:44,  halfWidth:4.55, toZ:39,   toFloor:16.4, direction:1 }
  });

  const state = {
    installed:false,
    scene:null,
    helper:null,
    xr:null,
    desktop:null,
    observer:null,
    previousRoute:null,
    previousCompleted:0,
    landing:null,
    carriesStarted:0,
    carriesCompleted:0,
    carryFrames:0,
    forcedFinishes:0,
    clearedCollisionMeshes:0,
    hiddenGlassMeshes:0,
    lastWorld:null,
    lastError:null
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const stairApi = () => window.__UCAN_STAIR_AUTHORITY_V322__ || null;
  const xrApi = () => window.__UCAN_XR_STAIRS_ENTRY_V324__ || null;

  function fail(stage, error) {
    state.lastError = { stage, message:String(error?.message || error), at:new Date().toISOString() };
    console.error(`[UCAN ${VERSION}] ${stage}:`, error);
    publish();
  }

  function inXR() {
    const X = B.WebXRState || {};
    const value = state.helper?.baseExperience?.state;
    return value === X.ENTERING_XR || value === X.IN_XR || xrApi()?.getState?.().inXR === true;
  }

  function root() {
    return state.xr?.parent || null;
  }

  function worldPosition() {
    try {
      state.xr?.computeWorldMatrix?.(true);
      const value = state.xr?.globalPosition || state.xr?.getAbsolutePosition?.() || state.xr?.position;
      return value?.clone?.() || null;
    } catch (_) {
      return null;
    }
  }

  function metadataChain(mesh) {
    const data = {};
    let current = mesh;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parent) {
      Object.assign(data, current.metadata || {});
    }
    return data;
  }

  function bounds(mesh) {
    try {
      mesh.computeWorldMatrix?.(true);
      const box = mesh.getBoundingInfo?.().boundingBox;
      if (!box) return null;
      return {
        minX:box.minimumWorld.x, maxX:box.maximumWorld.x,
        minY:box.minimumWorld.y, maxY:box.maximumWorld.y,
        minZ:box.minimumWorld.z, maxZ:box.maximumWorld.z
      };
    } catch (_) {
      return null;
    }
  }

  function intersectsExit(box, route) {
    if (!box) return false;
    const z2 = route.toZ + route.direction * (CLEARANCE + 1.6);
    const minZ = Math.min(route.toZ - 1.2, z2);
    const maxZ = Math.max(route.toZ + 1.2, z2);
    return (
      box.maxX >= route.centerX - route.halfWidth - 0.9 &&
      box.minX <= route.centerX + route.halfWidth + 0.9 &&
      box.maxY >= route.toFloor - 0.6 &&
      box.minY <= route.toFloor + 3.4 &&
      box.maxZ >= minZ &&
      box.minZ <= maxZ
    );
  }

  function walkable(mesh) {
    const data = metadataChain(mesh);
    const name = String(mesh?.name || '');
    return Boolean(
      data.walkable || data.teleportable || data.stairSurface || data.xrStairSurface ||
      /piso|losa|suelo|rampa|peldaño|banda escalera|plataforma|descanso|ruta avatar|zona segura/i.test(name)
    );
  }

  function glassLike(mesh) {
    const data = metadataChain(mesh);
    const text = `${String(mesh?.name || '')} ${String(mesh?.material?.name || '')}`;
    return Boolean(data.glass || data.glassPanel || /cristal|glass|vidrio|mampara/i.test(text));
  }

  function clearExit(routeId) {
    const route = ROUTES[routeId];
    if (!route || !state.scene) return 0;
    let changed = 0;

    for (const mesh of state.scene.meshes || []) {
      if (!mesh || mesh.isDisposed?.() || !intersectsExit(bounds(mesh), route)) continue;

      if (glassLike(mesh)) {
        try {
          if (mesh.isEnabled?.() !== false) {
            mesh.setEnabled?.(false);
            changed += 1;
          }
        } catch (_) {}
        if (mesh.isVisible !== false) {
          mesh.isVisible = false;
          changed += 1;
        }
        if (Number(mesh.visibility ?? 1) !== 0) {
          mesh.visibility = 0;
          changed += 1;
        }
        if (mesh.checkCollisions !== false) {
          mesh.checkCollisions = false;
          changed += 1;
        }
        mesh.isPickable = false;
        mesh.metadata = {
          ...(mesh.metadata || {}),
          hiddenByV322:true,
          hiddenByV326Landing:true,
          dynamicSharedV313:true,
          noCanonicalRepairV325:true
        };
        state.hiddenGlassMeshes += 1;
        continue;
      }

      if (!walkable(mesh) && mesh.checkCollisions) {
        mesh.checkCollisions = false;
        mesh.isPickable = false;
        mesh.metadata = {
          ...(mesh.metadata || {}),
          collisionClearedByV322:true,
          collisionClearedByV326Landing:true,
          geometryOnlyV322:true
        };
        state.clearedCollisionMeshes += 1;
        changed += 1;
      }
    }
    return changed;
  }

  function beginLanding(routeId) {
    const route = ROUTES[routeId];
    const position = worldPosition();
    const locomotionRoot = root();
    if (!route || !position || !locomotionRoot) return false;

    clearExit(routeId);
    state.landing = {
      routeId,
      targetZ:route.toZ + route.direction * CLEARANCE,
      startedAt:performance.now(),
      deadline:performance.now() + TIMEOUT_MS
    };
    locomotionRoot.position.y = route.toFloor;
    state.carriesStarted += 1;
    return true;
  }

  function finishLanding(forced = false) {
    if (!state.landing) return;
    if (forced) state.forcedFinishes += 1;
    state.carriesCompleted += 1;
    state.landing = null;
  }

  function syncDesktop(route) {
    const position = worldPosition();
    if (!position || !state.desktop?.position) return;
    state.desktop.position.x = position.x;
    state.desktop.position.z = position.z;
    state.desktop.position.y = route.toFloor + 1.72;
    state.lastWorld = { x:position.x, y:route.toFloor, z:position.z };
  }

  function carry(dt) {
    const landing = state.landing;
    const route = landing ? ROUTES[landing.routeId] : null;
    const locomotionRoot = root();
    const position = worldPosition();
    if (!landing || !route || !locomotionRoot || !position) return false;

    state.carryFrames += 1;
    locomotionRoot.position.y = route.toFloor;

    const minX = route.centerX - route.halfWidth + 0.5;
    const maxX = route.centerX + route.halfWidth - 0.5;
    locomotionRoot.position.x += clamp(position.x, minX, maxX) - position.x;

    const remaining = (landing.targetZ - position.z) * route.direction;
    if (remaining <= 0.04) {
      syncDesktop(route);
      finishLanding(false);
      return true;
    }

    locomotionRoot.position.z += route.direction * Math.min(CARRY_SPEED * dt, remaining);
    syncDesktop(route);

    if (performance.now() >= landing.deadline) {
      const latest = worldPosition();
      if (latest) locomotionRoot.position.z += landing.targetZ - latest.z;
      syncDesktop(route);
      finishLanding(true);
    }
    return true;
  }

  function frame() {
    if (!inXR()) {
      state.previousRoute = null;
      state.previousCompleted = Number(stairApi()?.getState?.().completedRoutes || 0);
      return;
    }

    try {
      const stair = stairApi()?.getState?.() || {};
      const currentRoute = stair.activeRoute || null;
      const completed = Number(stair.completedRoutes || 0);

      if (
        state.previousRoute &&
        !currentRoute &&
        completed > state.previousCompleted &&
        !state.landing
      ) {
        beginLanding(state.previousRoute);
      }

      const dt = clamp((state.scene?.getEngine?.().getDeltaTime?.() || 16) / 1000, 0.001, 0.05);
      carry(dt);

      state.previousRoute = currentRoute;
      state.previousCompleted = completed;
      publish();
    } catch (error) {
      fail('frame', error);
    }
  }

  function getState() {
    return {
      installed:state.installed,
      xrOnly:true,
      landingReleaseAfterRoute:true,
      collisionFreeExitCorridor:true,
      smoothCarryOff:true,
      landingClearanceMeters:CLEARANCE,
      landingCarrySpeed:CARRY_SPEED,
      inXR:inXR(),
      activeRoute:stairApi()?.getState?.().activeRoute || null,
      landingActive:Boolean(state.landing),
      landingRoute:state.landing?.routeId || null,
      landingTargetZ:state.landing?.targetZ ?? null,
      carriesStarted:state.carriesStarted,
      carriesCompleted:state.carriesCompleted,
      carryFrames:state.carryFrames,
      forcedFinishes:state.forcedFinishes,
      clearedCollisionMeshes:state.clearedCollisionMeshes,
      hiddenGlassMeshes:state.hiddenGlassMeshes,
      lastWorld:state.lastWorld,
      lastError:state.lastError
    };
  }

  function publish() {
    window.__UCAN_XR_LANDING_RELEASE_V326__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      ...getState(),
      clearExit,
      getState
    };
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    state.helper = window.__UCAN_XR_HELPER__ || null;
    state.xr = state.helper?.baseExperience?.camera || null;
    state.desktop = window.__UCAN_API__?.getCamera?.() || state.scene?.activeCamera || null;

    if (
      !state.scene ||
      !state.helper ||
      !state.xr ||
      !state.desktop ||
      !state.scene.onBeforeRenderObservable ||
      !window.__UCAN_XR_STAIRS_ENTRY_V324__?.installed ||
      !stairApi()?.installed
    ) return false;

    for (const routeId of Object.keys(ROUTES)) clearExit(routeId);
    state.previousCompleted = Number(stairApi()?.getState?.().completedRoutes || 0);
    state.observer = state.scene.onBeforeRenderObservable.add(frame);
    state.installed = true;
    publish();
    console.info('[UCAN V326 R30] Salida superior WebXR liberada con corredor sin colisiones y desembarque continuo.');
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 700) window.clearInterval(timer);
    } catch (error) {
      fail('install', error);
      if (attempts >= 700) window.clearInterval(timer);
    }
  }, 100);

  publish();
})();