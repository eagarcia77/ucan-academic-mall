(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V313';
  const REVISION = 'R17';
  const BUILD = 'V313-20260729-PARALLEL-INTERACTION-R17';
  const MAX_DISTANCE = 80;

  const state = {
    scene:null,
    helper:null,
    installed:false,
    controllers:new Map(),
    nativePicks:0,
    manualPicks:0,
    actionTriggers:0,
    syntheticPointerEvents:0,
    misses:0,
    lastNativePickAt:0,
    lastManualPickAt:0,
    lastPicked:null,
    lastSource:null,
    lastError:null
  };

  function metadataChain(mesh) {
    const merged = {};
    let current = mesh;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parent) Object.assign(merged, current.metadata || {});
    return merged;
  }

  function names(mesh) {
    const values = [];
    let current = mesh;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parent) values.push(String(current.name || ''));
    return values.join(' ');
  }

  function isInteractive(mesh) {
    if (!mesh || mesh.isDisposed?.() || mesh.isVisible === false || Number(mesh.visibility ?? 1) <= 0) return false;
    if (typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return false;
    const metadata = metadataChain(mesh);
    const text = names(mesh);
    return Boolean(
      mesh.isPickable || mesh.actionManager ||
      metadata.livePanel || metadata.livePanelKey || metadata.readableSign || metadata.celestialObject || metadata.celestialId ||
      metadata.boardScreen || metadata.interactive || metadata.teleportable ||
      /cartel|letrero|rótulo|rotulo|pantalla|panel|mapa|calendario|reloj|agenda|clima|fase lunar|pizarra|puerta|botón|boton|telescopio|planeta|satélite|satelite/i.test(text)
    );
  }

  function actionTarget(mesh) {
    let current = mesh;
    let fallback = null;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parent) {
      if (!fallback && isInteractive(current)) fallback = current;
      if (current.actionManager) return current;
    }
    return fallback || mesh;
  }

  function pointerInfo(pickInfo) {
    if (B.PointerInfo) return new B.PointerInfo(B.PointerEventTypes.POINTERPICK, null, pickInfo);
    return { type:B.PointerEventTypes.POINTERPICK, event:null, pickInfo };
  }

  function triggerPick(pickInfo, source) {
    const pickedMesh = pickInfo?.pickedMesh;
    if (!pickInfo?.hit || !pickedMesh) {
      state.misses += 1;
      updateAudit();
      return false;
    }
    const target = actionTarget(pickedMesh);
    const now = performance.now();
    if (state.lastPicked === target?.uniqueId && now - state.lastManualPickAt < 300) return false;
    state.lastManualPickAt = now;
    state.lastPicked = target?.uniqueId || pickedMesh.uniqueId;
    state.lastSource = source;
    state.manualPicks += 1;

    const detail = { source, target, pickedMesh, pickInfo, at:Date.now() };
    window.dispatchEvent(new CustomEvent('ucan:parallel-pick-v313', { detail }));

    try {
      if (target?.actionManager && B.ActionManager?.OnPickTrigger != null) {
        const actionEvent = B.ActionEvent?.CreateNew
          ? B.ActionEvent.CreateNew(target, null, pickInfo)
          : { source:target, meshUnderPointer:pickedMesh, additionalData:pickInfo };
        target.actionManager.processTrigger(B.ActionManager.OnPickTrigger, actionEvent);
        state.actionTriggers += 1;
      }
    } catch (error) {
      state.lastError = { stage:'action-manager', message:String(error?.message || error), at:new Date().toISOString() };
    }

    try {
      pickInfo.__ucanParallelV313 = true;
      state.scene.onPointerObservable?.notifyObservers?.(pointerInfo(pickInfo), B.PointerEventTypes.POINTERPICK);
      state.syntheticPointerEvents += 1;
    } catch (error) {
      state.lastError = { stage:'synthetic-pointer', message:String(error?.message || error), at:new Date().toISOString() };
    }

    updateAudit();
    return true;
  }

  function pickRay(ray) {
    if (!ray || !state.scene?.pickWithRay) return null;
    try {
      return state.scene.pickWithRay(ray, mesh => isInteractive(mesh), false);
    } catch (_) { return null; }
  }

  function rayFromPointer(pointer, directionSign = 1) {
    if (!pointer?.getWorldMatrix) return null;
    try {
      pointer.computeWorldMatrix?.(true);
      const matrix = pointer.getWorldMatrix();
      const origin = pointer.getAbsolutePosition?.().clone?.() || B.Vector3.TransformCoordinates(B.Vector3.Zero(), matrix);
      const direction = B.Vector3.TransformNormal(new B.Vector3(0, 0, directionSign), matrix).normalize();
      return new B.Ray(origin, direction, MAX_DISTANCE);
    } catch (_) { return null; }
  }

  function controllerPick(controller) {
    let directRay = null;
    try {
      if (typeof controller?.getWorldPointerRay === 'function') directRay = controller.getWorldPointerRay(MAX_DISTANCE);
      else if (typeof controller?.getWorldPointerRayToRef === 'function') {
        directRay = new B.Ray(B.Vector3.Zero(), new B.Vector3(0,0,1), MAX_DISTANCE);
        controller.getWorldPointerRayToRef(directRay);
      }
    } catch (_) {}

    const candidates = [];
    if (directRay) candidates.push(pickRay(directRay));
    candidates.push(pickRay(rayFromPointer(controller?.pointer, 1)));
    candidates.push(pickRay(rayFromPointer(controller?.pointer, -1)));
    return candidates.filter(hit => hit?.hit).sort((a,b) => Number(a.distance || Infinity) - Number(b.distance || Infinity))[0] || null;
  }

  function gazePick() {
    const camera = state.helper?.baseExperience?.camera || state.scene?.activeCamera;
    try { return pickRay(camera?.getForwardRay?.(MAX_DISTANCE)); }
    catch (_) { return null; }
  }

  function performControllerPick(controller) {
    const elapsed = performance.now() - state.lastNativePickAt;
    if (elapsed < 180) return;
    const hit = controllerPick(controller) || gazePick();
    triggerPick(hit, 'xr-controller');
  }

  function bindMotionController(controller, motion) {
    if (!motion || motion.__ucanParallelInteractionV313Bound) return;
    motion.__ucanParallelInteractionV313Bound = true;
    const trigger = motion.getComponent?.('xr-standard-trigger') || motion.getComponent?.('trigger');
    if (!trigger) return;
    trigger.onButtonStateChangedObservable?.add?.(() => {
      if (!trigger.changes?.pressed || !trigger.pressed) return;
      window.setTimeout(() => performControllerPick(controller), 95);
    });
  }

  function bindController(controller) {
    if (!controller || state.controllers.has(controller.uniqueId || controller)) return;
    const key = controller.uniqueId || controller;
    state.controllers.set(key, controller);
    if (controller.motionController) bindMotionController(controller, controller.motionController);
    controller.onMotionControllerInitObservable?.add?.(motion => bindMotionController(controller, motion));
    updateAudit();
  }

  function bindHelper() {
    state.helper = window.__UCAN_XR_HELPER__ || state.helper;
    const input = state.helper?.input;
    if (!input) return false;
    for (const controller of input.controllers || []) bindController(controller);
    if (!input.__ucanParallelInteractionV313Observer) {
      input.__ucanParallelInteractionV313Observer = input.onControllerAddedObservable?.add?.(bindController) || true;
    }
    return true;
  }

  function observeNativePicks() {
    state.scene.onPointerObservable?.add?.(info => {
      if (info.type !== B.PointerEventTypes.POINTERPICK) return;
      if (info.pickInfo?.__ucanParallelV313) return;
      state.lastNativePickAt = performance.now();
      state.nativePicks += 1;
      state.lastSource = 'browser-mobile-or-native-xr';
      state.lastPicked = info.pickInfo?.pickedMesh?.uniqueId || null;
      updateAudit();
    });
  }

  function updateAudit() {
    window.__UCAN_PARALLEL_INTERACTION_V313__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      oneInteractionPipeline:true,
      browserPointer:true,
      mobileTouch:true,
      nativeXrPointer:true,
      controllerRayFallback:true,
      gazeFallback:true,
      sameActionManagerEveryEnvironment:true,
      controllers:state.controllers.size,
      nativePicks:state.nativePicks,
      manualPicks:state.manualPicks,
      actionTriggers:state.actionTriggers,
      syntheticPointerEvents:state.syntheticPointerEvents,
      misses:state.misses,
      lastPicked:state.lastPicked,
      lastSource:state.lastSource,
      lastError:state.lastError,
      pickFromGaze:() => triggerPick(gazePick(), 'audit-gaze'),
      getState:() => ({
        installed:state.installed,
        oneInteractionPipeline:true,
        controllers:state.controllers.size,
        nativePicks:state.nativePicks,
        manualPicks:state.manualPicks,
        actionTriggers:state.actionTriggers,
        lastSource:state.lastSource,
        lastError:state.lastError
      })
    };
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    if (!state.scene) return false;
    state.installed = true;
    observeNativePicks();
    bindHelper();
    window.setInterval(bindHelper, 450);
    window.__UCAN_API__?.setStatus?.('V313: clic, toque y controlador XR utilizan el mismo manejador de interacción.');
    console.info('[UCAN V313 R17] Interacción paralela instalada.');
    updateAudit();
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
