(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V305';
  const REVISION = 'R9';
  const BUILD = 'V305-20260728-FLOOR1-ADS-TERRACE-XR-R9';
  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const FLOOR1_MIN_Y = 0.15;
  const FLOOR1_MAX_Y = 7.9;
  const ROOFTOP_MIN_Y = 25.5;
  const RAY_LENGTH = 620;
  const SCAN_MS = 850;
  const POLL_MS = 55;
  const PRESS_COOLDOWN_MS = 240;

  const state = {
    scene:null,
    helper:null,
    installed:false,
    floor1Records:new Map(),
    floor1Faces:[],
    terraceCandidates:[],
    candidateIds:new Set(),
    controllers:new Map(),
    infoRoot:null,
    infoTexture:null,
    infoVisible:false,
    currentTitle:null,
    lastScan:0,
    lastPoll:0,
    floor1Sources:0,
    correctedFloor1Faces:0,
    terraceObjects:0,
    componentBindings:0,
    joystickBindings:0,
    joystickSelections:0,
    triggerSelections:0,
    primarySelections:0,
    gazeSelections:0,
    pointerSelections:0,
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
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parent) names.push(String(current.name || ''));
    return names.join(' ');
  }

  function worldCenter(mesh) {
    try {
      mesh.computeWorldMatrix?.(true);
      return mesh.getBoundingInfo?.().boundingSphere?.centerWorld?.clone?.() || mesh.getAbsolutePosition?.().clone?.() || mesh.position?.clone?.();
    } catch (_) {
      return mesh?.position?.clone?.() || B.Vector3.Zero();
    }
  }

  function worldYaw(mesh) {
    try {
      mesh.computeWorldMatrix?.(true);
      const normal = B.Vector3.TransformNormal(new B.Vector3(0, 0, 1), mesh.getWorldMatrix());
      normal.y = 0;
      if (normal.lengthSquared() > 0.0001) {
        normal.normalize();
        return Math.atan2(normal.x, normal.z);
      }
    } catch (_) {}
    return Number(mesh?.absoluteRotationQuaternion?.toEulerAngles?.().y ?? mesh?.rotation?.y ?? 0);
  }

  function worldDimensions(mesh) {
    try {
      mesh.computeWorldMatrix?.(true);
      const extend = mesh.getBoundingInfo().boundingBox.extendSizeWorld;
      return {
        width:Math.max(0.8, Math.min(32, Math.max(Math.abs(extend.x), Math.abs(extend.z)) * 2)),
        height:Math.max(0.5, Math.min(16, Math.abs(extend.y) * 2))
      };
    } catch (_) {
      return { width:8, height:4.5 };
    }
  }

  function textureOf(mesh) {
    return mesh?.material?.diffuseTexture || mesh?.material?.emissiveTexture || null;
  }

  function canvasOfTexture(texture) {
    try { return texture?.getContext?.()?.canvas || null; } catch (_) { return null; }
  }

  function canvasOfMesh(mesh) {
    return canvasOfTexture(textureOf(mesh));
  }

  function normalizedKey(mesh) {
    const metadata = metadataChain(mesh);
    const raw = String(metadata.livePanelKey || metadata.title || metadata.floor1AnnouncementTitle || mesh?.name || mesh?.uniqueId || 'anuncio');
    return raw.toLowerCase()
      .replace(/\b(frente|reverso|posterior|interior|exterior|cara)\b/g, '')
      .replace(/[^a-z0-9áéíóúñ]+/gi, '-')
      .replace(/^-+|-+$/g, '') || `anuncio-${mesh?.uniqueId || Date.now()}`;
  }

  function floor1SourceScore(mesh) {
    if (!mesh || mesh.isDisposed?.()) return -1;
    const metadata = metadataChain(mesh);
    if (metadata.correctedFloor1AnnouncementV305R9 || metadata.correctedFloor1AnnouncementV305R8) return -1;
    if (metadata.correctedBoardFaceV305R7 || metadata.seasonalBoard || metadata.celestialObject) return -1;
    const center = worldCenter(mesh);
    if (!center || center.y < FLOOR1_MIN_Y || center.y > FLOOR1_MAX_Y) return -1;
    const texture = textureOf(mesh);
    if (!texture) return -1;
    const names = nameChain(mesh);
    if (/panel información|panel flotante|cielo optimizado|textura información|rooftop|terraza/i.test(names)) return -1;
    const signLike = Boolean(
      metadata.livePanel || metadata.livePanelKey || metadata.readableSign || metadata.cafeteriaMenu || metadata.branding ||
      metadata.directory || metadata.kiosk || metadata.advertisement || metadata.announcement
    ) || /anuncio|publicidad|promoci[oó]n|evento|comunicado|noticia|directorio|cartel|letrero|r[oó]tulo|banner|auspiciador|patrocinador|pantalla|display|men[uú]|cafeter[ií]a|biblioteca|kiosco|kiosk|bienvenid|ucan|inter/i.test(names);
    if (!signLike) return -1;
    let score = 1;
    if (metadata.livePanelKey) score += 80;
    if (metadata.readableSign) score += 40;
    if (metadata.cafeteriaMenu) score += 35;
    if (canvasOfTexture(texture)) score += 30;
    if (mesh.isVisible !== false && mesh.isEnabled?.() !== false) score += 10;
    return score;
  }

  function createCorrectedTexture(source, key) {
    const sourceTexture = textureOf(source);
    const canvas = canvasOfTexture(sourceTexture);
    if (canvas) {
      const size = sourceTexture?.getSize?.() || {};
      const texture = new B.DynamicTexture(`textura anuncio piso 1 R9 ${key}`, {
        width:Math.max(256, Number(canvas.width || size.width || 1024)),
        height:Math.max(128, Number(canvas.height || size.height || 512))
      }, state.scene, false);
      texture.hasAlpha = Boolean(sourceTexture?.hasAlpha);
      texture.wrapU = B.Texture.CLAMP_ADDRESSMODE;
      texture.wrapV = B.Texture.CLAMP_ADDRESSMODE;
      texture.uScale = 1;
      texture.vScale = 1;
      texture.uOffset = 0;
      texture.vOffset = 0;
      texture.updateSamplingMode?.(B.Texture.BILINEAR_SAMPLINGMODE);
      return { texture, dynamic:true };
    }
    let texture = null;
    try { texture = sourceTexture?.clone?.(); } catch (_) {}
    texture = texture || sourceTexture;
    if (texture) {
      texture.wrapU = B.Texture.CLAMP_ADDRESSMODE;
      texture.wrapV = B.Texture.CLAMP_ADDRESSMODE;
      texture.uScale = Math.abs(Number(texture.uScale || 1));
      texture.vScale = Math.abs(Number(texture.vScale || 1));
      texture.uOffset = 0;
      texture.vOffset = 0;
    }
    return { texture, dynamic:false };
  }

  function syncRecordTexture(record) {
    if (!record.dynamic) return true;
    const canvas = canvasOfMesh(record.source);
    if (!canvas || !record.texture) return false;
    const ctx = record.texture.getContext();
    const size = record.texture.getSize?.() || { width:1024, height:512 };
    ctx.setTransform?.(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.drawImage(canvas, 0, 0, size.width, size.height);
    record.texture.update(false);
    return true;
  }

  function createFace(record, side, angleOffset) {
    const face = B.MeshBuilder.CreatePlane(`Anuncio piso 1 vertical R9 ${record.key} ${side}`, {
      width:record.width,
      height:record.height,
      sideOrientation:B.Mesh.FRONTSIDE
    }, state.scene);
    const material = new B.StandardMaterial(`material anuncio piso 1 R9 ${record.key} ${side}`, state.scene);
    material.diffuseTexture = record.texture;
    material.emissiveTexture = record.texture;
    material.opacityTexture = record.texture?.hasAlpha ? record.texture : null;
    material.disableLighting = true;
    material.backFaceCulling = true;
    material.specularColor = B.Color3.Black();
    face.material = material;
    face.rotationQuaternion = null;
    face.billboardMode = B.Mesh.BILLBOARDMODE_NONE;
    face.scaling.set(1, 1, 1);
    face.isPickable = true;
    face.alwaysSelectAsActiveMesh = true;
    face.checkCollisions = false;
    face.renderingGroupId = 4;
    face.metadata = {
      ...(record.metadata || {}),
      correctedFloor1AnnouncementV305R9:true,
      floor1KeyV305R9:record.key,
      livePanel:true,
      livePanelKey:record.panelKey,
      readableSign:true,
      dynamicTextureInvertYFalse:true,
      twoIndependentFrontFaces:true,
      billboardDisabled:true,
      angleOffset,
      side
    };
    return face;
  }

  function alignRecord(record) {
    const center = worldCenter(record.source);
    const baseYaw = worldYaw(record.source);
    if (!center) return;
    record.center = center;
    for (const face of record.faces) {
      const angle = baseYaw + Number(face.metadata?.angleOffset || 0);
      const normal = new B.Vector3(Math.sin(angle), 0, Math.cos(angle));
      face.position.copyFrom(center.add(normal.scale(0.035)));
      face.rotationQuaternion = null;
      face.rotation.set(0, angle, 0);
      face.scaling.set(1, 1, 1);
      face.billboardMode = B.Mesh.BILLBOARDMODE_NONE;
      face.setEnabled?.(true);
      face.isVisible = true;
      face.visibility = 1;
      face.isPickable = true;
    }
  }

  function hideLegacyFloor1(record) {
    for (const mesh of [...(state.scene?.meshes || [])]) {
      if (!mesh || mesh === record.source || record.faces.includes(mesh) || mesh.isDisposed?.()) continue;
      if (mesh.metadata?.correctedFloor1AnnouncementV305R9) continue;
      if (floor1SourceScore(mesh) < 0 || normalizedKey(mesh) !== record.key) continue;
      try {
        mesh.isPickable = false;
        mesh.isVisible = false;
        mesh.visibility = 0;
        mesh.setEnabled?.(false);
        mesh.metadata = { ...(mesh.metadata || {}), hiddenByFloor1R9:true };
      } catch (_) {}
    }
    try {
      record.source.isPickable = false;
      record.source.isVisible = false;
      record.source.visibility = 0;
      record.source.setEnabled?.(false);
      record.source.metadata = { ...(record.source.metadata || {}), hiddenByFloor1R9:true };
    } catch (_) {}
  }

  function createFloor1Record(source, key) {
    const dimensions = worldDimensions(source);
    const metadata = metadataChain(source);
    const corrected = createCorrectedTexture(source, key);
    if (!corrected.texture) return null;
    const record = {
      key,
      source,
      width:dimensions.width,
      height:dimensions.height,
      texture:corrected.texture,
      dynamic:corrected.dynamic,
      metadata:{ ...metadata },
      panelKey:String(metadata.livePanelKey || metadata.title || source.name || key),
      faces:[]
    };
    record.faces.push(createFace(record, 'frente', 0));
    record.faces.push(createFace(record, 'reverso', Math.PI));
    state.floor1Records.set(key, record);
    syncRecordTexture(record);
    alignRecord(record);
    hideLegacyFloor1(record);
    return record;
  }

  function scanFloor1() {
    const best = new Map();
    for (const mesh of [...(state.scene?.meshes || [])]) {
      const score = floor1SourceScore(mesh);
      if (score < 0) continue;
      const key = normalizedKey(mesh);
      const existing = best.get(key);
      if (!existing || score > existing.score) best.set(key, { mesh, score });
    }
    for (const [key, candidate] of best) {
      const record = state.floor1Records.get(key) || createFloor1Record(candidate.mesh, key);
      if (!record) continue;
      syncRecordTexture(record);
      alignRecord(record);
      hideLegacyFloor1(record);
    }
    state.floor1Faces = [...state.floor1Records.values()].flatMap(record => record.faces).filter(face => !face.isDisposed?.());
    state.floor1Sources = state.floor1Records.size;
    state.correctedFloor1Faces = state.floor1Faces.length;
  }

  function terraceCandidateInfo(mesh) {
    if (!mesh || mesh.isDisposed?.() || mesh.isVisible === false || mesh.isEnabled?.() === false) return null;
    const metadata = metadataChain(mesh);
    const names = nameChain(mesh);
    if (metadata.r9InfoPanel || /Panel información unificado R9|cara información R9/i.test(names)) return null;
    const center = worldCenter(mesh);
    const celestial = Boolean(metadata.celestialId || metadata.celestialData || metadata.celestialObject || metadata.astronomyLabel) ||
      /objeto cielo|etiqueta cielo|planeta|estrella|luna|saturno|j[uú]piter|marte|venus|mercurio|urano|neptuno|eei|iss/i.test(names);
    const panel = Boolean(metadata.correctedBoardFaceV305R7 || metadata.r7PanelKey || metadata.livePanel || metadata.livePanelKey || metadata.readableSign) ||
      /panel clima|estado del tiempo|agenda astron[oó]mica|fase lunar|mapa celeste|calendario astron[oó]mico|reloj san germ[aá]n|cartel|letrero|r[oó]tulo|señal/i.test(names);
    if (!celestial && !panel) return null;
    if (!celestial && Number(center?.y || 0) < ROOFTOP_MIN_Y) return null;
    return { type:celestial ? 'celestial' : 'panel', metadata, center };
  }

  function scanTerrace() {
    const candidates = [];
    const ids = new Set();
    for (const mesh of [...(state.scene?.meshes || [])]) {
      const info = terraceCandidateInfo(mesh);
      if (!info) continue;
      mesh.isPickable = true;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.metadata = {
        ...(mesh.metadata || {}),
        terraceInteractiveV305R9:true,
        terraceInteractiveTypeV305R9:info.type
      };
      candidates.push(mesh);
      ids.add(mesh.uniqueId);
    }
    state.terraceCandidates = candidates;
    state.candidateIds = ids;
    state.terraceObjects = candidates.length;
  }

  function createInfoPanel() {
    if (state.infoRoot) return;
    const root = new B.TransformNode('Panel información unificado R9', state.scene);
    const texture = new B.DynamicTexture('textura información unificada R9', { width:1200, height:720 }, state.scene, false);
    texture.wrapU = B.Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = B.Texture.CLAMP_ADDRESSMODE;
    texture.updateSamplingMode?.(B.Texture.BILINEAR_SAMPLINGMODE);
    const material = new B.StandardMaterial('material información unificada R9', state.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = true;
    material.disableDepthWrite = true;
    for (const [side, z, rotation] of [['frente', -0.012, 0], ['reverso', 0.012, Math.PI]]) {
      const plane = B.MeshBuilder.CreatePlane(`cara información R9 ${side}`, { width:4.15, height:2.48, sideOrientation:B.Mesh.FRONTSIDE }, state.scene);
      plane.parent = root;
      plane.position.z = z;
      plane.rotation.y = rotation;
      plane.material = material;
      plane.isPickable = false;
      plane.renderingGroupId = 8;
      plane.metadata = { r9InfoPanel:true };
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
    const celestialId = metadata.celestialId || metadata.celestialData?.id;
    if (celestialId || metadata.celestialObject) {
      const entry = metadata.celestialData || (window.__UCAN_INTERACTIVE_SKY__?.getObjects?.() || []).find(item => item.id === celestialId) || {};
      return {
        type:'celestial',
        id:entry.id || celestialId,
        title:entry.name || String(mesh.name || 'Objeto celeste'),
        category:entry.category || entry.kind || 'Astronomía',
        summary:entry.summary || 'Información astronómica disponible en la terraza.',
        facts:[
          entry.constellation ? `Constelación: ${entry.constellation}` : null,
          Number.isFinite(Number(entry.actualAltitude ?? entry.altitude)) ? `Altitud: ${Number(entry.actualAltitude ?? entry.altitude).toFixed(1)}°` : null,
          Number.isFinite(Number(entry.azimuth)) ? `Azimut: ${Number(entry.azimuth).toFixed(1)}°` : null,
          entry.phase || null
        ].filter(Boolean),
        color:entry.color || '#fed141'
      };
    }
    const floor1Key = metadata.floor1KeyV305R9;
    const floor1Record = floor1Key ? state.floor1Records.get(floor1Key) : null;
    return {
      type:'panel',
      title:String(metadata.title || metadata.livePanelKey || metadata.r7PanelKey || floor1Record?.panelKey || mesh.name || 'Información'),
      canvas:floor1Record ? canvasOfMesh(floor1Record.source) : canvasOfMesh(mesh),
      panelKey:metadata.r7PanelKey || metadata.livePanelKey || floor1Record?.panelKey || null
    };
  }

  function drawInfo(info) {
    createInfoPanel();
    const ctx = state.infoTexture.getContext();
    ctx.setTransform?.(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 1200, 720);
    ctx.fillStyle = '#071426';
    ctx.fillRect(0, 0, 1200, 720);
    ctx.fillStyle = info.color || '#fed141';
    ctx.fillRect(0, 0, 1200, 18);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 52px Segoe UI, Arial';
    ctx.fillText(String(info.title || 'Información').slice(0, 48), 44, 34);
    if (info.type === 'celestial') {
      ctx.fillStyle = '#9edbe6';
      ctx.font = 'bold 28px Segoe UI, Arial';
      ctx.fillText(info.category || 'Astronomía', 46, 104);
      ctx.fillStyle = '#ffffff';
      ctx.font = '28px Segoe UI, Arial';
      let y = 164;
      for (const fact of (info.facts || []).slice(0, 5)) {
        ctx.fillText(`• ${fact}`, 50, y);
        y += 44;
      }
      ctx.fillStyle = '#e5fbff';
      ctx.font = '27px Segoe UI, Arial';
      wrapText(ctx, info.summary, 50, Math.max(y + 24, 410), 1090, 40, 5);
    } else {
      const x = 44, y = 116, w = 1112, h = 500;
      ctx.fillStyle = '#f7f5ec';
      ctx.fillRect(x, y, w, h);
      if (info.canvas) {
        const ratio = Math.min((w - 24) / info.canvas.width, (h - 24) / info.canvas.height);
        const drawW = info.canvas.width * ratio;
        const drawH = info.canvas.height * ratio;
        ctx.drawImage(info.canvas, x + (w - drawW) / 2, y + (h - drawH) / 2, drawW, drawH);
      } else {
        ctx.fillStyle = '#17342e';
        ctx.font = '30px Segoe UI, Arial';
        wrapText(ctx, 'El contenido está disponible en este punto informativo.', x + 42, y + 80, w - 84, 42, 5);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.font = '24px Segoe UI, Arial';
    ctx.fillText('B/Y: cerrar · Joystick, gatillo o A/X: seleccionar', 44, 670);
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
    const target = origin.add(forward.scale(2.75));
    target.y = origin.y - 0.05;
    state.infoRoot.position.copyFrom(target);
    const toCamera = origin.subtract(target);
    state.infoRoot.rotationQuaternion = null;
    state.infoRoot.rotation.set(0, Math.atan2(toCamera.x, toCamera.z), 0);
  }

  function openInfoForMesh(mesh, source) {
    if (!mesh) return false;
    const info = infoForMesh(mesh);
    if (!info) return false;
    try { window.__UCAN_VR_SIGNS_V305_R7__?.close?.(); } catch (_) {}
    try { window.__UCAN_VISUAL_INTERACTION_V304_R6__?.close?.(); } catch (_) {}
    if (info.type === 'celestial' && info.id) {
      try { window.__UCAN_INTERACTIVE_SKY__?.select?.(info.id); } catch (_) {}
    }
    drawInfo(info);
    state.infoVisible = true;
    state.currentTitle = info.title;
    state.infoRoot.setEnabled(true);
    placeInfoPanel();
    state.infoOpens += 1;
    if (source === 'pointer') state.pointerSelections += 1;
    window.__UCAN_API__?.setStatus?.(`Información abierta: ${info.title}. Presione B o Y para cerrar.`);
    updateAudit();
    return true;
  }

  function closeInfo() {
    if (!state.infoVisible) return;
    state.infoVisible = false;
    state.currentTitle = null;
    state.infoRoot?.setEnabled(false);
    state.infoCloses += 1;
    try { window.__UCAN_VR_SIGNS_V305_R7__?.close?.(); } catch (_) {}
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

  function gazeRay() {
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

  function allSelectableMeshes() {
    return [...state.floor1Faces, ...state.terraceCandidates].filter(mesh => mesh && !mesh.isDisposed?.() && mesh.isVisible !== false && mesh.isEnabled?.() !== false);
  }

  function pickWithRay(ray) {
    if (!ray) return null;
    const all = allSelectableMeshes();
    const ids = new Set(all.map(mesh => mesh.uniqueId));
    try {
      const pick = state.scene.pickWithRay(ray, mesh => ids.has(mesh.uniqueId), false);
      if (pick?.hit && pick.pickedMesh) return pick.pickedMesh;
    } catch (_) {}
    let best = null;
    for (const mesh of all) {
      const center = worldCenter(mesh);
      if (!center) continue;
      const vector = center.subtract(ray.origin);
      const distance = vector.length();
      if (!Number.isFinite(distance) || distance < 0.35 || distance > RAY_LENGTH) continue;
      vector.scaleInPlace(1 / distance);
      const angle = Math.acos(Math.max(-1, Math.min(1, B.Vector3.Dot(ray.direction, vector))));
      const metadata = metadataChain(mesh);
      const limit = metadata.terraceInteractiveTypeV305R9 === 'celestial' ? 16 * Math.PI / 180 : 11 * Math.PI / 180;
      if (angle > limit) continue;
      const score = angle + distance * 0.000002;
      if (!best || score < best.score) best = { mesh, score };
    }
    return best?.mesh || null;
  }

  function selectFromController(controller, activationSource) {
    scanFloor1();
    scanTerrace();
    let target = pickWithRay(controllerRay(controller));
    if (!target) {
      target = pickWithRay(gazeRay());
      if (target) state.gazeSelections += 1;
    }
    if (!target) {
      state.failedSelections += 1;
      window.__UCAN_API__?.setStatus?.('Apunte al anuncio, planeta o letrero y presione el joystick, gatillo o A/X.');
      updateAudit();
      return false;
    }
    if (!openInfoForMesh(target, 'controller')) return false;
    if (activationSource === 'joystick') state.joystickSelections += 1;
    else if (activationSource === 'trigger') state.triggerSelections += 1;
    else state.primarySelections += 1;
    updateAudit();
    return true;
  }

  function componentIds(motion) {
    try { return motion?.getComponentIds?.() || Object.keys(motion?.components || {}); }
    catch (_) { return Object.keys(motion?.components || {}); }
  }

  function componentById(motion, id) {
    try { return motion?.getComponent?.(id) || motion?.components?.[id] || null; }
    catch (_) { return motion?.components?.[id] || null; }
  }

  function bindMotionController(controller, motion) {
    if (!motion) return;
    const record = state.controllers.get(controller.uniqueId || controller);
    if (!record) return;
    record.motion = motion;
    const ids = componentIds(motion);
    for (const id of ids) {
      const component = componentById(motion, id);
      if (!component || component.__ucanR9Bound) continue;
      const lower = String(id).toLowerCase();
      let action = null;
      if (/thumbstick|touchpad/.test(lower)) action = 'joystick';
      else if (/trigger/.test(lower)) action = 'trigger';
      else if (/a-button|x-button/.test(lower)) action = 'primary';
      else if (/b-button|y-button/.test(lower)) action = 'secondary';
      if (!action) continue;
      component.__ucanR9Bound = true;
      record.components[action] = component;
      state.componentBindings += 1;
      if (action === 'joystick') state.joystickBindings += 1;
      component.onButtonStateChangedObservable?.add?.(() => {
        if (!component.changes?.pressed || !component.pressed) return;
        const now = performance.now();
        if (now - record.lastPress < PRESS_COOLDOWN_MS) return;
        record.lastPress = now;
        if (action === 'secondary') closeInfo();
        else selectFromController(controller, action);
      });
    }
  }

  function registerController(controller) {
    if (!controller) return;
    const key = controller.uniqueId || controller;
    if (state.controllers.has(key)) return;
    const record = { controller, motion:null, components:{}, pressed:{ joystick:false, trigger:false, primary:false, secondary:false }, lastPress:0 };
    state.controllers.set(key, record);
    if (controller.motionController) bindMotionController(controller, controller.motionController);
    controller.onMotionControllerInitObservable?.add?.(motion => bindMotionController(controller, motion));
  }

  function componentPressed(record, action) {
    const component = record.components[action];
    if (component && (component.pressed || Number(component.value || 0) > 0.58)) return true;
    const gamepad = record.controller?.inputSource?.gamepad || record.motion?.gamepadObject || record.motion?.gamepad;
    const index = Number(component?.gamepadIndices?.button);
    if (Number.isInteger(index) && index >= 0) {
      const button = gamepad?.buttons?.[index];
      if (button?.pressed || Number(button?.value || 0) > 0.58) return true;
    }
    const fallbackIndexes = action === 'joystick' ? [3] : action === 'trigger' ? [0] : action === 'primary' ? [4] : [5];
    return fallbackIndexes.some(i => Boolean(gamepad?.buttons?.[i]?.pressed || Number(gamepad?.buttons?.[i]?.value || 0) > 0.58));
  }

  function pollControllers() {
    if (state.helper?.baseExperience?.state !== XR_STATE.IN_XR) return;
    for (const record of state.controllers.values()) {
      for (const action of ['joystick', 'trigger', 'primary', 'secondary']) {
        const pressed = componentPressed(record, action);
        if (pressed && !record.pressed[action]) {
          const now = performance.now();
          if (now - record.lastPress >= PRESS_COOLDOWN_MS) {
            record.lastPress = now;
            if (action === 'secondary') closeInfo();
            else selectFromController(record.controller, action);
          }
        }
        record.pressed[action] = pressed;
      }
    }
  }

  function installControllerSupport() {
    const input = state.helper?.input;
    if (!input) return;
    for (const controller of input.controllers || []) registerController(controller);
    input.onControllerAddedObservable?.add?.(registerController);
    input.onControllerRemovedObservable?.add?.(controller => state.controllers.delete(controller.uniqueId || controller));
  }

  function installPointerSupport() {
    state.scene.onPointerObservable?.add?.(pointerInfo => {
      if (pointerInfo.type !== B.PointerEventTypes.POINTERPICK) return;
      const mesh = pointerInfo.pickInfo?.pickedMesh;
      if (!mesh) return;
      if (mesh.metadata?.correctedFloor1AnnouncementV305R9 || mesh.metadata?.terraceInteractiveV305R9) openInfoForMesh(mesh, 'pointer');
    });
  }

  function updateAudit() {
    window.__UCAN_VR_INTERACTION_V305_R9__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      xrStateDefined:true,
      cacheBustRequired:true,
      floor1SupportsDynamicTextures:true,
      floor1SupportsImageTextures:true,
      floor1TwoIndependentFrontFaces:true,
      floor1DynamicTextureInvertY:false,
      floor1BillboardDisabled:true,
      terracePlanets:true,
      terraceSkyLabels:true,
      terraceSigns:true,
      joystickComponentEvents:true,
      joystickComponentGamepadIndex:true,
      joystickIndex3Fallback:true,
      controllerRay:true,
      headGazeFallback:true,
      floor1Sources:state.floor1Sources,
      correctedFloor1Faces:state.correctedFloor1Faces,
      terraceObjects:state.terraceObjects,
      controllers:state.controllers.size,
      componentBindings:state.componentBindings,
      joystickBindings:state.joystickBindings,
      joystickSelections:state.joystickSelections,
      triggerSelections:state.triggerSelections,
      primarySelections:state.primarySelections,
      gazeSelections:state.gazeSelections,
      pointerSelections:state.pointerSelections,
      failedSelections:state.failedSelections,
      infoVisible:state.infoVisible,
      currentTitle:state.currentTitle,
      infoOpens:state.infoOpens,
      infoCloses:state.infoCloses,
      lastError:state.lastError,
      refresh:() => { scanFloor1(); scanTerrace(); },
      close:closeInfo,
      getState:() => ({
        installed:state.installed,
        inXR:state.helper?.baseExperience?.state === XR_STATE.IN_XR,
        floor1Sources:state.floor1Sources,
        correctedFloor1Faces:state.correctedFloor1Faces,
        terraceObjects:state.terraceObjects,
        controllers:state.controllers.size,
        joystickBindings:state.joystickBindings,
        joystickSelections:state.joystickSelections,
        failedSelections:state.failedSelections,
        infoVisible:state.infoVisible,
        currentTitle:state.currentTitle,
        lastError:state.lastError
      })
    };
  }

  function frame() {
    const now = performance.now();
    if (now - state.lastScan >= SCAN_MS) {
      state.lastScan = now;
      try { scanFloor1(); scanTerrace(); } catch (error) {
        state.lastError = { stage:'scan', message:String(error?.message || error), at:new Date().toISOString() };
      }
    }
    if (now - state.lastPoll >= POLL_MS) {
      state.lastPoll = now;
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
    state.installed = true;
    createInfoPanel();
    scanFloor1();
    scanTerrace();
    installControllerSupport();
    installPointerSupport();
    state.scene.onBeforeRenderObservable.add(() => {
      try { frame(); } catch (error) {
        state.lastError = { stage:'frame', message:String(error?.message || error), at:new Date().toISOString() };
        console.error('[UCAN V305 R9]', error);
      }
    });
    state.helper.baseExperience?.onStateChangedObservable?.add?.(current => {
      if (current === XR_STATE.IN_XR) {
        window.setTimeout(() => { scanFloor1(); scanTerrace(); installControllerSupport(); }, 500);
      } else if (current === XR_STATE.NOT_IN_XR) closeInfo();
    });
    window.__UCAN_API__?.setStatus?.('UCAN V305 R9 cargado: anuncios verticales y joystick XR corregidos.');
    console.info('[UCAN V305 R9] Corrección real de anuncios y selección XR instalada.');
    updateAudit();
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 500) window.clearInterval(timer);
    } catch (error) {
      state.lastError = { stage:'install', message:String(error?.message || error), at:new Date().toISOString() };
      if (attempts >= 500) window.clearInterval(timer);
    }
  }, 100);

  updateAudit();
})();
