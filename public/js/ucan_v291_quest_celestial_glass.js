(() => {
  'use strict';

  const VERSION = 'V291';
  const BUILD = 'V291-20260720-QUEST-CELESTIAL-GLASS';
  const B = window.BABYLON;
  if (!B) return;

  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const CELESTIAL_RAY_LENGTH = 240;
  const CELESTIAL_MAX_DISTANCE = 265;
  const CELESTIAL_ANGLE_LIMIT = 7.5 * Math.PI / 180;
  const GLASS_NAME = /cristal|vidrio|\bglass\b|ventana transparente|fachada transparente/i;

  const state = {
    scene:null,
    helper:null,
    installed:false,
    inXR:false,
    controllers:new Map(),
    materialOriginals:new Map(),
    meshOriginals:new Map(),
    exactSelections:0,
    angularSelections:0,
    failedSelections:0,
    glassMaterialsPatched:0,
    glassMeshesPatched:0,
    glassRestores:0,
    scans:0,
    lastSelection:null,
    lastError:null,
    lastScanAt:0
  };

  const finite = value => Number.isFinite(Number(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function xrActive() {
    try {
      const xr = window.__UCAN_UNIFIED_XR_AUDIT__?.getState?.();
      if (xr?.inXR === true) return true;
    } catch (_) {}
    const current = state.helper?.baseExperience?.state;
    return current === XR_STATE.ENTERING_XR || current === XR_STATE.IN_XR;
  }

  function setStatus(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const element = document.getElementById('status');
    if (element && !window.__UCAN_API__?.setStatus) element.textContent = message;
  }

  function recordError(stage, error) {
    state.lastError = {
      stage,
      name:String(error?.name || 'Error'),
      message:String(error?.message || error || 'Error XR desconocido'),
      at:new Date().toISOString()
    };
    console.error(`[UCAN ${VERSION}] ${stage}:`, error);
    updateAudit();
  }

  function controllerKey(controller) {
    return controller?.uniqueId || controller;
  }

  function controllerRay(controller, length = CELESTIAL_RAY_LENGTH) {
    const ray = new B.Ray(new B.Vector3(0, 0, 0), new B.Vector3(0, 0, 1), length);
    try {
      if (controller?.getWorldPointerRayToRef) {
        controller.getWorldPointerRayToRef(ray);
        ray.length = length;
        ray.direction.normalize();
        return ray;
      }
    } catch (_) {}
    const pointer = controller?.pointer || controller?.grip;
    try {
      ray.origin.copyFrom(pointer.getAbsolutePosition());
      B.Vector3.TransformNormalToRef(new B.Vector3(0, 0, 1), pointer.getWorldMatrix(), ray.direction);
      ray.direction.normalize();
    } catch (_) {}
    return ray;
  }

  function gamepad(controller) {
    return controller?.inputSource?.gamepad || controller?.motionController?.gamepadObject || controller?.motionController?.gamepad || null;
  }

  function triggerPressed(controller) {
    const motion = controller?.motionController;
    let trigger = null;
    try { trigger = motion?.getComponentOfType?.('trigger') || motion?.getComponent?.('xr-standard-trigger') || motion?.getComponent?.('trigger'); } catch (_) {}
    if (trigger) {
      if (typeof trigger.pressed === 'boolean') return trigger.pressed;
      if (finite(trigger.value)) return Number(trigger.value) > 0.58;
    }
    const pad = gamepad(controller);
    return Boolean(pad?.buttons?.[0]?.pressed || Number(pad?.buttons?.[0]?.value || 0) > 0.58);
  }

  function isEnabled(mesh) {
    if (!mesh) return false;
    if (typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return false;
    if (mesh.isVisible === false || Number(mesh.visibility ?? 1) <= 0) return false;
    return true;
  }

  function isCelestial(mesh) {
    if (!isEnabled(mesh)) return false;
    const metadata = mesh.metadata || {};
    return Boolean(metadata.celestialId || metadata.celestialData || metadata.celestialObject) || /objeto cielo|etiqueta cielo|planeta|estrella|luna|saturno|júpiter|jupiter|marte|venus|mercurio|urano|neptuno/i.test(String(mesh.name || ''));
  }

  function celestialId(mesh) {
    let current = mesh;
    for (let depth = 0; current && depth < 5; depth += 1, current = current.parent) {
      const id = current.metadata?.celestialId || current.metadata?.celestialData?.id;
      if (id) return String(id);
    }
    return null;
  }

  function celestialCenter(mesh) {
    try {
      const center = mesh.getBoundingInfo?.().boundingSphere?.centerWorld;
      if (center) return center.clone();
    } catch (_) {}
    try { return mesh.getAbsolutePosition?.().clone?.() || mesh.absolutePosition?.clone?.(); } catch (_) {}
    return null;
  }

  function exactCelestialPick(ray) {
    try {
      const result = state.scene?.pickWithRay?.(ray, mesh => isCelestial(mesh), false);
      if (result?.hit && result.pickedMesh) return result.pickedMesh;
    } catch (error) {
      recordError('exact-celestial-pick', error);
    }
    return null;
  }

  function angularCelestialPick(ray) {
    let best = null;
    const seen = new Set();
    for (const mesh of state.scene?.meshes || []) {
      if (!isCelestial(mesh)) continue;
      const id = celestialId(mesh) || mesh.uniqueId;
      if (seen.has(id)) continue;
      seen.add(id);
      const center = celestialCenter(mesh);
      if (!center) continue;
      const toTarget = center.subtract(ray.origin);
      const distance = toTarget.length();
      if (!finite(distance) || distance < 1 || distance > CELESTIAL_MAX_DISTANCE) continue;
      toTarget.scaleInPlace(1 / distance);
      const dot = clamp(B.Vector3.Dot(ray.direction, toTarget), -1, 1);
      if (dot <= 0) continue;
      const angle = Math.acos(dot);
      if (angle > CELESTIAL_ANGLE_LIMIT) continue;
      const score = angle + distance * 0.000004;
      if (!best || score < best.score) best = { mesh, id, angle, distance, score };
    }
    return best;
  }

  function showCelestial(mesh, method, angular = null) {
    const id = celestialId(mesh);
    if (!id) return false;
    let shown = false;
    try {
      shown = window.__UCAN_CELESTIAL_WINDOW__?.show?.(id) !== false;
    } catch (_) {}
    if (!shown) {
      try {
        window.__UCAN_INTERACTIVE_SKY__?.select?.(id);
        shown = true;
      } catch (_) {}
    }
    if (!shown) return false;
    state.lastSelection = {
      id,
      name:String(mesh?.metadata?.celestialData?.name || mesh?.name || id),
      method,
      angleDegrees:angular ? Number((angular.angle * 180 / Math.PI).toFixed(2)) : 0,
      distance:angular ? Number(angular.distance.toFixed(2)) : null,
      at:new Date().toISOString()
    };
    setStatus(`Información celeste abierta en Meta Quest: ${state.lastSelection.name}.`);
    updateAudit();
    return true;
  }

  function selectCelestial(controller) {
    if (!state.inXR || !state.scene) return false;
    const ray = controllerRay(controller, CELESTIAL_RAY_LENGTH);
    const exact = exactCelestialPick(ray);
    if (exact && showCelestial(exact, 'raycast-exacto')) {
      state.exactSelections += 1;
      updateAudit();
      return true;
    }
    const angular = angularCelestialPick(ray);
    if (angular?.mesh && showCelestial(angular.mesh, 'selección-angular', angular)) {
      state.angularSelections += 1;
      updateAudit();
      return true;
    }
    state.failedSelections += 1;
    setStatus('No se detectó un planeta. Apunte el rayo amarillo hacia el planeta o su nombre y presione el gatillo.');
    updateAudit();
    return false;
  }

  function registerController(controller) {
    const key = controllerKey(controller);
    if (!controller || state.controllers.has(key)) return;
    state.controllers.set(key, { controller, triggerDown:false });
    updateAudit();
  }

  function unregisterController(controller) {
    state.controllers.delete(controllerKey(controller));
    updateAudit();
  }

  function installControllers() {
    const input = state.helper?.input;
    if (!input) return;
    for (const controller of input.controllers || []) registerController(controller);
    input.onControllerAddedObservable?.add?.(registerController);
    input.onControllerRemovedObservable?.add?.(unregisterController);
  }

  function pollControllers() {
    if (!state.inXR) return;
    for (const record of state.controllers.values()) {
      const pressed = triggerPressed(record.controller);
      if (pressed && !record.triggerDown) selectCelestial(record.controller);
      record.triggerDown = pressed;
    }
  }

  function glassMaterial(material) {
    if (!material) return false;
    const alpha = Number(material.alpha ?? 1);
    return GLASS_NAME.test(String(material.name || '')) || material.metadata?.ucanGlass === true || (alpha > 0.08 && alpha < 0.56 && /cristal|glass|vidrio/i.test(String(material.id || '')));
  }

  function rememberMaterial(material) {
    if (state.materialOriginals.has(material)) return;
    state.materialOriginals.set(material, {
      alpha:material.alpha,
      backFaceCulling:material.backFaceCulling,
      needDepthPrePass:material.needDepthPrePass,
      disableDepthWrite:material.disableDepthWrite,
      forceDepthWrite:material.forceDepthWrite,
      separateCullingPass:material.separateCullingPass,
      transparencyMode:material.transparencyMode,
      alphaMode:material.alphaMode,
      fogEnabled:material.fogEnabled,
      diffuseColor:material.diffuseColor?.clone?.(),
      emissiveColor:material.emissiveColor?.clone?.(),
      specularColor:material.specularColor?.clone?.(),
      specularPower:material.specularPower
    });
  }

  function patchGlassMaterial(material) {
    rememberMaterial(material);
    const name = String(material.name || '');
    const dark = /oscuro|dark/i.test(name);
    const door = /puerta|door/i.test(name);
    material.alpha = dark ? 0.34 : door ? 0.40 : 0.26;
    material.backFaceCulling = false;
    material.needDepthPrePass = false;
    material.disableDepthWrite = true;
    if ('forceDepthWrite' in material) material.forceDepthWrite = false;
    material.separateCullingPass = true;
    if (B.Material?.MATERIAL_ALPHABLEND != null) material.transparencyMode = B.Material.MATERIAL_ALPHABLEND;
    if (B.Engine?.ALPHA_COMBINE != null) material.alphaMode = B.Engine.ALPHA_COMBINE;
    material.fogEnabled = false;
    if (material.diffuseColor) material.diffuseColor = dark ? new B.Color3(0.18, 0.34, 0.39) : door ? new B.Color3(0.58, 0.82, 0.88) : new B.Color3(0.66, 0.86, 0.91);
    if (material.emissiveColor) material.emissiveColor = dark ? new B.Color3(0.025, 0.055, 0.065) : new B.Color3(0.045, 0.085, 0.10);
    if (material.specularColor) material.specularColor = new B.Color3(0.55, 0.68, 0.72);
    if ('specularPower' in material) material.specularPower = 48;
    material.metadata = { ...(material.metadata || {}), ucanQuestGlassV291:true };
  }

  function rememberMesh(mesh) {
    if (state.meshOriginals.has(mesh)) return;
    state.meshOriginals.set(mesh, {
      receiveShadows:mesh.receiveShadows,
      alphaIndex:mesh.alphaIndex,
      renderingGroupId:mesh.renderingGroupId
    });
  }

  function patchGlass() {
    if (!state.scene) return;
    let materials = 0;
    let meshes = 0;
    for (const material of state.scene.materials || []) {
      if (!glassMaterial(material)) continue;
      patchGlassMaterial(material);
      materials += 1;
    }
    for (const mesh of state.scene.meshes || []) {
      if (!glassMaterial(mesh.material)) continue;
      rememberMesh(mesh);
      mesh.receiveShadows = false;
      mesh.alphaIndex = Math.max(Number(mesh.alphaIndex || 0), 40);
      mesh.renderingGroupId = Math.max(Number(mesh.renderingGroupId || 0), 2);
      mesh.metadata = { ...(mesh.metadata || {}), ucanQuestGlassMeshV291:true };
      meshes += 1;
    }
    state.glassMaterialsPatched = materials;
    state.glassMeshesPatched = meshes;
    state.scans += 1;
    state.lastScanAt = performance.now();
    updateAudit();
  }

  function restoreGlass() {
    for (const [material, original] of state.materialOriginals) {
      try {
        material.alpha = original.alpha;
        material.backFaceCulling = original.backFaceCulling;
        material.needDepthPrePass = original.needDepthPrePass;
        material.disableDepthWrite = original.disableDepthWrite;
        if ('forceDepthWrite' in material) material.forceDepthWrite = original.forceDepthWrite;
        material.separateCullingPass = original.separateCullingPass;
        material.transparencyMode = original.transparencyMode;
        material.alphaMode = original.alphaMode;
        material.fogEnabled = original.fogEnabled;
        if (original.diffuseColor) material.diffuseColor = original.diffuseColor.clone();
        if (original.emissiveColor) material.emissiveColor = original.emissiveColor.clone();
        if (original.specularColor) material.specularColor = original.specularColor.clone();
        if (finite(original.specularPower)) material.specularPower = original.specularPower;
      } catch (_) {}
    }
    for (const [mesh, original] of state.meshOriginals) {
      try {
        mesh.receiveShadows = original.receiveShadows;
        mesh.alphaIndex = original.alphaIndex;
        mesh.renderingGroupId = original.renderingGroupId;
      } catch (_) {}
    }
    state.materialOriginals.clear();
    state.meshOriginals.clear();
    state.glassRestores += 1;
    updateAudit();
  }

  function onXrStateChanged(xrState) {
    const active = xrState === XR_STATE.ENTERING_XR || xrState === XR_STATE.IN_XR;
    if (active && !state.inXR) {
      state.inXR = true;
      patchGlass();
    } else if (!active && state.inXR) {
      state.inXR = false;
      restoreGlass();
    } else {
      state.inXR = active;
    }
    updateAudit();
  }

  function frame() {
    const active = xrActive();
    if (active !== state.inXR) onXrStateChanged(active ? XR_STATE.IN_XR : XR_STATE.NOT_IN_XR);
    if (!state.inXR) return;
    pollControllers();
    if (performance.now() - state.lastScanAt > 2200) patchGlass();
  }

  function install(scene, helper) {
    if (state.installed) return;
    state.installed = true;
    state.scene = scene;
    state.helper = helper;
    installControllers();
    helper.baseExperience?.onStateChangedObservable?.add?.(onXrStateChanged);
    scene.onBeforeRenderObservable.add(frame);
    if (xrActive()) onXrStateChanged(XR_STATE.IN_XR);
    updateAudit();
    console.info('[UCAN V291] Selección celeste de largo alcance y cristales Meta Quest instalados.');
  }

  function updateAudit() {
    window.__UCAN_QUEST_VISUAL_AUDIT__ = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      inXR:state.inXR,
      celestialRayLength:CELESTIAL_RAY_LENGTH,
      celestialMaxDistance:CELESTIAL_MAX_DISTANCE,
      celestialAngularFallback:true,
      celestialAngleLimitDegrees:7.5,
      exactSelections:state.exactSelections,
      angularSelections:state.angularSelections,
      failedSelections:state.failedSelections,
      lastSelection:state.lastSelection,
      controllers:state.controllers.size,
      questGlassCompatibility:true,
      glassDepthPrePassDisabled:true,
      glassAlphaBlend:true,
      glassBackFacesVisible:true,
      glassShadowsDisabled:true,
      glassRestoredAfterXR:true,
      glassMaterialsPatched:state.glassMaterialsPatched,
      glassMeshesPatched:state.glassMeshesPatched,
      glassRestores:state.glassRestores,
      scans:state.scans,
      lastError:state.lastError,
      getState:() => ({
        installed:state.installed,
        inXR:state.inXR,
        controllers:state.controllers.size,
        exactSelections:state.exactSelections,
        angularSelections:state.angularSelections,
        failedSelections:state.failedSelections,
        lastSelection:state.lastSelection,
        glassMaterialsPatched:state.glassMaterialsPatched,
        glassMeshesPatched:state.glassMeshesPatched,
        lastError:state.lastError
      }),
      selectWithController:controller => selectCelestial(controller),
      repatchGlass:() => patchGlass()
    };
  }

  function boot(attempt = 0) {
    const scene = window.__UCAN_API__?.getScene?.();
    const helper = window.__UCAN_XR_HELPER__;
    if (scene && helper?.baseExperience) return install(scene, helper);
    if (attempt < 240) window.setTimeout(() => boot(attempt + 1), 100);
    else {
      state.lastError = { stage:'boot', name:'Timeout', message:'No se encontró el ayudante XR.', at:new Date().toISOString() };
      updateAudit();
    }
  }

  updateAudit();
  boot();
})();
