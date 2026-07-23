(() => {
  'use strict';

  const VERSION = 'V303';
  const REVISION = 'R2';
  const BUILD = 'V303-20260723-QUEST-ZONE-GLASS-REAR-RAILS-R2';
  const B = window.BABYLON;
  if (!B) return;

  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const SCAN_INTERVAL_MS = 120;
  const FLOOR2_ESCALATOR_ROUTE_X = Object.freeze([-34, -26, -20, -8]);

  const ZONES = Object.freeze({
    // Cubre las cuatro rutas P1↔P2 y P2↔P3, incluida la ruta x=-34 que quedaba fuera de V303 R1.
    floor2EscalatorFront: Object.freeze({ minX:-43.0, maxX:2.0, minY:7.10, maxY:16.25, minZ:4.5, maxZ:43.5 }),
    rooftopStair: Object.freeze({ minX:35.5, maxX:52.5, minY:15.15, maxY:31.60, minZ:3.5, maxZ:47.5 }),
    // Barandas ubicadas detrás del arranque de la escalera en el Piso 3.
    floor3RearBottom: Object.freeze({ minX:35.5, maxX:52.5, minY:15.10, maxY:22.70, minZ:36.5, maxZ:51.0 }),
    // Barandas posteriores junto al desembarco superior.
    rooftopRearTop: Object.freeze({ minX:35.5, maxX:52.5, minY:24.70, maxY:31.70, minZ:2.5, maxZ:15.0 })
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
    preservedCorrectedMetalRailings:0,
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
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parent) Object.assign(merged, current.metadata || {});
    return merged;
  }

  function nameChain(mesh) {
    const names = [];
    let current = mesh;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parent) names.push(String(current.name || ''));
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

  function materialText(mesh) {
    const material = mesh?.material;
    return `${String(material?.name || '')} ${String(material?.id || '')}`;
  }

  function colorLuminance(color) {
    if (!color) return 1;
    return Number(color.r || 0) * 0.2126 + Number(color.g || 0) * 0.7152 + Number(color.b || 0) * 0.0722;
  }

  function isGlassLike(mesh) {
    const metadata = metadataChain(mesh);
    const material = mesh?.material;
    const text = `${nameChain(mesh)} ${materialText(mesh)}`;
    const alpha = Number(material?.alpha ?? 1);
    return Boolean(
      metadata.stairGlassPanel === true ||
      metadata.glass === true ||
      metadata.glassPanel === true ||
      /cristal|glass|vidrio|mampara/i.test(text) ||
      (alpha < 0.96 && /baranda|panel|puerta|railing|guard/i.test(text)) ||
      (material?.needDepthPrePass === true && alpha < 0.98)
    );
  }

  function isDarkGlass(mesh) {
    if (!isGlassLike(mesh)) return false;
    const material = mesh?.material;
    const text = `${nameChain(mesh)} ${materialText(mesh)}`;
    if (/cristal oscuro|dark ?glass|vidrio oscuro|glass dark|negro|black/i.test(text)) return true;
    const luminance = Math.min(colorLuminance(material?.diffuseColor), colorLuminance(material?.albedoColor));
    return Number(material?.alpha ?? 1) < 0.97 && luminance < 0.46;
  }

  function isRailLike(mesh) {
    const metadata = metadataChain(mesh);
    const text = nameChain(mesh);
    return Boolean(
      metadata.rooftopStairGuard === true ||
      metadata.stairRail === true ||
      /baranda|pasamanos|railing|handrail|guard ?rail|riel/i.test(text)
    );
  }

  function isProtectedCorrectedMetal(mesh) {
    const metadata = metadataChain(mesh);
    const text = nameChain(mesh);
    if (metadata.stairGlassPanel === true || /cristal|glass|vidrio/i.test(`${text} ${materialText(mesh)}`)) return false;
    return Boolean(
      metadata.stairTopRail === true ||
      metadata.stairLowerRail === true ||
      metadata.stairRailPost === true ||
      /pasamanos superior escalera Quest V301|riel inferior escalera Quest V301|poste baranda escalera Quest V301/i.test(text)
    );
  }

  function rearRailingZone(bounds) {
    if (intersects(bounds, ZONES.floor3RearBottom)) return 'floor3-rear-railing';
    if (intersects(bounds, ZONES.rooftopRearTop)) return 'rooftop-rear-railing';
    return null;
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
    mesh.metadata = {
      ...(mesh.metadata || {}),
      ucanQuestGeometryRemovedV303:true,
      ucanQuestGeometryRevisionV303:REVISION,
      ucanQuestGeometryReasonV303:reason
    };
    return true;
  }

  function classifyAndHide(mesh) {
    if (!mesh || typeof mesh.getBoundingInfo !== 'function') return;
    const bounds = worldBounds(mesh);
    if (!bounds) return;

    // Los postes y pasamanos inclinados creados para los laterales siguen activos.
    if (isProtectedCorrectedMetal(mesh) && intersects(bounds, ZONES.rooftopStair)) {
      state.preservedCorrectedMetalRailings += 1;
      return;
    }

    // Elimina las barandas situadas detrás de la escalera sin depender de su orientación.
    const rearReason = rearRailingZone(bounds);
    if (rearReason && isRailLike(mesh)) {
      if (hideMesh(mesh, rearReason)) {
        if (rearReason === 'floor3-rear-railing') state.floor3RearRailingsRemoved += 1;
        else state.rooftopRearRailingsRemoved += 1;
      }
      return;
    }

    // Cualquier material de cristal oscuro se elimina en Quest, aunque su nombre sea genérico.
    if (isDarkGlass(mesh)) {
      if (hideMesh(mesh, 'dark-glass-global')) state.darkGlassGlobalRemoved += 1;
      return;
    }

    if (!isGlassLike(mesh)) return;

    // Frente de todas las escaleras/escaleras eléctricas del Piso 2.
    if (intersects(bounds, ZONES.floor2EscalatorFront)) {
      if (hideMesh(mesh, 'floor2-escalator-front-glass')) state.floor2FrontGlassRemoved += 1;
      return;
    }

    // Escalera completa del Piso 3 a la terraza.
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
    state.preservedCorrectedMetalRailings = 0;
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
          delete mesh.metadata.ucanQuestGeometryRevisionV303;
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
      window.__UCAN_API__?.setStatus?.('Meta Quest V303 R2: cristales negros, cristales frente a las escaleras del Piso 2 y barandas posteriores del Piso 3 eliminados.');
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
    console.error(`[UCAN ${VERSION} ${REVISION}] ${stage}:`, error);
    updateAudit();
  }

  function updateAudit() {
    const floor2RouteCoverage = FLOOR2_ESCALATOR_ROUTE_X.every(x => x >= ZONES.floor2EscalatorFront.minX && x <= ZONES.floor2EscalatorFront.maxX);
    window.__UCAN_QUEST_V303__ = {
      version:VERSION,
      revision:REVISION,
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
      floor2EscalatorAllRoutesCovered:floor2RouteCoverage,
      floor2EscalatorRouteX:FLOOR2_ESCALATOR_ROUTE_X,
      rearRailingsRemovedWithoutOrientationDependency:true,
      rooftopStairGlassRemoved:true,
      floor3RearRailingsRemoved:true,
      rooftopRearRailingsRemoved:true,
      correctedMetalSideRailingsPreserved:true,
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
      preservedCorrectedMetalRailings:state.preservedCorrectedMetalRailings,
      lastError:state.lastError,
      rescan:() => scanAndClean(true),
      getState:() => ({
        inXR:state.inXR,
        questDevice:state.questDevice,
        revision:REVISION,
        hiddenMeshes:state.hiddenMeshes.size,
        darkGlassGlobalRemoved:state.darkGlassGlobalRemoved,
        floor2FrontGlassRemoved:state.floor2FrontGlassRemoved,
        rooftopStairGlassRemoved:state.rooftopStairGlassRemoved,
        floor3RearRailingsRemoved:state.floor3RearRailingsRemoved,
        rooftopRearRailingsRemoved:state.rooftopRearRailingsRemoved,
        preservedCorrectedMetalRailings:state.preservedCorrectedMetalRailings,
        floor2EscalatorAllRoutesCovered:floor2RouteCoverage,
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
    console.info(`[UCAN ${VERSION} ${REVISION}] Limpieza geométrica ampliada para Meta Quest instalada.`);
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