(() => {
  'use strict';

  const VERSION = 'V297';
  const BUILD = 'V297-20260722-QUEST-ROOM-SIGNS-DESKTOP-SPEED';
  const B = window.BABYLON;
  if (!B) return;

  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const DEAD_ZONE = 0.16;
  const DIGITAL_THRESHOLD = 0.34;
  const SPRINT_THRESHOLD = 0.72;
  const SPEED = Object.freeze({ comfort:3.4, normal:5.0, sprint:7.0 });
  const WORLD = Object.freeze({ minX:-73, maxX:73, minZ:-59, maxZ:59 });

  const state = {
    scene:null,
    helper:null,
    installed:false,
    inXR:false,
    questDevice:false,
    roomGroups:new Map(),
    overlays:new Map(),
    originalStates:new Map(),
    disposedMirroredCopies:0,
    correctedRoomSigns:0,
    movementCorrectionFrames:0,
    normalSpeedFrames:0,
    sprintFrames:0,
    comfortFrames:0,
    lastMagnitude:0,
    lastTargetSpeed:0,
    lastExtraSpeed:0,
    lastError:null
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
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
    return (state.helper?.input?.controllers || []).some(controller =>
      (controller?.inputSource?.profiles || []).some(profile => /oculus|meta|quest|touch/i.test(String(profile)))
    );
  }

  function metadataChain(mesh) {
    const merged = {};
    let current = mesh;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parent) Object.assign(merged, current.metadata || {});
    return merged;
  }

  function roomLabel(mesh) {
    const metadata = metadataChain(mesh);
    const source = [mesh?.name, metadata.title, metadata.text, metadata.label, metadata.room, metadata.id].filter(Boolean).join(' ');
    const match = source.match(/\bSV[-\s]?20([1-5])\b/i);
    return match ? `SV-20${match[1]}` : null;
  }

  function isRoomSignMesh(mesh) {
    const label = roomLabel(mesh);
    if (!label) return false;
    const metadata = metadataChain(mesh);
    const name = String(mesh?.name || '');
    const signName = /r[oó]tulo|letrero|cartel|se[nñ]al|directorio|sign/i.test(name);
    const signMetadata = metadata.readableSign === true || metadata.ucanQuestRoomSignFrontV296 === true || metadata.ucanQuestRoomSignBackV296 === true;
    const excluded = /pizarra|pantalla|monitor|kiosk|quiosco|puerta|marco|pared|nota kanban|evidencia/i.test(name);
    return (signName || signMetadata) && !excluded;
  }

  function isMirroredCopyV296(mesh) {
    return Boolean(mesh?.metadata?.ucanQuestRoomSignBackV296) || /reverso legible Quest V296/i.test(String(mesh?.name || ''));
  }

  function disposeMirroredCopies() {
    for (const mesh of [...(state.scene?.meshes || [])]) {
      if (!isMirroredCopyV296(mesh)) continue;
      try { mesh.dispose?.(); state.disposedMirroredCopies += 1; } catch (_) {}
    }
  }

  function rememberOriginal(mesh) {
    if (!mesh || state.originalStates.has(mesh)) return;
    state.originalStates.set(mesh, {
      enabled:typeof mesh.isEnabled === 'function' ? mesh.isEnabled() : true,
      isVisible:mesh.isVisible,
      visibility:mesh.visibility,
      isPickable:mesh.isPickable
    });
  }

  function hideOriginal(mesh) {
    rememberOriginal(mesh);
    mesh.isVisible = false;
    mesh.visibility = 0;
    mesh.isPickable = false;
  }

  function restoreOriginals() {
    for (const [mesh, original] of state.originalStates) {
      try {
        mesh.setEnabled?.(original.enabled);
        mesh.isVisible = original.isVisible;
        mesh.visibility = original.visibility;
        mesh.isPickable = original.isPickable;
      } catch (_) {}
    }
    state.originalStates.clear();
  }

  function groupRoomSigns() {
    const groups = new Map();
    for (const mesh of state.scene?.meshes || []) {
      if (!isRoomSignMesh(mesh) || isMirroredCopyV296(mesh)) continue;
      const label = roomLabel(mesh);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(mesh);
    }
    state.roomGroups = groups;
    return groups;
  }

  function worldBounds(meshes) {
    let minX=Infinity, minY=Infinity, minZ=Infinity, maxX=-Infinity, maxY=-Infinity, maxZ=-Infinity;
    for (const mesh of meshes) {
      try {
        mesh.computeWorldMatrix?.(true);
        const box = mesh.getBoundingInfo?.().boundingBox;
        if (!box) continue;
        minX = Math.min(minX, box.minimumWorld.x); minY = Math.min(minY, box.minimumWorld.y); minZ = Math.min(minZ, box.minimumWorld.z);
        maxX = Math.max(maxX, box.maximumWorld.x); maxY = Math.max(maxY, box.maximumWorld.y); maxZ = Math.max(maxZ, box.maximumWorld.z);
      } catch (_) {}
    }
    if (![minX,minY,minZ,maxX,maxY,maxZ].every(finite)) return null;
    return {
      center:new B.Vector3((minX+maxX)/2, (minY+maxY)/2, (minZ+maxZ)/2),
      width:clamp(Math.max(maxX-minX, maxZ-minZ), 3.8, 6.4),
      height:clamp(maxY-minY, 0.85, 1.65)
    };
  }

  function createSignMaterial(label) {
    const texture = new B.DynamicTexture(`textura rótulo ${label} Quest V297`, { width:1024, height:300 }, state.scene, false);
    texture.hasAlpha = false;
    texture.updateSamplingMode?.(B.Texture.BILINEAR_SAMPLINGMODE);
    const ctx = texture.getContext();
    ctx.fillStyle = '#004c2f';
    ctx.fillRect(0, 0, 1024, 300);
    ctx.fillStyle = '#d7b514';
    ctx.fillRect(0, 255, 1024, 45);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 118px Segoe UI, Arial';
    ctx.fillText(label, 512, 128);
    ctx.font = 'bold 34px Segoe UI, Arial';
    ctx.fillStyle = '#dcefe7';
    ctx.fillText('SALA VIRTUAL', 512, 220);
    texture.update(false);

    const material = new B.StandardMaterial(`material rótulo ${label} Quest V297`, state.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = true;
    material.disableDepthWrite = true;
    material.needDepthPrePass = false;
    material.zOffset = -12;
    return { material, texture };
  }

  function createOverlay(label, meshes) {
    const bounds = worldBounds(meshes);
    if (!bounds) return null;
    const assets = createSignMaterial(label);
    const plane = B.MeshBuilder.CreatePlane(`rótulo ${label} frontal Quest V297`, {
      width:bounds.width,
      height:Math.max(1.05, bounds.height),
      sideOrientation:B.Mesh.FRONTSIDE
    }, state.scene);
    plane.position.copyFrom(bounds.center);
    plane.billboardMode = B.Mesh.BILLBOARDMODE_Y;
    plane.material = assets.material;
    plane.isPickable = false;
    plane.checkCollisions = false;
    plane.alwaysSelectAsActiveMesh = true;
    plane.renderingGroupId = 6;
    plane.alphaIndex = 300;
    plane.metadata = { readableSign:true, room:label, questOnly:true, ucanRoomSignOverlayV297:true, mirrored:false };
    return { plane, ...assets, meshes };
  }

  function enforceReadableRoomSigns() {
    if (!state.questDevice || !state.inXR) return;
    disposeMirroredCopies();
    const groups = groupRoomSigns();
    for (const [label, meshes] of groups) {
      for (const mesh of meshes) hideOriginal(mesh);
      let overlay = state.overlays.get(label);
      if (!overlay || overlay.plane?.isDisposed?.()) {
        overlay = createOverlay(label, meshes);
        if (overlay) state.overlays.set(label, overlay);
      }
      if (!overlay) continue;
      const bounds = worldBounds(meshes);
      if (bounds) {
        overlay.plane.position.copyFrom(bounds.center);
        overlay.plane.scaling.x = bounds.width / Math.max(0.001, overlay.plane.getBoundingInfo().boundingBox.extendSize.x * 2);
      }
      overlay.plane.setEnabled(true);
    }
    state.correctedRoomSigns = state.overlays.size;
  }

  function disposeOverlays() {
    for (const overlay of state.overlays.values()) {
      try { overlay.plane?.dispose?.(); } catch (_) {}
      try { overlay.material?.dispose?.(); } catch (_) {}
      try { overlay.texture?.dispose?.(); } catch (_) {}
    }
    state.overlays.clear();
    state.correctedRoomSigns = 0;
  }

  function comfortEnabled() {
    return document.getElementById('comfortBtn')?.getAttribute('aria-pressed') === 'true';
  }

  function normalizeAxis(raw) {
    const value = finite(raw) ? Number(raw) : 0;
    const magnitude = Math.abs(value);
    if (magnitude <= DEAD_ZONE) return 0;
    return Math.sign(value) * clamp((magnitude - DEAD_ZONE) / (1 - DEAD_ZONE), 0, 1);
  }

  function leftController() {
    const controllers = state.helper?.input?.controllers || [];
    return controllers.find(controller => String(controller?.inputSource?.handedness || controller?.motionController?.handedness) === 'left') || controllers[0] || null;
  }

  function controllerAxes(controller) {
    const motion = controller?.motionController;
    let component = null;
    try { component = motion?.getComponentOfType?.('thumbstick') || motion?.getComponent?.('xr-standard-thumbstick') || motion?.getComponent?.('thumbstick'); } catch (_) {}
    const axes = component?.axes || component?.value?.axes;
    if (axes && finite(axes.x) && finite(axes.y)) return { x:normalizeAxis(axes.x), y:normalizeAxis(axes.y) };
    const gamepad = controller?.inputSource?.gamepad || motion?.gamepadObject || motion?.gamepad;
    const values = Array.from(gamepad?.axes || []);
    if (values.length < 2) return { x:0, y:0 };
    const offset = values.length >= 4 ? 2 : 0;
    return { x:normalizeAxis(values[offset]), y:normalizeAxis(values[offset+1]) };
  }

  function horizontalBasis(camera) {
    let forward = null;
    try { forward = camera?.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward) forward = new B.Vector3(0,0,1);
    forward.y = 0;
    if (forward.lengthSquared() < 0.0001) forward.set(0,0,1);
    forward.normalize();
    return { forward, right:new B.Vector3(forward.z,0,-forward.x).normalize() };
  }

  function transitionActive() {
    try { return Boolean(window.__UCAN_UNIFIED_XR_AUDIT__?.getState?.()?.transition); } catch (_) { return false; }
  }

  function applyDesktopSpeedCorrection() {
    if (!state.questDevice || !state.inXR || transitionActive()) return;
    const camera = state.helper?.baseExperience?.camera;
    const controller = leftController();
    if (!camera?.position || !controller) return;
    const axes = controllerAxes(controller);
    const magnitude = Math.min(1, Math.hypot(axes.x, axes.y));
    state.lastMagnitude = magnitude;
    if (magnitude < 0.01) { state.lastTargetSpeed = 0; state.lastExtraSpeed = 0; return; }

    const comfort = comfortEnabled();
    const inputStrength = magnitude >= DIGITAL_THRESHOLD ? 1 : magnitude / DIGITAL_THRESHOLD;
    const targetSpeed = comfort ? SPEED.comfort : (magnitude >= SPRINT_THRESHOLD ? SPEED.sprint : SPEED.normal);
    const baseSpeed = comfort ? SPEED.comfort : SPEED.normal;
    const existingSpeed = baseSpeed * magnitude;
    const extraSpeed = Math.max(0, targetSpeed * inputStrength - existingSpeed);
    state.lastTargetSpeed = targetSpeed;
    state.lastExtraSpeed = extraSpeed;
    if (extraSpeed <= 0.001) return;

    const basis = horizontalBasis(camera);
    const direction = basis.right.scale(axes.x).add(basis.forward.scale(-axes.y));
    if (direction.lengthSquared() < 0.0001) return;
    direction.normalize();
    const dt = clamp((state.scene.getEngine().getDeltaTime() || 16) / 1000, 0.001, 0.05);
    const step = direction.scale(extraSpeed * dt);
    const y = camera.position.y;
    try {
      if (typeof camera._collideWithWorld === 'function') camera._collideWithWorld(step);
      else camera.position.addInPlace(step);
    } catch (_) {
      camera.position.addInPlace(step);
    }
    camera.position.y = y;
    camera.position.x = clamp(camera.position.x, WORLD.minX, WORLD.maxX);
    camera.position.z = clamp(camera.position.z, WORLD.minZ, WORLD.maxZ);

    const desktop = window.__UCAN_RUNTIME__?.camera;
    if (desktop?.position && desktop !== camera) {
      desktop.position.x = camera.position.x;
      desktop.position.z = camera.position.z;
    }
    state.movementCorrectionFrames += 1;
    if (comfort) state.comfortFrames += 1;
    else if (targetSpeed === SPEED.sprint) state.sprintFrames += 1;
    else state.normalSpeedFrames += 1;
  }

  function onXrStateChanged(xrState) {
    state.inXR = xrState === XR_STATE.ENTERING_XR || xrState === XR_STATE.IN_XR;
    state.questDevice = detectQuestDevice();
    if (state.inXR && state.questDevice) enforceReadableRoomSigns();
    else if (!state.inXR) {
      restoreOriginals();
      disposeOverlays();
    }
    updateAudit();
  }

  function frame() {
    const active = xrActive();
    if (active !== state.inXR) onXrStateChanged(active ? XR_STATE.IN_XR : XR_STATE.NOT_IN_XR);
    if (!state.inXR) return;
    if (!state.questDevice) state.questDevice = detectQuestDevice();
    if (!state.questDevice) return;
    enforceReadableRoomSigns();
    applyDesktopSpeedCorrection();
    updateAudit();
  }

  function updateAudit() {
    window.__UCAN_QUEST_ROOM_SPEED_V297__ = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      questOnly:true,
      inXR:state.inXR,
      questDevice:state.questDevice,
      screenshotMirroringCause:'V296 cloned the existing front/back signs and rendered extra reversed surfaces.',
      v296MirroredCopiesRemoved:true,
      roomSignsRegeneratedAsFrontFacingTextures:true,
      roomSignsBillboardY:true,
      roomSignsNeverUseBackTexture:true,
      desktopMovementSpeeds:true,
      browserComfortSpeed:SPEED.comfort,
      browserNormalSpeed:SPEED.normal,
      browserSprintSpeed:SPEED.sprint,
      analogToKeyboardParity:true,
      digitalThreshold:DIGITAL_THRESHOLD,
      fullStickSprint:true,
      sprintThreshold:SPRINT_THRESHOLD,
      desktopSceneUnchanged:true,
      correctedRoomSigns:state.correctedRoomSigns,
      disposedMirroredCopies:state.disposedMirroredCopies,
      movementCorrectionFrames:state.movementCorrectionFrames,
      normalSpeedFrames:state.normalSpeedFrames,
      sprintFrames:state.sprintFrames,
      comfortFrames:state.comfortFrames,
      lastMagnitude:state.lastMagnitude,
      lastTargetSpeed:state.lastTargetSpeed,
      lastExtraSpeed:state.lastExtraSpeed,
      lastError:state.lastError,
      getState:() => ({
        inXR:state.inXR,
        questDevice:state.questDevice,
        correctedRoomSigns:state.correctedRoomSigns,
        disposedMirroredCopies:state.disposedMirroredCopies,
        movementCorrectionFrames:state.movementCorrectionFrames,
        sprintFrames:state.sprintFrames,
        lastMagnitude:state.lastMagnitude,
        lastTargetSpeed:state.lastTargetSpeed,
        lastExtraSpeed:state.lastExtraSpeed,
        lastError:state.lastError
      })
    };
  }

  function install(scene, helper) {
    if (state.installed) return;
    state.installed = true;
    state.scene = scene;
    state.helper = helper;
    helper.baseExperience?.onStateChangedObservable?.add?.(onXrStateChanged);
    scene.onBeforeRenderObservable.add(() => {
      try { frame(); }
      catch (error) {
        state.lastError = { stage:'frame', name:String(error?.name || 'Error'), message:String(error?.message || error), at:new Date().toISOString() };
        updateAudit();
      }
    });
    if (xrActive()) onXrStateChanged(XR_STATE.IN_XR);
    updateAudit();
    console.info(`[UCAN ${VERSION}] Rótulos frontales y velocidad de navegador para Meta Quest instalados.`);
  }

  function boot(attempt = 0) {
    const scene = window.__UCAN_API__?.getScene?.();
    const helper = window.__UCAN_XR_HELPER__;
    const controlsReady = window.__UCAN_UNIFIED_XR_AUDIT__?.version === 'V296';
    const interactionReady = window.__UCAN_QUEST_INTERACTION_V296__?.version === 'V296';
    if (scene && helper?.baseExperience && controlsReady && interactionReady) return install(scene, helper);
    if (attempt < 320) window.setTimeout(() => boot(attempt + 1), 100);
    else {
      state.lastError = { stage:'boot', name:'Timeout', message:'No se encontró la escena, WebXR o V296.', at:new Date().toISOString() };
      updateAudit();
    }
  }

  updateAudit();
  boot();
})();