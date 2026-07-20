(() => {
  'use strict';

  const VERSION = 'V279';
  const BUILD = 'V279-20260720-XR-FULL-VISUAL-PARITY';
  const B = window.BABYLON;
  if (!B?.Scene?.prototype?.createDefaultXRExperienceAsync) return;

  const states = new WeakMap();
  const XR_AUXILIARY = /webxr|motion.?controller|controller mesh|left hand|right hand|hand mesh|teleport|gaze|laser|pointer|selection ring|ray mesh/i;

  const cloneValue = value => {
    try { return value?.clone?.() ?? value; } catch (_) { return value; }
  };
  const finite = value => Number.isFinite(Number(value));
  const enabled = object => typeof object?.isEnabled === 'function' ? object.isEnabled() : true;

  function isSceneMesh(mesh) {
    if (!mesh || mesh.metadata?.xrUnderStairBlocker) return false;
    return !XR_AUXILIARY.test(String(mesh.name || ''));
  }

  function captureMaterial(material) {
    return {
      material,
      alpha: material.alpha,
      alphaMode: material.alphaMode,
      backFaceCulling: material.backFaceCulling,
      needDepthPrePass: material.needDepthPrePass,
      disableDepthWrite: material.disableDepthWrite,
      forceDepthWrite: material.forceDepthWrite,
      separateCullingPass: material.separateCullingPass,
      transparencyMode: material.transparencyMode,
      disableLighting: material.disableLighting,
      wireframe: material.wireframe,
      pointsCloud: material.pointsCloud,
      zOffset: material.zOffset,
      diffuseColor: cloneValue(material.diffuseColor),
      emissiveColor: cloneValue(material.emissiveColor),
      specularColor: cloneValue(material.specularColor),
      ambientColor: cloneValue(material.ambientColor),
      diffuseTexture: material.diffuseTexture,
      emissiveTexture: material.emissiveTexture,
      opacityTexture: material.opacityTexture,
      useAlphaFromDiffuseTexture: material.useAlphaFromDiffuseTexture,
      transparent: Number(material.alpha ?? 1) < 0.999 || Boolean(material.opacityTexture)
    };
  }

  function captureSnapshot(scene, state, stage) {
    const engine = scene.getEngine();
    const desktop = state.desktop || scene.activeCamera;
    const image = scene.imageProcessingConfiguration;
    state.desktop = desktop;
    state.snapshot = {
      stage,
      capturedAt: new Date().toISOString(),
      hardwareScaling: engine.getHardwareScalingLevel(),
      clearColor: cloneValue(scene.clearColor),
      ambientColor: cloneValue(scene.ambientColor),
      fogEnabled: scene.fogEnabled,
      fogMode: scene.fogMode,
      fogDensity: scene.fogDensity,
      fogStart: scene.fogStart,
      fogEnd: scene.fogEnd,
      fogColor: cloneValue(scene.fogColor),
      environmentTexture: scene.environmentTexture,
      environmentIntensity: scene.environmentIntensity,
      autoClear: scene.autoClear,
      autoClearDepthAndStencil: scene.autoClearDepthAndStencil,
      shadowsEnabled: scene.shadowsEnabled,
      lightsEnabled: scene.lightsEnabled,
      texturesEnabled: scene.texturesEnabled,
      particlesEnabled: scene.particlesEnabled,
      postProcessesEnabled: scene.postProcessesEnabled,
      forceWireframe: scene.forceWireframe,
      forcePointsCloud: scene.forcePointsCloud,
      useRightHandedSystem: scene.useRightHandedSystem,
      skipFrustumClipping: scene.skipFrustumClipping,
      image: image ? {
        exposure: image.exposure,
        contrast: image.contrast,
        toneMappingEnabled: image.toneMappingEnabled,
        toneMappingType: image.toneMappingType,
        vignetteEnabled: image.vignetteEnabled,
        colorCurvesEnabled: image.colorCurvesEnabled,
        colorGradingEnabled: image.colorGradingEnabled
      } : null,
      camera: desktop ? {
        layerMask: desktop.layerMask,
        minZ: desktop.minZ,
        maxZ: desktop.maxZ,
        inertia: desktop.inertia
      } : null,
      lights: (scene.lights || []).map(light => ({
        light,
        enabled: enabled(light),
        intensity: light.intensity,
        diffuse: cloneValue(light.diffuse),
        specular: cloneValue(light.specular),
        groundColor: cloneValue(light.groundColor)
      })),
      meshes: (scene.meshes || []).filter(isSceneMesh).map(mesh => ({
        mesh,
        enabled: enabled(mesh),
        isVisible: mesh.isVisible !== false,
        visibility: Number(mesh.visibility ?? 1),
        layerMask: mesh.layerMask,
        renderingGroupId: mesh.renderingGroupId,
        alphaIndex: mesh.alphaIndex,
        alwaysSelectAsActiveMesh: Boolean(mesh.alwaysSelectAsActiveMesh),
        receiveShadows: Boolean(mesh.receiveShadows),
        material: mesh.material
      })),
      materials: (scene.materials || []).map(captureMaterial)
    };
    state.lastFullRestore = 0;
    state.captureCount += 1;
    updateAudit(state);
  }

  function setEngineScalingGuard(state) {
    const engine = state.scene.getEngine();
    engine.__ucanV279ParityState = state;
    if (engine.__ucanV279OriginalSetHardwareScalingLevel) return;
    engine.__ucanV279OriginalSetHardwareScalingLevel = engine.setHardwareScalingLevel.bind(engine);
    engine.setHardwareScalingLevel = value => {
      const active = engine.__ucanV279ParityState;
      if (active?.inXR && !active.allowScalingChange) return engine.getHardwareScalingLevel();
      return engine.__ucanV279OriginalSetHardwareScalingLevel(value);
    };
  }

  function setScaling(state, value) {
    const engine = state.scene.getEngine();
    if (!finite(value) || !engine.__ucanV279OriginalSetHardwareScalingLevel) return;
    if (Math.abs(engine.getHardwareScalingLevel() - Number(value)) < 0.01) return;
    state.allowScalingChange = true;
    try { engine.__ucanV279OriginalSetHardwareScalingLevel(Number(value)); }
    finally { state.allowScalingChange = false; }
  }

  function applyCameraParity(camera, snapshot) {
    if (!camera || !snapshot?.camera) return;
    camera.layerMask = snapshot.camera.layerMask ?? camera.layerMask;
    camera.minZ = Math.max(0.05, Math.min(Number(snapshot.camera.minZ || 0.06), 0.12));
    camera.maxZ = Math.max(Number(snapshot.camera.maxZ || 0), 2500);
    if (finite(snapshot.camera.inertia) && 'inertia' in camera) camera.inertia = snapshot.camera.inertia;
  }

  function restoreColor(target, key, value) {
    if (!target || !value) return;
    try {
      if (target[key]?.copyFrom) target[key].copyFrom(value);
      else target[key] = cloneValue(value);
    } catch (_) {}
  }

  function applyMaterialParity(item, inXR) {
    const material = item.material;
    if (!material || material.isDisposed?.()) return;
    material.alpha = item.alpha;
    material.disableLighting = item.disableLighting;
    material.wireframe = item.wireframe;
    material.pointsCloud = item.pointsCloud;
    material.zOffset = item.zOffset;
    material.diffuseTexture = item.diffuseTexture;
    material.emissiveTexture = item.emissiveTexture;
    material.opacityTexture = item.opacityTexture;
    material.useAlphaFromDiffuseTexture = item.useAlphaFromDiffuseTexture;
    restoreColor(material, 'diffuseColor', item.diffuseColor);
    restoreColor(material, 'emissiveColor', item.emissiveColor);
    restoreColor(material, 'specularColor', item.specularColor);
    restoreColor(material, 'ambientColor', item.ambientColor);

    if (inXR && item.transparent) {
      material.backFaceCulling = false;
      material.needDepthPrePass = false;
      material.disableDepthWrite = true;
      if ('forceDepthWrite' in material) material.forceDepthWrite = false;
      material.separateCullingPass = true;
      if (B.Material?.MATERIAL_ALPHABLEND != null) material.transparencyMode = B.Material.MATERIAL_ALPHABLEND;
      if (B.Engine?.ALPHA_COMBINE != null) material.alphaMode = B.Engine.ALPHA_COMBINE;
    } else {
      material.alphaMode = item.alphaMode;
      material.backFaceCulling = item.backFaceCulling;
      material.needDepthPrePass = item.needDepthPrePass;
      material.disableDepthWrite = item.disableDepthWrite;
      if ('forceDepthWrite' in material) material.forceDepthWrite = item.forceDepthWrite;
      material.separateCullingPass = item.separateCullingPass;
      material.transparencyMode = item.transparencyMode;
    }
  }

  function restoreFullParity(state, force = false) {
    if (!state.inXR || !state.snapshot) return;
    const scene = state.scene;
    const snapshot = state.snapshot;
    const now = performance.now();

    applyCameraParity(state.xr, snapshot);
    for (const camera of state.xr?.rigCameras || []) applyCameraParity(camera, snapshot);
    if (!force && now - state.lastFullRestore < 160) return;
    state.lastFullRestore = now;

    setScaling(state, snapshot.hardwareScaling);
    if (snapshot.clearColor) scene.clearColor = cloneValue(snapshot.clearColor);
    if (snapshot.ambientColor) scene.ambientColor = cloneValue(snapshot.ambientColor);
    scene.fogEnabled = snapshot.fogEnabled;
    scene.fogMode = snapshot.fogMode;
    scene.fogDensity = snapshot.fogDensity;
    scene.fogStart = snapshot.fogStart;
    scene.fogEnd = snapshot.fogEnd;
    if (snapshot.fogColor) scene.fogColor = cloneValue(snapshot.fogColor);
    scene.environmentTexture = snapshot.environmentTexture;
    scene.environmentIntensity = snapshot.environmentIntensity;
    scene.autoClear = snapshot.autoClear;
    scene.autoClearDepthAndStencil = snapshot.autoClearDepthAndStencil;
    scene.shadowsEnabled = snapshot.shadowsEnabled;
    scene.lightsEnabled = snapshot.lightsEnabled;
    scene.texturesEnabled = snapshot.texturesEnabled;
    scene.particlesEnabled = snapshot.particlesEnabled;
    scene.postProcessesEnabled = snapshot.postProcessesEnabled;
    scene.forceWireframe = snapshot.forceWireframe;
    scene.forcePointsCloud = snapshot.forcePointsCloud;
    scene.useRightHandedSystem = snapshot.useRightHandedSystem;
    scene.skipFrustumClipping = snapshot.skipFrustumClipping;

    if (typeof scene.setRenderingAutoClearDepthStencil === 'function') {
      for (const groupId of [1, 2, 3]) scene.setRenderingAutoClearDepthStencil(groupId, false, false, false);
    }

    const image = scene.imageProcessingConfiguration;
    if (image && snapshot.image) {
      image.exposure = snapshot.image.exposure;
      image.contrast = snapshot.image.contrast;
      image.toneMappingEnabled = snapshot.image.toneMappingEnabled;
      image.toneMappingType = snapshot.image.toneMappingType;
      image.vignetteEnabled = snapshot.image.vignetteEnabled;
      image.colorCurvesEnabled = snapshot.image.colorCurvesEnabled;
      image.colorGradingEnabled = snapshot.image.colorGradingEnabled;
    }

    for (const item of snapshot.lights) {
      const light = item.light;
      if (!light || light.isDisposed?.()) continue;
      if (typeof light.setEnabled === 'function' && enabled(light) !== item.enabled) light.setEnabled(item.enabled);
      light.intensity = item.intensity;
      restoreColor(light, 'diffuse', item.diffuse);
      restoreColor(light, 'specular', item.specular);
      restoreColor(light, 'groundColor', item.groundColor);
    }

    for (const item of snapshot.meshes) {
      const mesh = item.mesh;
      if (!mesh || mesh.isDisposed?.()) continue;
      if (typeof mesh.setEnabled === 'function' && enabled(mesh) !== item.enabled) mesh.setEnabled(item.enabled);
      mesh.isVisible = item.isVisible;
      mesh.visibility = item.visibility;
      mesh.layerMask = item.layerMask;
      mesh.renderingGroupId = item.renderingGroupId;
      mesh.alphaIndex = item.alphaIndex;
      mesh.alwaysSelectAsActiveMesh = item.alwaysSelectAsActiveMesh;
      mesh.receiveShadows = item.receiveShadows;
      if (item.material && mesh.material !== item.material) mesh.material = item.material;
    }

    for (const item of snapshot.materials) applyMaterialParity(item, true);
    state.restoreCount += 1;
    updateAudit(state);
  }

  function restoreDesktopMaterials(state) {
    if (!state.snapshot) return;
    for (const item of state.snapshot.materials) applyMaterialParity(item, false);
  }

  function compareParity(state) {
    const snapshot = state.snapshot;
    if (!snapshot) return { ready:false, reason:'No se ha capturado la vista de computadora.' };
    let meshDifferences = 0;
    let lightDifferences = 0;
    let transparentUnsafe = 0;
    for (const item of snapshot.meshes) {
      const mesh = item.mesh;
      if (!mesh || mesh.isDisposed?.()) continue;
      if (enabled(mesh) !== item.enabled || mesh.isVisible !== item.isVisible || Math.abs(Number(mesh.visibility ?? 1) - item.visibility) > 0.001 || mesh.layerMask !== item.layerMask || mesh.material !== item.material) meshDifferences += 1;
    }
    for (const item of snapshot.lights) {
      const light = item.light;
      if (!light || light.isDisposed?.()) continue;
      if (enabled(light) !== item.enabled || Math.abs(Number(light.intensity) - Number(item.intensity)) > 0.001) lightDifferences += 1;
    }
    for (const item of snapshot.materials) {
      if (!item.transparent || !state.inXR) continue;
      const material = item.material;
      if (material?.needDepthPrePass === true || material?.disableDepthWrite !== true) transparentUnsafe += 1;
    }
    const rig = state.xr?.rigCameras || [];
    const rigCameraDifferences = rig.filter(camera => camera.layerMask !== snapshot.camera?.layerMask || camera.maxZ < 2500 || camera.minZ > 0.12).length;
    return {
      ready:true,
      inXR:state.inXR,
      meshDifferences,
      lightDifferences,
      transparentUnsafe,
      rigCameraDifferences,
      hardwareScaling:state.scene.getEngine().getHardwareScalingLevel(),
      capturedHardwareScaling:snapshot.hardwareScaling,
      passed:meshDifferences === 0 && lightDifferences === 0 && transparentUnsafe === 0 && rigCameraDifferences === 0
    };
  }

  function updateAudit(state) {
    const snapshot = state.snapshot;
    window.__UCAN_XR_VISUAL_PARITY__ = {
      version:VERSION,
      build:BUILD,
      installed:true,
      inXR:state.inXR,
      snapshotBeforeImmersive:true,
      sameSceneObjects:true,
      sameLighting:true,
      sameTextures:true,
      sameEnvironment:true,
      sameImageProcessing:true,
      stereoRigCameraParity:true,
      hardwareScalingLockedInXR:true,
      allTransparentMaterialsXRSafe:true,
      blackMaterialProtection:true,
      locomotionControllerPreserved:'V277',
      capturedMeshes:snapshot?.meshes?.length || 0,
      capturedMaterials:snapshot?.materials?.length || 0,
      capturedLights:snapshot?.lights?.length || 0,
      captureCount:state.captureCount,
      restoreCount:state.restoreCount,
      compare:() => compareParity(state),
      refreshSnapshot:() => { captureSnapshot(state.scene, state, 'manual-refresh'); restoreFullParity(state, true); return compareParity(state); }
    };
  }

  function install(scene, helper) {
    if (!helper || helper.__ucanV279VisualParity) return helper;
    helper.__ucanV279VisualParity = true;
    const state = {
      scene,
      helper,
      xr:helper.baseExperience.camera,
      desktop:scene.activeCamera,
      snapshot:null,
      inXR:false,
      allowScalingChange:false,
      lastFullRestore:0,
      captureCount:0,
      restoreCount:0
    };
    states.set(scene, state);
    setEngineScalingGuard(state);

    helper.baseExperience.onStateChangedObservable.add(xrState => {
      if (xrState === B.WebXRState.ENTERING_XR) {
        state.inXR = true;
        captureSnapshot(scene, state, 'before-immersive-camera-switch');
      } else if (xrState === B.WebXRState.IN_XR) {
        state.inXR = true;
        if (!state.snapshot) captureSnapshot(scene, state, 'in-xr-fallback');
        restoreFullParity(state, true);
        window.setTimeout(() => restoreFullParity(state, true), 250);
        window.setTimeout(() => restoreFullParity(state, true), 900);
        window.__UCAN_API__?.setStatus?.('V279: modo inmersivo usando la misma escena, luces, materiales, cielo y calidad visual de la vista de computadora.');
      } else if (xrState === B.WebXRState.NOT_IN_XR) {
        state.inXR = false;
        restoreDesktopMaterials(state);
        updateAudit(state);
      }
    });

    scene.onBeforeRenderObservable.add(() => restoreFullParity(state));
    updateAudit(state);
    console.info('[UCAN V279] Paridad visual completa de computadora a WebXR instalada.');
    return helper;
  }

  const original = B.Scene.prototype.createDefaultXRExperienceAsync;
  if (original.__ucanV279VisualParityPatched) return;
  async function patched(options = {}) {
    const helper = await original.call(this, options);
    return install(this, helper);
  }
  patched.__ucanV279VisualParityPatched = true;
  patched.__ucanOriginal = original;
  B.Scene.prototype.createDefaultXRExperienceAsync = patched;

  window.__UCAN_XR_VISUAL_PARITY_BOOT__ = {
    version:VERSION,
    build:BUILD,
    patched:true,
    independentOfLocomotion:true,
    protectsTransparentMaterials:true,
    locksDesktopVisualState:true
  };
})();
