(() => {
  'use strict';

  const VERSION = 'V304';
  const REVISION = 'R5';
  const BUILD = 'V304-20260725-GLOBAL-GLASS-UPRIGHT-SIGNS-R5';
  const B = window.BABYLON;
  if (!B) return;

  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const GLASS_BATCH_SIZE = 48;
  const BOARD_SCAN_LIMIT = 16;
  const MAINTENANCE_MS = 3000;

  const state = {
    scene:null,
    helper:null,
    installed:false,
    glassMaterial:null,
    glassOriginals:new Map(),
    boardSources:new Map(),
    boardFaces:new Map(),
    glassConverted:0,
    glassCandidates:0,
    boardsFixed:0,
    boardFacesCreated:0,
    scans:0,
    batchTimer:null,
    maintenanceTimer:null,
    lastError:null
  };

  function helperReady() {
    state.scene = window.__UCAN_API__?.getScene?.() || state.scene;
    state.helper = window.__UCAN_XR_HELPER__ || state.helper;
    return Boolean(state.scene);
  }

  function currentXRState() {
    return state.helper?.baseExperience?.state ?? XR_STATE.NOT_IN_XR;
  }

  function questDetected() {
    const ua = String(navigator.userAgent || '');
    const brands = Array.isArray(navigator.userAgentData?.brands)
      ? navigator.userAgentData.brands.map(item => item?.brand || '').join(' ')
      : '';
    return /OculusBrowser|Meta Quest|Quest 2|Quest 3|Quest Pro/i.test(`${ua} ${brands}`);
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
    const text = `${nameChain(mesh)} ${materialText(mesh)}`;
    const alpha = Number(mesh.material?.alpha ?? 1);
    if (metadata.seasonalBoard === true || metadata.readableSign === true || /cartel|rótulo|rotulo|letrero|logo|pantalla/i.test(text)) return false;
    return Boolean(
      metadata.stairGlassPanel === true ||
      metadata.glass === true ||
      metadata.glassPanel === true ||
      metadata.ucanQuestTransparentSurfaceV304R4 === true ||
      /cristal|glass|vidrio|mampara|ventana transparente/i.test(text) ||
      (alpha < 0.98 && /baranda|panel|puerta|ventana|railing|guard/i.test(text))
    );
  }

  function excludedGlass(mesh) {
    const metadata = metadataChain(mesh);
    const text = nameChain(mesh);
    const reason = mesh.metadata?.ucanQuestGeometryReasonV303;
    return Boolean(
      reason === 'floor3-rear-railing' ||
      reason === 'rooftop-rear-railing' ||
      metadata.centralTerraceFeature === true ||
      /tragaluz|centro.*terraza|terraza.*centro|baranda tragaluz rooftop|cristal.*centro.*terraza/i.test(text)
    );
  }

  function globalGlassMaterial() {
    if (state.glassMaterial && !state.glassMaterial.isDisposed?.()) return state.glassMaterial;
    const material = new B.StandardMaterial('cristal claro global UCAN V304 R5', state.scene);
    material.diffuseColor = B.Color3.FromHexString('#a9dce6');
    material.emissiveColor = B.Color3.FromHexString('#6eaeb9');
    material.specularColor = B.Color3.FromHexString('#e8fbff');
    material.specularPower = 56;
    material.alpha = 0.52;
    material.backFaceCulling = false;
    material.needDepthPrePass = false;
    material.disableDepthWrite = true;
    material.forceDepthWrite = false;
    material.separateCullingPass = false;
    material.useAlphaFromDiffuseTexture = false;
    material.disableLighting = true;
    material.transparencyMode = B.Material?.MATERIAL_ALPHABLEND ?? 2;
    state.glassMaterial = material;
    return material;
  }

  function preserveGlass(mesh) {
    if (state.glassOriginals.has(mesh)) return;
    state.glassOriginals.set(mesh, {
      material:mesh.material,
      enabled:mesh.isEnabled?.() !== false,
      isVisible:mesh.isVisible,
      visibility:mesh.visibility,
      isPickable:mesh.isPickable,
      checkCollisions:mesh.checkCollisions,
      renderingGroupId:mesh.renderingGroupId,
      alphaIndex:mesh.alphaIndex,
      metadata:{ ...(mesh.metadata || {}) }
    });
  }

  function applyGlass(mesh, index) {
    if (!mesh || excludedGlass(mesh)) return false;
    preserveGlass(mesh);
    try { mesh.setEnabled?.(true); } catch (_) {}
    mesh.material = globalGlassMaterial();
    mesh.isVisible = true;
    mesh.visibility = 1;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.receiveShadows = false;
    mesh.alwaysSelectAsActiveMesh = false;
    mesh.renderingGroupId = 2;
    mesh.alphaIndex = 120 + (index % 80);
    mesh.metadata = {
      ...(mesh.metadata || {}),
      globalClearGlassV304R5:true,
      glassColorV304R5:'#a9dce6',
      frontBackVisible:true
    };
    return true;
  }

  function processGlassBatch(candidates, start = 0) {
    if (!state.scene) return;
    const end = Math.min(candidates.length, start + GLASS_BATCH_SIZE);
    for (let index = start; index < end; index += 1) {
      if (applyGlass(candidates[index], index)) state.glassConverted += 1;
    }
    if (end < candidates.length) {
      state.batchTimer = window.setTimeout(() => processGlassBatch(candidates, end), 16);
      return;
    }
    state.batchTimer = null;
    updateAudit();
  }

  function normalizeGlass() {
    if (!state.scene) return;
    // Dentro de Quest XR, R4 conserva el material optimizado y sus barandas. R5 cubre browser, desktop y la restauración al salir.
    if (questDetected() && currentXRState() === XR_STATE.IN_XR) return;
    const candidates = [...(state.scene.meshes || [])].filter(mesh => isGlassCandidate(mesh) && !excludedGlass(mesh));
    state.glassCandidates = candidates.length;
    state.glassConverted = 0;
    if (state.batchTimer) window.clearTimeout(state.batchTimer);
    processGlassBatch(candidates, 0);
  }

  function isSeasonalBoardSource(mesh) {
    if (!mesh || typeof mesh.getBoundingInfo !== 'function') return false;
    const metadata = metadataChain(mesh);
    const text = nameChain(mesh);
    if (metadata.globalBoardFaceV304R5 === true || metadata.globalBoardSourceV304R5 === true) return false;
    return Boolean(
      metadata.seasonalBoard === true ||
      metadata.livePanelKey === 'season-current-v304' ||
      metadata.livePanelKey === 'pr-celebration-v304' ||
      metadata.livePanelKey === 'four-seasons-v304' ||
      /Cartel (?:estación actual|celebración Puerto Rico|cuatro estaciones) V304/i.test(text)
    );
  }

  function localBoardDimensions(mesh) {
    try {
      const box = mesh.getBoundingInfo().boundingBox;
      return {
        width:Math.max(1, Math.abs(box.maximum.x - box.minimum.x)),
        height:Math.max(1, Math.abs(box.maximum.y - box.minimum.y))
      };
    } catch (_) { return { width:13.5, height:6.3 }; }
  }

  function absolutePosition(mesh) {
    try {
      mesh.computeWorldMatrix?.(true);
      return mesh.getAbsolutePosition?.().clone?.() || mesh.absolutePosition?.clone?.() || mesh.position.clone();
    } catch (_) { return mesh.position?.clone?.() || new B.Vector3(0, 3, 0); }
  }

  function normalizeTexture(texture) {
    if (!texture) return;
    texture.uScale = Math.abs(Number(texture.uScale || 1));
    texture.vScale = Math.abs(Number(texture.vScale || 1));
    texture.uOffset = Number(texture.uOffset || 0);
    texture.vOffset = Number(texture.vOffset || 0);
    texture.uAng = 0;
    texture.vAng = 0;
    texture.wAng = 0;
  }

  function boardMaterial(source, suffix) {
    const original = source.material;
    const material = original?.clone?.(`material cartel global R5 ${suffix}`) || new B.StandardMaterial(`material cartel global R5 ${suffix}`, state.scene);
    material.diffuseTexture = original?.diffuseTexture || material.diffuseTexture;
    material.emissiveTexture = original?.emissiveTexture || material.emissiveTexture;
    material.opacityTexture = original?.opacityTexture || material.opacityTexture;
    normalizeTexture(material.diffuseTexture);
    normalizeTexture(material.emissiveTexture);
    normalizeTexture(material.opacityTexture);
    material.backFaceCulling = true;
    material.disableLighting = true;
    material.alpha = 1;
    return material;
  }

  function openBoardFace(face, panelKey) {
    const metadata = face.metadata || {};
    const previous = metadata.livePanelKey;
    metadata.livePanelKey = panelKey;
    try { window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.openPanelByMesh?.(face); }
    finally {
      if (previous == null) delete metadata.livePanelKey;
      else metadata.livePanelKey = previous;
    }
  }

  function createBoardFace(source, snapshot, position, width, height, angle, offsetSign, suffix) {
    const face = B.MeshBuilder.CreatePlane(`Panel global legible R5 ${snapshot.panelKey || snapshot.originalName} ${suffix}`, {
      width,
      height,
      sideOrientation:B.Mesh.FRONTSIDE
    }, state.scene);
    face.parent = null;
    face.position.copyFrom(position);
    const normal = new B.Vector3(Math.sin(angle), 0, Math.cos(angle));
    face.position.addInPlace(normal.scale(0.035 * offsetSign));
    face.rotationQuaternion = null;
    face.rotation.set(0, angle, 0);
    face.billboardMode = B.Mesh.BILLBOARDMODE_NONE;
    face.material = boardMaterial(source, suffix);
    face.isPickable = true;
    face.checkCollisions = false;
    face.alwaysSelectAsActiveMesh = false;
    face.renderingGroupId = 3;
    face.alphaIndex = 340;
    face.metadata = {
      ...snapshot.metadata,
      livePanelKey:undefined,
      seasonalBoard:true,
      readableSign:true,
      globalBoardFaceV304R5:true,
      frontSideOnly:true,
      noBacksideMirroring:true,
      uprightOrientation:true,
      originalPanelKeyV304R5:snapshot.panelKey,
      side:suffix
    };
    delete face.metadata.livePanelKey;
    if (B.ActionManager && B.ExecuteCodeAction) {
      face.actionManager = new B.ActionManager(state.scene);
      face.actionManager.registerAction(new B.ExecuteCodeAction(B.ActionManager.OnPickTrigger, () => openBoardFace(face, snapshot.panelKey)));
    }
    return face;
  }

  function replaceBoard(source) {
    if (!source || state.boardSources.has(source)) return false;
    const metadata = { ...(source.metadata || {}) };
    const panelKey = metadata.livePanelKey || metadata.livePanelKeyV304 || String(source.name || 'cartel-v304-r5');
    const snapshot = {
      originalName:String(source.name || ''),
      panelKey,
      metadata,
      enabled:source.isEnabled?.() !== false,
      isVisible:source.isVisible,
      visibility:source.visibility,
      isPickable:source.isPickable
    };
    const { width, height } = localBoardDimensions(source);
    const position = absolutePosition(source);
    const towardCenter = Math.atan2(-position.x, -position.z);
    const first = createBoardFace(source, snapshot, position, width, height, towardCenter, 1, 'hacia centro');
    const second = createBoardFace(source, snapshot, position, width, height, towardCenter + Math.PI, 1, 'hacia exterior');

    state.boardSources.set(source, snapshot);
    state.boardFaces.set(source, [first, second]);
    source.name = `Fuente oculta cartel global R5 ${state.boardSources.size}`;
    source.metadata = {
      ...metadata,
      globalBoardSourceV304R5:true,
      originalNameV304R5:snapshot.originalName,
      originalPanelKeyV304R5:panelKey
    };
    delete source.metadata.livePanelKey;
    delete source.metadata.seasonalBoard;
    delete source.metadata.readableSign;
    try { source.setEnabled?.(false); } catch (_) {}
    source.isVisible = false;
    source.visibility = 0;
    source.isPickable = false;
    return true;
  }

  function normalizeBoards() {
    if (!state.scene) return;
    const sources = [...(state.scene.meshes || [])].filter(isSeasonalBoardSource).slice(0, BOARD_SCAN_LIMIT);
    for (const source of sources) replaceBoard(source);
    state.boardsFixed = state.boardSources.size;
    state.boardFacesCreated = [...state.boardFaces.values()].reduce((total, faces) => total + faces.length, 0);
    maintainBoards();
    updateAudit();
  }

  function maintainBoards() {
    for (const [source, faces] of state.boardFaces) {
      try {
        source.setEnabled?.(false);
        source.isVisible = false;
        source.visibility = 0;
      } catch (_) {}
      for (const face of faces) {
        try {
          face.setEnabled?.(true);
          face.isVisible = true;
          face.visibility = 1;
          face.rotation.x = 0;
          face.rotation.z = 0;
          face.billboardMode = B.Mesh.BILLBOARDMODE_NONE;
        } catch (_) {}
      }
    }
    // Oculta reemplazos antiguos R4 que puedan crearse durante la transición XR; R5 conserva sus dos caras globales.
    for (const mesh of [...(state.scene?.meshes || [])]) {
      if (mesh?.metadata?.holidayBoardPuertoRicoV304R4 !== true) continue;
      try { mesh.setEnabled?.(false); } catch (_) {}
      mesh.isVisible = false;
      mesh.visibility = 0;
    }
  }

  function runMaintenance() {
    try {
      state.scans += 1;
      normalizeBoards();
      normalizeGlass();
      maintainBoards();
      updateAudit();
    } catch (error) { recordError('maintenance-r5', error); }
  }

  function updateAudit() {
    window.__UCAN_GLOBAL_VISUAL_V304_R5__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      browserGlassCorrected:true,
      questGlassCompatibilityPreserved:true,
      glassColor:'#a9dce6',
      glassAlpha:0.52,
      glassLightingIndependent:true,
      glassDepthPrePassDisabled:true,
      glassDepthWriteDisabled:true,
      seasonalBoardsTwoFrontFaces:true,
      seasonalBoardsBacksideMirroringDisabled:true,
      seasonalBoardsBillboardDisabled:true,
      seasonalBoardsUpright:true,
      seasonalBoardsAllEnvironments:true,
      glassCandidates:state.glassCandidates,
      glassConverted:state.glassConverted,
      boardsFixed:state.boardsFixed,
      boardFacesCreated:state.boardFacesCreated,
      scans:state.scans,
      lastError:state.lastError,
      refresh:runMaintenance,
      getState:() => ({
        installed:state.installed,
        glassCandidates:state.glassCandidates,
        glassConverted:state.glassConverted,
        boardsFixed:state.boardsFixed,
        boardFacesCreated:state.boardFacesCreated,
        scans:state.scans,
        lastError:state.lastError
      })
    };
  }

  function install() {
    if (state.installed || !helperReady()) return false;
    const ecosystemReady = window.__UCAN_SEASONAL_ECOSYSTEM_V304__?.installed === true ||
      (state.scene.meshes || []).some(mesh => /Cartel (?:estación actual|celebración Puerto Rico|cuatro estaciones) V304/i.test(String(mesh?.name || '')));
    if (!ecosystemReady) return false;
    state.installed = true;
    runMaintenance();
    window.setTimeout(runMaintenance, 700);
    window.setTimeout(runMaintenance, 1800);
    window.setTimeout(runMaintenance, 4200);
    state.maintenanceTimer = window.setInterval(runMaintenance, MAINTENANCE_MS);
    state.helper?.baseExperience?.onStateChangedObservable?.add?.(xrState => {
      if (xrState === XR_STATE.NOT_IN_XR) window.setTimeout(runMaintenance, 250);
      else if (xrState === XR_STATE.IN_XR) window.setTimeout(() => { normalizeBoards(); maintainBoards(); }, 1000);
    });
    console.info(`[UCAN ${VERSION} ${REVISION}] Cristal global claro y carteles frontales instalados.`);
    updateAudit();
    return true;
  }

  let attempts = 0;
  const bootTimer = window.setInterval(() => {
    attempts += 1;
    if (install() || attempts >= 420) window.clearInterval(bootTimer);
  }, 100);

  updateAudit();
})();