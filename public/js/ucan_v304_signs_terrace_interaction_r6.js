(() => {
  'use strict';

  const VERSION = 'V304';
  const REVISION = 'R6';
  const BUILD = 'V304-20260728-UPRIGHT-SIGNS-TERRACE-XR-INTERACTION-R6';
  const B = window.BABYLON;
  if (!B) return;

  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const RAY_LENGTH = 360;
  const CONTROLLER_POLL_MS = 80;
  const CANDIDATE_REFRESH_MS = 1700;
  const SIGN_REFRESH_MS = 2500;
  const SIGN_KEYS = new Set(['season-current-v304', 'pr-celebration-v304', 'four-seasons-v304']);

  const state = {
    scene:null,
    helper:null,
    installed:false,
    controllers:new Map(),
    signRecords:new Map(),
    candidates:[],
    candidateIds:new Set(),
    infoRoot:null,
    infoTexture:null,
    infoVisible:false,
    currentInfo:null,
    correctedSigns:0,
    correctedFaces:0,
    interactiveCandidates:0,
    controllerSelections:0,
    joystickSelections:0,
    triggerSelections:0,
    primarySelections:0,
    gazeFallbackSelections:0,
    failedSelections:0,
    infoOpens:0,
    infoCloses:0,
    lastCandidateRefresh:0,
    lastSignRefresh:0,
    lastControllerPoll:0,
    lastError:null
  };

  function helperReady() {
    state.scene = window.__UCAN_API__?.getScene?.() || state.scene;
    state.helper = window.__UCAN_XR_HELPER__ || state.helper;
    return Boolean(state.scene && state.helper?.baseExperience);
  }

  function xrState() {
    return state.helper?.baseExperience?.state ?? XR_STATE.NOT_IN_XR;
  }

  function inXR() {
    return xrState() === XR_STATE.IN_XR;
  }

  function recordError(stage, error) {
    state.lastError = {
      stage,
      name:String(error?.name || 'Error'),
      message:String(error?.message || error || 'Error desconocido'),
      at:new Date().toISOString()
    };
    console.error(`[UCAN ${VERSION} ${REVISION}] ${stage}:`, error);
    updateAudit();
  }

  function setStatus(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const status = document.getElementById('status');
    if (status && !window.__UCAN_API__?.setStatus) status.textContent = message;
  }

  function metadataChain(mesh) {
    const merged = {};
    let current = mesh;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parent) Object.assign(merged, current.metadata || {});
    return merged;
  }

  function nameChain(mesh) {
    const names = [];
    let current = mesh;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parent) names.push(String(current.name || ''));
    return names.join(' ');
  }

  function meshCenter(mesh) {
    try {
      mesh.computeWorldMatrix?.(true);
      return mesh.getBoundingInfo?.().boundingSphere?.centerWorld?.clone?.() || mesh.getAbsolutePosition?.().clone?.();
    } catch (_) { return null; }
  }

  function absolutePosition(mesh) {
    try {
      mesh.computeWorldMatrix?.(true);
      return mesh.getAbsolutePosition?.().clone?.() || mesh.absolutePosition?.clone?.() || mesh.position?.clone?.();
    } catch (_) { return mesh.position?.clone?.() || new B.Vector3(0, 4, 0); }
  }

  function boardPanelKey(mesh) {
    const metadata = metadataChain(mesh);
    const direct = metadata.originalPanelKeyV304R5 || metadata.originalPanelKeyV304R4 || metadata.livePanelKey;
    if (SIGN_KEYS.has(direct)) return direct;
    const text = nameChain(mesh);
    if (/estación actual/i.test(text)) return 'season-current-v304';
    if (/celebración Puerto Rico|feriados Puerto Rico|Puerto Rico hoy/i.test(text)) return 'pr-celebration-v304';
    if (/cuatro estaciones/i.test(text)) return 'four-seasons-v304';
    return null;
  }

  function isOriginalBoardSource(mesh) {
    if (!mesh || typeof mesh.getBoundingInfo !== 'function') return false;
    const metadata = metadataChain(mesh);
    if (metadata.correctedBoardFaceV304R6 === true) return false;
    const key = boardPanelKey(mesh);
    if (!key) return false;
    return Boolean(
      metadata.globalBoardSourceV304R5 === true ||
      metadata.seasonalBoard === true ||
      metadata.livePanelKey === key ||
      /Cartel (?:estación actual|celebración Puerto Rico|cuatro estaciones) V304/i.test(nameChain(mesh))
    );
  }

  function findSourceTexture(mesh) {
    return mesh?.material?.diffuseTexture || mesh?.material?.emissiveTexture || null;
  }

  function sourceCanvas(texture) {
    try { return texture?.getContext?.()?.canvas || null; } catch (_) { return null; }
  }

  function localDimensions(mesh) {
    try {
      const box = mesh.getBoundingInfo().boundingBox;
      return {
        width:Math.max(1, Math.abs(box.maximum.x - box.minimum.x)),
        height:Math.max(1, Math.abs(box.maximum.y - box.minimum.y))
      };
    } catch (_) { return { width:13.5, height:6.3 }; }
  }

  function createCorrectedTexture(source, key) {
    const sourceTexture = findSourceTexture(source);
    const canvas = sourceCanvas(sourceTexture);
    const width = Math.max(256, Number(canvas?.width || sourceTexture?.getSize?.().width || 1024));
    const height = Math.max(128, Number(canvas?.height || sourceTexture?.getSize?.().height || 512));
    const texture = new B.DynamicTexture(`textura vertical correcta R6 ${key}`, { width, height }, state.scene, false);
    texture.hasAlpha = false;
    texture.updateSamplingMode?.(B.Texture.BILINEAR_SAMPLINGMODE);
    return texture;
  }

  function syncCorrectedTexture(record) {
    const sourceTexture = findSourceTexture(record.source);
    const source = sourceCanvas(sourceTexture);
    if (!source || !record.texture) return false;
    const ctx = record.texture.getContext();
    const size = record.texture.getSize?.() || { width:1024, height:512 };
    ctx.setTransform?.(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.drawImage(source, 0, 0, size.width, size.height);
    // DynamicTexture necesita invertir Y al subir el canvas para que el texto quede vertical en FRONTSIDE.
    record.texture.update(true);
    return true;
  }

  function createSignMaterial(texture, key, suffix) {
    const material = new B.StandardMaterial(`material cartel vertical R6 ${key} ${suffix}`, state.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = true;
    material.disableDepthWrite = true;
    material.alpha = 1;
    return material;
  }

  function openSign(face) {
    const opened = window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.openPanelByMesh?.(face) === true;
    if (!opened && face.metadata?.livePanelKey) openR6Info(infoForMesh(face));
  }

  function createSignFace(record, angle, side, offsetDirection) {
    const normal = new B.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const face = B.MeshBuilder.CreatePlane(`Cartel vertical R6 ${record.key} ${side}`, {
      width:record.width,
      height:record.height,
      sideOrientation:B.Mesh.FRONTSIDE
    }, state.scene);
    face.position.copyFrom(record.position.add(normal.scale(0.042 * offsetDirection)));
    face.rotationQuaternion = null;
    face.rotation.set(0, angle, 0);
    face.billboardMode = B.Mesh.BILLBOARDMODE_NONE;
    face.material = createSignMaterial(record.texture, record.key, side);
    face.isPickable = true;
    face.checkCollisions = false;
    face.alwaysSelectAsActiveMesh = true;
    face.renderingGroupId = 3;
    face.alphaIndex = 380;
    face.metadata = {
      ...(record.originalMetadata || {}),
      livePanel:true,
      livePanelKey:record.key,
      readableSign:true,
      seasonalBoard:true,
      correctedBoardFaceV304R6:true,
      frontSideOnly:true,
      noBacksideMirroring:true,
      dynamicTextureInvertYTrue:true,
      uprightOrientation:true,
      side
    };
    if (B.ActionManager && B.ExecuteCodeAction) {
      face.actionManager = new B.ActionManager(state.scene);
      face.actionManager.registerAction(new B.ExecuteCodeAction(B.ActionManager.OnPickTrigger, () => openSign(face)));
    }
    return face;
  }

  function hideLegacyBoardMeshes(key, source) {
    for (const mesh of [...(state.scene?.meshes || [])]) {
      if (!mesh || mesh === source) continue;
      const metadata = metadataChain(mesh);
      const meshKey = boardPanelKey(mesh);
      if (meshKey !== key) continue;
      if (metadata.correctedBoardFaceV304R6 === true) continue;
      if (!(metadata.globalBoardFaceV304R5 || metadata.holidayBoardPuertoRicoV304R4 || metadata.seasonalBoard || metadata.readableSign)) continue;
      try { mesh.setEnabled?.(false); } catch (_) {}
      mesh.isVisible = false;
      mesh.visibility = 0;
      mesh.isPickable = false;
      mesh.metadata = { ...(mesh.metadata || {}), hiddenByCorrectedBoardV304R6:true };
    }
  }

  function createSignRecord(source, key) {
    if (!source || state.signRecords.has(key)) return null;
    const dimensions = localDimensions(source);
    const position = absolutePosition(source);
    const texture = createCorrectedTexture(source, key);
    const angleToCenter = Math.atan2(-position.x, -position.z);
    const record = {
      key,
      source,
      texture,
      position,
      width:dimensions.width,
      height:dimensions.height,
      originalMetadata:{ ...(source.metadata || {}) },
      faces:[]
    };
    record.faces.push(createSignFace(record, angleToCenter, 'hacia centro', 1));
    record.faces.push(createSignFace(record, angleToCenter + Math.PI, 'hacia exterior', 1));
    syncCorrectedTexture(record);

    try { source.setEnabled?.(false); } catch (_) {}
    source.isVisible = false;
    source.visibility = 0;
    source.isPickable = false;
    source.metadata = {
      ...(source.metadata || {}),
      originalBoardSourceV304R6:true,
      originalPanelKeyV304R6:key
    };
    hideLegacyBoardMeshes(key, source);
    state.signRecords.set(key, record);
    return record;
  }

  function refreshSigns() {
    const sources = [...(state.scene?.meshes || [])].filter(isOriginalBoardSource);
    for (const key of SIGN_KEYS) {
      if (!state.signRecords.has(key)) {
        const source = sources.find(mesh => boardPanelKey(mesh) === key);
        if (source) createSignRecord(source, key);
      }
      const record = state.signRecords.get(key);
      if (!record) continue;
      syncCorrectedTexture(record);
      hideLegacyBoardMeshes(key, record.source);
      for (const face of record.faces) {
        try {
          face.setEnabled?.(true);
          face.isVisible = true;
          face.visibility = 1;
          face.rotation.x = 0;
          face.rotation.z = 0;
          face.billboardMode = B.Mesh.BILLBOARDMODE_NONE;
          face.isPickable = true;
        } catch (_) {}
      }
    }
    state.correctedSigns = state.signRecords.size;
    state.correctedFaces = [...state.signRecords.values()].reduce((sum, record) => sum + record.faces.length, 0);
  }

  function rooftopCandidateInfo(mesh) {
    if (!mesh || typeof mesh.getBoundingInfo !== 'function') return null;
    if (mesh.isVisible === false || Number(mesh.visibility ?? 1) <= 0 || mesh.isEnabled?.() === false) return null;
    const metadata = metadataChain(mesh);
    const text = nameChain(mesh);
    const position = meshCenter(mesh);
    const celestial = Boolean(metadata.celestialId || metadata.celestialData || metadata.celestialObject || metadata.astronomyLabel) ||
      /objeto cielo|etiqueta cielo|planeta|estrella|luna|saturno|júpiter|jupiter|marte|venus|mercurio|urano|neptuno|eei|iss/i.test(text);
    const panel = Boolean(metadata.livePanel || metadata.livePanelKey) ||
      /panel clima|agenda astronómica|fase lunar|mapa celeste|calendario astronómico|reloj san germán|cartel|letrero|rótulo|rotulo/i.test(text);
    const rooftop = metadata.rooftop === true || celestial || panel || Number(position?.y || 0) >= 26.0;
    if (!rooftop || (!celestial && !panel)) return null;
    return { type:celestial ? 'celestial' : 'panel', metadata, text, position };
  }

  function skyEntryFor(mesh) {
    const metadata = metadataChain(mesh);
    if (metadata.celestialData) return metadata.celestialData;
    const id = metadata.celestialId;
    const objects = window.__UCAN_INTERACTIVE_SKY__?.getObjects?.() || [];
    return objects.find(entry => entry.id === id) || null;
  }

  function decorateCandidate(mesh, info) {
    const metadata = { ...(mesh.metadata || {}) };
    metadata.rooftop = true;
    metadata.readableSign = true;
    metadata.terraceInteractiveV304R6 = true;
    metadata.terraceInteractiveTypeV304R6 = info.type;
    if (info.type === 'celestial') {
      const entry = skyEntryFor(mesh);
      metadata.celestialObject = true;
      if (entry) {
        metadata.celestialData = entry;
        metadata.celestialId = entry.id;
      }
    } else {
      metadata.livePanel = true;
      metadata.livePanelKey = metadata.livePanelKey || metadata.title || String(mesh.name || '').replace(/\s+(?:frente|reverso)$/i, '');
    }
    mesh.metadata = metadata;
    mesh.isPickable = true;
    mesh.alwaysSelectAsActiveMesh = true;
    return mesh;
  }

  function refreshCandidates() {
    const candidates = [];
    const ids = new Set();
    for (const mesh of [...(state.scene?.meshes || [])]) {
      const info = rooftopCandidateInfo(mesh);
      if (!info) continue;
      decorateCandidate(mesh, info);
      candidates.push(mesh);
      ids.add(mesh.uniqueId);
    }
    state.candidates = candidates;
    state.candidateIds = ids;
    state.interactiveCandidates = candidates.length;
  }

  function createInfoPanel() {
    if (state.infoRoot) return;
    const root = new B.TransformNode('Panel información terraza R6', state.scene);
    const texture = new B.DynamicTexture('textura información terraza R6', { width:1024, height:640 }, state.scene, false);
    texture.updateSamplingMode?.(B.Texture.BILINEAR_SAMPLINGMODE);
    const material = new B.StandardMaterial('material información terraza R6', state.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = true;
    material.disableDepthWrite = true;
    for (const [side, z, rotation] of [['frente', -0.015, 0], ['reverso', 0.015, Math.PI]]) {
      const plane = B.MeshBuilder.CreatePlane(`panel información terraza R6 ${side}`, {
        width:3.45,
        height:2.16,
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

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    let line = '';
    let row = 0;
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        ctx.fillText(line, x, y + row * lineHeight);
        row += 1;
        line = word;
        if (row >= maxLines) break;
      } else line = next;
    }
    if (line && row < maxLines) ctx.fillText(line, x, y + row * lineHeight);
  }

  function infoForMesh(mesh) {
    const metadata = metadataChain(mesh);
    if (metadata.celestialId || metadata.celestialData || metadata.celestialObject) {
      const entry = metadata.celestialData || skyEntryFor(mesh) || {};
      const facts = [];
      if (entry.constellation) facts.push(`Constelación: ${entry.constellation}`);
      if (Number.isFinite(Number(entry.actualAltitude ?? entry.altitude))) facts.push(`Altitud: ${Number(entry.actualAltitude ?? entry.altitude).toFixed(1)}°`);
      if (Number.isFinite(Number(entry.azimuth))) facts.push(`Azimut: ${Number(entry.azimuth).toFixed(1)}°`);
      if (entry.phase) facts.push(String(entry.phase));
      return {
        type:'celestial',
        title:entry.name || metadata.celestialData?.name || String(mesh.name || 'Objeto celeste'),
        category:entry.category || entry.kind || 'Astronomía',
        summary:entry.summary || 'Información astronómica disponible en la terraza.',
        facts,
        color:entry.color || '#fed141',
        id:entry.id || metadata.celestialId
      };
    }
    const panelKey = metadata.livePanelKey || metadata.originalPanelKeyV304R6 || String(mesh.name || 'Panel informativo');
    let texture = mesh.material?.diffuseTexture || mesh.material?.emissiveTexture || null;
    let canvas = sourceCanvas(texture);
    if (!canvas) {
      const displays = state.scene?.metadata?.astronomyDisplays || {};
      const record = Object.values(displays).find(value => value?.name === panelKey || value?.key === panelKey);
      canvas = sourceCanvas(record?.texture);
    }
    return { type:'panel', title:metadata.title || panelKey, category:'Información de la terraza', canvas, sourceMesh:mesh };
  }

  function drawInfo(info) {
    createInfoPanel();
    const ctx = state.infoTexture.getContext();
    ctx.clearRect(0, 0, 1024, 640);
    ctx.fillStyle = '#071426';
    ctx.fillRect(0, 0, 1024, 640);
    ctx.fillStyle = info.color || '#fed141';
    ctx.fillRect(0, 0, 1024, 18);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Segoe UI, Arial';
    ctx.textBaseline = 'top';
    ctx.fillText(String(info.title || 'Información').slice(0, 42), 40, 34);
    if (info.type === 'panel' && info.canvas) {
      const x = 44, y = 105, w = 936, h = 475;
      const ratio = Math.min(w / info.canvas.width, h / info.canvas.height);
      const drawW = info.canvas.width * ratio;
      const drawH = info.canvas.height * ratio;
      ctx.fillStyle = '#f7f5ec';
      ctx.fillRect(x, y, w, h);
      ctx.drawImage(info.canvas, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
    } else {
      ctx.fillStyle = '#9edbe6';
      ctx.font = 'bold 27px Segoe UI, Arial';
      ctx.fillText(info.category || 'Información', 42, 108);
      ctx.fillStyle = '#ffffff';
      ctx.font = '27px Segoe UI, Arial';
      let y = 160;
      for (const fact of (info.facts || []).slice(0, 5)) {
        ctx.fillText(`• ${fact}`, 48, y);
        y += 42;
      }
      ctx.fillStyle = '#e5fbff';
      ctx.font = '26px Segoe UI, Arial';
      wrapText(ctx, info.summary || 'Información disponible.', 48, Math.max(y + 18, 370), 920, 38, 5);
    }
    ctx.fillStyle = 'rgba(255,255,255,.78)';
    ctx.font = '22px Segoe UI, Arial';
    ctx.fillText('Presione B o Y para cerrar. Gatillo, A/X o joystick para seleccionar.', 42, 603);
    state.infoTexture.update(true);
  }

  function placeInfoPanel() {
    if (!state.infoVisible || !state.infoRoot) return;
    const camera = state.scene?.activeCamera || state.helper?.baseExperience?.camera || window.__UCAN_API__?.getCamera?.();
    if (!camera) return;
    const origin = camera.globalPosition?.clone?.() || camera.position?.clone?.();
    if (!origin) return;
    let forward;
    try { forward = camera.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward || forward.lengthSquared() < 0.001) forward = new B.Vector3(0, 0, 1);
    forward.normalize();
    const target = origin.add(forward.scale(2.55));
    target.y = origin.y - 0.08;
    state.infoRoot.position.copyFrom(target);
    const toCamera = origin.subtract(target);
    state.infoRoot.rotationQuaternion = null;
    state.infoRoot.rotation.set(0, Math.atan2(toCamera.x, toCamera.z), 0);
  }

  function openR6Info(info) {
    if (!info) return false;
    try { window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.close?.(); } catch (_) {}
    drawInfo(info);
    state.currentInfo = info;
    state.infoVisible = true;
    state.infoRoot.setEnabled(true);
    placeInfoPanel();
    state.infoOpens += 1;
    setStatus(`Información abierta: ${info.title || 'Terraza'}. Presione B o Y para cerrar.`);
    updateAudit();
    return true;
  }

  function closeR6Info() {
    if (!state.infoVisible) return;
    state.infoVisible = false;
    state.currentInfo = null;
    state.infoRoot?.setEnabled(false);
    state.infoCloses += 1;
    updateAudit();
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
      if (ray) { ray.length = RAY_LENGTH; ray.direction.normalize(); return ray; }
    } catch (_) {}
    return null;
  }

  function angularPick(ray) {
    if (!ray) return null;
    let best = null;
    for (const mesh of state.candidates) {
      const center = meshCenter(mesh);
      if (!center) continue;
      const vector = center.subtract(ray.origin);
      const distance = vector.length();
      if (!Number.isFinite(distance) || distance < 0.4 || distance > RAY_LENGTH) continue;
      vector.scaleInPlace(1 / distance);
      const angle = Math.acos(Math.max(-1, Math.min(1, B.Vector3.Dot(ray.direction, vector))));
      const type = mesh.metadata?.terraceInteractiveTypeV304R6;
      const limit = type === 'celestial' ? 21 * Math.PI / 180 : 13 * Math.PI / 180;
      if (angle > limit) continue;
      const score = angle + distance * 0.000004;
      if (!best || score < best.score) best = { mesh, score };
    }
    return best?.mesh || null;
  }

  function pickFromRay(ray) {
    if (!ray) return null;
    try {
      const pick = state.scene.pickWithRay(ray, mesh => state.candidateIds.has(mesh.uniqueId), false);
      if (pick?.hit && pick.pickedMesh) return pick.pickedMesh;
    } catch (_) {}
    return angularPick(ray);
  }

  function selectFromController(controller, activationSource) {
    refreshCandidatesIfNeeded(true);
    let target = pickFromRay(controllerRay(controller));
    if (!target) {
      target = pickFromRay(headGazeRay());
      if (target) state.gazeFallbackSelections += 1;
    }
    if (!target) {
      state.failedSelections += 1;
      setStatus('Apunte el control o la mirada al cartel o planeta y presione el gatillo, A/X o el joystick.');
      updateAudit();
      return false;
    }
    const info = infoForMesh(target);
    if (!openR6Info(info)) return false;
    state.controllerSelections += 1;
    if (activationSource === 'joystick') state.joystickSelections += 1;
    else if (activationSource === 'trigger') state.triggerSelections += 1;
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
    state.controllers.set(key, {
      controller,
      trigger:false,
      joystick:false,
      primary:false,
      secondary:false
    });
  }

  function installControllers() {
    const input = state.helper?.input;
    if (!input) return;
    for (const controller of input.controllers || []) registerController(controller);
    input.onControllerAddedObservable?.add?.(registerController);
    input.onControllerRemovedObservable?.add?.(controller => state.controllers.delete(controller.uniqueId || controller));
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

      if (secondary && !record.secondary) closeR6Info();
      if (trigger && !record.trigger) selectFromController(controller, 'trigger');
      if (primary && !record.primary) selectFromController(controller, 'primary');
      if (joystick && !record.joystick) selectFromController(controller, 'joystick');

      record.trigger = trigger;
      record.joystick = joystick;
      record.primary = primary;
      record.secondary = secondary;
    }
  }

  function refreshCandidatesIfNeeded(force = false) {
    const now = performance.now();
    if (!force && now - state.lastCandidateRefresh < CANDIDATE_REFRESH_MS) return;
    state.lastCandidateRefresh = now;
    refreshCandidates();
  }

  function fixExistingInfoTextures() {
    for (const texture of state.scene?.textures || []) {
      const name = String(texture?.name || '');
      if (!/contenido ventana universal V292|panel cielo optimizado V287/i.test(name)) continue;
      try { texture.update?.(true); } catch (_) {}
    }
  }

  function frame() {
    const now = performance.now();
    if (now - state.lastControllerPoll >= CONTROLLER_POLL_MS) {
      state.lastControllerPoll = now;
      try { pollControllers(); } catch (error) { recordError('controllers-r6', error); }
    }
    if (now - state.lastCandidateRefresh >= CANDIDATE_REFRESH_MS) {
      try { refreshCandidatesIfNeeded(); } catch (error) { recordError('candidates-r6', error); }
    }
    if (now - state.lastSignRefresh >= SIGN_REFRESH_MS) {
      state.lastSignRefresh = now;
      try { refreshSigns(); fixExistingInfoTextures(); } catch (error) { recordError('signs-r6', error); }
    }
    if (state.infoVisible) placeInfoPanel();
    updateAudit();
  }

  function updateAudit() {
    window.__UCAN_VISUAL_INTERACTION_V304_R6__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      signsUseCopiedCanvas:true,
      signsDynamicTextureInvertY:true,
      signsTwoFrontFaces:true,
      signsBacksideDisabled:true,
      signsBillboardDisabled:true,
      signsUprightAllEnvironments:true,
      terraceTriggerSelection:true,
      terracePrimarySelection:true,
      terraceJoystickSelection:true,
      terraceControllerRaySelection:true,
      terraceHeadGazeFallback:true,
      terraceOwnXRInfoPanel:true,
      terraceInfoTextureInvertY:true,
      correctedSigns:state.correctedSigns,
      correctedFaces:state.correctedFaces,
      interactiveCandidates:state.interactiveCandidates,
      controllers:state.controllers.size,
      controllerSelections:state.controllerSelections,
      joystickSelections:state.joystickSelections,
      triggerSelections:state.triggerSelections,
      primarySelections:state.primarySelections,
      gazeFallbackSelections:state.gazeFallbackSelections,
      failedSelections:state.failedSelections,
      infoVisible:state.infoVisible,
      currentInfo:state.currentInfo?.title || null,
      infoOpens:state.infoOpens,
      infoCloses:state.infoCloses,
      lastError:state.lastError,
      refresh:() => { refreshSigns(); refreshCandidates(); fixExistingInfoTextures(); },
      close:closeR6Info,
      getState:() => ({
        installed:state.installed,
        inXR:inXR(),
        correctedSigns:state.correctedSigns,
        correctedFaces:state.correctedFaces,
        interactiveCandidates:state.interactiveCandidates,
        controllers:state.controllers.size,
        controllerSelections:state.controllerSelections,
        joystickSelections:state.joystickSelections,
        triggerSelections:state.triggerSelections,
        gazeFallbackSelections:state.gazeFallbackSelections,
        infoVisible:state.infoVisible,
        currentInfo:state.currentInfo?.title || null,
        lastError:state.lastError
      })
    };
  }

  function install() {
    if (state.installed || !helperReady()) return false;
    const ecosystemReady = window.__UCAN_SEASONAL_ECOSYSTEM_V304__?.installed === true ||
      (state.scene.meshes || []).some(mesh => boardPanelKey(mesh));
    const universalReady = window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.openPanelByMesh;
    if (!ecosystemReady || !universalReady) return false;
    state.installed = true;
    createInfoPanel();
    installControllers();
    refreshSigns();
    refreshCandidates();
    fixExistingInfoTextures();
    state.scene.onBeforeRenderObservable.add(() => {
      try { frame(); } catch (error) { recordError('frame-r6', error); }
    });
    state.helper.baseExperience?.onStateChangedObservable?.add?.(current => {
      if (current === XR_STATE.IN_XR) {
        window.setTimeout(() => { refreshCandidates(); refreshSigns(); fixExistingInfoTextures(); }, 850);
      } else if (current === XR_STATE.NOT_IN_XR) {
        closeR6Info();
        window.setTimeout(() => { refreshSigns(); fixExistingInfoTextures(); }, 250);
      }
    });
    setStatus('UCAN V304 R6: carteles verticales y selección de terraza preparados.');
    console.info(`[UCAN ${VERSION} ${REVISION}] Carteles verticales e interacción de terraza instalados.`);
    updateAudit();
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (install() || attempts >= 420) window.clearInterval(timer);
  }, 100);

  updateAudit();
})();