(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V313';
  const REVISION = 'R17';
  const BUILD = 'V313-20260729-PARALLEL-CANONICAL-SCENE-R17';
  const LEVEL = Object.freeze({ three:16.4, roof:27.2 });
  const STAIR = Object.freeze({ minX:40.8, maxX:47.2, bottomZ:39.0, topZ:10.5 });
  const ALL_LAYERS = 0x0fffffff;
  const GLASS_VISIBILITY = 0.46;
  const REPAIR_INTERVAL_MS = 220;
  const CAPTURE_DELAY_MS = 2600;

  const ZONES = Object.freeze({
    floor3RearBottom:{ minX:35.5, maxX:52.5, minY:15.10, maxY:22.70, minZ:36.5, maxZ:51.0 },
    rooftopRearTop:{ minX:35.5, maxX:52.5, minY:24.70, maxY:31.70, minZ:2.5, maxZ:15.0 }
  });

  const state = {
    scene:null,
    helper:null,
    installed:false,
    inXR:false,
    xrMode:'browser',
    glassMaterial:null,
    metalMaterial:null,
    floorMaterial:null,
    converted:new Map(),
    hidden:new Map(),
    generated:[],
    railMeshes:[],
    terraceMeshes:[],
    canonical:new Map(),
    canonicalReady:false,
    canonicalHash:'',
    currentHash:'',
    captures:0,
    repairPasses:0,
    repairedProperties:0,
    currentDeviations:0,
    convertedGlass:0,
    hiddenLegacyGeometry:0,
    hiddenRearRails:0,
    hiddenCentralTerrace:0,
    canonicalRailMeshes:0,
    canonicalTerracePanels:0,
    lastRepairAt:0,
    lastError:null
  };

  function metadataChain(mesh) {
    const merged = {};
    let current = mesh;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parent) Object.assign(merged, current.metadata || {});
    return merged;
  }

  function nameChain(mesh) {
    const values = [];
    let current = mesh;
    for (let depth = 0; current && depth < 10; depth += 1, current = current.parent) values.push(String(current.name || ''));
    return values.join(' ');
  }

  function worldBounds(mesh) {
    try {
      mesh.computeWorldMatrix?.(true);
      const box = mesh.getBoundingInfo?.().boundingBox;
      if (!box) return null;
      return {
        minX:box.minimumWorld.x, maxX:box.maximumWorld.x,
        minY:box.minimumWorld.y, maxY:box.maximumWorld.y,
        minZ:box.minimumWorld.z, maxZ:box.maximumWorld.z
      };
    } catch (_) { return null; }
  }

  function intersects(bounds, zone) {
    return Boolean(bounds && zone &&
      bounds.maxX >= zone.minX && bounds.minX <= zone.maxX &&
      bounds.maxY >= zone.minY && bounds.minY <= zone.maxY &&
      bounds.maxZ >= zone.minZ && bounds.minZ <= zone.maxZ);
  }

  function enabled(mesh) {
    try { return mesh?.isEnabled?.() !== false; }
    catch (_) { return true; }
  }

  function isCentralTerrace(mesh, bounds) {
    const metadata = metadataChain(mesh);
    const text = nameChain(mesh);
    return Boolean(
      metadata.centralTerraceFeature === true ||
      /tragaluz|baranda tragaluz rooftop|marco.*centro.*terraza|cristal.*centro.*terraza|centro.*cristal/i.test(text)
    ) && intersects(bounds, { minX:-35,maxX:35,minY:25,maxY:31.8,minZ:-22,maxZ:23 });
  }

  function isRearRailing(mesh, bounds) {
    const metadata = metadataChain(mesh);
    const text = nameChain(mesh);
    const rail = metadata.rooftopStairGuard === true || metadata.stairRail === true || /baranda|pasamanos|railing|handrail|guard ?rail|riel/i.test(text);
    return rail && (intersects(bounds, ZONES.floor3RearBottom) || intersects(bounds, ZONES.rooftopRearTop));
  }

  function isLegacyModeGeometry(mesh) {
    if (!mesh || mesh.metadata?.parallelCanonicalV313) return false;
    const metadata = metadataChain(mesh);
    const text = nameChain(mesh);
    return Boolean(
      metadata.vrCanonicalV312 === true ||
      metadata.rooftopStairRail === true || metadata.rooftopStairGuard === true ||
      metadata.questCorrectedStairRailV301 === true || metadata.questCorrectedStairRailV304R4 === true ||
      metadata.questSolidFloorV301 === true ||
      /terraza canónica VR V312|escalera VR canónica V312|baranda lateral escalera terraza|pasamanos escalera terraza|baranda hueco escalera terraza|pasamanos superior escalera Quest V301|riel inferior escalera Quest V301|poste baranda escalera Quest V301|poste lateral R4|pasamanos lateral R4|riel lateral R4|superficie translúcida lateral R4/i.test(text)
    );
  }

  function isGlassLike(mesh) {
    if (!mesh || typeof mesh.getBoundingInfo !== 'function') return false;
    const metadata = metadataChain(mesh);
    const text = `${nameChain(mesh)} ${String(mesh.material?.name || '')}`;
    const alpha = Number(mesh.material?.alpha ?? 1);
    return Boolean(
      metadata.glass === true || metadata.glassPanel === true || metadata.stairGlassPanel === true ||
      /cristal|glass|vidrio|mampara/i.test(text) ||
      (alpha < 0.97 && /baranda|panel|puerta|ventana|railing|guard/i.test(text))
    );
  }

  function isDynamicMesh(mesh) {
    const metadata = metadataChain(mesh);
    const text = nameChain(mesh);
    return Boolean(
      metadata.avatar === true || metadata.local === true || metadata.remoteAvatarV312 === true || metadata.remoteAvatarV313 === true ||
      metadata.realtimeWorldV312 === true || metadata.parallelWorldV313 === true || metadata.dynamicSharedV313 === true ||
      metadata.skyObject === true || metadata.celestialObject === true || metadata.celestialSky === true || metadata.weatherParticle === true ||
      metadata.seasonal === true || metadata.boardScreen === true || metadata.livePanelDynamic === true ||
      /avatar|burbuja|foco compartido|nube|lluvia|nieve|partícula|particula|sol visual|luna visual|estrella|planeta|cometa|\biss\b|satélite|satelite|pantalla pizarra|pizarra electrónica|pizarra electronica|video dinámico|video dinamico/i.test(text)
    );
  }

  function hide(mesh, reason) {
    if (!mesh || mesh.metadata?.parallelCanonicalV313 || state.hidden.has(mesh)) return false;
    state.hidden.set(mesh, {
      enabled:enabled(mesh),
      isVisible:mesh.isVisible,
      visibility:mesh.visibility,
      isPickable:mesh.isPickable,
      checkCollisions:mesh.checkCollisions,
      reason
    });
    try { mesh.setEnabled?.(false); } catch (_) {}
    mesh.isVisible = false;
    mesh.visibility = 0;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.metadata = { ...(mesh.metadata || {}), hiddenByParallelSceneV313:true, parallelSceneReasonV313:reason };
    return true;
  }

  function glassMaterial() {
    if (state.glassMaterial && !state.glassMaterial.isDisposed?.()) return state.glassMaterial;
    const material = new B.StandardMaterial('cristal canónico paralelo V313', state.scene);
    material.diffuseColor = B.Color3.FromHexString('#b8e2ea');
    material.emissiveColor = B.Color3.FromHexString('#315d66').scale(0.20);
    material.specularColor = B.Color3.FromHexString('#e8fbff');
    material.specularPower = 48;
    material.alpha = 0.965;
    material.backFaceCulling = false;
    material.disableDepthWrite = true;
    material.forceDepthWrite = false;
    material.transparencyMode = B.Material?.MATERIAL_ALPHABLEND ?? 2;
    state.glassMaterial = material;
    return material;
  }

  function metalMaterial() {
    if (state.metalMaterial && !state.metalMaterial.isDisposed?.()) return state.metalMaterial;
    const material = new B.StandardMaterial('metal canónico paralelo V313', state.scene);
    material.diffuseColor = B.Color3.FromHexString('#54666b');
    material.emissiveColor = B.Color3.FromHexString('#1d292c').scale(0.18);
    material.specularColor = B.Color3.FromHexString('#b9c7ca');
    material.specularPower = 44;
    state.metalMaterial = material;
    return material;
  }

  function floorMaterial() {
    if (state.floorMaterial && !state.floorMaterial.isDisposed?.()) return state.floorMaterial;
    const material = new B.StandardMaterial('piso terraza canónico paralelo V313', state.scene);
    material.diffuseColor = B.Color3.FromHexString('#9b9c91');
    material.emissiveColor = B.Color3.FromHexString('#262822').scale(0.08);
    material.specularColor = B.Color3.Black();
    state.floorMaterial = material;
    return material;
  }

  function convertGlass(mesh) {
    if (!mesh || mesh.metadata?.parallelCanonicalV313 || state.converted.has(mesh)) return false;
    const bounds = worldBounds(mesh);
    if (isCentralTerrace(mesh, bounds) || isRearRailing(mesh, bounds)) return false;
    state.converted.set(mesh, {
      material:mesh.material,
      enabled:enabled(mesh),
      isVisible:mesh.isVisible,
      visibility:mesh.visibility,
      isPickable:mesh.isPickable,
      checkCollisions:mesh.checkCollisions
    });
    try { mesh.setEnabled?.(true); } catch (_) {}
    mesh.material = glassMaterial();
    mesh.isVisible = true;
    mesh.visibility = GLASS_VISIBILITY;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.alwaysSelectAsActiveMesh = false;
    mesh.receiveShadows = false;
    mesh.renderingGroupId = 3;
    mesh.layerMask = ALL_LAYERS;
    mesh.metadata = { ...(mesh.metadata || {}), parallelGlassV313:true, frontBackVisible:true };
    state.convertedGlass += 1;
    return true;
  }

  function stairGroundAtZ(z) {
    const progress = Math.max(0, Math.min(1, (STAIR.bottomZ - z) / (STAIR.bottomZ - STAIR.topZ)));
    return LEVEL.three + (LEVEL.roof - LEVEL.three) * progress;
  }

  function trackGenerated(mesh, metadata = {}) {
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.alwaysSelectAsActiveMesh = false;
    mesh.layerMask = ALL_LAYERS;
    mesh.metadata = { ...(mesh.metadata || {}), parallelCanonicalV313:true, sameInEveryEnvironment:true, ...metadata };
    state.generated.push(mesh);
    return mesh;
  }

  function buildRailSide(x, side) {
    const metal = metalMaterial();
    const glass = glassMaterial();
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
        const post = B.MeshBuilder.CreateCylinder(`poste escalera paralelo V313 ${side} ${index}`, { diameter:0.13, height:1.30, tessellation:10 }, state.scene);
        post.position.set(x, ground + 0.65, z);
        post.material = metal;
        trackGenerated(post, { stairRail:true, stairRailPost:true, side });
        state.railMeshes.push(post);
      }
    }

    const top = B.MeshBuilder.CreateTube(`pasamanos escalera paralelo V313 ${side}`, { path:topPath, radius:0.072, tessellation:10, cap:B.Mesh.CAP_ALL }, state.scene);
    top.material = metal;
    trackGenerated(top, { stairRail:true, stairTopRail:true, side });
    state.railMeshes.push(top);

    const middle = B.MeshBuilder.CreateTube(`riel escalera paralelo V313 ${side}`, { path:middlePath, radius:0.045, tessellation:9, cap:B.Mesh.CAP_ALL }, state.scene);
    middle.material = metal;
    trackGenerated(middle, { stairRail:true, stairLowerRail:true, side });
    state.railMeshes.push(middle);

    for (let index = 0; index < segments; index += 1) {
      const z1 = STAIR.bottomZ - index * depth;
      const z2 = STAIR.bottomZ - (index + 1) * depth;
      const z = (z1 + z2) / 2;
      const ground = stairGroundAtZ(z);
      const pane = B.MeshBuilder.CreateBox(`cristal escalera paralelo V313 ${side} ${index}`, { width:0.065, height:0.76, depth:depth * 0.88 }, state.scene);
      pane.position.set(x, ground + 0.83, z);
      pane.material = glass;
      pane.visibility = GLASS_VISIBILITY;
      pane.renderingGroupId = 3;
      pane.alphaIndex = 260 + index;
      trackGenerated(pane, { stairRail:true, stairGlassPanel:true, frontBackVisible:true, side });
      state.railMeshes.push(pane);
    }
  }

  function buildCanonicalStairs() {
    if (state.railMeshes.some(mesh => !mesh.isDisposed?.())) return;
    buildRailSide(STAIR.minX + 0.34, 'oeste');
    buildRailSide(STAIR.maxX - 0.34, 'este');
    state.canonicalRailMeshes = state.railMeshes.length;
  }

  function createTerracePanel(name, x1, x2, z1, z2) {
    const mesh = B.MeshBuilder.CreateBox(name, { width:x2-x1, height:0.08, depth:z2-z1 }, state.scene);
    mesh.position.set((x1+x2)/2, LEVEL.roof + 0.04, (z1+z2)/2);
    mesh.material = floorMaterial();
    mesh.receiveShadows = false;
    trackGenerated(mesh, { walkable:true, teleportable:true, rooftop:true, parallelTerraceFloorV313:true });
    state.terraceMeshes.push(mesh);
  }

  function buildCanonicalTerrace() {
    if (state.terraceMeshes.some(mesh => !mesh.isDisposed?.())) return;
    createTerracePanel('terraza paralela V313 oeste', -72, STAIR.minX, -60, 60);
    createTerracePanel('terraza paralela V313 este', STAIR.maxX, 72, -60, 60);
    createTerracePanel('terraza paralela V313 sur', STAIR.minX, STAIR.maxX, -60, 9.0);
    createTerracePanel('terraza paralela V313 norte', STAIR.minX, STAIR.maxX, 40.5, 60);
    state.canonicalTerracePanels = state.terraceMeshes.length;
  }

  function applyVrReferenceToEveryMode() {
    if (!state.scene) return;
    for (const mesh of [...(state.scene.meshes || [])]) {
      if (!mesh || mesh.isDisposed?.() || mesh.metadata?.parallelCanonicalV313) continue;
      const bounds = worldBounds(mesh);
      if (isCentralTerrace(mesh, bounds)) {
        if (hide(mesh, 'central-terrace-feature')) state.hiddenCentralTerrace += 1;
        continue;
      }
      if (isRearRailing(mesh, bounds)) {
        if (hide(mesh, 'rear-stair-railing')) state.hiddenRearRails += 1;
        continue;
      }
      if (isLegacyModeGeometry(mesh)) {
        if (hide(mesh, 'legacy-mode-geometry')) state.hiddenLegacyGeometry += 1;
        continue;
      }
      if (isGlassLike(mesh)) convertGlass(mesh);
    }
    buildCanonicalStairs();
    buildCanonicalTerrace();
    for (const mesh of state.generated) {
      if (!mesh || mesh.isDisposed?.()) continue;
      mesh.setEnabled?.(true);
      mesh.isVisible = true;
      mesh.visibility = mesh.metadata?.stairGlassPanel ? GLASS_VISIBILITY : 1;
      mesh.layerMask = ALL_LAYERS;
    }
  }

  function snapshotMesh(mesh) {
    return {
      mesh,
      enabled:enabled(mesh),
      isVisible:mesh.isVisible !== false,
      visibility:Number(mesh.visibility ?? 1),
      material:mesh.material || null,
      layerMask:Number(mesh.layerMask ?? ALL_LAYERS),
      isPickable:Boolean(mesh.isPickable),
      checkCollisions:Boolean(mesh.checkCollisions),
      receiveShadows:Boolean(mesh.receiveShadows),
      renderingGroupId:Number(mesh.renderingGroupId || 0),
      alphaIndex:Number(mesh.alphaIndex || 0),
      billboardMode:Number(mesh.billboardMode || 0)
    };
  }

  function hashRecords(records, current = false) {
    let hash = 2166136261;
    const append = value => {
      const text = String(value);
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
      }
    };
    for (const [id, record] of [...records.entries()].sort((a,b) => Number(a[0]) - Number(b[0]))) {
      const mesh = record.mesh;
      if (!mesh || mesh.isDisposed?.()) continue;
      append(id);
      append(current ? enabled(mesh) : record.enabled);
      append(current ? mesh.isVisible !== false : record.isVisible);
      append((current ? Number(mesh.visibility ?? 1) : record.visibility).toFixed(4));
      append(current ? mesh.material?.uniqueId || 0 : record.material?.uniqueId || 0);
      append(current ? Number(mesh.layerMask ?? ALL_LAYERS) : record.layerMask);
      append(current ? Boolean(mesh.isPickable) : record.isPickable);
      append(current ? Boolean(mesh.checkCollisions) : record.checkCollisions);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function captureCanonical() {
    if (!state.scene) return false;
    applyVrReferenceToEveryMode();
    const records = new Map();
    for (const mesh of state.scene.meshes || []) {
      if (!mesh || mesh.isDisposed?.() || isDynamicMesh(mesh)) continue;
      records.set(mesh.uniqueId, snapshotMesh(mesh));
    }
    state.canonical = records;
    state.canonicalReady = records.size > 0;
    state.canonicalHash = hashRecords(records, false);
    state.currentHash = hashRecords(records, true);
    state.captures += 1;
    updateAudit();
    return state.canonicalReady;
  }

  function restoreRecord(record) {
    const mesh = record.mesh;
    if (!mesh || mesh.isDisposed?.()) return 0;
    let repairs = 0;
    try {
      if (enabled(mesh) !== record.enabled) { mesh.setEnabled?.(record.enabled); repairs += 1; }
      if ((mesh.isVisible !== false) !== record.isVisible) { mesh.isVisible = record.isVisible; repairs += 1; }
      if (Math.abs(Number(mesh.visibility ?? 1) - record.visibility) > 0.0001) { mesh.visibility = record.visibility; repairs += 1; }
      if (mesh.material !== record.material) { mesh.material = record.material; repairs += 1; }
      if (Number(mesh.layerMask ?? ALL_LAYERS) !== record.layerMask) { mesh.layerMask = record.layerMask; repairs += 1; }
      if (Boolean(mesh.isPickable) !== record.isPickable) { mesh.isPickable = record.isPickable; repairs += 1; }
      if (Boolean(mesh.checkCollisions) !== record.checkCollisions) { mesh.checkCollisions = record.checkCollisions; repairs += 1; }
      if (Boolean(mesh.receiveShadows) !== record.receiveShadows) { mesh.receiveShadows = record.receiveShadows; repairs += 1; }
      if (Number(mesh.renderingGroupId || 0) !== record.renderingGroupId) { mesh.renderingGroupId = record.renderingGroupId; repairs += 1; }
      if (Number(mesh.alphaIndex || 0) !== record.alphaIndex) { mesh.alphaIndex = record.alphaIndex; repairs += 1; }
      if (Number(mesh.billboardMode || 0) !== record.billboardMode) { mesh.billboardMode = record.billboardMode; repairs += 1; }
    } catch (_) {}
    return repairs;
  }

  function repairCanonical(force = false) {
    if (!state.canonicalReady || !state.scene) return 0;
    const now = performance.now();
    if (!force && now - state.lastRepairAt < REPAIR_INTERVAL_MS) return 0;
    state.lastRepairAt = now;
    let repairs = 0;
    for (const record of state.canonical.values()) repairs += restoreRecord(record);
    state.repairPasses += 1;
    state.repairedProperties += repairs;
    state.currentDeviations = repairs;
    state.currentHash = hashRecords(state.canonical, true);
    updateAudit();
    return repairs;
  }

  function currentMode() {
    const xrState = state.helper?.baseExperience?.state;
    const XR = B.WebXRState || {};
    const active = xrState === XR.ENTERING_XR || xrState === XR.IN_XR;
    if (!active) return 'browser';
    return state.xrMode || 'vr';
  }

  function updateAudit() {
    window.__UCAN_PARALLEL_SCENE_V313__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      authoritativeEnvironment:'VR reference applied globally',
      oneBabylonScene:true,
      sameSceneBrowserMobileVrMr:true,
      sameGeometryEveryEnvironment:true,
      sameMaterialsEveryEnvironment:true,
      sameVisibilityEveryEnvironment:true,
      sameFloor3StairsEveryEnvironment:true,
      modeSpecificGeometryAllowed:false,
      modeSpecificMaterialReplacementAllowed:false,
      modeSpecificMeshHidingAllowed:false,
      currentMode:currentMode(),
      inXR:state.inXR,
      canonicalReady:state.canonicalReady,
      canonicalMeshCount:state.canonical.size,
      canonicalHash:state.canonicalHash,
      currentHash:state.currentHash,
      hashesMatch:Boolean(state.canonicalHash && state.canonicalHash === state.currentHash),
      captures:state.captures,
      repairPasses:state.repairPasses,
      repairedProperties:state.repairedProperties,
      currentDeviations:state.currentDeviations,
      convertedGlass:state.convertedGlass,
      hiddenLegacyGeometry:state.hiddenLegacyGeometry,
      hiddenRearRails:state.hiddenRearRails,
      hiddenCentralTerrace:state.hiddenCentralTerrace,
      canonicalRailMeshes:state.canonicalRailMeshes,
      canonicalTerracePanels:state.canonicalTerracePanels,
      lastError:state.lastError,
      capture:captureCanonical,
      repair:() => repairCanonical(true),
      refresh:() => { applyVrReferenceToEveryMode(); captureCanonical(); return repairCanonical(true); },
      getState:() => ({
        installed:state.installed,
        currentMode:currentMode(),
        oneBabylonScene:true,
        sameGeometryEveryEnvironment:true,
        sameFloor3StairsEveryEnvironment:true,
        canonicalReady:state.canonicalReady,
        canonicalMeshCount:state.canonical.size,
        canonicalHash:state.canonicalHash,
        currentHash:state.currentHash,
        hashesMatch:Boolean(state.canonicalHash && state.canonicalHash === state.currentHash),
        canonicalRailMeshes:state.canonicalRailMeshes,
        canonicalTerracePanels:state.canonicalTerracePanels,
        currentDeviations:state.currentDeviations,
        lastError:state.lastError
      })
    };
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    state.helper = window.__UCAN_XR_HELPER__ || null;
    if (!state.scene) return false;

    window.__UCAN_DISABLE_MODE_SPECIFIC_VISUALS_V313__ = true;
    window.__UCAN_DISABLE_STRICT_PARITY_V309__ = true;
    window.__UCAN_DISABLE_VR_CANONICAL_V312__ = true;
    state.installed = true;
    applyVrReferenceToEveryMode();

    window.setTimeout(() => {
      try { captureCanonical(); repairCanonical(true); }
      catch (error) {
        state.lastError = { stage:'capture', message:String(error?.message || error), at:new Date().toISOString() };
        updateAudit();
      }
    }, CAPTURE_DELAY_MS);

    state.scene.onBeforeRenderObservable.add(() => {
      try { repairCanonical(false); }
      catch (error) {
        state.lastError = { stage:'repair', message:String(error?.message || error), at:new Date().toISOString() };
        updateAudit();
      }
    });

    const bindHelper = () => {
      state.helper = window.__UCAN_XR_HELPER__ || state.helper;
      const observable = state.helper?.baseExperience?.onStateChangedObservable;
      if (!observable || observable.__ucanParallelSceneV313Bound) return;
      observable.__ucanParallelSceneV313Bound = true;
      observable.add(value => {
        const XR = B.WebXRState || {};
        state.inXR = value === XR.ENTERING_XR || value === XR.IN_XR;
        state.xrMode = window.__UCAN_XR_ENTRY_V313__?.activeMode || (state.inXR ? 'vr' : 'browser');
        window.setTimeout(() => repairCanonical(true), 0);
        window.setTimeout(() => repairCanonical(true), 150);
        window.setTimeout(() => repairCanonical(true), 900);
        updateAudit();
      });
    };
    bindHelper();
    window.setInterval(bindHelper, 500);
    window.setInterval(() => {
      applyVrReferenceToEveryMode();
      if (!state.canonicalReady) captureCanonical();
      repairCanonical(true);
    }, 1800);

    window.__UCAN_API__?.setStatus?.('V313: browser, móvil, VR y MR usan una sola escena canónica sin geometría por dispositivo.');
    console.info('[UCAN V313 R17] Escena paralela canónica instalada para todos los entornos.');
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
