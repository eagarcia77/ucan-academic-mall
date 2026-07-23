(() => {
  'use strict';

  const VERSION = 'V305';
  const BUILD = 'V305-20260723-ECOSYSTEM-VISIBILITY-ENTRY-GARDEN';
  const B = window.BABYLON;
  if (!B) return;

  const state = {
    scene:null,
    root:null,
    baseRoot:null,
    installed:false,
    questMode:false,
    visibleMeshes:0,
    entranceTrees:0,
    entrancePalms:0,
    entranceShrubs:0,
    entranceFlowers:0,
    entranceLights:0,
    boardsRelocated:0,
    baseMeshesForcedVisible:0,
    lastEnsureAt:0,
    lastError:null
  };

  const color = hex => B.Color3.FromHexString(hex);

  function questDetected() {
    const ua = String(navigator.userAgent || '');
    const brands = Array.isArray(navigator.userAgentData?.brands)
      ? navigator.userAgentData.brands.map(item => item?.brand || '').join(' ')
      : '';
    return /OculusBrowser|Meta Quest|Quest 2|Quest 3|Quest Pro/i.test(`${ua} ${brands}`);
  }

  function material(name, diffuse, options = {}) {
    const mat = new B.StandardMaterial(name, state.scene);
    mat.diffuseColor = color(diffuse);
    mat.specularColor = options.specular ? color(options.specular) : new B.Color3(0.03, 0.03, 0.03);
    mat.emissiveColor = options.emissive ? color(options.emissive) : B.Color3.Black();
    mat.alpha = options.alpha == null ? 1 : options.alpha;
    mat.backFaceCulling = options.backFaceCulling !== false;
    if (options.disableLighting) mat.disableLighting = true;
    return mat;
  }

  function track(mesh, metadata = {}) {
    mesh.parent = state.root;
    mesh.checkCollisions = false;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.metadata = {
      ...(mesh.metadata || {}),
      ecosystemV305:true,
      entranceGarden:true,
      decorative:true,
      ...metadata
    };
    state.visibleMeshes += 1;
    return mesh;
  }

  function box(name, position, size, mat) {
    const mesh = B.MeshBuilder.CreateBox(name, { width:size.x, height:size.y, depth:size.z }, state.scene);
    mesh.position.copyFrom(position);
    mesh.material = mat;
    return track(mesh);
  }

  function cylinder(name, position, height, diameter, mat, tessellation = 10) {
    const mesh = B.MeshBuilder.CreateCylinder(name, { height, diameter, tessellation }, state.scene);
    mesh.position.copyFrom(position);
    mesh.material = mat;
    return track(mesh);
  }

  function sphere(name, position, diameter, mat, segments = 8) {
    const mesh = B.MeshBuilder.CreateSphere(name, { diameter, segments }, state.scene);
    mesh.position.copyFrom(position);
    mesh.material = mat;
    return track(mesh);
  }

  function createTree(x, z, scale, mats, flowering = false) {
    const trunkHeight = 4.7 * scale;
    cylinder(`tronco plaza natural V305 ${state.entranceTrees}`, new B.Vector3(x, trunkHeight / 2, z), trunkHeight, 0.58 * scale, mats.trunk, 10);
    const crownY = trunkHeight + 0.85 * scale;
    const crownMat = flowering ? mats.leafBright : mats.leaf;
    const crowns = state.questMode ? [[0,0,3.2],[-1.0,0.1,2.5],[1.0,0.1,2.5]] : [[0,0,3.3],[-1.15,0.1,2.6],[1.15,0.1,2.6],[0,0.75,2.5]];
    crowns.forEach(([dx,dy,d], index) => sphere(`copa plaza natural V305 ${state.entranceTrees}-${index}`, new B.Vector3(x + dx * scale, crownY + dy * scale, z), d * scale, crownMat, 8));
    if (flowering) {
      const count = state.questMode ? 5 : 9;
      for (let i = 0; i < count; i += 1) {
        const angle = i * 2.399;
        sphere(`flor flamboyán plaza V305 ${state.entranceTrees}-${i}`, new B.Vector3(
          x + Math.cos(angle) * (1.0 + (i % 3) * 0.45) * scale,
          crownY + 0.35 * scale + Math.sin(i * 1.31) * 0.5 * scale,
          z + Math.sin(angle) * (1.0 + (i % 3) * 0.45) * scale
        ), 0.38 * scale, mats.flower, 6);
        state.entranceFlowers += 1;
      }
    }
    state.entranceTrees += 1;
  }

  function createPalm(x, z, scale, mats) {
    const height = 5.8 * scale;
    cylinder(`tronco palma plaza V305 ${state.entrancePalms}`, new B.Vector3(x, height / 2, z), height, 0.38 * scale, mats.palmTrunk, 9);
    const leaves = state.questMode ? 5 : 7;
    for (let i = 0; i < leaves; i += 1) {
      const angle = i * Math.PI * 2 / leaves;
      const leaf = B.MeshBuilder.CreateCylinder(`hoja palma plaza V305 ${state.entrancePalms}-${i}`, {
        height:3.2 * scale,
        diameterTop:0.04,
        diameterBottom:0.25 * scale,
        tessellation:6
      }, state.scene);
      leaf.position.set(x + Math.cos(angle) * 1.05 * scale, height + 0.25 * scale, z + Math.sin(angle) * 1.05 * scale);
      leaf.rotation.z = Math.PI / 2.65;
      leaf.rotation.y = -angle;
      leaf.material = mats.leaf;
      track(leaf);
    }
    sphere(`corona palma plaza V305 ${state.entrancePalms}`, new B.Vector3(x, height, z), 0.72 * scale, mats.leafBright, 7);
    state.entrancePalms += 1;
  }

  function createShrub(x, z, scale, mats, flowering = false) {
    sphere(`arbusto plaza natural V305 ${state.entranceShrubs}`, new B.Vector3(x, 0.72 * scale, z), 1.65 * scale, flowering ? mats.leafBright : mats.leaf, 7);
    if (flowering) {
      for (let i = 0; i < 3; i += 1) {
        sphere(`flor arbusto plaza V305 ${state.entranceShrubs}-${i}`, new B.Vector3(x + (i - 1) * 0.42 * scale, 1.12 * scale, z + (i % 2 ? 0.28 : -0.22) * scale), 0.27 * scale, i % 2 ? mats.flower : mats.accent, 5);
        state.entranceFlowers += 1;
      }
    }
    state.entranceShrubs += 1;
  }

  function createGardenLight(x, z, mats) {
    cylinder(`poste luz plaza V305 ${state.entranceLights}`, new B.Vector3(x, 0.62, z), 1.24, 0.10, mats.metal, 8);
    const lamp = sphere(`luz plaza V305 ${state.entranceLights}`, new B.Vector3(x, 1.34, z), 0.27, mats.lamp, 6);
    lamp.material.disableLighting = true;
    state.entranceLights += 1;
  }

  function createEntranceTitle(mats) {
    const texture = new B.DynamicTexture('Rótulo ecosistema visible V305 textura', { width:1400, height:320 }, state.scene, false);
    const ctx = texture.getContext();
    ctx.fillStyle = '#123d2d'; ctx.fillRect(0, 0, 1400, 320);
    ctx.fillStyle = '#f1c232'; ctx.fillRect(0, 0, 1400, 36); ctx.fillRect(0, 284, 1400, 36);
    ctx.strokeStyle = '#f8edbd'; ctx.lineWidth = 10; ctx.strokeRect(12, 12, 1376, 296);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff'; ctx.font = 'bold 74px Arial'; ctx.fillText('ECOSISTEMA NATURAL', 700, 122);
    const season = window.__UCAN_SEASONAL_ECOSYSTEM_V304__?.currentSeasonLabel || 'VERANO';
    ctx.fillStyle = '#ffd44d'; ctx.font = 'bold 50px Arial'; ctx.fillText(`${String(season).toUpperCase()} · PUERTO RICO`, 700, 220);
    texture.update(false);

    const mat = new B.StandardMaterial('Rótulo ecosistema visible V305 material', state.scene);
    mat.diffuseTexture = texture;
    mat.emissiveTexture = texture;
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    const sign = B.MeshBuilder.CreatePlane('Rótulo ecosistema visible desde vestíbulo V305', { width:16.5, height:3.8, sideOrientation:B.Mesh.DOUBLESIDE }, state.scene);
    sign.position.set(0, 6.15, 37.4);
    sign.rotation.set(0, 0, 0);
    sign.material = mat;
    sign.renderingGroupId = 3;
    sign.alphaIndex = 140;
    sign.isPickable = true;
    track(sign, { readableSign:true, livePanel:true, livePanelKey:'ecosystem-entry-v305', title:'Ecosistema natural estacional' });
    sign.actionManager = B.ActionManager && B.ExecuteCodeAction ? new B.ActionManager(state.scene) : null;
    sign.actionManager?.registerAction?.(new B.ExecuteCodeAction(B.ActionManager.OnPickTrigger, () => {
      window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.openPanelByMesh?.(sign);
    }));
    return sign;
  }

  function orientBoardTowardLobby(mesh, position) {
    if (!mesh) return false;
    mesh.billboardMode = B.Mesh.BILLBOARDMODE_NONE;
    mesh.rotationQuaternion = null;
    mesh.position.copyFrom(position);
    mesh.rotation.set(0, 0, 0);
    try { mesh.lookAt(new B.Vector3(position.x, position.y, 60)); } catch (_) {}
    mesh.rotation.x = 0;
    mesh.rotation.z = 0;
    mesh.setEnabled(true);
    mesh.isVisible = true;
    mesh.visibility = 1;
    mesh.isPickable = true;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.renderingGroupId = 3;
    mesh.alphaIndex = 150;
    mesh.metadata = { ...(mesh.metadata || {}), uprightV305:true, visibleFromInitialLobby:true };
    state.boardsRelocated += 1;
    return true;
  }

  function relocateBoards() {
    orientBoardTowardLobby(state.scene.getMeshByName('Cartel estación actual V304'), new B.Vector3(-18, 4.15, 37.2));
    orientBoardTowardLobby(state.scene.getMeshByName('Cartel celebración Puerto Rico V304'), new B.Vector3(18, 4.15, 37.2));
    const four = state.scene.getMeshByName('Cartel cuatro estaciones V304');
    if (four) orientBoardTowardLobby(four, new B.Vector3(48, 3.6, 31.5));
  }

  function forceBaseEcosystemVisible() {
    state.baseRoot = state.scene.getTransformNodeByName?.('Ecosistema natural estacional UCAN V304') || null;
    state.baseRoot?.setEnabled?.(true);
    let visible = 0;
    for (const mesh of state.scene.meshes || []) {
      if (mesh?.metadata?.ecosystemV304 !== true) continue;
      const celebrationOnly = mesh?.metadata?.puertoRicoFlag === true || /guirnalda Puerto Rico/i.test(String(mesh.name || ''));
      if (celebrationOnly) continue;
      try { mesh.setEnabled?.(true); } catch (_) {}
      mesh.isVisible = true;
      mesh.visibility = 1;
      mesh.alwaysSelectAsActiveMesh = true;
      visible += 1;
    }
    state.baseMeshesForcedVisible = visible;
  }

  function buildEntranceGarden() {
    state.root = new B.TransformNode('Plaza natural visible UCAN V305', state.scene);
    const mats = {
      soil:material('tierra jardín visible V305', '#36583b'),
      border:material('borde piedra jardín visible V305', '#777d74'),
      trunk:material('tronco jardín visible V305', '#6d4529'),
      palmTrunk:material('tronco palma jardín visible V305', '#88643d'),
      leaf:material('hoja jardín visible V305', '#237a3b'),
      leafBright:material('hoja brillante jardín visible V305', '#49a857'),
      flower:material('flor roja jardín visible V305', '#f5523b', { emissive:'#30100c' }),
      accent:material('flor amarilla jardín visible V305', '#ffd44d', { emissive:'#332b0b' }),
      metal:material('metal jardín visible V305', '#273331'),
      lamp:material('luz jardín visible V305', '#ffe39a', { emissive:'#ffe39a', disableLighting:true })
    };

    for (const x of [-43, 43]) {
      box(`isla jardín visible V305 ${x}`, new B.Vector3(x, 0.10, 32), new B.Vector3(18, 0.20, 7), mats.soil);
      box(`borde jardín visible V305 ${x} norte`, new B.Vector3(x, 0.25, 35.45), new B.Vector3(18.4, 0.30, 0.25), mats.border);
      box(`borde jardín visible V305 ${x} sur`, new B.Vector3(x, 0.25, 28.55), new B.Vector3(18.4, 0.30, 0.25), mats.border);
      box(`borde jardín visible V305 ${x} oeste`, new B.Vector3(x - 9.08, 0.25, 32), new B.Vector3(0.25, 0.30, 7.0), mats.border);
      box(`borde jardín visible V305 ${x} este`, new B.Vector3(x + 9.08, 0.25, 32), new B.Vector3(0.25, 0.30, 7.0), mats.border);
    }

    createTree(-45, 31.5, 0.88, mats, true);
    createTree(45, 31.5, 0.88, mats, true);
    if (!state.questMode) {
      createPalm(-56, 27.5, 0.78, mats);
      createPalm(56, 27.5, 0.78, mats);
    }
    const shrubs = [-50,-46,-40,-36,36,40,46,50];
    shrubs.forEach((x, index) => createShrub(x, index < 4 ? 33.7 : 33.7, 0.72 + (index % 2) * 0.08, mats, true));
    [-30,-15,0,15,30].forEach(x => createGardenLight(x, 38.8, mats));
    createEntranceTitle(mats);
  }

  function ensureVisible(force = false) {
    const now = performance.now();
    if (!force && now - state.lastEnsureAt < 1000) return;
    state.lastEnsureAt = now;
    state.root?.setEnabled?.(true);
    state.baseRoot?.setEnabled?.(true);
    forceBaseEcosystemVisible();
    relocateBoards();
    updateAudit();
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

  function updateAudit() {
    window.__UCAN_ECOSYSTEM_VISIBILITY_V305__ = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      questMode:state.questMode,
      baseEcosystemVersion:'V304',
      ecosystemRootForcedEnabled:true,
      visibleFromInitialLobby:true,
      entranceGardenEnabled:true,
      entranceGardenClearOfCentralEscalator:true,
      seasonalBoardsRelocatedIntoView:true,
      seasonalBoardsUpright:true,
      seasonalBoardsBillboardDisabled:true,
      entranceTitleVisible:true,
      browserAndQuest:true,
      visibleMeshes:state.visibleMeshes,
      entranceTrees:state.entranceTrees,
      entrancePalms:state.entrancePalms,
      entranceShrubs:state.entranceShrubs,
      entranceFlowers:state.entranceFlowers,
      entranceLights:state.entranceLights,
      boardsRelocated:state.boardsRelocated,
      baseMeshesForcedVisible:state.baseMeshesForcedVisible,
      lastError:state.lastError,
      refresh:() => ensureVisible(true),
      getState:() => ({
        installed:state.installed,
        questMode:state.questMode,
        visibleMeshes:state.visibleMeshes,
        entranceTrees:state.entranceTrees,
        entrancePalms:state.entrancePalms,
        entranceShrubs:state.entranceShrubs,
        entranceFlowers:state.entranceFlowers,
        entranceLights:state.entranceLights,
        boardsRelocated:state.boardsRelocated,
        baseMeshesForcedVisible:state.baseMeshesForcedVisible,
        lastError:state.lastError
      })
    };
  }

  function install(scene) {
    if (state.installed) return;
    state.installed = true;
    state.scene = scene;
    state.questMode = questDetected();
    try {
      forceBaseEcosystemVisible();
      buildEntranceGarden();
      relocateBoards();
      scene.onBeforeRenderObservable.add(() => {
        try { ensureVisible(false); } catch (error) { recordError('ensure-visible', error); }
      });
      window.__UCAN_API__?.setStatus?.('UCAN Academic V305: ecosistema visible desde el vestíbulo y en Meta Quest.');
      updateAudit();
      console.info(`[UCAN ${VERSION}] Ecosistema visible desde el acceso principal.`);
    } catch (error) {
      recordError('install', error);
    }
  }

  function boot(attempt = 0) {
    const scene = window.__UCAN_API__?.getScene?.();
    const baseReady = window.__UCAN_SEASONAL_ECOSYSTEM_V304__?.installed === true;
    if (scene && baseReady) return install(scene);
    if (attempt < 420) window.setTimeout(() => boot(attempt + 1), 100);
    else recordError('boot', new Error('No se encontró la escena principal o el ecosistema V304.'));
  }

  updateAudit();
  boot();
})();
