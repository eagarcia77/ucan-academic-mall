(() => {
  'use strict';

  const VERSION = 'V305';
  const REVISION = 'R7';
  const BUILD = 'V305-20260728-VR-UPRIGHT-SIGNS-INTERACTION-R7';
  const B = window.BABYLON;
  if (!B) return;

  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const SIGN_KEYS = Object.freeze([
    'season-current-v304',
    'pr-celebration-v304',
    'four-seasons-v304'
  ]);
  const TITLES = Object.freeze({
    'season-current-v304':'Estación actual',
    'pr-celebration-v304':'Puerto Rico hoy',
    'four-seasons-v304':'Cuatro estaciones'
  });
  const RAY_LENGTH = 220;
  const REFRESH_MS = 600;
  const CONTROLLER_POLL_MS = 70;

  const state = {
    scene:null,
    helper:null,
    installed:false,
    records:new Map(),
    controllers:new Map(),
    infoRoot:null,
    infoTexture:null,
    infoVisible:false,
    currentKey:null,
    lastRefresh:0,
    lastControllerPoll:0,
    correctedSigns:0,
    correctedFaces:0,
    disposedLegacyFaces:0,
    pointerSelections:0,
    controllerSelections:0,
    triggerSelections:0,
    primarySelections:0,
    joystickSelections:0,
    gazeFallbackSelections:0,
    failedSelections:0,
    infoOpens:0,
    infoCloses:0,
    lastError:null
  };

  function metadataChain(mesh) {
    const merged = {};
    let current = mesh;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parent) {
      Object.assign(merged, current.metadata || {});
    }
    return merged;
  }

  function nameChain(mesh) {
    const names = [];
    let current = mesh;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parent) {
      names.push(String(current.name || ''));
    }
    return names.join(' ');
  }

  function boardKey(mesh) {
    if (!mesh) return null;
    const metadata = metadataChain(mesh);
    const direct = metadata.r7PanelKey || metadata.originalPanelKeyV304R6 || metadata.originalPanelKeyV304R5 ||
      metadata.originalPanelKeyV304R4 || metadata.livePanelKey;
    if (SIGN_KEYS.includes(direct)) return direct;
    const text = nameChain(mesh);
    if (/estación actual/i.test(text)) return 'season-current-v304';
    if (/celebración Puerto Rico|feriados Puerto Rico|Puerto Rico hoy/i.test(text)) return 'pr-celebration-v304';
    if (/cuatro estaciones/i.test(text)) return 'four-seasons-v304';
    return null;
  }

  function findTexture(mesh) {
    return mesh?.material?.diffuseTexture || mesh?.material?.emissiveTexture || null;
  }

  function textureCanvas(texture) {
    try { return texture?.getContext?.()?.canvas || null; } catch (_) { return null; }
  }

  function absolutePosition(mesh) {
    try {
      mesh.computeWorldMatrix?.(true);
      return mesh.getAbsolutePosition?.().clone?.() || mesh.absolutePosition?.clone?.() || mesh.position?.clone?.();
    } catch (_) {
      return mesh?.position?.clone?.() || new B.Vector3(0, 4, 0);
    }
  }

  function localDimensions(mesh) {
    try {
      const box = mesh.getBoundingInfo().boundingBox;
      return {
        width:Math.max(1, Math.abs(box.maximum.x - box.minimum.x)),
        height:Math.max(1, Math.abs(box.maximum.y - box.minimum.y))
      };
    } catch (_) {
      return { width:13.5, height:6.3 };
    }
  }

  function sourceScore(mesh, key) {
    if (!mesh || boardKey(mesh) !== key) return -1;
    const metadata = metadataChain(mesh);
    if (metadata.correctedBoardFaceV305R7 === true) return -1;
    const canvas = textureCanvas(findTexture(mesh));
    if (!canvas) return -1;
    let score = 1;
    if (metadata.originalBoardSourceV304R6 === true) score += 100;
    if (metadata.globalBoardSourceV304R5 === true) score += 60;
    if (metadata.seasonalBoard === true) score += 30;
    if (metadata.correctedBoardFaceV304R6 === true) score += 10;
    if (mesh.isEnabled?.() === false || mesh.isVisible === false) score += 5;
    return score;
  }

  function findBestSource(key) {
    let best = null;
    let bestScore = -1;
    for (const mesh of state.scene?.meshes || []) {
      const score = sourceScore(mesh, key);
      if (score > bestScore) {
        best = mesh;
        bestScore = score;
      }
    }
    return best;
  }

  function createTexture(source, key) {
    const sourceTexture = findTexture(source);
    const canvas = textureCanvas(sourceTexture);
    const width = Math.max(256, Number(canvas?.width || sourceTexture?.getSize?.().width || 1024));
    const height = Math.max(128, Number(canvas?.height || sourceTexture?.getSize?.().height || 512));
    const texture = new B.DynamicTexture(`textura VR vertical R7 ${key}`, { width, height }, state.scene, false);
    texture.hasAlpha = false;
    texture.wrapU = B.Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = B.Texture.CLAMP_ADDRESSMODE;
    texture.uScale = 1;
    texture.vScale = 1;
    texture.uOffset = 0;
    texture.vOffset = 0;
    texture.updateSamplingMode?.(B.Texture.BILINEAR_SAMPLINGMODE);
    return texture;
  }

  function syncTexture(record) {
    const source = textureCanvas(findTexture(record.source));
    if (!source || !record.texture) return false;
    const ctx = record.texture.getContext();
    const size = record.texture.getSize?.() || { width:1024, height:512 };
    ctx.setTransform?.(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.drawImage(source, 0, 0, size.width, size.height);
    // R7: no invertir Y. R6 utilizaba update(true), que en Meta Quest mostraba el canvas al revés.
    record.texture.update(false);
    return true;
  }

  function createMaterial(record, side) {
    const material = new B.StandardMaterial(`material VR vertical R7 ${record.key} ${side}`, state.scene);
    material.diffuseTexture = record.texture;
    material.emissiveTexture = record.texture;
    material.disableLighting = true;
    material.backFaceCulling = true;
    material.disableDepthWrite = false;
    material.alpha = 1;
    material.specularColor = B.Color3.Black();
    return material;
  }

  function createFace(record, side, angleOffset, planeOffset) {
    const face = B.MeshBuilder.CreatePlane(`Panel vertical VR R7 ${record.key} ${side}`, {
      width:record.width,
      height:record.height,
      sideOrientation:B.Mesh.FRONTSIDE
    }, state.scene);
    face.rotationQuaternion = null;
    face.billboardMode = B.Mesh.BILLBOARDMODE_NONE;
    face.material = createMaterial(record, side);
    face.isPickable = true;
    face.checkCollisions = false;
    face.alwaysSelectAsActiveMesh = true;
    face.renderingGroupId = 3;
    face.metadata = {
      correctedBoardFaceV305R7:true,
      r7PanelKey:record.key,
      vrInteractiveV305R7:true,
      frontSideOnly:true,
      noBacksideMirroring:true,
      dynamicTextureInvertYFalse:true,
      billboardDisabled:true,
      uprightOrientation:true,
      side,
      angleOffset,
      planeOffset
    };
    if (B.ActionManager && B.ExecuteCodeAction) {
      face.actionManager = new B.ActionManager(state.scene);
      face.actionManager.registerAction(new B.ExecuteCodeAction(B.ActionManager.OnPickTrigger, () => openInfo(record.key, 'pointer')));
    }
    return face;
  }

  function alignRecord(record) {
    const position = absolutePosition(record.source);
    const angleToCenter = Math.atan2(-position.x, -position.z);
    record.position = position;
    for (const face of record.faces) {
      const angle = angleToCenter + Number(face.metadata?.angleOffset || 0);
      const normal = new B.Vector3(Math.sin(angle), 0, Math.cos(angle));
      face.position.copyFrom(position.add(normal.scale(Number(face.metadata?.planeOffset || 0.045))));
      face.rotationQuaternion = null;
      face.rotation.set(0, angle, 0);
      face.billboardMode = B.Mesh.BILLBOARDMODE_NONE;
      face.setEnabled?.(true);
      face.isVisible = true;
      face.visibility = 1;
      face.isPickable = true;
    }
  }

  function keepSourceHidden(source) {
    if (!source) return;
    try { source.setEnabled?.(false); } catch (_) {}
    source.isVisible = false;
    source.visibility = 0;
    source.isPickable = false;
    source.metadata = { ...(source.metadata || {}), hiddenByV305R7:true };
  }

  function disableLegacyForKey(key, source) {
    for (const mesh of [...(state.scene?.meshes || [])]) {
      if (!mesh || mesh === source || boardKey(mesh) !== key) continue;
      if (mesh.metadata?.correctedBoardFaceV305R7 === true) continue;
      const metadata = metadataChain(mesh);
      const legacyFace = metadata.correctedBoardFaceV304R6 === true || metadata.globalBoardFaceV304R5 === true ||
        metadata.holidayBoardPuertoRicoV304R4 === true || metadata.readableSign === true || metadata.seasonalBoard === true;
      if (!legacyFace) continue;
      try {
        mesh.isPickable = false;
        mesh.isVisible = false;
        mesh.visibility = 0;
        mesh.setEnabled?.(false);
        mesh.metadata = { ...(mesh.metadata || {}), disposedByV305R7:true };
        mesh.dispose?.(false, true);
        state.disposedLegacyFaces += 1;
      } catch (_) {}
    }
    keepSourceHidden(source);
  }

  function createRecord(key) {
    if (state.records.has(key)) return state.records.get(key);
    const source = findBestSource(key);
    if (!source) return null;
    const dimensions = localDimensions(source);
    const record = {
      key,
      source,
      width:dimensions.width,
      height:dimensions.height,
      texture:null,
      faces:[],
      position:absolutePosition(source)
    };
    record.texture = createTexture(source, key);
    record.faces.push(createFace(record, 'hacia centro', 0, 0.048));
    record.faces.push(createFace(record, 'hacia exterior', Math.PI, 0.048));
    state.records.set(key, record);
    syncTexture(record);
    alignRecord(record);
    disableLegacyForKey(key, source);
    return record;
  }

  function refreshSigns() {
    for (const key of SIGN_KEYS) {
      const record = state.records.get(key) || createRecord(key);
      if (!record) continue;
      syncTexture(record);
      alignRecord(record);
      disableLegacyForKey(key, record.source);
    }
    state.correctedSigns = state.records.size;
    state.correctedFaces = [...state.records.values()].reduce((sum, record) => sum + record.faces.filter(face => !face.isDisposed?.()).length, 0);
  }

  function createInfoPanel() {
    if (state.infoRoot) return;
    const root = new B.TransformNode('Panel información VR R7', state.scene);
    const texture = new B.DynamicTexture('textura información VR R7', { width:1200, height:720 }, state.scene, false);
    texture.hasAlpha = false;
    texture.wrapU = B.Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = B.Texture.CLAMP_ADDRESSMODE;
    texture.uScale = 1;
    texture.vScale = 1;
    texture.updateSamplingMode?.(B.Texture.BILINEAR_SAMPLINGMODE);
    const material = new B.StandardMaterial('material información VR R7', state.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = true;
    material.disableDepthWrite = true;
    for (const [side, z, rotation] of [['frente', -0.012, 0], ['reverso', 0.012, Math.PI]]) {
      const plane = B.MeshBuilder.CreatePlane(`Panel información VR R7 ${side}`, {
        width:3.9,
        height:2.34,
        sideOrientation:B.Mesh.FRONTSIDE
      }, state.scene);
      plane.parent = root;
      plane.position.z = z;
      plane.rotation.y = rotation;
      plane.material = material;
      plane.isPickable = false;
      plane.renderingGroupId = 7;
    }
    root.setEnabled(false);
    state.infoRoot = root;
    state.infoTexture = texture;
  }

  function drawInfo(record) {
    createInfoPanel();
    const source = textureCanvas(findTexture(record.source));
    const ctx = state.infoTexture.getContext();
    ctx.setTransform?.(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 1200, 720);
    ctx.fillStyle = '#071426';
    ctx.fillRect(0, 0, 1200, 720);
    ctx.fillStyle = '#fed141';
    ctx.fillRect(0, 0, 1200, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 52px Segoe UI, Arial';
    ctx.textBaseline = 'top';
    ctx.fillText(TITLES[record.key] || 'Información', 44, 34);
    ctx.fillStyle = '#9edbe6';
    ctx.font = '26px Segoe UI, Arial';
    ctx.fillText('UCAN · Patio exterior tropical', 46, 96);
    const x = 44, y = 142, w = 1112, h = 474;
    ctx.fillStyle = '#f7f5ec';
    ctx.fillRect(x, y, w, h);
    if (source) {
      const ratio = Math.min((w - 24) / source.width, (h - 24) / source.height);
      const drawW = source.width * ratio;
      const drawH = source.height * ratio;
      ctx.drawImage(source, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
    } else {
      ctx.fillStyle = '#17342e';
      ctx.font = '30px Segoe UI, Arial';
      ctx.fillText('La información del cartel se está actualizando.', x + 40, y + 80);
    }
    ctx.fillStyle = 'rgba(255,255,255,.88)';
    ctx.font = '24px Segoe UI, Arial';
    ctx.fillText('B/Y: cerrar · Gatillo, A/X o joystick: seleccionar otro cartel', 44, 660);
    // R7: el panel tampoco invierte Y al subir el canvas.
    state.infoTexture.update(false);
  }

  function placeInfoPanel() {
    if (!state.infoVisible || !state.infoRoot) return;
    const camera = state.scene?.activeCamera || state.helper?.baseExperience?.camera || window.__UCAN_API__?.getCamera?.();
    if (!camera) return;
    const origin = camera.globalPosition?.clone?.() || camera.position?.clone?.();
    if (!origin) return;
    let forward = null;
    try { forward = camera.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward || forward.lengthSquared() < 0.001) forward = new B.Vector3(0, 0, 1);
    forward.normalize();
    const target = origin.add(forward.scale(2.65));
    target.y = origin.y - 0.06;
    state.infoRoot.position.copyFrom(target);
    const toCamera = origin.subtract(target);
    state.infoRoot.rotationQuaternion = null;
    state.infoRoot.rotation.set(0, Math.atan2(toCamera.x, toCamera.z), 0);
  }

  function openInfo(key, source = 'unknown') {
    const record = state.records.get(key);
    if (!record) return false;
    try { window.__UCAN_VISUAL_INTERACTION_V304_R6__?.close?.(); } catch (_) {}
    try { window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.close?.(); } catch (_) {}
    drawInfo(record);
    state.currentKey = key;
    state.infoVisible = true;
    state.infoRoot.setEnabled(true);
    placeInfoPanel();
    state.infoOpens += 1;
    if (source === 'pointer') state.pointerSelections += 1;
    window.__UCAN_API__?.setStatus?.(`Información abierta: ${TITLES[key] || key}. Presione B o Y para cerrar.`);
    updateAudit();
    return true;
  }

  function closeInfo() {
    if (!state.infoVisible) return;
    state.infoVisible = false;
    state.currentKey = null;
    state.infoRoot?.setEnabled(false);
    state.infoCloses += 1;
    updateAudit();
  }

  function isR7Face(mesh) {
    return mesh?.metadata?.correctedBoardFaceV305R7 === true && !mesh.isDisposed?.() && mesh.isVisible !== false && mesh.isEnabled?.() !== false;
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

  function headGazeRay() {
    const camera = state.scene?.activeCamera || state.helper?.baseExperience?.camera;
    try {
      const ray = camera?.getForwardRay?.(RAY_LENGTH);
      if (ray) {
        ray.length = RAY_LENGTH;
        ray.direction.normalize();
        return ray;
      }
    } catch (_) {}
    return null;
  }

  function angularPick(ray) {
    if (!ray) return null;
    let best = null;
    for (const record of state.records.values()) {
      for (const face of record.faces) {
        if (!isR7Face(face)) continue;
        const center = absolutePosition(face);
        const vector = center.subtract(ray.origin);
        const distance = vector.length();
        if (!Number.isFinite(distance) || distance < 0.4 || distance > RAY_LENGTH) continue;
        vector.scaleInPlace(1 / distance);
        const angle = Math.acos(Math.max(-1, Math.min(1, B.Vector3.Dot(ray.direction, vector))));
        if (angle > 14 * Math.PI / 180) continue;
        const score = angle + distance * 0.00001;
        if (!best || score < best.score) best = { face, score };
      }
    }
    return best?.face || null;
  }

  function pickR7Face(ray) {
    if (!ray) return null;
    try {
      const pick = state.scene.pickWithRay(ray, isR7Face, false);
      if (pick?.hit && pick.pickedMesh) return pick.pickedMesh;
    } catch (_) {}
    return angularPick(ray);
  }

  function selectFromController(controller, activationSource) {
    refreshSigns();
    let face = pickR7Face(controllerRay(controller));
    if (!face) {
      face = pickR7Face(headGazeRay());
      if (face) state.gazeFallbackSelections += 1;
    }
    if (!face) {
      state.failedSelections += 1;
      window.__UCAN_API__?.setStatus?.('Apunte al cartel y presione gatillo, A/X o el joystick.');
      updateAudit();
      return false;
    }
    const key = face.metadata?.r7PanelKey;
    if (!openInfo(key, 'controller')) return false;
    state.controllerSelections += 1;
    if (activationSource === 'trigger') state.triggerSelections += 1;
    else if (activationSource === 'joystick') state.joystickSelections += 1;
    else state.primarySelections += 1;
    updateAudit();
    return true;
  }

  function gamepad(controller) {
    return controller?.inputSource?.gamepad || controller?.motionController?.gamepadObject || controller?.motionController?.gamepad || null;
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

  function pressed(controller, type, ids, fallbackIndexes) {
    const component = motionComponent(controller, type, ids);
    if (component?.pressed || Number(component?.value || 0) > 0.56) return true;
    const pad = gamepad(controller);
    return fallbackIndexes.some(index => Boolean(pad?.buttons?.[index]?.pressed || Number(pad?.buttons?.[index]?.value || 0) > 0.56));
  }

  function registerController(controller) {
    if (!controller) return;
    const key = controller.uniqueId || controller;
    if (state.controllers.has(key)) return;
    state.controllers.set(key, { controller, trigger:false, joystick:false, primary:false, secondary:false });
  }

  function installControllers() {
    const input = state.helper?.input;
    if (!input) return;
    for (const controller of input.controllers || []) registerController(controller);
    input.onControllerAddedObservable?.add?.(registerController);
    input.onControllerRemovedObservable?.add?.(controller => state.controllers.delete(controller.uniqueId || controller));
  }

  function inXR() {
    return state.helper?.baseExperience?.state === XR_STATE.IN_XR;
  }

  function pollControllers() {
    if (!inXR()) return;
    for (const record of state.controllers.values()) {
      const controller = record.controller;
      const hand = String(controller?.inputSource?.handedness || controller?.motionController?.handedness || '');
      const trigger = pressed(controller, 'trigger', ['xr-standard-trigger', 'trigger'], [0]);
      const joystick = pressed(controller, 'thumbstick', ['xr-standard-thumbstick', 'thumbstick'], [3]);
      const primary = pressed(controller, 'button', hand === 'right' ? ['a-button'] : ['x-button'], [4]);
      const secondary = pressed(controller, 'button', hand === 'right' ? ['b-button'] : ['y-button'], [5]);

      if (secondary && !record.secondary) closeInfo();
      if (trigger && !record.trigger) selectFromController(controller, 'trigger');
      if (primary && !record.primary) selectFromController(controller, 'primary');
      if (joystick && !record.joystick) selectFromController(controller, 'joystick');

      record.trigger = trigger;
      record.joystick = joystick;
      record.primary = primary;
      record.secondary = secondary;
    }
  }

  function installPointerSelection() {
    state.scene.onPointerObservable?.add?.(pointerInfo => {
      if (pointerInfo.type !== B.PointerEventTypes.POINTERPICK) return;
      const face = pointerInfo.pickInfo?.pickedMesh;
      if (!isR7Face(face)) return;
      openInfo(face.metadata?.r7PanelKey, 'pointer');
    });
  }

  function updateAudit() {
    window.__UCAN_VR_SIGNS_V305_R7__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      twoIndependentFrontFaces:true,
      dynamicTextureInvertY:false,
      infoTextureInvertY:false,
      billboardDisabled:true,
      legacyFacesDisposed:true,
      desktopPointerSelection:true,
      xrControllerRaySelection:true,
      xrTriggerSelection:true,
      xrPrimarySelection:true,
      xrJoystickSelection:true,
      xrHeadGazeFallback:true,
      xrSecondaryClose:true,
      correctedSigns:state.correctedSigns,
      correctedFaces:state.correctedFaces,
      disposedLegacyFaces:state.disposedLegacyFaces,
      controllers:state.controllers.size,
      pointerSelections:state.pointerSelections,
      controllerSelections:state.controllerSelections,
      triggerSelections:state.triggerSelections,
      primarySelections:state.primarySelections,
      joystickSelections:state.joystickSelections,
      gazeFallbackSelections:state.gazeFallbackSelections,
      failedSelections:state.failedSelections,
      infoVisible:state.infoVisible,
      currentKey:state.currentKey,
      infoOpens:state.infoOpens,
      infoCloses:state.infoCloses,
      lastError:state.lastError,
      refresh:refreshSigns,
      close:closeInfo,
      openByKey:key => openInfo(key, 'api'),
      getState:() => ({
        installed:state.installed,
        inXR:inXR(),
        correctedSigns:state.correctedSigns,
        correctedFaces:state.correctedFaces,
        disposedLegacyFaces:state.disposedLegacyFaces,
        controllers:state.controllers.size,
        controllerSelections:state.controllerSelections,
        infoVisible:state.infoVisible,
        currentKey:state.currentKey,
        lastError:state.lastError
      })
    };
  }

  function frame() {
    const now = performance.now();
    if (now - state.lastRefresh >= REFRESH_MS) {
      state.lastRefresh = now;
      try { refreshSigns(); } catch (error) {
        state.lastError = { stage:'refresh', message:String(error?.message || error), at:new Date().toISOString() };
      }
    }
    if (now - state.lastControllerPoll >= CONTROLLER_POLL_MS) {
      state.lastControllerPoll = now;
      try { pollControllers(); } catch (error) {
        state.lastError = { stage:'controllers', message:String(error?.message || error), at:new Date().toISOString() };
      }
    }
    if (state.infoVisible) placeInfoPanel();
    updateAudit();
  }

  function helperReady() {
    state.scene = window.__UCAN_API__?.getScene?.() || state.scene;
    state.helper = window.__UCAN_XR_HELPER__ || state.helper;
    return Boolean(state.scene && state.helper?.baseExperience);
  }

  function install() {
    if (state.installed || !helperReady()) return false;
    const sourcesReady = SIGN_KEYS.some(key => findBestSource(key));
    if (!sourcesReady) return false;
    state.installed = true;
    createInfoPanel();
    refreshSigns();
    installControllers();
    installPointerSelection();
    state.scene.onBeforeRenderObservable.add(() => {
      try { frame(); } catch (error) {
        state.lastError = { stage:'frame', message:String(error?.message || error), at:new Date().toISOString() };
        console.error('[UCAN V305 R7] Error:', error);
      }
    });
    state.helper.baseExperience?.onStateChangedObservable?.add?.(current => {
      if (current === XR_STATE.IN_XR) window.setTimeout(refreshSigns, 450);
      if (current === XR_STATE.NOT_IN_XR) closeInfo();
    });
    window.__UCAN_API__?.setStatus?.('UCAN V305 R7: carteles VR verticales e interacción reforzada preparados.');
    console.info('[UCAN V305 R7] Carteles VR e interacción instalados.');
    updateAudit();
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 420) window.clearInterval(timer);
    } catch (error) {
      state.lastError = { stage:'install', message:String(error?.message || error), at:new Date().toISOString() };
      if (attempts >= 420) window.clearInterval(timer);
    }
  }, 100);

  updateAudit();
})();
