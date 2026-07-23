(() => {
  'use strict';

  const VERSION = 'V302';
  const BUILD = 'V302-20260723-REMOVE-QUEST-STAIR-GLASS';
  const B = window.BABYLON;
  if (!B) return;

  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const STAIR_BOUNDS = Object.freeze({ minX:38.8, maxX:49.2, minY:15.5, maxY:30.5, minZ:6.5, maxZ:43.5 });
  const SCAN_INTERVAL_MS = 250;

  const state = {
    scene:null,
    helper:null,
    installed:false,
    inXR:false,
    questDevice:false,
    hiddenMeshes:new Map(),
    scans:0,
    removedMeshes:0,
    removedV301Panes:0,
    removedOriginalGlassRails:0,
    preservedMetalMeshes:0,
    lastScanAt:0,
    lastError:null
  };

  function questDetected() {
    const ua = String(navigator.userAgent || '');
    const brands = Array.isArray(navigator.userAgentData?.brands)
      ? navigator.userAgentData.brands.map(item => item?.brand || '').join(' ')
      : '';
    if (/OculusBrowser|Meta Quest|Quest 2|Quest 3|Quest Pro/i.test(`${ua} ${brands}`)) return true;
    const controllers = state.helper?.input?.controllers || [];
    return controllers.some(controller =>
      (controller?.inputSource?.profiles || []).some(profile => /oculus|meta|quest|touch/i.test(String(profile)))
    );
  }

  function xrActive() {
    const current = state.helper?.baseExperience?.state;
    return current === XR_STATE.ENTERING_XR || current === XR_STATE.IN_XR;
  }

  function absolutePosition(mesh) {
    try { return mesh.getAbsolutePosition?.() || mesh.absolutePosition || mesh.position; }
    catch (_) { return mesh?.position || null; }
  }

  function insideStairArea(mesh) {
    const position = absolutePosition(mesh);
    if (!position) return false;
    return position.x >= STAIR_BOUNDS.minX && position.x <= STAIR_BOUNDS.maxX &&
      position.y >= STAIR_BOUNDS.minY && position.y <= STAIR_BOUNDS.maxY &&
      position.z >= STAIR_BOUNDS.minZ && position.z <= STAIR_BOUNDS.maxZ;
  }

  function metadataChain(mesh) {
    const merged = {};
    let current = mesh;
    for (let depth = 0; current && depth < 7; depth += 1, current = current.parent) Object.assign(merged, current.metadata || {});
    return merged;
  }

  function nameChain(mesh) {
    const names = [];
    let current = mesh;
    for (let depth = 0; current && depth < 7; depth += 1, current = current.parent) names.push(String(current.name || ''));
    return names.join(' ');
  }

  function isMetalStairPart(mesh) {
    const metadata = metadataChain(mesh);
    const names = nameChain(mesh);
    return Boolean(metadata.stairRailPost || metadata.stairTopRail || metadata.stairLowerRail) ||
      /poste baranda escalera|pasamanos superior escalera|riel inferior escalera|metal baranda escalera/i.test(names);
  }

  function isStairGlass(mesh) {
    const metadata = metadataChain(mesh);
    const names = nameChain(mesh);
    const materialName = String(mesh?.material?.name || '');

    if (isMetalStairPart(mesh)) return false;
    if (metadata.stairGlassPanel === true) return true;
    if (metadata.questCorrectedStairRailV301 === true && /cristal|glass|vidrio/i.test(`${names} ${materialName}`)) return true;
    if (/cristal baranda escalera Quest V301/i.test(names)) return true;
    if (/baranda hueco escalera terraza/i.test(names)) return true;
    if (insideStairArea(mesh) && /cristal|glass|vidrio/i.test(`${names} ${materialName}`)) return true;
    return false;
  }

  function hideMesh(mesh) {
    if (!mesh || state.hiddenMeshes.has(mesh)) return false;
    state.hiddenMeshes.set(mesh, {
      enabled:typeof mesh.isEnabled === 'function' ? mesh.isEnabled() : mesh._isEnabled !== false,
      isVisible:mesh.isVisible,
      visibility:mesh.visibility,
      checkCollisions:mesh.checkCollisions,
      isPickable:mesh.isPickable,
      alwaysSelectAsActiveMesh:mesh.alwaysSelectAsActiveMesh
    });
    const metadata = metadataChain(mesh);
    try { mesh.setEnabled?.(false); } catch (_) {}
    mesh.isVisible = false;
    mesh.visibility = 0;
    mesh.checkCollisions = false;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = false;
    mesh.metadata = { ...(mesh.metadata || {}), ucanQuestStairGlassRemovedV302:true };
    state.removedMeshes += 1;
    if (metadata.stairGlassPanel === true || /cristal baranda escalera Quest V301/i.test(nameChain(mesh))) state.removedV301Panes += 1;
    else state.removedOriginalGlassRails += 1;
    return true;
  }

  function scanAndRemove(force = false) {
    if (!state.scene || !state.inXR || !state.questDevice) return;
    const now = performance.now();
    if (!force && now - state.lastScanAt < SCAN_INTERVAL_MS) return;
    state.lastScanAt = now;
    state.scans += 1;
    let preserved = 0;
    for (const mesh of state.scene.meshes || []) {
      if (isMetalStairPart(mesh) && insideStairArea(mesh)) {
        preserved += 1;
        continue;
      }
      if (isStairGlass(mesh)) hideMesh(mesh);
    }
    state.preservedMetalMeshes = preserved;
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
        if (mesh.metadata) delete mesh.metadata.ucanQuestStairGlassRemovedV302;
      } catch (_) {}
    }
    state.hiddenMeshes.clear();
  }

  function enterXR() {
    state.inXR = true;
    state.questDevice = questDetected();
    if (state.questDevice) {
      scanAndRemove(true);
      window.__UCAN_API__?.setStatus?.('Meta Quest V302: cristales negros de la escalera eliminados; barandas metálicas conservadas.');
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
    scanAndRemove(false);
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
    window.__UCAN_QUEST_V302__ = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      inXR:state.inXR,
      questDevice:state.questDevice,
      questOnly:true,
      desktopStairUnchanged:true,
      stairGlassRemoved:true,
      stairGlassMeshesDisabled:true,
      stairGlassCollisionsDisabled:true,
      v301GlassPanesRemoved:true,
      originalDarkGlassRailsRemoved:true,
      metalPostsPreserved:true,
      metalHandrailsPreserved:true,
      noNewStairGlassCreated:true,
      scans:state.scans,
      removedMeshes:state.removedMeshes,
      removedV301Panes:state.removedV301Panes,
      removedOriginalGlassRails:state.removedOriginalGlassRails,
      preservedMetalMeshes:state.preservedMetalMeshes,
      lastError:state.lastError,
      rescan:() => scanAndRemove(true),
      getState:() => ({
        inXR:state.inXR,
        questDevice:state.questDevice,
        hiddenMeshes:state.hiddenMeshes.size,
        removedMeshes:state.removedMeshes,
        removedV301Panes:state.removedV301Panes,
        removedOriginalGlassRails:state.removedOriginalGlassRails,
        preservedMetalMeshes:state.preservedMetalMeshes,
        lastError:state.lastError
      })
    };
    window.__UCAN_STAIR_GLASS_V302__ = window.__UCAN_QUEST_V302__;
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
    console.info(`[UCAN ${VERSION}] Cristales de la escalera eliminados en Meta Quest.`);
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
