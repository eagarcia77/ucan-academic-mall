(() => {
  'use strict';

  const VERSION = 'V295';
  const BUILD = 'V295-20260721-QUEST-DESKTOP-PARITY-TERRACE-ASSETS';
  const B = window.BABYLON;
  if (!B) return;

  const LEVEL = Object.freeze({ three:16.4, roof:27.2 });
  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });

  const state = {
    scene:null,
    helper:null,
    installed:false,
    inXR:false,
    questDevice:false,
    terraceLock:false,
    desktopAppearance:null,
    lightOriginals:new Map(),
    meshOriginals:new Map(),
    nodeOriginals:new Map(),
    skyRefreshed:false,
    forcedFrames:0,
    forcedMeshes:0,
    forcedCelestial:0,
    forcedPanels:0,
    textureRefreshes:0,
    floorCorrections:0,
    lastError:null
  };

  const finite = value => Number.isFinite(Number(value));

  function xrActive() {
    try {
      if (window.__UCAN_UNIFIED_XR_AUDIT__?.getState?.()?.inXR === true) return true;
    } catch (_) {}
    const current = state.helper?.baseExperience?.state;
    return current === XR_STATE.ENTERING_XR || current === XR_STATE.IN_XR;
  }

  function detectQuestDevice() {
    const ua = String(navigator.userAgent || '');
    const brands = Array.isArray(navigator.userAgentData?.brands)
      ? navigator.userAgentData.brands.map(item => item?.brand || '').join(' ')
      : '';
    if (/OculusBrowser|Meta Quest|Quest 2|Quest 3|Quest Pro/i.test(`${ua} ${brands}`)) return true;
    const controllers = state.helper?.input?.controllers || [];
    return controllers.some(controller => {
      const profiles = controller?.inputSource?.profiles || [];
      return profiles.some(profile => /oculus|meta|quest|touch/i.test(String(profile)));
    });
  }

  function camera() {
    return state.helper?.baseExperience?.camera || state.scene?.activeCamera || null;
  }

  function cameraPosition() {
    const current = camera();
    return current?.position || current?.globalPosition || null;
  }

  function eyeHeight() {
    const audit = window.__UCAN_UNIFIED_XR_AUDIT__?.getState?.();
    const values = [audit?.eyeHeight, camera()?.realWorldHeight, camera()?._realWorldHeight, 1.72];
    return values.map(Number).find(value => finite(value) && value >= 0.8 && value <= 2.4) || 1.72;
  }

  function currentFloor() {
    try {
      const xr = window.__UCAN_UNIFIED_XR_AUDIT__?.getState?.();
      if (xr?.inXR && finite(xr.floor)) return Number(xr.floor);
    } catch (_) {}
    try {
      const floor = window.__UCAN_FLOOR_STATE_V287__?.getState?.()?.floorBase;
      if (finite(floor)) return Number(floor);
    } catch (_) {}
    return Number(cameraPosition()?.y || 0) >= LEVEL.roof - 0.5 ? LEVEL.roof : LEVEL.three;
  }

  function setStableFloor(base, reason) {
    try { window.__UCAN_FLOOR_STATE_V287__?.setFloorBase?.(base, reason); } catch (_) {}
  }

  function insideRooftopStairs(position) {
    return Boolean(position && position.x >= 38.0 && position.x <= 50.0 && position.z >= 7.5 && position.z <= 42.0);
  }

  function captureDesktopAppearance() {
    if (state.desktopAppearance || !state.scene) return;
    const image = state.scene.imageProcessingConfiguration || null;
    state.desktopAppearance = {
      exposure:image?.exposure,
      contrast:image?.contrast,
      toneMappingEnabled:image?.toneMappingEnabled,
      toneMappingType:image?.toneMappingType,
      vignetteEnabled:image?.vignetteEnabled,
      colorCurvesEnabled:image?.colorCurvesEnabled,
      colorGradingEnabled:image?.colorGradingEnabled,
      environmentIntensity:state.scene.environmentIntensity,
      clearColor:state.scene.clearColor?.clone?.()
    };
    for (const light of state.scene.lights || []) {
      if (finite(light?.intensity)) state.lightOriginals.set(light, Number(light.intensity));
    }
  }

  function applyExactDesktopAppearance() {
    if (!state.questDevice || !state.inXR || !state.scene || !state.desktopAppearance) return;
    const original = state.desktopAppearance;
    const image = state.scene.imageProcessingConfiguration;
    if (image) {
      if (finite(original.exposure)) image.exposure = original.exposure;
      if (finite(original.contrast)) image.contrast = original.contrast;
      if (typeof original.toneMappingEnabled === 'boolean') image.toneMappingEnabled = original.toneMappingEnabled;
      if (original.toneMappingType != null) image.toneMappingType = original.toneMappingType;
      if (typeof original.vignetteEnabled === 'boolean') image.vignetteEnabled = original.vignetteEnabled;
      if (typeof original.colorCurvesEnabled === 'boolean') image.colorCurvesEnabled = original.colorCurvesEnabled;
      if (typeof original.colorGradingEnabled === 'boolean') image.colorGradingEnabled = original.colorGradingEnabled;
    }
    if (finite(original.environmentIntensity)) state.scene.environmentIntensity = original.environmentIntensity;
    if (original.clearColor && state.scene.clearColor) state.scene.clearColor.copyFrom(original.clearColor);
    for (const [light, intensity] of state.lightOriginals) {
      try { light.intensity = intensity; } catch (_) {}
    }
  }

  function rememberNode(node) {
    if (!node || state.nodeOriginals.has(node)) return;
    state.nodeOriginals.set(node, { enabled:node._isEnabled !== false });
  }

  function enableParentChain(mesh) {
    let current = mesh?.parent;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parent) {
      rememberNode(current);
      try { current.setEnabled?.(true); } catch (_) {}
    }
  }

  function metadataChain(mesh) {
    const merged = {};
    let current = mesh;
    for (let depth = 0; current && depth < 7; depth += 1, current = current.parent) Object.assign(merged, current.metadata || {});
    return merged;
  }

  function isCelestial(mesh) {
    const metadata = metadataChain(mesh);
    return Boolean(metadata.celestialId || metadata.celestialData || metadata.celestialObject) ||
      /objeto cielo|etiqueta cielo|planeta|estrella|luna|saturno|júpiter|jupiter|marte|venus|mercurio|urano|neptuno/i.test(String(mesh?.name || ''));
  }

  function isTerracePanel(mesh) {
    const metadata = metadataChain(mesh);
    return Boolean(metadata.livePanel || metadata.livePanelKey || (metadata.readableSign && metadata.rooftop)) ||
      /panel clima|agenda astronómica|fase lunar|mapa celeste|calendario astronómico|reloj san germán|señal temporada terraza/i.test(String(mesh?.name || ''));
  }

  function rememberMesh(mesh) {
    if (!mesh || state.meshOriginals.has(mesh)) return;
    state.meshOriginals.set(mesh, {
      enabled:mesh._isEnabled !== false,
      isVisible:mesh.isVisible,
      visibility:mesh.visibility,
      isPickable:mesh.isPickable,
      alwaysSelectAsActiveMesh:mesh.alwaysSelectAsActiveMesh
    });
  }

  function refreshDynamicTexture(mesh) {
    const textures = [mesh?.material?.diffuseTexture, mesh?.material?.emissiveTexture].filter(Boolean);
    const unique = new Set(textures);
    for (const texture of unique) {
      if (typeof texture.getContext !== 'function' || typeof texture.update !== 'function') continue;
      try {
        texture.update(false);
        state.textureRefreshes += 1;
      } catch (_) {}
    }
  }

  function forceVisible(mesh, celestial, panel) {
    rememberMesh(mesh);
    enableParentChain(mesh);
    try { mesh.setEnabled?.(true); } catch (_) {}
    mesh.isVisible = true;
    mesh.visibility = 1;
    mesh.isPickable = true;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.metadata = {
      ...(mesh.metadata || {}),
      ucanQuestVisibleV295:true,
      readableSign:true,
      rooftop:true
    };
    if (panel) refreshDynamicTexture(mesh);
    if (celestial) state.forcedCelestial += 1;
    if (panel) state.forcedPanels += 1;
    state.forcedMeshes += 1;
  }

  function stabilizeTerrace() {
    if (!state.questDevice || !state.inXR) return false;
    const position = cameraPosition();
    if (!position) return false;
    const stair = insideRooftopStairs(position);
    const nearTop = position.x >= 37.0 && position.x <= 51.0 && position.z <= 16.0 && position.y >= LEVEL.roof - 2.8;
    const nearBottom = stair && position.z >= 37.0 && position.y <= LEVEL.three + 4.0;
    const controls = window.__UCAN_UNIFIED_XR_AUDIT__;
    if (nearTop || controls?.rooftopCommitted === true || currentFloor() >= LEVEL.roof - 0.35) state.terraceLock = true;
    if (nearBottom) state.terraceLock = false;
    if (!state.terraceLock) return false;

    setStableFloor(LEVEL.roof, 'quest-v295-terrace-sticky');
    if (!stair) {
      const minimumY = LEVEL.roof + eyeHeight();
      if (Number(position.y) < minimumY - 0.12) {
        position.y = minimumY;
        state.floorCorrections += 1;
      }
    }
    return true;
  }

  function forceTerraceAssets() {
    if (!state.questDevice || !state.inXR || !state.scene) return;
    const terrace = stabilizeTerrace() || currentFloor() >= LEVEL.roof - 0.35;
    if (!terrace) return;

    if (!state.skyRefreshed) {
      try { window.__UCAN_INTERACTIVE_SKY__?.refresh?.(); } catch (_) {}
      state.skyRefreshed = true;
    }

    const root = state.scene.getTransformNodeByName?.('Cielo optimizado terraza V287');
    if (root) {
      rememberNode(root);
      root.setEnabled(true);
    }

    state.forcedMeshes = 0;
    state.forcedCelestial = 0;
    state.forcedPanels = 0;
    for (const mesh of state.scene.meshes || []) {
      const celestial = isCelestial(mesh);
      const panel = isTerracePanel(mesh);
      if (celestial || panel) forceVisible(mesh, celestial, panel);
    }
    state.forcedFrames += 1;
  }

  function restoreDesktopScene() {
    for (const [mesh, original] of state.meshOriginals) {
      try {
        mesh.setEnabled?.(original.enabled);
        mesh.isVisible = original.isVisible;
        mesh.visibility = original.visibility;
        mesh.isPickable = original.isPickable;
        mesh.alwaysSelectAsActiveMesh = original.alwaysSelectAsActiveMesh;
      } catch (_) {}
    }
    for (const [node, original] of state.nodeOriginals) {
      try { node.setEnabled?.(original.enabled); } catch (_) {}
    }
    state.meshOriginals.clear();
    state.nodeOriginals.clear();
    state.skyRefreshed = false;
    state.terraceLock = false;
  }

  function onXrStateChanged(xrState) {
    const active = xrState === XR_STATE.ENTERING_XR || xrState === XR_STATE.IN_XR;
    state.inXR = active;
    state.questDevice = detectQuestDevice();
    if (active && state.questDevice) {
      applyExactDesktopAppearance();
      forceTerraceAssets();
    } else if (!active) {
      applyExactDesktopAppearance();
      restoreDesktopScene();
    }
    updateAudit();
  }

  function frame() {
    const active = xrActive();
    if (active !== state.inXR) onXrStateChanged(active ? XR_STATE.IN_XR : XR_STATE.NOT_IN_XR);
    if (!state.inXR) return;
    if (!state.questDevice) state.questDevice = detectQuestDevice();
    if (!state.questDevice) return;
    applyExactDesktopAppearance();
    forceTerraceAssets();
    updateAudit();
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

  function install(scene, helper) {
    if (state.installed) return;
    state.installed = true;
    state.scene = scene;
    state.helper = helper;
    captureDesktopAppearance();
    helper.baseExperience?.onStateChangedObservable?.add?.(onXrStateChanged);
    scene.onBeforeRenderObservable.add(() => {
      try { frame(); } catch (error) { recordError('frame', error); }
    });
    if (xrActive()) onXrStateChanged(XR_STATE.IN_XR);
    updateAudit();
    console.info(`[UCAN ${VERSION}] Paridad visual de computadora y recursos de terraza Meta Quest instalados.`);
  }

  function updateAudit() {
    window.__UCAN_QUEST_PARITY_V295__ = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      questOnly:true,
      inXR:state.inXR,
      questDevice:state.questDevice,
      exactDesktopLighting:true,
      exposureOverride:false,
      contrastOverride:false,
      toneMappingOverride:false,
      floorMaterialOverride:false,
      desktopSceneUnchanged:true,
      terraceFloorSticky:true,
      terraceLock:state.terraceLock,
      terraceDropToFloorThreePrevented:true,
      skyRootForcedEveryFrame:true,
      celestialMeshesForcedVisible:true,
      hiddenPlanetsEducationallyVisibleInXR:true,
      terracePanelsForcedVisible:true,
      dynamicPanelTexturesRefreshed:true,
      originalMaterialsPreserved:true,
      forcedFrames:state.forcedFrames,
      forcedMeshes:state.forcedMeshes,
      forcedCelestial:state.forcedCelestial,
      forcedPanels:state.forcedPanels,
      textureRefreshes:state.textureRefreshes,
      floorCorrections:state.floorCorrections,
      lastError:state.lastError,
      getState:() => ({
        inXR:state.inXR,
        questDevice:state.questDevice,
        terraceLock:state.terraceLock,
        forcedMeshes:state.forcedMeshes,
        forcedCelestial:state.forcedCelestial,
        forcedPanels:state.forcedPanels,
        floorCorrections:state.floorCorrections,
        lastError:state.lastError
      }),
      refresh:() => forceTerraceAssets()
    };
  }

  function boot(attempt = 0) {
    const scene = window.__UCAN_API__?.getScene?.();
    const helper = window.__UCAN_XR_HELPER__;
    const controlsReady = window.__UCAN_UNIFIED_XR_AUDIT__?.version === 'V293';
    const windowReady = window.__UCAN_UNIVERSAL_SIGN_AUDIT__?.version === 'V292';
    if (scene && helper?.baseExperience && controlsReady && windowReady) return install(scene, helper);
    if (attempt < 300) window.setTimeout(() => boot(attempt + 1), 100);
    else {
      state.lastError = { stage:'boot', name:'Timeout', message:'No se encontró la escena, WebXR, V293 o V292.', at:new Date().toISOString() };
      updateAudit();
    }
  }

  updateAudit();
  boot();
})();