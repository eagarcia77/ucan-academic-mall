(() => {
  'use strict';

  const VERSION = 'V303';
  const BUILD = 'V303-20260723-QUEST-ZONE-GLASS-REAR-RAILS';
  const B = window.BABYLON;
  if (!B) return;

  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const SCAN_INTERVAL_MS = 180;

  const ZONES = Object.freeze({
    floor2EscalatorFront: Object.freeze({ minX:-31.5, maxX:8.5, minY:7.45, maxY:15.35, minZ:11.5, maxZ:40.5 }),
    rooftopStair: Object.freeze({ minX:37.5, maxX:50.5, minY:15.4, maxY:30.7, minZ:5.5, maxZ:44.5 }),
    floor3RearBottom: Object.freeze({ minX:37.0, maxX:51.0, minY:15.4, maxY:21.8, minZ:38.0, maxZ:46.5 }),
    rooftopRearTop: Object.freeze({ minX:37.0, maxX:51.0, minY:25.2, maxY:31.2, minZ:4.0, maxZ:12.8 })
  });

  const state = {
    scene:null,
    helper:null,
    installed:false,
    inXR:false,
    questDevice:false,
    hiddenMeshes:new Map(),
    scans:0,
    darkGlassGlobalRemoved:0,
    floor2FrontGlassRemoved:0,
    rooftopStairGlassRemoved:0,
    floor3RearRailingsRemoved:0,
    rooftopRearRailingsRemoved:0,
    preservedSideRailings:0,
    lastScanAt:0,
    lastError:null
  };

  function questDetected() {
    const ua = String(navigator.userAgent || '');
    const brands = Array.isArray(navigator.userAgentData?.brands)
      ? navigator.userAgentData.brands.map(item => item?.brand || '').join(' ')
      : '';
    if (/OculusBrowser|Meta Quest|Quest 2|Quest 3|Quest Pro/i.test(`${ua} ${brands}`)) return true;
    return (state.helper?.input?.controllers || []).some(controller =>
      (controller?.inputSource?.profiles || []).some(profile => /oculus|meta|quest|touch/i.test(String(profile)))
    );
  }

  function xrActive() {
    const current = state.helper?.baseExperience?.state;
    return current === XR_STATE.ENTERING_XR || current === XR_STATE.IN_XR;
  }

  function metadataChain(mesh) {
    const merged = {};
    let current = mesh;
    for (let depth = 0; current && depth < 9; depth += 1, current = current.parent) Object.assign(merged, current.metadata || {});
    return merged;
  }

  function nameChain(mesh) {
    const names = [];
    let current = mesh;
    for (let depth = 0; current && depth < 9; depth += 1, current = current.parent) names.push(String(current.name || ''));
    return names.join(' ');
  }

  function worldBounds(mesh) {
    try {
      mesh.computeWorldMatrix?.(true);
      const box = mesh.getBoundingInfo?.().boundingBox;
      if (!box) return null;
      const min = box.minimumWorld;
      const max = box.maximumWorld;
      return {
        minX:min.x, maxX:max.x,
        minY:min.y, maxY:max.y,
        minZ:min.z, maxZ:max.z,
        sizeX:max.x-min.x,
        sizeY:max.y-min.y,
        sizeZ:max.z-min.z,
        centerX:(min.x+max.x)/2,
        centerY:(min.y+max.y)/2,
        centerZ:(min.z+max.z)/2
      };
    } catch (_) { return null; }
  }

  function intersects(bounds, zone) {
    return Boolean(bounds && zone &&
      bounds.maxX >= zone.minX && bounds.minX <= zone.maxX &&
      bounds.maxY >= zone.minY && bounds.minY <= zone.maxY &&
      bounds.maxZ >= zone.minZ && bounds.minZ <= zone.maxZ);
  }

  function materialLabel(mesh) {
    const material = mesh?.material;
    return `${String(material?.name || '')} ${String(material?.id || '')}`;
  }

  function isGlassLike(mesh) {
    const metadata = metadataChain(mesh);
    const text = `${nameChain(mesh)} ${materialLabel(mesh)}`;
    const alpha = Number(mesh?.material?.alpha ?? 1);
    return Boolean(
      metadata.stairGlassPanel === true ||
      metadata.glass === true ||
      /cristal|glass|vidrio/i.test(text) ||
      (alpha < 0.92 && /baranda|panel|mampara|puerta/i.test(text))
    );
  }

  function isDarkGlass(mesh) {
    if (!isGlassLike(mesh)) return false;
    const material = mesh?.material;
    const text = `${nameChain(mesh)} ${materialLabel(mesh)}`;
    if (/cristal oscuro|dark glass|vidrio oscuro|glass dark/i.test(text)) return true;
    const color = material?.diffuseColor;
    const luminance = color ? Number(color.r || 0) * 0.2126 + Number(color.g || 0) * 0.7152 + Number(color.b || 0) * 0.0722 : 1;
    return Number(material?.alpha ?? 1) < 0.9 && luminance < 0.34;
  }

  function isRailLike(mesh) {
    const metadata = metadataChain(mesh);
    const text = nameChain(mesh);
    return Boolean(
      metadata.rooftopStairGuard === true ||
      metadata.stairRail === true ||
      /baranda|pasamanos|railing|handrail|guard rail|guardrail|riel/i.test(text)
    );
  }

  function isSideRailing(mesh, bounds) {
    const metadata = metadataChain(mesh);
    const text = nameChain(mesh);
    if (metadata.stairTopRail || metadata.stairLowerRail || metadata.stairRailPost) return true;
    if (/pasamanos superior escalera Quest V301|riel inferior escalera Quest V301|poste baranda escalera Quest V301/i.test(text)) return true;
    if (!bounds) return false;
    return bounds.sizeZ >= Math.max(7, bounds.sizeX * 2.2);
  }

  function isCrossRearRailing(mesh, bounds) {
    if (!isRailLike(mesh) || !bounds) return false;
    if (isSideRailing(mesh, bounds)) return false;
    const inBottom = intersects(bounds, ZONES.floor3RearBottom);
    const inTop = intersects(bounds, ZONES.rooftopRearTop);
    if (!inBottom && !inTop) return false;
    const crosswise = bounds.sizeX >= 1.2 && bounds.sizeX >= bounds.sizeZ * 1.35;
    const namedRear = /detrás|detras|posterior|fondo|trasera|hueco escalera terraza/i.test(nameChain(mesh));
    return crosswise || namedRear;
  }

  function hideMesh(mesh, reason) {
    if (!mesh || state.hiddenMeshes.has(mesh)) return false;
    state.hiddenMeshes.set(mesh, {
      enabled:typeof mesh.isEnabled === 'function' ? mesh.isEnabled() : mesh._isEnabled !== false,
      isVisible:mesh.isVisible,
      visibility:mesh.visibility,
      checkCollisions:mesh.checkCollisions,
      isPickable:mesh.isPickable,
      alwaysSelectAsActiveMesh:mesh.alwaysSelectAsActiveMesh,
      reason
    });
    try { mesh.setEnabled?.(false); } catch (_) {}
    mesh.isVisible = false;
    mesh.visibility = 0;
    mesh.checkCollisions = false;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = false;
    mesh.metadata = { ...(mesh.metadata || {}), ucanQuestGeometryRemovedV303:true, ucanQuestGeometryReasonV303:reason };
    return true;
  }

  function classifyAndHide(mesh) {
    if (!mesh || typeof mesh.getBoundingInfo !== 'function') return;
    const bounds = worldBounds(mesh);
    if (!bounds) return;

    if (isCrossRearRailing(mesh, bounds)) {
      if (hideMesh(mesh, 'floor3-rooftop-rear-railing')) {
        if (intersects(bounds, ZONES.floor3RearBottom)) state.floor3RearRailingsRemoved += 1;
        if (intersects(bounds, ZONES.rooftopRearTop)) state.rooftopRearRailingsRemoved += 1;
      }
      return;
    }

    if (isRailLike(mesh) && isSideRailing(mesh, bounds) && intersects(bounds, ZONES.rooftopStair)) {
      state.preservedSideRailings += 1;
      return;
    }

    if (isDarkGlass(mesh)) {
      if (hideMesh(mesh, 'dark-glass-global')) state.darkGlassGlobalRemoved += 1;
      return;
    }

    if (!isGlassLike(mesh)) return;

    if (intersects(bounds, ZONES.floor2EscalatorFront)) {
      if (hideMesh(mesh, 'floor2-escalator-front-glass')) state.floor2FrontGlassRemoved += 1;
      return;
    }

    if (intersects(bounds, ZONES.rooftopStair)) {
      if (hideMesh(mesh, 'rooftop-stair-glass')) state.rooftopStairGlassRemoved += 1;
    }
  }

  function scanAndClean(force = false) {
    if (!state.scene || !state.inXR || !state.questDevice) return;
    const now = performance.now();
    if (!force && now - state.lastScanAt < SCAN_INTERVAL_MS) return;
    state.lastScanAt = now;
    state.scans += 1;
    state.preservedSideRailings = 0;
    for (const mesh of state.scene.meshes || []) classifyAndHide(mesh);
    updateAudit();
  }

  function restoreMeshes() {
    for (const [mesh, original] of state.hiddenMeshes) {
      try {
        if (mesh?.isDisposed?.()) continue;
        mesh.setEnabled?.(original.enabled);
        mesh.isVisible = original.isVisible;
        mesh.visibility = original.visibility;
        mesh.checkCollisions = original.checkCollisions;
        mesh.isPickable = original.isPickable;
        mesh.alwaysSelectAsActiveMesh = original.alwaysSelectAsActiveMesh;
        if (mesh.metadata) {
          delete mesh.metadata.ucanQuestGeometryRemovedV303;
          delete mesh.metadata.ucanQuestGeometryReasonV303;
        }
      } catch (_) {}
    }
    state.hiddenMeshes.clear();
  }

  function enterXR() {
    state.inXR = true;
    state.questDevice = questDetected();
    if (state.questDevice) {
      scanAndClean(true);
      window.__UCAN_API__?.setStatus?.('Meta Quest V303: cristales negros, paneles frente a escaleras del Piso 2 y barandas traseras del Piso 3 eliminados.');
    }
    updateAudit();
  }

  function exitXR() {
    state.inXR = false;
    restoreMeshes();
    updateAudit();
  }

  function frame() {
    const active = xrActive();
    if (active && !state.inXR) enterXR();
    if (!active && state.inXR) exitXR();
    if (!state.inXR) return;
    if (!state.questDevice) state.questDevice = questDetected();
    if (!state.questDevice) return;
    scanAndClean(false);
  }

  function recordError(stage, error) {
    state.lastError = {
      stage,
      name:String(error?.name || 'Error'),
      message:String(error?.message || error || 'Error desconocido'),
      at:new Date().toISOString()
    };
    console.error(`[UCAN ${VERSION}] ${stage}:`, error);
    updateAudit();
  }

  function updateAudit() {
    window.__UCAN_QUEST_V303__ = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      inXR:state.inXR,
      questDevice:state.questDevice,
      questOnly:true,
      desktopGeometryUnchanged:true,
      boundingBoxZoneDetection:true,
      parentNameAndMetadataDetection:true,
      darkGlassRemovedGlobally:true,
      floor2EscalatorFrontGlassRemoved:true,
      rooftopStairGlassRemoved:true,
      floor3RearRailingsRemoved:true,
      rooftopRearRailingsRemoved:true,
      rooftopSideRailingsPreserved:true,
      collisionsDisabledForRemovedGeometry:true,
      pickingDisabledForRemovedGeometry:true,
      scanIntervalMs:SCAN_INTERVAL_MS,
      zones:ZONES,
      scans:state.scans,
      hiddenMeshes:state.hiddenMeshes.size,
      darkGlassGlobalRemoved:state.darkGlassGlobalRemoved,
      floor2FrontGlassRemoved:state.floor2FrontGlassRemoved,
      rooftopStairGlassRemovedCount:state.rooftopStairGlassRemoved,
      floor3RearRailingsRemovedCount:state.floor3RearRailingsRemoved,
      rooftopRearRailingsRemovedCount:state.rooftopRearRailingsRemoved,
      preservedSideRailings:state.preservedSideRailings,
      lastError:state.lastError,
      rescan:() => scanAndClean(true),
      getState:() => ({
        inXR:state.inXR,
        questDevice:state.questDevice,
        hiddenMeshes:state.hiddenMeshes.size,
        darkGlassGlobalRemoved:state.darkGlassGlobalRemoved,
        floor2FrontGlassRemoved:state.floor2FrontGlassRemoved,
        rooftopStairGlassRemoved:state.rooftopStairGlassRemoved,
        floor3RearRailingsRemoved:state.floor3RearRailingsRemoved,
        rooftopRearRailingsRemoved:state.rooftopRearRailingsRemoved,
        preservedSideRailings:state.preservedSideRailings,
        lastError:state.lastError
      })
    };
    window.__UCAN_ZONE_GEOMETRY_V303__ = window.__UCAN_QUEST_V303__;
  }

  function install(scene, helper) {
    if (state.installed) return;
    state.installed = true;
    state.scene = scene;
    state.helper = helper;
    helper.baseExperience?.onStateChangedObservable?.add?.(xrState => {
      if (xrState === XR_STATE.ENTERING_XR || xrState === XR_STATE.IN_XR) enterXR();
      else if (xrState === XR_STATE.NOT_IN_XR) exitXR();
    });
    scene.onBeforeRenderObservable.add(() => {
      try { frame(); } catch (error) { recordError('frame', error); }
    });
    if (xrActive()) enterXR();
    updateAudit();
    console.info(`[UCAN ${VERSION}] Limpieza geométrica por zonas Meta Quest instalada.`);
  }

  function boot(attempt = 0) {
    const scene = window.__UCAN_API__?.getScene?.();
    const helper = window.__UCAN_XR_HELPER__;
    const baseReady = window.__UCAN_QUEST_V301__?.version === 'V301';
    if (scene && helper?.baseExperience && baseReady) return install(scene, helper);
    if (attempt < 360) window.setTimeout(() => boot(attempt + 1), 100);
    else recordError('boot', new Error('No se encontró la escena, WebXR o el runtime V301.'));
  }

  updateAudit();
  boot();
})();
