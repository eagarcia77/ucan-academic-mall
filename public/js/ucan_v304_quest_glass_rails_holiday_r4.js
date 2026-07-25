(() => {
  'use strict';

  const VERSION = 'V304';
  const REVISION = 'R4';
  const BUILD = 'V304-20260725-QUEST-GLASS-RAILS-HOLIDAY-R4';
  const B = window.BABYLON;
  if (!B) return;

  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const LEVEL = Object.freeze({ three:16.4, roof:27.2 });
  const STAIR = Object.freeze({ minX:40.8, maxX:47.2, bottomZ:39.0, topZ:10.5 });
  const VISUAL_START_DELAY_MS = 720;
  const MAINTENANCE_MS = 2200;
  const GLASS_BATCH_SIZE = 36;
  const GLASS_VISIBILITY = 0.46;
  const ALLOWED_HIDDEN_REASONS = new Set(['dark-glass-global', 'rooftop-stair-glass', 'floor2-escalator-front-glass']);

  const state = {
    scene:null,
    helper:null,
    installed:false,
    questDevice:false,
    inXR:false,
    visualsReady:false,
    visualTimer:null,
    batchTimer:null,
    maintenanceTimer:null,
    glassMaterial:null,
    metalMaterial:null,
    glassOriginals:new Map(),
    oldRailOriginals:new Map(),
    holidayOriginal:null,
    holidaySource:null,
    holidayFaces:[],
    railMeshes:[],
    convertedGlass:0,
    glassCandidates:0,
    railPosts:0,
    railTubes:0,
    railPanes:0,
    holidayFacesCreated:0,
    visualPasses:0,
    vrAttempts:0,
    vrEntries:0,
    mrAttempts:0,
    mrEntries:0,
    exits:0,
    lastError:null
  };

  function helperReady() {
    state.helper = window.__UCAN_XR_HELPER__ || state.helper;
    state.scene = window.__UCAN_API__?.getScene?.() || state.scene;
    return Boolean(state.helper?.baseExperience && state.scene);
  }

  function questDetected() {
    const ua = String(navigator.userAgent || '');
    const brands = Array.isArray(navigator.userAgentData?.brands)
      ? navigator.userAgentData.brands.map(item => item?.brand || '').join(' ')
      : '';
    if (/OculusBrowser|Meta Quest|Quest 2|Quest 3|Quest Pro/i.test(`${ua} ${brands}`)) return true;
    return (state.helper?.input?.controllers || []).some(controller =>
      (controller?.inputSource?.profiles || []).some(profile => /oculus|meta|quest|touch/i.test(String(profile)))
    );
  }

  function currentXRState() {
    return state.helper?.baseExperience?.state ?? XR_STATE.NOT_IN_XR;
  }

  function setStatus(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const status = document.getElementById('status');
    if (status && !window.__UCAN_API__?.setStatus) status.textContent = message;
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

  function materialText(mesh) {
    return `${String(mesh?.material?.name || '')} ${String(mesh?.material?.id || '')}`;
  }

  function isGlassCandidate(mesh) {
    if (!mesh || typeof mesh.getBoundingInfo !== 'function') return false;
    const metadata = metadataChain(mesh);
    const reason = mesh.metadata?.ucanQuestGeometryReasonV303;
    const text = `${nameChain(mesh)} ${materialText(mesh)}`;
    const alpha = Number(mesh.material?.alpha ?? 1);
    return Boolean(
      ALLOWED_HIDDEN_REASONS.has(reason) ||
      metadata.stairGlassPanel === true ||
      metadata.glass === true ||
      metadata.glassPanel === true ||
      /cristal|glass|vidrio|mampara/i.test(text) ||
      (alpha < 0.97 && /baranda|panel|puerta|ventana|railing|guard/i.test(text))
    );
  }

  function excludedGlass(mesh) {
    const metadata = metadataChain(mesh);
    const reason = mesh.metadata?.ucanQuestGeometryReasonV303;
    const text = nameChain(mesh);
    return Boolean(
      reason === 'floor3-rear-railing' ||
      reason === 'rooftop-rear-railing' ||
      metadata.centralTerraceFeature === true ||
      /tragaluz|centro.*terraza|terraza.*centro|baranda tragaluz rooftop|cristal.*centro.*terraza/i.test(text)
    );
  }

  function transparentMaterial() {
    if (state.glassMaterial && !state.glassMaterial.isDisposed?.()) return state.glassMaterial;
    const material = new B.StandardMaterial('superficie translúcida UCAN R4', state.scene);
    material.diffuseColor = B.Color3.FromHexString('#b8e2ea');
    material.emissiveColor = B.Color3.FromHexString('#315d66').scale(0.20);
    material.specularColor = B.Color3.FromHexString('#e8fbff');
    material.specularPower = 48;
    // Se mantiene por encima del umbral de V303. La transparencia visual se controla con mesh.visibility.
    material.alpha = 0.965;
    material.backFaceCulling = false;
    material.needDepthPrePass = false;
    material.disableDepthWrite = true;
    material.forceDepthWrite = false;
    material.separateCullingPass = false;
    material.transparencyMode = B.Material?.MATERIAL_ALPHABLEND ?? 2;
    state.glassMaterial = material;
    return material;
  }

  function stairMetalMaterial() {
    if (state.metalMaterial && !state.metalMaterial.isDisposed?.()) return state.metalMaterial;
    const material = new B.StandardMaterial('metal lateral escalera UCAN R4', state.scene);
    material.diffuseColor = B.Color3.FromHexString('#54666b');
    material.emissiveColor = B.Color3.FromHexString('#1d292c').scale(0.18);
    material.specularColor = B.Color3.FromHexString('#b9c7ca');
    material.specularPower = 44;
    state.metalMaterial = material;
    return material;
  }

  function preserveGlass(mesh) {
    if (state.glassOriginals.has(mesh)) return;
    state.glassOriginals.set(mesh, {
      name:mesh.name,
      material:mesh.material,
      metadata:{ ...(mesh.metadata || {}) },
      enabled:mesh.isEnabled?.() !== false,
      isVisible:mesh.isVisible,
      visibility:mesh.visibility,
      isPickable:mesh.isPickable,
      checkCollisions:mesh.checkCollisions,
      alwaysSelectAsActiveMesh:mesh.alwaysSelectAsActiveMesh,
      renderingGroupId:mesh.renderingGroupId,
      alphaIndex:mesh.alphaIndex
    });
  }

  function convertGlass(mesh, index) {
    if (!mesh || excludedGlass(mesh)) return false;
    preserveGlass(mesh);
    try { mesh.setEnabled?.(true); } catch (_) {}
    mesh.name = `UCAN translúcido R4 ${index}`;
    mesh.material = transparentMaterial();
    mesh.isVisible = true;
    mesh.visibility = GLASS_VISIBILITY;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.alwaysSelectAsActiveMesh = false;
    mesh.receiveShadows = false;
    mesh.renderingGroupId = 3;
    mesh.alphaIndex = 180 + (index % 60);
    const metadata = { ...(mesh.metadata || {}) };
    delete metadata.stairGlassPanel;
    delete metadata.glass;
    delete metadata.glassPanel;
    delete metadata.ucanQuestGeometryRemovedV303;
    delete metadata.ucanQuestGeometryRevisionV303;
    delete metadata.ucanQuestGeometryReasonV303;
    metadata.ucanQuestTransparentSurfaceV304R4 = true;
    metadata.frontBackVisible = true;
    mesh.metadata = metadata;
    return true;
  }

  function processGlassCandidates(candidates, startIndex = 0) {
    if (!state.inXR || currentXRState() !== XR_STATE.IN_XR) return;
    const end = Math.min(candidates.length, startIndex + GLASS_BATCH_SIZE);
    for (let index = startIndex; index < end; index += 1) {
      if (convertGlass(candidates[index], index)) state.convertedGlass += 1;
    }
    if (end < candidates.length) {
      state.batchTimer = window.setTimeout(() => processGlassCandidates(candidates, end), 18);
      return;
    }
    state.batchTimer = null;
    replaceStairRailings();
    replaceHolidayBoard();
    state.visualsReady = true;
    state.visualPasses += 1;
    maintainVisuals();
    setStatus('Meta Quest V304 R4: cristales, barandas laterales y cartel de feriados corregidos.');
    updateAudit();
  }

  function restoreGlassOriginals() {
    for (const [mesh, original] of state.glassOriginals) {
      try {
        if (mesh?.isDisposed?.()) continue;
        mesh.name = original.name;
        mesh.material = original.material;
        mesh.metadata = { ...original.metadata };
        mesh.setEnabled?.(original.enabled);
        mesh.isVisible = original.isVisible;
        mesh.visibility = original.visibility;
        mesh.isPickable = original.isPickable;
        mesh.checkCollisions = original.checkCollisions;
        mesh.alwaysSelectAsActiveMesh = original.alwaysSelectAsActiveMesh;
        mesh.renderingGroupId = original.renderingGroupId;
        mesh.alphaIndex = original.alphaIndex;
      } catch (_) {}
    }
    state.glassOriginals.clear();
    state.convertedGlass = 0;
    state.glassCandidates = 0;
  }

  function stairGroundAtZ(z) {
    const progress = Math.max(0, Math.min(1, (STAIR.bottomZ - z) / (STAIR.bottomZ - STAIR.topZ)));
    return LEVEL.three + (LEVEL.roof - LEVEL.three) * progress;
  }

  function isOldStairRail(mesh) {
    const metadata = metadataChain(mesh);
    const text = nameChain(mesh);
    return Boolean(
      metadata.questCorrectedStairRailV301 === true ||
      /pasamanos superior escalera Quest V301|riel inferior escalera Quest V301|poste baranda escalera Quest V301/i.test(text)
    );
  }

  function hideOldStairRails() {
    for (const mesh of [...(state.scene?.meshes || [])]) {
      if (!isOldStairRail(mesh) || state.oldRailOriginals.has(mesh)) continue;
      state.oldRailOriginals.set(mesh, {
        enabled:mesh.isEnabled?.() !== false,
        isVisible:mesh.isVisible,
        visibility:mesh.visibility,
        checkCollisions:mesh.checkCollisions
      });
      try { mesh.setEnabled?.(false); } catch (_) {}
      mesh.isVisible = false;
      mesh.visibility = 0;
      mesh.checkCollisions = false;
    }
  }

  function restoreOldStairRails() {
    for (const [mesh, original] of state.oldRailOriginals) {
      try {
        mesh.setEnabled?.(original.enabled);
        mesh.isVisible = original.isVisible;
        mesh.visibility = original.visibility;
        mesh.checkCollisions = original.checkCollisions;
      } catch (_) {}
    }
    state.oldRailOriginals.clear();
  }

  function trackRail(mesh, metadata = {}) {
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.alwaysSelectAsActiveMesh = false;
    mesh.metadata = {
      ...(mesh.metadata || {}),
      questCorrectedStairRailV304R4:true,
      stairRail:true,
      ...metadata
    };
    state.railMeshes.push(mesh);
    return mesh;
  }

  function buildRailSide(x, sideLabel) {
    const metal = stairMetalMaterial();
    const translucent = transparentMaterial();
    const segments = 18;
    const depth = (STAIR.bottomZ - STAIR.topZ) / segments;
    const topPath = [];
    const middlePath = [];

    for (let index = 0; index <= segments; index += 1) {
      const z = STAIR.bottomZ - index * depth;
      const ground = stairGroundAtZ(z);
      topPath.push(new B.Vector3(x, ground + 1.28, z));
      middlePath.push(new B.Vector3(x, ground + 0.61, z));
      if (index % 3 === 0 || index === segments) {
        const post = B.MeshBuilder.CreateCylinder(`poste lateral R4 ${sideLabel} ${index}`, {
          diameter:0.13,
          height:1.30,
          tessellation:10
        }, state.scene);
        post.position.set(x, ground + 0.65, z);
        post.material = metal;
        trackRail(post, { stairRailPost:true, side:sideLabel });
        state.railPosts += 1;
      }
    }

    const top = B.MeshBuilder.CreateTube(`pasamanos lateral R4 ${sideLabel}`, {
      path:topPath,
      radius:0.072,
      tessellation:10,
      cap:B.Mesh.CAP_ALL
    }, state.scene);
    top.material = metal;
    trackRail(top, { stairTopRail:true, side:sideLabel });
    state.railTubes += 1;

    const middle = B.MeshBuilder.CreateTube(`riel lateral R4 ${sideLabel}`, {
      path:middlePath,
      radius:0.045,
      tessellation:9,
      cap:B.Mesh.CAP_ALL
    }, state.scene);
    middle.material = metal;
    trackRail(middle, { stairLowerRail:true, side:sideLabel });
    state.railTubes += 1;

    for (let index = 0; index < segments; index += 1) {
      const z1 = STAIR.bottomZ - index * depth;
      const z2 = STAIR.bottomZ - (index + 1) * depth;
      const z = (z1 + z2) / 2;
      const ground = stairGroundAtZ(z);
      const pane = B.MeshBuilder.CreateBox(`superficie translúcida lateral R4 ${sideLabel} ${index}`, {
        width:0.065,
        height:0.76,
        depth:depth * 0.88
      }, state.scene);
      pane.position.set(x, ground + 0.83, z);
      pane.material = translucent;
      pane.visibility = GLASS_VISIBILITY;
      pane.renderingGroupId = 3;
      pane.alphaIndex = 260 + index;
      trackRail(pane, { ucanQuestTransparentSurfaceV304R4:true, frontBackVisible:true, side:sideLabel });
      state.railPanes += 1;
    }
  }

  function replaceStairRailings() {
    if (state.railMeshes.length > 0) return;
    hideOldStairRails();
    // Las nuevas barandas se colocan dentro de los bordes laterales de la escalera, no detrás de ella.
    buildRailSide(STAIR.minX + 0.34, 'oeste');
    buildRailSide(STAIR.maxX - 0.34, 'este');
  }

  function disposeRailings() {
    for (const mesh of state.railMeshes.splice(0)) {
      try { mesh.dispose?.(); } catch (_) {}
    }
    state.railPosts = 0;
    state.railTubes = 0;
    state.railPanes = 0;
    restoreOldStairRails();
  }

  function holidayBoardSource() {
    return [...(state.scene?.meshes || [])].find(mesh => {
      const metadata = metadataChain(mesh);
      const text = nameChain(mesh);
      return metadata.livePanelKey === 'pr-celebration-v304' || /Cartel celebración Puerto Rico V304/i.test(text);
    }) || null;
  }

  function boardDimensions(mesh) {
    try {
      mesh.computeWorldMatrix?.(true);
      const box = mesh.getBoundingInfo().boundingBox;
      return {
        width:Math.max(1, (box.maximumWorld.x - box.minimumWorld.x) || 13.5),
        height:Math.max(1, (box.maximumWorld.y - box.minimumWorld.y) || 6.3)
      };
    } catch (_) { return { width:13.5, height:6.3 }; }
  }

  function cloneBoardMaterial(sourceMaterial, suffix) {
    const material = sourceMaterial?.clone?.(`material cartel feriado R4 ${suffix}`) || sourceMaterial;
    if (material) {
      material.backFaceCulling = true;
      material.disableLighting = true;
    }
    return material;
  }

  function createHolidayFace(source, width, height, facing, offset, suffix) {
    const face = B.MeshBuilder.CreatePlane(`Cartel feriados Puerto Rico legible R4 ${suffix}`, {
      width,
      height,
      sideOrientation:B.Mesh.FRONTSIDE
    }, state.scene);
    face.parent = source.parent || null;
    face.position.copyFrom(source.position);
    face.position.addInPlace(offset);
    face.rotationQuaternion = null;
    face.rotation.set(0, facing, 0);
    face.billboardMode = B.Mesh.BILLBOARDMODE_NONE;
    face.material = cloneBoardMaterial(source.material, suffix);
    face.isPickable = true;
    face.checkCollisions = false;
    face.alwaysSelectAsActiveMesh = false;
    face.renderingGroupId = 3;
    face.alphaIndex = 320;
    face.metadata = {
      ...(source.metadata || {}),
      seasonalBoard:true,
      readableSign:true,
      holidayBoardPuertoRicoV304R4:true,
      frontSideOnly:true,
      orientation:'upright',
      side:suffix
    };
    if (B.ActionManager && B.ExecuteCodeAction) {
      face.actionManager = new B.ActionManager(state.scene);
      face.actionManager.registerAction(new B.ExecuteCodeAction(B.ActionManager.OnPickTrigger, () => {
        window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.openPanelByMesh?.(face);
      }));
    }
    state.holidayFaces.push(face);
    return face;
  }

  function replaceHolidayBoard() {
    if (state.holidayFaces.length > 0) return;
    const source = holidayBoardSource();
    if (!source) return;
    state.holidaySource = source;
    state.holidayOriginal = {
      enabled:source.isEnabled?.() !== false,
      isVisible:source.isVisible,
      visibility:source.visibility,
      isPickable:source.isPickable
    };
    const { width, height } = boardDimensions(source);
    try { source.setEnabled?.(false); } catch (_) {}
    source.isVisible = false;
    source.visibility = 0;
    source.isPickable = false;

    const z = Number(source.position?.z || 0);
    const x = Number(source.position?.x || 0);
    if (Math.abs(z) >= Math.abs(x)) {
      const inwardFacing = z >= 0 ? Math.PI : 0;
      const outwardFacing = inwardFacing + Math.PI;
      const inwardOffset = new B.Vector3(0, 0, z >= 0 ? -0.025 : 0.025);
      const outwardOffset = new B.Vector3(0, 0, z >= 0 ? 0.025 : -0.025);
      createHolidayFace(source, width, height, inwardFacing, inwardOffset, 'hacia edificio');
      createHolidayFace(source, width, height, outwardFacing, outwardOffset, 'hacia exterior');
    } else {
      const inwardFacing = x >= 0 ? -Math.PI / 2 : Math.PI / 2;
      const outwardFacing = inwardFacing + Math.PI;
      const inwardOffset = new B.Vector3(x >= 0 ? -0.025 : 0.025, 0, 0);
      const outwardOffset = new B.Vector3(x >= 0 ? 0.025 : -0.025, 0, 0);
      createHolidayFace(source, width, height, inwardFacing, inwardOffset, 'hacia edificio');
      createHolidayFace(source, width, height, outwardFacing, outwardOffset, 'hacia exterior');
    }
    state.holidayFacesCreated = state.holidayFaces.length;
  }

  function restoreHolidayBoard() {
    for (const face of state.holidayFaces.splice(0)) {
      try { face.material?.dispose?.(false, false); } catch (_) {}
      try { face.dispose?.(); } catch (_) {}
    }
    if (state.holidaySource && state.holidayOriginal) {
      try {
        state.holidaySource.setEnabled?.(state.holidayOriginal.enabled);
        state.holidaySource.isVisible = state.holidayOriginal.isVisible;
        state.holidaySource.visibility = state.holidayOriginal.visibility;
        state.holidaySource.isPickable = state.holidayOriginal.isPickable;
      } catch (_) {}
    }
    state.holidaySource = null;
    state.holidayOriginal = null;
    state.holidayFacesCreated = 0;
  }

  function maintainVisuals() {
    if (!state.inXR || currentXRState() !== XR_STATE.IN_XR || !state.visualsReady) return;
    for (const mesh of state.glassOriginals.keys()) {
      try {
        mesh.setEnabled?.(true);
        mesh.isVisible = true;
        mesh.visibility = GLASS_VISIBILITY;
      } catch (_) {}
    }
    for (const mesh of state.railMeshes) {
      try {
        mesh.setEnabled?.(true);
        mesh.isVisible = true;
        if (mesh.metadata?.ucanQuestTransparentSurfaceV304R4) mesh.visibility = GLASS_VISIBILITY;
      } catch (_) {}
    }
    for (const face of state.holidayFaces) {
      try { face.setEnabled?.(true); face.isVisible = true; face.visibility = 1; } catch (_) {}
    }
  }

  function beginVisualFixes() {
    if (!state.inXR || currentXRState() !== XR_STATE.IN_XR || !state.questDevice) return;
    state.visualsReady = false;
    state.convertedGlass = 0;
    const candidates = [...(state.scene?.meshes || [])].filter(mesh => isGlassCandidate(mesh) && !excludedGlass(mesh));
    state.glassCandidates = candidates.length;
    processGlassCandidates(candidates, 0);
  }

  function clearTimers() {
    if (state.visualTimer) window.clearTimeout(state.visualTimer);
    if (state.batchTimer) window.clearTimeout(state.batchTimer);
    state.visualTimer = null;
    state.batchTimer = null;
  }

  function scheduleVisualFixes() {
    clearTimers();
    state.visualsReady = false;
    state.visualTimer = window.setTimeout(() => {
      state.visualTimer = null;
      beginVisualFixes();
    }, VISUAL_START_DELAY_MS);
  }

  function restoreVisuals() {
    clearTimers();
    state.visualsReady = false;
    restoreHolidayBoard();
    disposeRailings();
    restoreGlassOriginals();
    updateAudit();
  }

  function showDiagnostics(title) {
    try { window.__UCAN_XR_ENTRY_MR_V304__?.showDiagnostics?.(title); }
    catch (_) { setStatus(title); }
  }

  function enterModeDirect(mode) {
    if (!helperReady()) {
      recordError('pre-entry-r4', new Error('Babylon WebXR todavía no está preparado.'));
      showDiagnostics('WebXR todavía no está preparado');
      return false;
    }
    if (!window.isSecureContext || !navigator.xr) {
      recordError('pre-entry-r4', new DOMException('WebXR requiere HTTPS y Meta Quest Browser.', 'SecurityError'));
      showDiagnostics('El navegador no puede iniciar WebXR');
      return false;
    }

    const base = state.helper.baseExperience;
    const current = currentXRState();
    if (current === XR_STATE.ENTERING_XR || current === XR_STATE.IN_XR) {
      Promise.resolve(base.exitXRAsync()).then(() => {
        state.exits += 1;
        updateAudit();
      }).catch(error => recordError('exitXR-r4', error));
      return true;
    }

    state.questDevice = questDetected();
    if (mode === 'immersive-ar') state.mrAttempts += 1;
    else state.vrAttempts += 1;
    setStatus(mode === 'immersive-ar' ? 'Solicitando MR Beta…' : 'Solicitando entrada al entorno VR…');

    let enterPromise;
    try {
      if (mode === 'immersive-vr') {
        enterPromise = base.enterXRAsync('immersive-vr', 'local-floor');
      } else {
        const renderTarget = state.helper.renderTarget || base.renderTarget;
        enterPromise = base.enterXRAsync('immersive-ar', 'local-floor', renderTarget, {
          optionalFeatures:['bounded-floor', 'hand-tracking', 'hit-test', 'anchors']
        });
      }
    } catch (error) {
      recordError(mode === 'immersive-ar' ? 'enterMR-sync-r4' : 'enterVR-sync-r4', error);
      showDiagnostics(mode === 'immersive-ar' ? 'MR Beta no pudo iniciar' : 'VR no pudo iniciar');
      return false;
    }

    Promise.resolve(enterPromise).then(() => {
      if (mode === 'immersive-ar') state.mrEntries += 1;
      else state.vrEntries += 1;
      updateAudit();
    }).catch(error => {
      recordError(mode === 'immersive-ar' ? 'enterMR-r4' : 'enterVR-r4', error);
      setStatus(`No se pudo iniciar ${mode === 'immersive-ar' ? 'MR' : 'VR'}: ${error?.name || 'Error'} — ${error?.message || error}`);
      showDiagnostics(mode === 'immersive-ar' ? 'MR Beta no pudo iniciar' : 'VR no pudo iniciar');
    });
    return true;
  }

  function rebindButton(id, mode) {
    const existing = document.getElementById(id);
    if (!existing) return null;
    if (existing.dataset.ucanV304R4Bound === 'true') return existing;
    const button = existing.cloneNode(true);
    button.dataset.ucanV289Bound = 'true';
    button.dataset.ucanV304XrBound = 'direct-user-gesture';
    button.dataset.ucanV304R4Bound = 'true';
    button.disabled = false;
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      enterModeDirect(mode);
    }, true);
    existing.replaceWith(button);
    return button;
  }

  function bindButtons() {
    rebindButton('xrBtn', 'immersive-vr');
    rebindButton('mrBtn', 'immersive-ar');
    rebindButton('ucanVrGogglesV304', 'immersive-vr');
  }

  function onXRStateChanged(current) {
    if (current === XR_STATE.ENTERING_XR) {
      state.inXR = true;
      state.visualsReady = false;
      setStatus('Entrando en VR… espere a que el visor complete la transición.');
    } else if (current === XR_STATE.IN_XR) {
      state.inXR = true;
      state.questDevice = questDetected();
      scheduleVisualFixes();
    } else if (current === XR_STATE.NOT_IN_XR) {
      state.inXR = false;
      restoreVisuals();
    }
    updateAudit();
  }

  function updateAudit() {
    window.__UCAN_QUEST_V304_R4__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      inXR:state.inXR,
      questDevice:state.questDevice,
      visualsReady:state.visualsReady,
      nonBlockingDuringEnteringXR:true,
      glassConvertedInsteadOfBlack:true,
      transparentSurfaceColor:'#b8e2ea',
      materialAlphaForV303Compatibility:0.965,
      meshVisibilityForTransparency:GLASS_VISIBILITY,
      depthPrePassDisabled:true,
      depthWriteDisabled:true,
      stairRailingsAlignedToSideEdges:true,
      stairRailingsBehindStairsRemoved:true,
      stairWestX:STAIR.minX + 0.34,
      stairEastX:STAIR.maxX - 0.34,
      holidayBoardTwoReadableFrontFaces:true,
      holidayBoardBacksideMirroringDisabled:true,
      holidayBoardBillboardDisabled:true,
      glassBatchSize:GLASS_BATCH_SIZE,
      convertedGlass:state.convertedGlass,
      glassCandidates:state.glassCandidates,
      railPosts:state.railPosts,
      railTubes:state.railTubes,
      railPanes:state.railPanes,
      holidayFacesCreated:state.holidayFacesCreated,
      visualPasses:state.visualPasses,
      vrAttempts:state.vrAttempts,
      vrEntries:state.vrEntries,
      mrAttempts:state.mrAttempts,
      mrEntries:state.mrEntries,
      exits:state.exits,
      lastError:state.lastError,
      enterVR:() => enterModeDirect('immersive-vr'),
      enterMR:() => enterModeDirect('immersive-ar'),
      refresh:() => { maintainVisuals(); updateAudit(); },
      getState:() => ({
        installed:state.installed,
        inXR:state.inXR,
        questDevice:state.questDevice,
        visualsReady:state.visualsReady,
        convertedGlass:state.convertedGlass,
        glassCandidates:state.glassCandidates,
        railPosts:state.railPosts,
        railTubes:state.railTubes,
        railPanes:state.railPanes,
        holidayFacesCreated:state.holidayFacesCreated,
        vrAttempts:state.vrAttempts,
        vrEntries:state.vrEntries,
        lastError:state.lastError
      })
    };
  }

  function install() {
    if (state.installed || !helperReady()) return false;
    if (window.__UCAN_QUEST_V303__?.installed !== true) return false;
    state.installed = true;
    bindButtons();
    state.helper.baseExperience?.onStateChangedObservable?.add?.(onXRStateChanged);
    state.maintenanceTimer = window.setInterval(() => {
      try {
        bindButtons();
        maintainVisuals();
      } catch (error) { recordError('maintenance-r4', error); }
    }, MAINTENANCE_MS);
    onXRStateChanged(currentXRState());
    updateAudit();
    console.info(`[UCAN ${VERSION} ${REVISION}] Cristales, barandas laterales y cartel de feriados instalados.`);
    return true;
  }

  let attempts = 0;
  const bootTimer = window.setInterval(() => {
    attempts += 1;
    bindButtons();
    if (install() || attempts >= 420) window.clearInterval(bootTimer);
  }, 100);

  updateAudit();
})();