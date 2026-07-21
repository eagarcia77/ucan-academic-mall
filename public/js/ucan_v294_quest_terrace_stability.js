(() => {
  'use strict';

  const VERSION = 'V294';
  const BUILD = 'V294-20260721-QUEST-TERRACE-LIGHT-SIGNS';
  const B = window.BABYLON;
  if (!B) return;

  const LEVEL = Object.freeze({ three:16.4, roof:27.2 });
  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const QUEST_EXPOSURE = 0.72;
  const QUEST_CONTRAST = 1.08;
  const QUEST_ENVIRONMENT_INTENSITY = 0.65;
  const QUEST_LIGHT_SCALE = 0.82;

  const state = {
    scene:null,
    helper:null,
    installed:false,
    questBrowser:false,
    inXR:false,
    terraceLock:false,
    lightingApplied:false,
    lightingOriginal:null,
    lightOriginals:new Map(),
    meshOriginals:new Map(),
    materialOriginals:new Map(),
    readableMeshesPatched:0,
    celestialLabelsPatched:0,
    terraceRootForces:0,
    floorCorrections:0,
    scans:0,
    lastScanAt:0,
    lastError:null
  };

  const finite = value => Number.isFinite(Number(value));

  function detectQuestBrowser() {
    const ua = String(navigator.userAgent || '');
    const brands = Array.isArray(navigator.userAgentData?.brands)
      ? navigator.userAgentData.brands.map(item => item?.brand || '').join(' ')
      : '';
    return /OculusBrowser|Meta Quest|Quest 2|Quest 3|Quest Pro/i.test(`${ua} ${brands}`);
  }

  function xrActive() {
    try {
      if (window.__UCAN_UNIFIED_XR_AUDIT__?.getState?.()?.inXR === true) return true;
    } catch (_) {}
    const current = state.helper?.baseExperience?.state;
    return current === XR_STATE.ENTERING_XR || current === XR_STATE.IN_XR;
  }

  function xrCamera() {
    return state.helper?.baseExperience?.camera || state.scene?.activeCamera || null;
  }

  function cameraPosition() {
    const camera = xrCamera();
    return camera?.position || camera?.globalPosition || null;
  }

  function eyeHeight() {
    const audit = window.__UCAN_UNIFIED_XR_AUDIT__?.getState?.();
    const values = [audit?.eyeHeight, xrCamera()?.realWorldHeight, xrCamera()?._realWorldHeight, 1.72];
    return values.map(Number).find(value => finite(value) && value >= 0.8 && value <= 2.4) || 1.72;
  }

  function insideRooftopStairs(position) {
    return Boolean(position && position.x >= 38.0 && position.x <= 50.0 && position.z >= 7.5 && position.z <= 42.0);
  }

  function floorApi() {
    return window.__UCAN_FLOOR_STATE_V287__ || null;
  }

  function setStableFloor(base, reason) {
    try { floorApi()?.setFloorBase?.(base, reason); } catch (_) {}
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

  function rememberLighting() {
    if (state.lightingOriginal || !state.scene) return;
    const image = state.scene.imageProcessingConfiguration || null;
    state.lightingOriginal = {
      exposure:image?.exposure,
      contrast:image?.contrast,
      toneMappingEnabled:image?.toneMappingEnabled,
      toneMappingType:image?.toneMappingType,
      environmentIntensity:state.scene.environmentIntensity
    };
    for (const light of state.scene.lights || []) {
      if (!finite(light?.intensity) || state.lightOriginals.has(light)) continue;
      state.lightOriginals.set(light, Number(light.intensity));
    }
  }

  function applyQuestLighting() {
    if (!state.questBrowser || !state.inXR || !state.scene || state.lightingApplied) return;
    rememberLighting();
    const image = state.scene.imageProcessingConfiguration;
    if (image) {
      image.exposure = QUEST_EXPOSURE;
      image.contrast = QUEST_CONTRAST;
      image.toneMappingEnabled = true;
      if (B.ImageProcessingConfiguration?.TONEMAPPING_ACES != null) {
        image.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
      }
    }
    if ('environmentIntensity' in state.scene) state.scene.environmentIntensity = QUEST_ENVIRONMENT_INTENSITY;
    for (const [light, original] of state.lightOriginals) {
      try { light.intensity = original * QUEST_LIGHT_SCALE; } catch (_) {}
    }
    state.lightingApplied = true;
    updateAudit();
  }

  function restoreLighting() {
    if (!state.lightingApplied || !state.scene || !state.lightingOriginal) return;
    const image = state.scene.imageProcessingConfiguration;
    if (image) {
      if (finite(state.lightingOriginal.exposure)) image.exposure = state.lightingOriginal.exposure;
      if (finite(state.lightingOriginal.contrast)) image.contrast = state.lightingOriginal.contrast;
      if (typeof state.lightingOriginal.toneMappingEnabled === 'boolean') image.toneMappingEnabled = state.lightingOriginal.toneMappingEnabled;
      if (state.lightingOriginal.toneMappingType != null) image.toneMappingType = state.lightingOriginal.toneMappingType;
    }
    if (finite(state.lightingOriginal.environmentIntensity)) state.scene.environmentIntensity = state.lightingOriginal.environmentIntensity;
    for (const [light, original] of state.lightOriginals) {
      try { light.intensity = original; } catch (_) {}
    }
    state.lightingApplied = false;
    updateAudit();
  }

  function metadataChain(mesh) {
    const merged = {};
    let current = mesh;
    for (let depth = 0; current && depth < 6; depth += 1, current = current.parent) Object.assign(merged, current.metadata || {});
    return merged;
  }

  function isCelestialLabel(mesh) {
    return /etiqueta cielo V287/i.test(String(mesh?.name || ''));
  }

  function isTerraceReadable(mesh) {
    if (!mesh) return false;
    const metadata = metadataChain(mesh);
    if (metadata.celestialId || metadata.celestialData || metadata.celestialObject || metadata.livePanel || metadata.livePanelKey || metadata.readableSign) return true;
    return /etiqueta cielo|objeto cielo|panel clima|agenda astronómica|fase lunar|mapa celeste|calendario astronómico|reloj san germán|cartel|letrero|rótulo|rotulo/i.test(String(mesh.name || ''));
  }

  function rememberMesh(mesh) {
    if (state.meshOriginals.has(mesh)) return;
    state.meshOriginals.set(mesh, {
      isPickable:mesh.isPickable,
      alwaysSelectAsActiveMesh:mesh.alwaysSelectAsActiveMesh,
      renderingGroupId:mesh.renderingGroupId,
      scaling:mesh.scaling?.clone?.()
    });
  }

  function rememberMaterial(material) {
    if (!material || state.materialOriginals.has(material)) return;
    state.materialOriginals.set(material, {
      backFaceCulling:material.backFaceCulling,
      disableDepthWrite:material.disableDepthWrite,
      disableLighting:material.disableLighting,
      alpha:material.alpha,
      wasFrozen:Boolean(material.isFrozen)
    });
  }

  function patchReadableMesh(mesh) {
    if (!isTerraceReadable(mesh)) return false;
    rememberMesh(mesh);
    mesh.isPickable = true;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.renderingGroupId = Math.max(4, Number(mesh.renderingGroupId || 0));
    mesh.metadata = { ...(mesh.metadata || {}), ucanQuestReadableV294:true };

    const celestialLabel = isCelestialLabel(mesh);
    if (celestialLabel && mesh.scaling) {
      const original = state.meshOriginals.get(mesh)?.scaling;
      if (original) mesh.scaling.copyFrom(original.scale(1.65));
      state.celestialLabelsPatched += 1;
    }

    const material = mesh.material;
    if (material) {
      rememberMaterial(material);
      try { material.unfreeze?.(); } catch (_) {}
      material.backFaceCulling = false;
      material.disableDepthWrite = true;
      if (celestialLabel || metadataChain(mesh).livePanel || metadataChain(mesh).livePanelKey) material.disableLighting = true;
      if (finite(material.alpha) && material.alpha < 0.92) material.alpha = Math.max(material.alpha, 0.96);
    }
    return true;
  }

  function restoreReadableMeshes() {
    for (const [mesh, original] of state.meshOriginals) {
      try {
        mesh.isPickable = original.isPickable;
        mesh.alwaysSelectAsActiveMesh = original.alwaysSelectAsActiveMesh;
        mesh.renderingGroupId = original.renderingGroupId;
        if (original.scaling && mesh.scaling) mesh.scaling.copyFrom(original.scaling);
      } catch (_) {}
    }
    for (const [material, original] of state.materialOriginals) {
      try {
        material.backFaceCulling = original.backFaceCulling;
        material.disableDepthWrite = original.disableDepthWrite;
        material.disableLighting = original.disableLighting;
        material.alpha = original.alpha;
        if (original.wasFrozen) material.freeze?.();
      } catch (_) {}
    }
    state.meshOriginals.clear();
    state.materialOriginals.clear();
    state.readableMeshesPatched = 0;
    state.celestialLabelsPatched = 0;
  }

  function currentFloorBase() {
    try {
      const xr = window.__UCAN_UNIFIED_XR_AUDIT__?.getState?.();
      if (xr?.inXR && finite(xr.floor)) return Number(xr.floor);
    } catch (_) {}
    try {
      const floor = floorApi()?.getState?.()?.floorBase;
      if (finite(floor)) return Number(floor);
    } catch (_) {}
    return Number(cameraPosition()?.y || 0) >= LEVEL.roof - 0.5 ? LEVEL.roof : LEVEL.three;
  }

  function stabilizeTerraceFloor() {
    if (!state.questBrowser || !state.inXR) return;
    const position = cameraPosition();
    if (!position) return;
    const stair = insideRooftopStairs(position);
    const nearTop = position.x >= 37.5 && position.x <= 50.5 && position.z <= 15.0 && position.y >= LEVEL.roof - 2.5;
    const nearBottom = stair && position.z >= 36.5 && position.y <= LEVEL.three + 4.2;
    const controlsAudit = window.__UCAN_UNIFIED_XR_AUDIT__;

    if (nearTop || controlsAudit?.rooftopCommitted === true || currentFloorBase() >= LEVEL.roof - 0.35) state.terraceLock = true;
    if (nearBottom) state.terraceLock = false;

    if (state.terraceLock) {
      setStableFloor(LEVEL.roof, 'quest-v294-terrace-lock');
      if (!stair) {
        const minimumY = LEVEL.roof + eyeHeight();
        if (Number(position.y) < minimumY - 0.18) {
          position.y = minimumY;
          state.floorCorrections += 1;
        }
      }
    }
  }

  function forceTerraceContent() {
    if (!state.questBrowser || !state.inXR || !state.scene) return;
    const onTerrace = state.terraceLock || currentFloorBase() >= LEVEL.roof - 0.35;
    if (!onTerrace) return;
    const root = state.scene.getTransformNodeByName?.('Cielo optimizado terraza V287');
    if (root && !root.isEnabled?.()) {
      root.setEnabled(true);
      state.terraceRootForces += 1;
    }
    let patched = 0;
    for (const mesh of state.scene.meshes || []) if (patchReadableMesh(mesh)) patched += 1;
    state.readableMeshesPatched = patched;
    state.scans += 1;
    state.lastScanAt = performance.now();
  }

  function onXrStateChanged(xrState) {
    const active = xrState === XR_STATE.ENTERING_XR || xrState === XR_STATE.IN_XR;
    state.inXR = active;
    if (active && state.questBrowser) {
      const position = cameraPosition();
      state.terraceLock = currentFloorBase() >= LEVEL.roof - 0.35 || Number(position?.y || 0) >= LEVEL.roof + 0.5;
      applyQuestLighting();
      forceTerraceContent();
    } else if (!active) {
      restoreLighting();
      restoreReadableMeshes();
      state.terraceLock = false;
    }
    updateAudit();
  }

  function frame() {
    const active = xrActive();
    if (active !== state.inXR) onXrStateChanged(active ? XR_STATE.IN_XR : XR_STATE.NOT_IN_XR);
    if (!state.inXR || !state.questBrowser) return;
    stabilizeTerraceFloor();
    if (!state.lightingApplied) applyQuestLighting();
    if (performance.now() - state.lastScanAt > 850) forceTerraceContent();
    updateAudit();
  }

  function install(scene, helper) {
    if (state.installed) return;
    state.installed = true;
    state.scene = scene;
    state.helper = helper;
    state.questBrowser = detectQuestBrowser();
    helper.baseExperience?.onStateChangedObservable?.add?.(onXrStateChanged);
    scene.onBeforeRenderObservable.add(frame);
    if (xrActive()) onXrStateChanged(XR_STATE.IN_XR);
    updateAudit();
    console.info(`[UCAN ${VERSION}] Estabilidad, exposición y carteles Meta Quest instalados.`);
  }

  function updateAudit() {
    window.__UCAN_QUEST_TERRACE_V294__ = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      questBrowser:state.questBrowser,
      questOnly:true,
      inXR:state.inXR,
      questExposure:QUEST_EXPOSURE,
      questContrast:QUEST_CONTRAST,
      questEnvironmentIntensity:QUEST_ENVIRONMENT_INTENSITY,
      questLightScale:QUEST_LIGHT_SCALE,
      lightingApplied:state.lightingApplied,
      terraceFloorSticky:true,
      terraceLock:state.terraceLock,
      terraceDropToFloorThreePrevented:true,
      xrDistantLabelsAlwaysActive:true,
      xrCelestialLabelsScaled:1.65,
      xrTerracePanelsReadable:true,
      readableMeshesPatched:state.readableMeshesPatched,
      celestialLabelsPatched:state.celestialLabelsPatched,
      terraceRootForces:state.terraceRootForces,
      floorCorrections:state.floorCorrections,
      scans:state.scans,
      lastError:state.lastError,
      getState:() => ({
        questBrowser:state.questBrowser,
        inXR:state.inXR,
        terraceLock:state.terraceLock,
        lightingApplied:state.lightingApplied,
        readableMeshesPatched:state.readableMeshesPatched,
        celestialLabelsPatched:state.celestialLabelsPatched,
        floorCorrections:state.floorCorrections,
        lastError:state.lastError
      }),
      rescan:() => forceTerraceContent()
    };
  }

  function boot(attempt = 0) {
    const scene = window.__UCAN_API__?.getScene?.();
    const helper = window.__UCAN_XR_HELPER__;
    const controlsReady = window.__UCAN_UNIFIED_XR_AUDIT__?.version === 'V293';
    if (scene && helper?.baseExperience && controlsReady) return install(scene, helper);
    if (attempt < 280) window.setTimeout(() => boot(attempt + 1), 100);
    else {
      state.lastError = { stage:'boot', name:'Timeout', message:'No se encontró la escena, WebXR o V293.', at:new Date().toISOString() };
      updateAudit();
    }
  }

  updateAudit();
  boot();
})();
