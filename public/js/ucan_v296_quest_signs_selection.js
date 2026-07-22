(() => {
  'use strict';

  const VERSION = 'V296';
  const BUILD = 'V296-20260722-QUEST-MOVEMENT-SIGNS-SELECTION';
  const B = window.BABYLON;
  if (!B) return;

  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const RAY_LENGTH = 300;
  const CELESTIAL_ANGLE = 10 * Math.PI / 180;
  const PANEL_ANGLE = 7 * Math.PI / 180;

  const state = {
    scene:null,
    helper:null,
    installed:false,
    inXR:false,
    questDevice:false,
    controllers:new Map(),
    roomSigns:new Map(),
    fixedRoomSigns:0,
    directSelections:0,
    angularSelections:0,
    triggerSelections:0,
    joystickSelections:0,
    primarySelections:0,
    failedSelections:0,
    lastSelected:null,
    lastError:null
  };

  const finite = value => Number.isFinite(Number(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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
    return [...state.controllers.values()].some(record => {
      const profiles = record.controller?.inputSource?.profiles || [];
      return profiles.some(profile => /oculus|meta|quest|touch/i.test(String(profile)));
    });
  }

  function metadataChain(mesh) {
    const merged = {};
    let current = mesh;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parent) Object.assign(merged, current.metadata || {});
    return merged;
  }

  function isEnabled(mesh) {
    if (!mesh) return false;
    if (typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return false;
    if (mesh.isVisible === false || Number(mesh.visibility ?? 1) <= 0) return false;
    return true;
  }

  function isRoomSign(mesh) {
    if (!mesh || mesh.metadata?.ucanQuestRoomSignBackV296) return false;
    const metadata = metadataChain(mesh);
    const name = `${mesh.name || ''} ${metadata.title || ''} ${metadata.label || ''} ${metadata.room || ''}`;
    return /\bSV[-\s]?20[1-5]\b|sala virtual|sal[oó]n virtual|aula virtual/i.test(name) &&
      !/puerta|marco|pared|muro|techo|piso|suelo/i.test(String(mesh.name || ''));
  }

  function isClose(mesh) {
    const metadata = metadataChain(mesh);
    return Boolean(metadata.ucanUniversalCloseV292 || metadata.ucanInfoCloseV290 || metadata.celestialWindowCloseV288);
  }

  function isCelestial(mesh) {
    const metadata = metadataChain(mesh);
    return Boolean(metadata.celestialId || metadata.celestialData || metadata.celestialObject) ||
      /objeto cielo|etiqueta cielo|planeta|estrella|luna|saturno|júpiter|jupiter|marte|venus|mercurio|urano|neptuno/i.test(String(mesh?.name || ''));
  }

  function isPanel(mesh) {
    const metadata = metadataChain(mesh);
    return Boolean(metadata.livePanel || metadata.livePanelKey) ||
      /panel clima|agenda astronómica|fase lunar|mapa celeste|calendario astronómico|reloj san germán/i.test(String(mesh?.name || ''));
  }

  function isInteractive(mesh) {
    return isEnabled(mesh) && (isClose(mesh) || isCelestial(mesh) || isPanel(mesh));
  }

  function ensureInteractive(mesh) {
    if (!mesh) return;
    let current = mesh;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parent) {
      try { current.setEnabled?.(true); } catch (_) {}
    }
    mesh.isVisible = true;
    mesh.visibility = 1;
    mesh.isPickable = true;
    mesh.alwaysSelectAsActiveMesh = true;
  }

  function cloneMaterial(material, name) {
    if (!material) return null;
    let clone = null;
    try { clone = material.clone?.(name) || null; } catch (_) {}
    if (!clone) return material;
    clone.backFaceCulling = true;
    if ('separateCullingPass' in clone) clone.separateCullingPass = false;
    return clone;
  }

  function makeRoomSignReadable(mesh) {
    if (!isRoomSign(mesh) || state.roomSigns.has(mesh)) return false;
    try {
      const originalMaterial = mesh.material || null;
      const frontMaterial = cloneMaterial(originalMaterial, `${mesh.name} material frontal Quest V296`);
      const backMaterial = cloneMaterial(originalMaterial, `${mesh.name} material posterior Quest V296`);
      if (frontMaterial) mesh.material = frontMaterial;
      mesh.isVisible = true;
      mesh.visibility = 1;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.metadata = { ...(mesh.metadata || {}), ucanQuestRoomSignFrontV296:true, readableSign:true };

      const back = mesh.clone?.(`${mesh.name} reverso legible Quest V296`, mesh.parent || null, true) || null;
      if (!back) return false;
      back.material = backMaterial || frontMaterial || originalMaterial;
      back.rotationQuaternion = null;
      if (mesh.rotation) back.rotation.copyFrom(mesh.rotation);
      back.rotation.y += Math.PI;
      if (mesh.position) back.position.copyFrom(mesh.position);
      if (mesh.scaling) back.scaling.copyFrom(mesh.scaling);
      back.isVisible = true;
      back.visibility = 1;
      back.isPickable = false;
      back.checkCollisions = false;
      back.alwaysSelectAsActiveMesh = true;
      back.renderingGroupId = Math.max(3, Number(mesh.renderingGroupId || 0));
      back.metadata = { ...(mesh.metadata || {}), ucanQuestRoomSignBackV296:true, readableSign:true };

      state.roomSigns.set(mesh, { originalMaterial, frontMaterial, backMaterial, back });
      state.fixedRoomSigns = state.roomSigns.size;
      return true;
    } catch (error) {
      state.lastError = { stage:'room-sign', message:String(error?.message || error), at:new Date().toISOString() };
      return false;
    }
  }

  function scanRoomSigns() {
    if (!state.questDevice || !state.inXR || !state.scene) return;
    for (const mesh of state.scene.meshes || []) makeRoomSignReadable(mesh);
  }

  function restoreRoomSigns() {
    for (const [mesh, record] of state.roomSigns) {
      try { mesh.material = record.originalMaterial; } catch (_) {}
      try { record.back?.dispose?.(); } catch (_) {}
      try { if (record.frontMaterial && record.frontMaterial !== record.originalMaterial) record.frontMaterial.dispose?.(); } catch (_) {}
      try { if (record.backMaterial && record.backMaterial !== record.originalMaterial) record.backMaterial.dispose?.(); } catch (_) {}
    }
    state.roomSigns.clear();
    state.fixedRoomSigns = 0;
  }

  function motionComponent(controller, type, ids = []) {
    const motion = controller?.motionController;
    try {
      const direct = motion?.getComponentOfType?.(type);
      if (direct) return direct;
    } catch (_) {}
    for (const id of ids) {
      try {
        const component = motion?.getComponent?.(id);
        if (component) return component;
      } catch (_) {}
    }
    return null;
  }

  function gamepad(controller) {
    return controller?.inputSource?.gamepad || controller?.motionController?.gamepadObject || controller?.motionController?.gamepad || null;
  }

  function pressed(button) {
    return Boolean(button?.pressed || Number(button?.value || 0) > 0.58);
  }

  function activation(controller) {
    const trigger = motionComponent(controller, 'trigger', ['xr-standard-trigger', 'trigger']);
    const thumbstick = motionComponent(controller, 'thumbstick', ['xr-standard-thumbstick', 'thumbstick']);
    const pad = gamepad(controller);
    const triggerPressed = Boolean(trigger?.pressed || Number(trigger?.value || 0) > 0.58 || pressed(pad?.buttons?.[0]));
    const joystickPressed = Boolean(thumbstick?.pressed || pressed(pad?.buttons?.[3]));
    const primaryPressed = Boolean(pressed(pad?.buttons?.[4]) || pressed(pad?.buttons?.[5]));
    return { pressed:triggerPressed || joystickPressed || primaryPressed, triggerPressed, joystickPressed, primaryPressed };
  }

  function controllerRay(controller, length = RAY_LENGTH) {
    const ray = new B.Ray(new B.Vector3(0, 0, 0), new B.Vector3(0, 0, 1), length);
    try {
      if (controller?.getWorldPointerRayToRef) {
        controller.getWorldPointerRayToRef(ray);
        ray.direction.normalize();
        ray.length = length;
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

  function meshCenter(mesh) {
    try {
      const center = mesh.getBoundingInfo?.().boundingSphere?.centerWorld;
      if (center) return center.clone();
    } catch (_) {}
    try { return mesh.getAbsolutePosition?.().clone?.() || mesh.absolutePosition?.clone?.(); } catch (_) {}
    return null;
  }

  function angularPick(ray) {
    let best = null;
    const seen = new Set();
    for (const mesh of state.scene?.meshes || []) {
      if (!isInteractive(mesh)) continue;
      const metadata = metadataChain(mesh);
      const key = metadata.celestialId || metadata.livePanelKey || metadata.title || mesh.uniqueId;
      if (seen.has(key)) continue;
      seen.add(key);
      const center = meshCenter(mesh);
      if (!center) continue;
      const vector = center.subtract(ray.origin);
      const distance = vector.length();
      if (!finite(distance) || distance < 0.5 || distance > RAY_LENGTH) continue;
      vector.scaleInPlace(1 / distance);
      const angle = Math.acos(clamp(B.Vector3.Dot(ray.direction, vector), -1, 1));
      const limit = isCelestial(mesh) ? CELESTIAL_ANGLE : PANEL_ANGLE;
      if (angle > limit) continue;
      const score = angle + distance * 0.000003;
      if (!best || score < best.score) best = { mesh, score, angle, distance };
    }
    return best;
  }

  function openMesh(mesh, source, activationState) {
    if (!mesh) return false;
    ensureInteractive(mesh);
    const api = window.__UCAN_UNIVERSAL_SIGN_WINDOW__;
    let opened = false;
    try { opened = api?.openPanelByMesh?.(mesh) === true; } catch (_) {}
    if (!opened && isClose(mesh)) {
      try { api?.close?.(); opened = true; } catch (_) {}
    }
    if (!opened) return false;
    state.lastSelected = String(mesh.name || metadataChain(mesh).title || 'Elemento informativo');
    if (source === 'direct') state.directSelections += 1;
    else state.angularSelections += 1;
    if (activationState?.triggerPressed) state.triggerSelections += 1;
    if (activationState?.joystickPressed) state.joystickSelections += 1;
    if (activationState?.primaryPressed) state.primarySelections += 1;
    updateAudit();
    return true;
  }

  function selectFromController(controller, activationState) {
    if (!state.questDevice || !state.inXR || !controller) return false;
    try {
      const ray = controllerRay(controller, RAY_LENGTH);
      let pick = null;
      try { pick = state.scene.pickWithRay(ray, mesh => isInteractive(mesh), false); } catch (_) {}
      if (pick?.hit && pick.pickedMesh && openMesh(pick.pickedMesh, 'direct', activationState)) return true;
      const angular = angularPick(ray);
      if (angular?.mesh && openMesh(angular.mesh, 'angular', activationState)) return true;
      state.failedSelections += 1;
      window.__UCAN_API__?.setStatus?.('Apunte el rayo al centro de una pantalla, letrero o planeta y presione el gatillo.');
      updateAudit();
      return false;
    } catch (error) {
      state.lastError = { stage:'selection', message:String(error?.message || error), at:new Date().toISOString() };
      state.failedSelections += 1;
      updateAudit();
      return false;
    }
  }

  function registerController(controller) {
    if (!controller) return;
    const key = controller.uniqueId || controller;
    if (state.controllers.has(key)) return;
    const record = { controller, down:false };
    state.controllers.set(key, record);

    const bindMotion = motion => {
      const trigger = (() => {
        try { return motion?.getComponentOfType?.('trigger') || motion?.getComponent?.('xr-standard-trigger') || motion?.getComponent?.('trigger'); } catch (_) { return null; }
      })();
      trigger?.onButtonStateChangedObservable?.add?.(component => {
        const isDown = Boolean(component?.pressed || component?.changes?.pressed?.current || Number(component?.value || 0) > 0.58);
        if (isDown && !record.down) selectFromController(controller, { pressed:true, triggerPressed:true, joystickPressed:false, primaryPressed:false });
        record.down = isDown;
      });
    };

    if (controller.motionController) bindMotion(controller.motionController);
    controller.onMotionControllerInitObservable?.add?.(bindMotion);
    state.questDevice = detectQuestDevice();
    updateAudit();
  }

  function installControllers() {
    const input = state.helper?.input;
    if (!input) return;
    for (const controller of input.controllers || []) registerController(controller);
    input.onControllerAddedObservable?.add?.(registerController);
    input.onControllerRemovedObservable?.add?.(controller => state.controllers.delete(controller.uniqueId || controller));
  }

  function pollControllers() {
    if (!state.questDevice || !state.inXR) return;
    for (const record of state.controllers.values()) {
      const current = activation(record.controller);
      if (current.pressed && !record.down) selectFromController(record.controller, current);
      record.down = current.pressed;
    }
  }

  function onXrStateChanged(xrState) {
    state.inXR = xrState === XR_STATE.ENTERING_XR || xrState === XR_STATE.IN_XR;
    state.questDevice = detectQuestDevice();
    if (state.inXR && state.questDevice) {
      scanRoomSigns();
      for (const mesh of state.scene?.meshes || []) if (isCelestial(mesh) || isPanel(mesh) || isClose(mesh)) ensureInteractive(mesh);
    } else if (!state.inXR) {
      restoreRoomSigns();
    }
    updateAudit();
  }

  function frame() {
    const active = xrActive();
    if (active !== state.inXR) onXrStateChanged(active ? XR_STATE.IN_XR : XR_STATE.NOT_IN_XR);
    if (!state.inXR) return;
    if (!state.questDevice) state.questDevice = detectQuestDevice();
    if (!state.questDevice) return;
    pollControllers();
    scanRoomSigns();
    for (const mesh of state.scene?.meshes || []) if (isCelestial(mesh) || isPanel(mesh) || isClose(mesh)) ensureInteractive(mesh);
    updateAudit();
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
    console.info(`[UCAN ${VERSION}] Letreros de salas y selección Meta Quest instalados.`);
  }

  function updateAudit() {
    window.__UCAN_QUEST_INTERACTION_V296__ = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      questOnly:true,
      inXR:state.inXR,
      questDevice:state.questDevice,
      roomSignsSeparateFrontBack:true,
      mirroredVirtualRoomSignsFixed:true,
      movementMatchesDesktop:true,
      desktopNaturalSpeed:5.0,
      desktopComfortSpeed:3.4,
      smoothTurnMatchesDesktop:true,
      desktopCollisionRules:true,
      directTouchControllerTrigger:true,
      triggerPollingFallback:true,
      selectionRayLength:RAY_LENGTH,
      celestialAngularFallbackDegrees:10,
      panelAngularFallbackDegrees:7,
      universalWindowIntegration:true,
      terracePanelsSelectable:true,
      celestialObjectsSelectable:true,
      fixedRoomSigns:state.fixedRoomSigns,
      controllers:state.controllers.size,
      directSelections:state.directSelections,
      angularSelections:state.angularSelections,
      triggerSelections:state.triggerSelections,
      joystickSelections:state.joystickSelections,
      primarySelections:state.primarySelections,
      failedSelections:state.failedSelections,
      lastSelected:state.lastSelected,
      lastError:state.lastError,
      getState:() => ({
        inXR:state.inXR,
        questDevice:state.questDevice,
        fixedRoomSigns:state.fixedRoomSigns,
        controllers:state.controllers.size,
        directSelections:state.directSelections,
        angularSelections:state.angularSelections,
        failedSelections:state.failedSelections,
        lastSelected:state.lastSelected,
        lastError:state.lastError
      })
    };
  }

  function boot(attempt = 0) {
    const scene = window.__UCAN_API__?.getScene?.();
    const helper = window.__UCAN_XR_HELPER__;
    const controlsReady = window.__UCAN_UNIFIED_XR_AUDIT__?.version === 'V296';
    const windowReady = window.__UCAN_UNIVERSAL_SIGN_AUDIT__?.version === 'V292';
    if (scene && helper?.baseExperience && controlsReady && windowReady) return install(scene, helper);
    if (attempt < 320) window.setTimeout(() => boot(attempt + 1), 100);
    else {
      state.lastError = { stage:'boot', message:'No se encontró la escena, WebXR, V296 o la ventana universal.', at:new Date().toISOString() };
      updateAudit();
    }
  }

  updateAudit();
  boot();
})();