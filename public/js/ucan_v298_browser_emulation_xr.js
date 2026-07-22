(() => {
  'use strict';

  const VERSION = 'V298';
  const BUILD = 'V298-20260722-BROWSER-SCENE-XR-EMULATION';
  const B = window.BABYLON;
  if (!B) return;

  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const LEVEL = Object.freeze({ one:0, two:8.2, three:16.4, roof:27.2 });
  const PLAYER_HEIGHT = 1.72;
  const SPEED = Object.freeze({ comfort:3.4, normal:5.0, sprint:7.0 });
  const TURN_SPEED = Object.freeze({ comfort:1.2, normal:1.9 });
  const DEAD_ZONE = 0.18;
  const SPRINT_THRESHOLD = 0.86;
  const RAY_LENGTH = 300;
  const WORLD = Object.freeze({ minX:-73, maxX:73, minZ:-59, maxZ:59 });

  const state = {
    scene:null,
    helper:null,
    desktop:null,
    xr:null,
    installed:false,
    inXR:false,
    questDevice:false,
    controllers:new Map(),
    browserRender:null,
    floor:LEVEL.one,
    rooftopCommitted:false,
    movementFrames:0,
    normalFrames:0,
    sprintFrames:0,
    comfortFrames:0,
    turnFrames:0,
    browserCollisionFrames:0,
    browserRideFrames:0,
    manualRooftopFrames:0,
    selections:0,
    pointerDispatches:0,
    panelOpens:0,
    boardOpens:0,
    failedSelections:0,
    legacyMeshesRemoved:0,
    lastSelected:null,
    lastAxes:{ move:{x:0,y:0}, turn:{x:0,y:0} },
    lastSpeed:0,
    lastError:null
  };

  const finite = value => Number.isFinite(Number(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function questDetected() {
    const ua = String(navigator.userAgent || '');
    const brands = Array.isArray(navigator.userAgentData?.brands)
      ? navigator.userAgentData.brands.map(item => item?.brand || '').join(' ')
      : '';
    if (/OculusBrowser|Meta Quest|Quest 2|Quest 3|Quest Pro/i.test(`${ua} ${brands}`)) return true;
    return [...state.controllers.values()].some(record =>
      (record.controller?.inputSource?.profiles || []).some(profile => /oculus|meta|quest|touch/i.test(String(profile)))
    );
  }

  function xrActive() {
    const current = state.helper?.baseExperience?.state;
    return current === XR_STATE.ENTERING_XR || current === XR_STATE.IN_XR;
  }

  function comfortEnabled() {
    return document.getElementById('comfortBtn')?.getAttribute('aria-pressed') === 'true';
  }

  function stableFloor() {
    try {
      const floor = Number(window.__UCAN_FLOOR_STATE_V287__?.getState?.()?.floorBase);
      if (finite(floor)) return floor;
    } catch (_) {}
    return state.floor;
  }

  function setStableFloor(base, reason) {
    state.floor = Number(base);
    try { window.__UCAN_FLOOR_STATE_V287__?.setFloorBase?.(base, reason); } catch (_) {}
  }

  function eyeHeight() {
    const values = [
      state.xr?.realWorldHeight,
      state.xr?._realWorldHeight,
      window.__UCAN_QUEST_XR_AUDIT__?.getState?.()?.eyeHeight,
      1.72
    ];
    return values.map(Number).find(value => finite(value) && value >= 0.8 && value <= 2.4) || 1.72;
  }

  function browserRideActive() {
    try { return Boolean(window.__ucanV254IsRiding?.()); } catch (_) { return false; }
  }

  function insideRooftopStairs(position) {
    return Boolean(position && position.x >= 38.0 && position.x <= 50.0 && position.z >= 7.5 && position.z <= 42.0);
  }

  function rooftopGround(position) {
    if (!insideRooftopStairs(position)) return null;
    const progress = clamp((39.0 - position.z) / (39.0 - 10.5), 0, 1);
    state.manualRooftopFrames += 1;
    if (progress >= 0.86) {
      state.rooftopCommitted = true;
      setStableFloor(LEVEL.roof, 'browser-xr:rooftop-arrival-v298');
    } else if (progress <= 0.06 && state.rooftopCommitted) {
      state.rooftopCommitted = false;
      setStableFloor(LEVEL.three, 'browser-xr:floor-three-arrival-v298');
    }
    return LEVEL.three + (LEVEL.roof - LEVEL.three) * progress;
  }

  function theaterGround(position, floor) {
    if (Math.abs(floor - LEVEL.three) > 0.35) return null;
    const center = position.x > -4.8 && position.x < 1.2 && position.z > -14 && position.z < 18.8;
    const side = position.x > 18.2 && position.x < 22.8 && position.z > -8 && position.z < 18.8;
    if (!center && !side) return null;
    const z0 = center ? -12 : -7;
    const z1 = 17.4;
    const rise = center ? 2.38 : 2.04;
    return LEVEL.three + rise * clamp((position.z - z0) / (z1 - z0), 0, 1);
  }

  function groundFor(position) {
    const stair = rooftopGround(position);
    if (stair != null) return stair;
    let floor = stableFloor();
    if (state.rooftopCommitted) floor = LEVEL.roof;
    const theater = theaterGround(position, floor);
    return theater == null ? floor : theater;
  }

  function captureBrowserRendering() {
    if (!state.scene || state.browserRender) return;
    const image = state.scene.imageProcessingConfiguration || null;
    const engine = state.scene.getEngine?.();
    state.browserRender = {
      exposure:image?.exposure,
      contrast:image?.contrast,
      toneMappingEnabled:image?.toneMappingEnabled,
      toneMappingType:image?.toneMappingType,
      environmentIntensity:state.scene.environmentIntensity,
      hardwareScaling:engine?.getHardwareScalingLevel?.(),
      materialCount:state.scene.materials?.length || 0,
      meshCount:state.scene.meshes?.length || 0
    };
  }

  function enforceBrowserRendering() {
    const original = state.browserRender;
    if (!original || !state.scene) return;
    const image = state.scene.imageProcessingConfiguration;
    if (image) {
      if (finite(original.exposure)) image.exposure = original.exposure;
      if (finite(original.contrast)) image.contrast = original.contrast;
      if (typeof original.toneMappingEnabled === 'boolean') image.toneMappingEnabled = original.toneMappingEnabled;
      if (original.toneMappingType != null) image.toneMappingType = original.toneMappingType;
    }
    if (finite(original.environmentIntensity)) state.scene.environmentIntensity = original.environmentIntensity;
    const engine = state.scene.getEngine?.();
    if (finite(original.hardwareScaling) && engine?.setHardwareScalingLevel && Math.abs(engine.getHardwareScalingLevel() - original.hardwareScaling) > 0.001) {
      engine.setHardwareScalingLevel(original.hardwareScaling);
    }
  }

  function removeLegacyQuestGeometry() {
    for (const mesh of [...(state.scene?.meshes || [])]) {
      const metadata = mesh?.metadata || {};
      const legacy = metadata.ucanQuestRoomSignBackV296 || metadata.ucanRoomSignOverlayV297 ||
        /reverso legible Quest V296|frontal Quest V297/i.test(String(mesh?.name || ''));
      if (!legacy) continue;
      try { mesh.dispose?.(); state.legacyMeshesRemoved += 1; } catch (_) {}
    }
  }

  function normalizeAxis(value) {
    const number = finite(value) ? Number(value) : 0;
    return Math.abs(number) >= DEAD_ZONE ? number : 0;
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

  function controllerAxes(controller) {
    const thumbstick = motionComponent(controller, 'thumbstick', ['xr-standard-thumbstick', 'thumbstick']);
    const componentAxes = thumbstick?.axes || thumbstick?.value?.axes;
    if (componentAxes && finite(componentAxes.x) && finite(componentAxes.y)) {
      return { x:normalizeAxis(componentAxes.x), y:normalizeAxis(componentAxes.y) };
    }
    const pad = controller?.inputSource?.gamepad || controller?.motionController?.gamepadObject || controller?.motionController?.gamepad;
    const axes = Array.from(pad?.axes || []);
    if (axes.length < 2) return { x:0, y:0 };
    const offset = axes.length >= 4 ? 2 : 0;
    return { x:normalizeAxis(axes[offset]), y:normalizeAxis(axes[offset + 1]) };
  }

  function controllerForHand(hand) {
    const records = [...state.controllers.values()];
    return records.find(record => String(record.controller?.inputSource?.handedness || record.controller?.motionController?.handedness) === hand)?.controller ||
      (hand === 'left' ? records[0]?.controller : records[1]?.controller) || null;
  }

  function horizontalBasis(camera) {
    let forward = null;
    try { forward = camera?.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward) forward = new B.Vector3(0, 0, 1);
    forward.y = 0;
    if (forward.lengthSquared() < 0.0001) forward.set(0, 0, 1);
    forward.normalize();
    return { forward, right:new B.Vector3(forward.z, 0, -forward.x).normalize() };
  }

  function cameraYaw(camera) {
    try { if (camera?.rotationQuaternion?.toEulerAngles) return camera.rotationQuaternion.toEulerAngles().y; } catch (_) {}
    return Number(camera?.rotation?.y || 0);
  }

  function setCameraYaw(camera, value) {
    if (!camera) return;
    try {
      if (camera.rotationQuaternion && B.Quaternion?.FromEulerAngles) camera.rotationQuaternion.copyFrom(B.Quaternion.FromEulerAngles(0, value, 0));
      else if (camera.rotation) camera.rotation.y = value;
    } catch (_) {}
  }

  function applyTurn(dt) {
    const controller = controllerForHand('right');
    const axes = controller ? controllerAxes(controller) : { x:0, y:0 };
    state.lastAxes.turn = axes;
    if (Math.abs(axes.x) < 0.22 || Math.abs(axes.y) > 0.72) return;
    const speed = comfortEnabled() ? TURN_SPEED.comfort : TURN_SPEED.normal;
    setCameraYaw(state.xr, cameraYaw(state.xr) + axes.x * speed * dt);
    state.turnFrames += 1;
  }

  function syncDesktopToXR(ground) {
    if (!state.desktop?.position || !state.xr?.position) return;
    state.desktop.position.x = state.xr.position.x;
    state.desktop.position.z = state.xr.position.z;
    state.desktop.position.y = ground + PLAYER_HEIGHT;
  }

  function mirrorBrowserRide() {
    if (!browserRideActive() || !state.desktop?.position || !state.xr?.position) return false;
    state.xr.position.x = state.desktop.position.x;
    state.xr.position.z = state.desktop.position.z;
    state.xr.position.y = state.desktop.position.y - PLAYER_HEIGHT + eyeHeight();
    state.browserRideFrames += 1;
    return true;
  }

  function moveWithBrowserCollision(step, ground) {
    if (!state.xr?.position || step.lengthSquared() < 1e-8) return;
    if (state.desktop?.position) {
      syncDesktopToXR(ground);
      const originalY = state.desktop.position.y;
      try {
        if (typeof state.desktop._collideWithWorld === 'function') state.desktop._collideWithWorld(step);
        else state.desktop.position.addInPlace(step);
      } catch (_) {
        state.desktop.position.addInPlace(step);
      }
      state.desktop.position.y = originalY;
      state.xr.position.x = state.desktop.position.x;
      state.xr.position.z = state.desktop.position.z;
      state.browserCollisionFrames += 1;
    } else if (typeof state.xr._collideWithWorld === 'function') {
      const y = state.xr.position.y;
      state.xr._collideWithWorld(step);
      state.xr.position.y = y;
    } else {
      state.xr.position.addInPlace(step);
    }
    state.xr.position.x = clamp(state.xr.position.x, WORLD.minX, WORLD.maxX);
    state.xr.position.z = clamp(state.xr.position.z, WORLD.minZ, WORLD.maxZ);
  }

  function applyMovement(dt) {
    if (mirrorBrowserRide()) return;
    const controller = controllerForHand('left');
    const axes = controller ? controllerAxes(controller) : { x:0, y:0 };
    state.lastAxes.move = axes;
    const magnitude = Math.min(1, Math.hypot(axes.x, axes.y));
    if (magnitude < 0.01) {
      state.lastSpeed = 0;
      const ground = groundFor(state.xr.position);
      state.xr.position.y = ground + eyeHeight();
      syncDesktopToXR(ground);
      return;
    }

    const comfort = comfortEnabled();
    const speed = comfort ? SPEED.comfort : (magnitude >= SPRINT_THRESHOLD ? SPEED.sprint : SPEED.normal);
    state.lastSpeed = speed;
    const digitalX = Math.abs(axes.x) >= DEAD_ZONE ? Math.sign(axes.x) : 0;
    const digitalY = Math.abs(axes.y) >= DEAD_ZONE ? Math.sign(axes.y) : 0;
    const basis = horizontalBasis(state.xr);
    const direction = basis.right.scale(digitalX).add(basis.forward.scale(-digitalY));
    if (direction.lengthSquared() > 1) direction.normalize();
    direction.scaleInPlace(speed * dt);

    const groundBefore = groundFor(state.xr.position);
    moveWithBrowserCollision(direction, groundBefore);
    const groundAfter = groundFor(state.xr.position);
    state.xr.position.y = groundAfter + eyeHeight();
    syncDesktopToXR(groundAfter);
    state.movementFrames += 1;
    if (comfort) state.comfortFrames += 1;
    else if (speed === SPEED.sprint) state.sprintFrames += 1;
    else state.normalFrames += 1;
  }

  function metadataChain(mesh) {
    const merged = {};
    let current = mesh;
    for (let depth = 0; current && depth < 8; depth += 1, current = current.parent) Object.assign(merged, current.metadata || {});
    return merged;
  }

  function enabledVisible(mesh) {
    if (!mesh) return false;
    if (typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return false;
    if (mesh.isVisible === false || Number(mesh.visibility ?? 1) <= 0) return false;
    return true;
  }

  function isCelestial(mesh) {
    const metadata = metadataChain(mesh);
    return Boolean(metadata.celestialId || metadata.celestialData || metadata.celestialObject || metadata.astronomyLabel) ||
      /objeto cielo|etiqueta cielo|planet-|planeta|saturno|júpiter|jupiter|marte|venus|mercurio|urano|neptuno/i.test(String(mesh?.name || ''));
  }

  function isPanel(mesh) {
    const metadata = metadataChain(mesh);
    return Boolean(metadata.livePanel || metadata.livePanelKey) ||
      /panel clima|agenda astronómica|fase lunar|mapa celeste|calendario astronómico|reloj san germán/i.test(String(mesh?.name || ''));
  }

  function roomId(mesh) {
    const metadata = metadataChain(mesh);
    const source = [mesh?.name, metadata.room, metadata.id, metadata.title, metadata.boardId].filter(Boolean).join(' ');
    const match = source.match(/\b(SV-20[1-5]|ANF-301)\b/i);
    return match ? match[1].toUpperCase() : null;
  }

  function isBoard(mesh) {
    const metadata = metadataChain(mesh);
    return Boolean(metadata.board || metadata.boardId || metadata.electronicBoard) ||
      /contenido pizarra|pizarra electrónica|pantalla.*SV-20[1-5]|pantalla.*ANF-301/i.test(String(mesh?.name || ''));
  }

  function isClose(mesh) {
    const metadata = metadataChain(mesh);
    return Boolean(metadata.ucanUniversalCloseV292 || metadata.ucanInfoCloseV290 || metadata.celestialWindowCloseV288);
  }

  function isInteractive(mesh) {
    return enabledVisible(mesh) && (isPanel(mesh) || isCelestial(mesh) || isBoard(mesh) || isClose(mesh));
  }

  function ensureBrowserPickability() {
    for (const mesh of state.scene?.meshes || []) {
      if (!isInteractive(mesh)) continue;
      if (mesh.metadata?.ucanBrowserPickableV298 !== true) {
        mesh.metadata = { ...(mesh.metadata || {}), ucanBrowserPickableV298:true, originalPickableV298:mesh.isPickable };
      }
      mesh.isPickable = true;
      mesh.alwaysSelectAsActiveMesh = true;
    }
  }

  function restorePickability() {
    for (const mesh of state.scene?.meshes || []) {
      if (mesh.metadata?.ucanBrowserPickableV298 !== true) continue;
      mesh.isPickable = Boolean(mesh.metadata.originalPickableV298);
      delete mesh.metadata.ucanBrowserPickableV298;
      delete mesh.metadata.originalPickableV298;
    }
  }

  function controllerRay(controller) {
    const ray = new B.Ray(B.Vector3.Zero(), new B.Vector3(0, 0, 1), RAY_LENGTH);
    try {
      if (controller?.getWorldPointerRayToRef) {
        controller.getWorldPointerRayToRef(ray);
        ray.direction.normalize();
        ray.length = RAY_LENGTH;
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

  function centerOf(mesh) {
    try { return mesh.getBoundingInfo?.().boundingSphere?.centerWorld?.clone?.() || mesh.getAbsolutePosition?.().clone?.(); }
    catch (_) { return null; }
  }

  function angularFallback(ray) {
    let best = null;
    for (const mesh of state.scene?.meshes || []) {
      if (!isInteractive(mesh)) continue;
      const center = centerOf(mesh);
      if (!center) continue;
      const vector = center.subtract(ray.origin);
      const distance = vector.length();
      if (!finite(distance) || distance < 0.4 || distance > RAY_LENGTH) continue;
      vector.scaleInPlace(1 / distance);
      const angle = Math.acos(clamp(B.Vector3.Dot(ray.direction, vector), -1, 1));
      const limit = isCelestial(mesh) ? 10 * Math.PI / 180 : 6 * Math.PI / 180;
      if (angle > limit) continue;
      const score = angle + distance * 0.000004;
      if (!best || score < best.score) best = { mesh, score, distance, angle };
    }
    return best?.mesh || null;
  }

  function dispatchBrowserPointer(pickInfo) {
    if (!pickInfo?.pickedMesh) return false;
    let dispatched = false;
    try {
      const pointerInfo = new B.PointerInfo(B.PointerEventTypes.POINTERPICK, pickInfo);
      state.scene.onPointerObservable.notifyObservers(pointerInfo, B.PointerEventTypes.POINTERPICK);
      state.pointerDispatches += 1;
      dispatched = true;
    } catch (_) {}
    try {
      const actionManager = pickInfo.pickedMesh.actionManager;
      if (actionManager && B.ActionManager?.OnPickTrigger != null) {
        actionManager.processTrigger(B.ActionManager.OnPickTrigger, B.ActionEvent?.CreateNew?.(pickInfo.pickedMesh, undefined, pickInfo));
        dispatched = true;
      }
    } catch (_) {}
    return dispatched;
  }

  function openLikeBrowser(mesh, pickInfo) {
    if (!mesh) return false;
    const before = window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.getState?.();
    dispatchBrowserPointer(pickInfo || { hit:true, pickedMesh:mesh, pickedPoint:centerOf(mesh), distance:0 });

    if (isClose(mesh)) {
      try { window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.close?.(); } catch (_) {}
      state.lastSelected = String(mesh.name || 'Cerrar');
      state.selections += 1;
      return true;
    }

    if (isBoard(mesh)) {
      const id = roomId(mesh);
      if (id) {
        try { window.__UCAN_API__?.openBoardPanel?.(id); state.boardOpens += 1; } catch (_) {}
        state.lastSelected = id;
        state.selections += 1;
        return true;
      }
    }

    if (isPanel(mesh) || isCelestial(mesh)) {
      let opened = false;
      try { opened = window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.openPanelByMesh?.(mesh) === true; } catch (_) {}
      const after = window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.getState?.();
      if (opened || after?.visible || after?.opened > before?.opened) {
        state.panelOpens += 1;
        state.lastSelected = String(mesh.name || metadataChain(mesh).title || 'Información');
        state.selections += 1;
        return true;
      }
    }

    state.lastSelected = String(mesh.name || 'Elemento');
    return true;
  }

  function selectFromController(controller) {
    if (!state.inXR || !state.questDevice || !controller) return false;
    try {
      ensureBrowserPickability();
      const ray = controllerRay(controller);
      let pick = null;
      try { pick = state.scene.pickWithRay(ray, mesh => isInteractive(mesh), false); } catch (_) {}
      if (pick?.hit && pick.pickedMesh && openLikeBrowser(pick.pickedMesh, pick)) return true;
      const fallback = angularFallback(ray);
      if (fallback && openLikeBrowser(fallback, { hit:true, pickedMesh:fallback, pickedPoint:centerOf(fallback), distance:0 })) return true;
      state.failedSelections += 1;
      window.__UCAN_API__?.setStatus?.('Apunte el rayo al centro de la pantalla o planeta y presione el gatillo.');
      return false;
    } catch (error) {
      recordError('selection', error);
      state.failedSelections += 1;
      return false;
    }
  }

  function buttonPressed(controller) {
    const trigger = motionComponent(controller, 'trigger', ['xr-standard-trigger', 'trigger']);
    const pad = controller?.inputSource?.gamepad || controller?.motionController?.gamepadObject || controller?.motionController?.gamepad;
    return Boolean(trigger?.pressed || Number(trigger?.value || 0) > 0.58 || pad?.buttons?.[0]?.pressed || Number(pad?.buttons?.[0]?.value || 0) > 0.58);
  }

  function registerController(controller) {
    if (!controller) return;
    const key = controller.uniqueId || controller;
    if (state.controllers.has(key)) return;
    const record = { controller, down:false };
    state.controllers.set(key, record);
    const bind = motion => {
      const trigger = (() => {
        try { return motion?.getComponentOfType?.('trigger') || motion?.getComponent?.('xr-standard-trigger') || motion?.getComponent?.('trigger'); }
        catch (_) { return null; }
      })();
      trigger?.onButtonStateChangedObservable?.add?.(component => {
        const down = Boolean(component?.pressed || component?.changes?.pressed?.current || Number(component?.value || 0) > 0.58);
        if (down && !record.down) selectFromController(controller);
        record.down = down;
      });
    };
    if (controller.motionController) bind(controller.motionController);
    controller.onMotionControllerInitObservable?.add?.(bind);
    state.questDevice = questDetected();
  }

  function installControllers() {
    const input = state.helper?.input;
    if (!input) return;
    for (const controller of input.controllers || []) registerController(controller);
    input.onControllerAddedObservable?.add?.(registerController);
    input.onControllerRemovedObservable?.add?.(controller => state.controllers.delete(controller.uniqueId || controller));
  }

  function pollTriggers() {
    for (const record of state.controllers.values()) {
      const down = buttonPressed(record.controller);
      if (down && !record.down) selectFromController(record.controller);
      record.down = down;
    }
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

  function enterBrowserEmulation() {
    state.inXR = true;
    state.questDevice = questDetected();
    state.xr = state.helper?.baseExperience?.camera || null;
    state.desktop = window.__UCAN_API__?.getCamera?.() || state.desktop;
    state.floor = stableFloor();
    state.rooftopCommitted = Math.abs(state.floor - LEVEL.roof) <= 0.4;
    window.__UCAN_BROWSER_XR_EMULATION_ACTIVE__ = true;
    removeLegacyQuestGeometry();
    enforceBrowserRendering();
    ensureBrowserPickability();
    const ground = groundFor(state.xr?.position || state.desktop?.position || B.Vector3.Zero());
    if (state.xr?.position) state.xr.position.y = ground + eyeHeight();
    syncDesktopToXR(ground);
    window.__UCAN_API__?.setStatus?.('Meta Quest utiliza ahora la misma escena, iluminación, materiales, movimiento y colisiones del browser.');
    updateAudit();
  }

  function exitBrowserEmulation() {
    state.inXR = false;
    window.__UCAN_BROWSER_XR_EMULATION_ACTIVE__ = false;
    restorePickability();
    if (state.desktop?.position && state.xr?.position) {
      const ground = groundFor(state.xr.position);
      state.desktop.position.x = state.xr.position.x;
      state.desktop.position.z = state.xr.position.z;
      state.desktop.position.y = ground + PLAYER_HEIGHT;
      setStableFloor(state.rooftopCommitted ? LEVEL.roof : stableFloor(), 'browser-xr:exit-v298');
    }
    updateAudit();
  }

  function onXrStateChanged(xrState) {
    if (xrState === XR_STATE.ENTERING_XR || xrState === XR_STATE.IN_XR) enterBrowserEmulation();
    else if (xrState === XR_STATE.NOT_IN_XR) exitBrowserEmulation();
  }

  function frame() {
    const active = xrActive();
    if (active && !state.inXR) enterBrowserEmulation();
    if (!active && state.inXR) exitBrowserEmulation();
    if (!state.inXR) return;
    if (!state.questDevice) state.questDevice = questDetected();
    if (!state.questDevice) return;
    state.xr = state.helper?.baseExperience?.camera || state.xr;
    enforceBrowserRendering();
    removeLegacyQuestGeometry();
    ensureBrowserPickability();
    pollTriggers();
    const dt = clamp((state.scene.getEngine().getDeltaTime() || 16) / 1000, 0.001, 0.05);
    applyTurn(dt);
    applyMovement(dt);
    updateAudit();
  }

  function updateAudit() {
    const floor = stableFloor();
    const data = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      architecture:'single-browser-scene-emulation',
      singleAuthoritativeRuntime:true,
      legacyQuestLayersRequired:false,
      v291VisualOverridesLoaded:false,
      v295TerraceOverrideLoaded:false,
      v296ControlAndSignOverridesLoaded:false,
      v297SignAndSpeedOverlayLoaded:false,
      sameSceneAsBrowser:true,
      sameMeshesAsBrowser:true,
      sameMaterialsAsBrowser:true,
      sameLightingAsBrowser:true,
      sameImageProcessingAsBrowser:true,
      sameRoomSignsAsBrowser:true,
      generatedRoomSignClones:false,
      generatedRoomSignOverlays:false,
      browserCollisionCameraProxy:true,
      browserMovementLoopSuppressedDuringXR:true,
      browserNormalSpeed:SPEED.normal,
      browserComfortSpeed:SPEED.comfort,
      browserSprintSpeed:SPEED.sprint,
      browserSmoothTurn:true,
      browserNormalTurnSpeed:TURN_SPEED.normal,
      browserComfortTurnSpeed:TURN_SPEED.comfort,
      defaultTeleportationDisabled:true,
      browserAutomaticEscalatorRoutes:true,
      rooftopStairsManualInXR:true,
      browserPointerEventDispatch:true,
      universalSignWindowIntegration:true,
      inXR:state.inXR,
      questDevice:state.questDevice,
      floor,
      floorNumber:floor === LEVEL.one ? 1 : floor === LEVEL.two ? 2 : floor === LEVEL.three ? 3 : 4,
      rooftopCommitted:state.rooftopCommitted,
      controllers:state.controllers.size,
      movementFrames:state.movementFrames,
      normalFrames:state.normalFrames,
      sprintFrames:state.sprintFrames,
      comfortFrames:state.comfortFrames,
      turnFrames:state.turnFrames,
      browserCollisionFrames:state.browserCollisionFrames,
      browserRideFrames:state.browserRideFrames,
      manualRooftopFrames:state.manualRooftopFrames,
      selections:state.selections,
      pointerDispatches:state.pointerDispatches,
      panelOpens:state.panelOpens,
      boardOpens:state.boardOpens,
      failedSelections:state.failedSelections,
      legacyMeshesRemoved:state.legacyMeshesRemoved,
      lastSelected:state.lastSelected,
      lastAxes:state.lastAxes,
      lastSpeed:state.lastSpeed,
      lastError:state.lastError,
      getState:() => ({
        inXR:state.inXR,
        questDevice:state.questDevice,
        floor:stableFloor(),
        rooftopCommitted:state.rooftopCommitted,
        controllers:state.controllers.size,
        movementFrames:state.movementFrames,
        browserCollisionFrames:state.browserCollisionFrames,
        browserRideFrames:state.browserRideFrames,
        selections:state.selections,
        panelOpens:state.panelOpens,
        boardOpens:state.boardOpens,
        failedSelections:state.failedSelections,
        lastSelected:state.lastSelected,
        lastAxes:state.lastAxes,
        lastSpeed:state.lastSpeed,
        lastError:state.lastError
      })
    };
    window.__UCAN_BROWSER_XR_EMULATION_V298__ = data;
    window.__UCAN_UNIFIED_XR_AUDIT__ = data;
    window.__UCAN_QUEST_CONTROLS_V298__ = data;
  }

  function install(scene, helper) {
    if (state.installed) return;
    state.installed = true;
    state.scene = scene;
    state.helper = helper;
    state.desktop = window.__UCAN_API__?.getCamera?.() || null;
    state.xr = helper.baseExperience?.camera || null;
    state.floor = stableFloor();
    captureBrowserRendering();
    removeLegacyQuestGeometry();
    installControllers();
    helper.baseExperience?.onStateChangedObservable?.add?.(onXrStateChanged);
    scene.onBeforeRenderObservable.add(() => {
      try { frame(); } catch (error) { recordError('frame', error); }
    });
    if (xrActive()) enterBrowserEmulation();
    updateAudit();
    console.info(`[UCAN ${VERSION}] Emulación XR de la escena del browser instalada.`);
  }

  function boot(attempt = 0) {
    const scene = window.__UCAN_API__?.getScene?.();
    const helper = window.__UCAN_XR_HELPER__;
    const universalReady = window.__UCAN_UNIVERSAL_SIGN_AUDIT__?.version === 'V292';
    const floorReady = window.__UCAN_FLOOR_STATE_V287__?.version === 'V287';
    if (scene && helper?.baseExperience && universalReady && floorReady) return install(scene, helper);
    if (attempt < 360) window.setTimeout(() => boot(attempt + 1), 100);
    else {
      state.lastError = { stage:'boot', name:'Timeout', message:'No se encontró la escena, WebXR, V292 o V287.', at:new Date().toISOString() };
      updateAudit();
    }
  }

  updateAudit();
  boot();
})();
