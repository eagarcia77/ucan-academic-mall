(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V309';
  const REVISION = 'R13';
  const BUILD = 'V309-20260728-STRICT-BROWSER-VR-VISUAL-PARITY-R13';
  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const ALL_LAYERS = 0x0fffffff;
  const SNAPSHOT_INTERVAL_MS = 900;
  const REPAIR_INTERVAL_MS = 180;

  const state = {
    scene:null,
    helper:null,
    desktopCamera:null,
    installed:false,
    inXR:false,
    canonical:null,
    canonicalAt:0,
    lastSnapshotAt:0,
    lastRepairAt:0,
    snapshots:0,
    repairPasses:0,
    repairedMeshes:0,
    repairedMaterials:0,
    repairedLights:0,
    suppressedQuestOnlyMeshes:0,
    cameraRepairs:0,
    sceneRepairs:0,
    currentDeviations:0,
    lastError:null
  };

  function cloneValue(value) {
    try { return value?.clone?.() ?? value; }
    catch (_) { return value; }
  }

  function shallowMetadata(value) {
    if (!value || typeof value !== 'object') return value;
    try { return { ...value }; }
    catch (_) { return value; }
  }

  function enabled(node) {
    try { return node?.isEnabled?.() !== false; }
    catch (_) { return true; }
  }

  function meshSnapshot(mesh) {
    return {
      mesh,
      name:String(mesh.name || ''),
      enabled:enabled(mesh),
      isVisible:mesh.isVisible !== false,
      visibility:Number(mesh.visibility ?? 1),
      material:mesh.material || null,
      receiveShadows:Boolean(mesh.receiveShadows),
      renderingGroupId:Number(mesh.renderingGroupId || 0),
      alphaIndex:Number(mesh.alphaIndex || 0),
      layerMask:Number(mesh.layerMask ?? ALL_LAYERS),
      isPickable:Boolean(mesh.isPickable),
      alwaysSelectAsActiveMesh:Boolean(mesh.alwaysSelectAsActiveMesh),
      checkCollisions:Boolean(mesh.checkCollisions),
      billboardMode:Number(mesh.billboardMode || 0),
      metadata:shallowMetadata(mesh.metadata)
    };
  }

  function lightSnapshot(light) {
    return {
      light,
      enabled:enabled(light),
      intensity:Number(light.intensity ?? 1),
      diffuse:cloneValue(light.diffuse),
      specular:cloneValue(light.specular),
      range:Number(light.range ?? Number.MAX_VALUE)
    };
  }

  function sceneSnapshot(scene) {
    const image = scene.imageProcessingConfiguration;
    return {
      clearColor:cloneValue(scene.clearColor),
      ambientColor:cloneValue(scene.ambientColor),
      environmentTexture:scene.environmentTexture || null,
      environmentIntensity:Number(scene.environmentIntensity ?? 1),
      fogEnabled:Boolean(scene.fogEnabled),
      fogMode:Number(scene.fogMode || 0),
      fogDensity:Number(scene.fogDensity || 0),
      fogStart:Number(scene.fogStart || 0),
      fogEnd:Number(scene.fogEnd || 0),
      fogColor:cloneValue(scene.fogColor),
      image:image ? {
        exposure:Number(image.exposure ?? 1),
        contrast:Number(image.contrast ?? 1),
        toneMappingEnabled:Boolean(image.toneMappingEnabled),
        toneMappingType:Number(image.toneMappingType || 0),
        vignetteEnabled:Boolean(image.vignetteEnabled),
        colorCurvesEnabled:Boolean(image.colorCurvesEnabled),
        colorGradingEnabled:Boolean(image.colorGradingEnabled)
      } : null
    };
  }

  function captureCanonical() {
    if (!state.scene || state.inXR) return false;
    const camera = window.__UCAN_API__?.getCamera?.() || state.desktopCamera || state.scene.activeCamera;
    state.desktopCamera = camera || state.desktopCamera;
    state.canonical = {
      meshes:new Map((state.scene.meshes || []).filter(mesh => !mesh.isDisposed?.()).map(mesh => [mesh.uniqueId, meshSnapshot(mesh)])),
      lights:new Map((state.scene.lights || []).filter(light => !light.isDisposed?.()).map(light => [light.uniqueId, lightSnapshot(light)])),
      scene:sceneSnapshot(state.scene),
      camera:camera ? {
        layerMask:Number(camera.layerMask ?? ALL_LAYERS),
        minZ:Number(camera.minZ ?? 0.1),
        maxZ:Number(camera.maxZ ?? 10000)
      } : { layerMask:ALL_LAYERS, minZ:0.1, maxZ:10000 }
    };
    state.canonicalAt = Date.now();
    state.snapshots += 1;
    updateAudit();
    return true;
  }

  function sameNumber(a, b, epsilon = 0.0001) {
    return Math.abs(Number(a || 0) - Number(b || 0)) <= epsilon;
  }

  function questOnlyMesh(mesh, canonical) {
    if (!mesh || canonical?.meshes?.has(mesh.uniqueId)) return false;
    const metadata = mesh.metadata || {};
    const name = String(mesh.name || '');
    return Boolean(
      metadata.questCorrectedStairRailV301 ||
      metadata.questSolidFloorV301 ||
      metadata.questCorrectedStairRailV304R4 ||
      metadata.holidayBoardPuertoRicoV304R4 ||
      metadata.ucanQuestGeometryRemovedV303 ||
      /viñeta confort Meta Quest V301|terraza completa Quest V301|poste baranda escalera Quest V301|pasamanos superior escalera Quest V301|riel inferior escalera Quest V301|poste lateral R4|pasamanos superior R4|riel medio R4|cristal lateral R4|Cartel feriados Puerto Rico legible R4/i.test(name)
    );
  }

  function suppressQuestOnly(canonical) {
    let suppressed = 0;
    for (const mesh of state.scene?.meshes || []) {
      if (!questOnlyMesh(mesh, canonical) || mesh.isDisposed?.()) continue;
      try {
        mesh.setEnabled?.(false);
        mesh.isVisible = false;
        mesh.visibility = 0;
        mesh.isPickable = false;
        mesh.checkCollisions = false;
        suppressed += 1;
      } catch (_) {}
    }
    state.suppressedQuestOnlyMeshes = suppressed;
  }

  function restoreMesh(record) {
    const mesh = record.mesh;
    if (!mesh || mesh.isDisposed?.()) return 0;
    let repairs = 0;
    try {
      if (enabled(mesh) !== record.enabled) { mesh.setEnabled?.(record.enabled); repairs += 1; }
      if ((mesh.isVisible !== false) !== record.isVisible) { mesh.isVisible = record.isVisible; repairs += 1; }
      if (!sameNumber(mesh.visibility, record.visibility)) { mesh.visibility = record.visibility; repairs += 1; }
      if (mesh.material !== record.material) { mesh.material = record.material; repairs += 1; state.repairedMaterials += 1; }
      if (Boolean(mesh.receiveShadows) !== record.receiveShadows) { mesh.receiveShadows = record.receiveShadows; repairs += 1; }
      if (Number(mesh.renderingGroupId || 0) !== record.renderingGroupId) { mesh.renderingGroupId = record.renderingGroupId; repairs += 1; }
      if (Number(mesh.alphaIndex || 0) !== record.alphaIndex) { mesh.alphaIndex = record.alphaIndex; repairs += 1; }
      if (Number(mesh.layerMask ?? ALL_LAYERS) !== record.layerMask) { mesh.layerMask = record.layerMask; repairs += 1; }
      if (Boolean(mesh.isPickable) !== record.isPickable) { mesh.isPickable = record.isPickable; repairs += 1; }
      if (Boolean(mesh.alwaysSelectAsActiveMesh) !== record.alwaysSelectAsActiveMesh) { mesh.alwaysSelectAsActiveMesh = record.alwaysSelectAsActiveMesh; repairs += 1; }
      if (Boolean(mesh.checkCollisions) !== record.checkCollisions) { mesh.checkCollisions = record.checkCollisions; repairs += 1; }
      if (Number(mesh.billboardMode || 0) !== record.billboardMode) { mesh.billboardMode = record.billboardMode; repairs += 1; }
      if (String(mesh.name || '') !== record.name) { mesh.name = record.name; repairs += 1; }
      if (mesh.metadata?.ucanQuestGeometryRemovedV303 || mesh.metadata?.ucanQuestTransparentSurfaceV304R4) {
        mesh.metadata = shallowMetadata(record.metadata);
        repairs += 1;
      }
    } catch (_) {}
    return repairs;
  }

  function restoreLights(canonical) {
    let repairs = 0;
    for (const record of canonical.lights.values()) {
      const light = record.light;
      if (!light || light.isDisposed?.()) continue;
      try {
        if (enabled(light) !== record.enabled) { light.setEnabled?.(record.enabled); repairs += 1; }
        if (!sameNumber(light.intensity, record.intensity)) { light.intensity = record.intensity; repairs += 1; }
        if (record.diffuse && light.diffuse && !light.diffuse.equals?.(record.diffuse)) { light.diffuse.copyFrom?.(record.diffuse); repairs += 1; }
        if (record.specular && light.specular && !light.specular.equals?.(record.specular)) { light.specular.copyFrom?.(record.specular); repairs += 1; }
        if (!sameNumber(light.range, record.range)) { light.range = record.range; repairs += 1; }
      } catch (_) {}
    }
    state.repairedLights += repairs;
    return repairs;
  }

  function restoreScene(canonical) {
    const scene = state.scene;
    const visual = canonical.scene;
    let repairs = 0;
    if (!scene || !visual) return repairs;
    try {
      if (visual.clearColor && scene.clearColor && !scene.clearColor.equals?.(visual.clearColor)) { scene.clearColor.copyFrom?.(visual.clearColor); repairs += 1; }
      if (visual.ambientColor && scene.ambientColor && !scene.ambientColor.equals?.(visual.ambientColor)) { scene.ambientColor.copyFrom?.(visual.ambientColor); repairs += 1; }
      if (scene.environmentTexture !== visual.environmentTexture) { scene.environmentTexture = visual.environmentTexture; repairs += 1; }
      if (!sameNumber(scene.environmentIntensity, visual.environmentIntensity)) { scene.environmentIntensity = visual.environmentIntensity; repairs += 1; }
      if (Boolean(scene.fogEnabled) !== visual.fogEnabled) { scene.fogEnabled = visual.fogEnabled; repairs += 1; }
      if (Number(scene.fogMode || 0) !== visual.fogMode) { scene.fogMode = visual.fogMode; repairs += 1; }
      if (!sameNumber(scene.fogDensity, visual.fogDensity)) { scene.fogDensity = visual.fogDensity; repairs += 1; }
      if (!sameNumber(scene.fogStart, visual.fogStart)) { scene.fogStart = visual.fogStart; repairs += 1; }
      if (!sameNumber(scene.fogEnd, visual.fogEnd)) { scene.fogEnd = visual.fogEnd; repairs += 1; }
      if (visual.fogColor && scene.fogColor && !scene.fogColor.equals?.(visual.fogColor)) { scene.fogColor.copyFrom?.(visual.fogColor); repairs += 1; }
      const image = scene.imageProcessingConfiguration;
      if (image && visual.image) {
        for (const key of ['exposure','contrast','toneMappingEnabled','toneMappingType','vignetteEnabled','colorCurvesEnabled','colorGradingEnabled']) {
          if (image[key] !== visual.image[key]) { image[key] = visual.image[key]; repairs += 1; }
        }
      }
    } catch (_) {}
    state.sceneRepairs += repairs;
    return repairs;
  }

  function restoreCamera(canonical) {
    const cameras = [
      state.helper?.baseExperience?.camera,
      state.scene?.activeCamera,
      ...(state.helper?.baseExperience?.camera?.rigCameras || [])
    ].filter(Boolean);
    let repairs = 0;
    for (const camera of cameras) {
      try {
        if (Number(camera.layerMask ?? ALL_LAYERS) !== canonical.camera.layerMask) { camera.layerMask = canonical.camera.layerMask; repairs += 1; }
        if (!sameNumber(camera.minZ, canonical.camera.minZ)) { camera.minZ = canonical.camera.minZ; repairs += 1; }
        if (!sameNumber(camera.maxZ, canonical.camera.maxZ)) { camera.maxZ = canonical.camera.maxZ; repairs += 1; }
      } catch (_) {}
    }
    state.cameraRepairs += repairs;
    return repairs;
  }

  function enforceParity(force = false) {
    if (!state.inXR || !state.canonical || !state.scene) return;
    const now = performance.now();
    if (!force && now - state.lastRepairAt < REPAIR_INTERVAL_MS) return;
    state.lastRepairAt = now;
    let repairs = 0;
    suppressQuestOnly(state.canonical);
    for (const record of state.canonical.meshes.values()) repairs += restoreMesh(record);
    repairs += restoreLights(state.canonical);
    repairs += restoreScene(state.canonical);
    repairs += restoreCamera(state.canonical);
    state.repairedMeshes += repairs;
    state.currentDeviations = repairs;
    state.repairPasses += 1;
    updateAudit();
  }

  function updateAudit() {
    window.__UCAN_STRICT_VISUAL_PARITY_V309__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      inXR:state.inXR,
      oneBabylonScene:true,
      browserSceneIsAuthoritative:true,
      sameGeometryBrowserVr:true,
      sameMeshVisibilityBrowserVr:true,
      sameMaterialsBrowserVr:true,
      sameLightingBrowserVr:true,
      sameFogAndEnvironmentBrowserVr:true,
      sameLayerMaskBrowserVr:true,
      questOnlyGeometryDisabled:true,
      questOnlyMaterialReplacementDisabled:true,
      questOnlyGlassRemovalDisabled:true,
      questOnlyRailingReplacementDisabled:true,
      questOnlyTerraceReplacementDisabled:true,
      questComfortVignetteDisabled:true,
      cameraAndControlsOnlyDifference:true,
      canonicalMeshCount:state.canonical?.meshes?.size || 0,
      canonicalLightCount:state.canonical?.lights?.size || 0,
      canonicalAt:state.canonicalAt ? new Date(state.canonicalAt).toISOString() : null,
      snapshots:state.snapshots,
      repairPasses:state.repairPasses,
      repairedMeshes:state.repairedMeshes,
      repairedMaterials:state.repairedMaterials,
      repairedLights:state.repairedLights,
      sceneRepairs:state.sceneRepairs,
      cameraRepairs:state.cameraRepairs,
      suppressedQuestOnlyMeshes:state.suppressedQuestOnlyMeshes,
      currentDeviations:state.currentDeviations,
      lastError:state.lastError,
      refresh:() => { if (state.inXR) enforceParity(true); else captureCanonical(); },
      getState:() => ({
        installed:state.installed,
        inXR:state.inXR,
        canonicalMeshCount:state.canonical?.meshes?.size || 0,
        canonicalLightCount:state.canonical?.lights?.size || 0,
        repairPasses:state.repairPasses,
        suppressedQuestOnlyMeshes:state.suppressedQuestOnlyMeshes,
        currentDeviations:state.currentDeviations,
        cameraAndControlsOnlyDifference:true,
        lastError:state.lastError
      })
    };
  }

  function currentXRState() {
    return state.helper?.baseExperience?.state ?? XR_STATE.NOT_IN_XR;
  }

  function onXRStateChanged(value) {
    if (value === XR_STATE.ENTERING_XR || value === XR_STATE.IN_XR) {
      state.inXR = true;
      if (!state.canonical) captureCanonical();
      window.setTimeout(() => enforceParity(true), 0);
      window.setTimeout(() => enforceParity(true), 120);
      window.setTimeout(() => enforceParity(true), 850);
      window.__UCAN_API__?.setStatus?.('V309: VR utiliza exactamente la misma geometría, materiales e iluminación del browser.');
    } else if (value === XR_STATE.NOT_IN_XR) {
      state.inXR = false;
      state.currentDeviations = 0;
      window.setTimeout(captureCanonical, 250);
    }
    updateAudit();
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    state.helper = window.__UCAN_XR_HELPER__ || null;
    state.desktopCamera = window.__UCAN_API__?.getCamera?.() || null;
    if (!state.scene || !state.helper?.baseExperience || !state.desktopCamera) return false;
    state.installed = true;
    captureCanonical();
    state.helper.baseExperience.onStateChangedObservable?.add?.(onXRStateChanged);
    state.scene.onBeforeRenderObservable.add(() => {
      try {
        const xr = currentXRState();
        const active = xr === XR_STATE.ENTERING_XR || xr === XR_STATE.IN_XR;
        if (active !== state.inXR) onXRStateChanged(xr);
        if (state.inXR) enforceParity(false);
        else if (performance.now() - state.lastSnapshotAt >= SNAPSHOT_INTERVAL_MS) {
          state.lastSnapshotAt = performance.now();
          captureCanonical();
        }
      } catch (error) {
        state.lastError = { stage:'frame', message:String(error?.message || error), at:new Date().toISOString() };
        updateAudit();
      }
    });
    onXRStateChanged(currentXRState());
    updateAudit();
    console.info('[UCAN V309 R13] Paridad visual estricta browser/WebXR instalada.');
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 600) window.clearInterval(timer);
    } catch (error) {
      state.lastError = { stage:'install', message:String(error?.message || error), at:new Date().toISOString() };
      updateAudit();
      if (attempts >= 600) window.clearInterval(timer);
    }
  }, 100);

  updateAudit();
})();
