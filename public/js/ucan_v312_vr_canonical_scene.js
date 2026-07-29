(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V312';
  const REVISION = 'R16';
  const BUILD = 'V312-20260729-VR-CANONICAL-SCENE-R16';
  const LEVEL = Object.freeze({ three:16.4, roof:27.2 });
  const STAIR = Object.freeze({ minX:40.8, maxX:47.2, bottomZ:39.0, topZ:10.5 });
  const ALL_LAYERS = 0x0fffffff;
  const GLASS_VISIBILITY = 0.46;

  const ZONES = Object.freeze({
    floor2EscalatorFront:{ minX:-43.0, maxX:2.0, minY:7.10, maxY:16.25, minZ:4.5, maxZ:43.5 },
    rooftopStair:{ minX:35.5, maxX:52.5, minY:15.15, maxY:31.60, minZ:3.5, maxZ:47.5 },
    floor3RearBottom:{ minX:35.5, maxX:52.5, minY:15.10, maxY:22.70, minZ:36.5, maxZ:51.0 },
    rooftopRearTop:{ minX:35.5, maxX:52.5, minY:24.70, maxY:31.70, minZ:2.5, maxZ:15.0 }
  });

  const state = {
    scene:null,
    installed:false,
    glassMaterial:null,
    metalMaterial:null,
    floorMaterial:null,
    converted:new Map(),
    hidden:new Map(),
    railMeshes:[],
    terraceMeshes:[],
    scans:0,
    convertedGlass:0,
    hiddenLegacyRails:0,
    hiddenRearRails:0,
    hiddenCentralTerrace:0,
    canonicalRailMeshes:0,
    canonicalTerracePanels:0,
    lastError:null
  };

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

  function materialText(mesh) {
    return `${String(mesh?.material?.name || '')} ${String(mesh?.material?.id || '')}`;
  }

  function isGlassLike(mesh) {
    if (!mesh || typeof mesh.getBoundingInfo !== 'function') return false;
    const metadata = metadataChain(mesh);
    const text = `${nameChain(mesh)} ${materialText(mesh)}`;
    const alpha = Number(mesh.material?.alpha ?? 1);
    return Boolean(
      metadata.glass === true || metadata.glassPanel === true || metadata.stairGlassPanel === true ||
      /cristal|glass|vidrio|mampara/i.test(text) ||
      (alpha < 0.97 && /baranda|panel|puerta|ventana|railing|guard/i.test(text))
    );
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

  function isLegacyStairRail(mesh) {
    if (mesh?.metadata?.vrCanonicalV312) return false;
    const metadata = metadataChain(mesh);
    const text = nameChain(mesh);
    return Boolean(
      metadata.rooftopStairRail === true || metadata.rooftopStairGuard === true ||
      metadata.questCorrectedStairRailV301 === true || metadata.questCorrectedStairRailV304R4 === true ||
      /baranda lateral escalera terraza|pasamanos escalera terraza|baranda hueco escalera terraza|pasamanos superior escalera Quest V301|riel inferior escalera Quest V301|poste baranda escalera Quest V301|poste lateral R4|pasamanos lateral R4|riel lateral R4|superficie translúcida lateral R4/i.test(text)
    );
  }

  function hide(mesh, reason) {
    if (!mesh || mesh.metadata?.vrCanonicalV312 || state.hidden.has(mesh)) return false;
    state.hidden.set(mesh, {
      enabled:mesh.isEnabled?.() !== false,
      visible:mesh.isVisible,
      visibility:mesh.visibility,
      pickable:mesh.isPickable,
      collisions:mesh.checkCollisions,
      reason
    });
    try { mesh.setEnabled?.(false); } catch (_) {}
    mesh.isVisible = false;
    mesh.visibility = 0;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.metadata = { ...(mesh.metadata || {}), hiddenByVrCanonicalV312:true, vrCanonicalReasonV312:reason };
    return true;
  }

  function glassMaterial() {
    if (state.glassMaterial && !state.glassMaterial.isDisposed?.()) return state.glassMaterial;
    const material = new B.StandardMaterial('superficie translúcida canónica VR V312', state.scene);
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
    const material = new B.StandardMaterial('metal escalera canónica VR V312', state.scene);
    material.diffuseColor = B.Color3.FromHexString('#54666b');
    material.emissiveColor = B.Color3.FromHexString('#1d292c').scale(0.18);
    material.specularColor = B.Color3.FromHexString('#b9c7ca');
    material.specularPower = 44;
    state.metalMaterial = material;
    return material;
  }

  function terraceFloorMaterial() {
    if (state.floorMaterial && !state.floorMaterial.isDisposed?.()) return state.floorMaterial;
    const material = new B.StandardMaterial('piso terraza canónico VR V312', state.scene);
    material.diffuseColor = B.Color3.FromHexString('#9b9c91');
    material.emissiveColor = B.Color3.FromHexString('#262822').scale(0.08);
    material.specularColor = B.Color3.Black();
    state.floorMaterial = material;
    return material;
  }

  function convertGlass(mesh) {
    if (!mesh || mesh.metadata?.vrCanonicalV312 || state.converted.has(mesh)) return false;
    const bounds = worldBounds(mesh);
    if (isCentralTerrace(mesh, bounds) || isRearRailing(mesh, bounds)) return false;
    state.converted.set(mesh, {
      material:mesh.material,
      enabled:mesh.isEnabled?.() !== false,
      visible:mesh.isVisible,
      visibility:mesh.visibility,
      pickable:mesh.isPickable,
      collisions:mesh.checkCollisions
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
    mesh.metadata = { ...(mesh.metadata || {}), vrCanonicalGlassV312:true, frontBackVisible:true };
    state.convertedGlass += 1;
    return true;
  }

  function stairGroundAtZ(z) {
    const progress = Math.max(0, Math.min(1, (STAIR.bottomZ - z) / (STAIR.bottomZ - STAIR.topZ)));
    return LEVEL.three + (LEVEL.roof - LEVEL.three) * progress;
  }

  function trackCanonical(mesh, metadata = {}) {
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.alwaysSelectAsActiveMesh = false;
    mesh.layerMask = ALL_LAYERS;
    mesh.metadata = { ...(mesh.metadata || {}), vrCanonicalV312:true, browserAndVrSame:true, ...metadata };
    state.railMeshes.push(mesh);
    return mesh;
  }

  function buildRailSide(x, sideLabel) {
    const metal = metalMaterial();
    const translucent = glassMaterial();
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
        const post = B.MeshBuilder.CreateCylinder(`poste escalera VR canónica V312 ${sideLabel} ${index}`, { diameter:0.13, height:1.30, tessellation:10 }, state.scene);
        post.position.set(x, ground + 0.65, z);
        post.material = metal;
        trackCanonical(post, { stairRail:true, stairRailPost:true, side:sideLabel });
      }
    }

    const top = B.MeshBuilder.CreateTube(`pasamanos escalera VR canónica V312 ${sideLabel}`, { path:topPath, radius:0.072, tessellation:10, cap:B.Mesh.CAP_ALL }, state.scene);
    top.material = metal;
    trackCanonical(top, { stairRail:true, stairTopRail:true, side:sideLabel });

    const middle = B.MeshBuilder.CreateTube(`riel escalera VR canónica V312 ${sideLabel}`, { path:middlePath, radius:0.045, tessellation:9, cap:B.Mesh.CAP_ALL }, state.scene);
    middle.material = metal;
    trackCanonical(middle, { stairRail:true, stairLowerRail:true, side:sideLabel });

    for (let index = 0; index < segments; index += 1) {
      const z1 = STAIR.bottomZ - index * depth;
      const z2 = STAIR.bottomZ - (index + 1) * depth;
      const z = (z1 + z2) / 2;
      const ground = stairGroundAtZ(z);
      const pane = B.MeshBuilder.CreateBox(`cristal escalera VR canónica V312 ${sideLabel} ${index}`, { width:0.065, height:0.76, depth:depth * 0.88 }, state.scene);
      pane.position.set(x, ground + 0.83, z);
      pane.material = translucent;
      pane.visibility = GLASS_VISIBILITY;
      pane.renderingGroupId = 3;
      pane.alphaIndex = 260 + index;
      trackCanonical(pane, { stairRail:true, stairGlassPanel:true, frontBackVisible:true, side:sideLabel });
    }
  }

  function buildCanonicalStairRailings() {
    if (state.railMeshes.some(mesh => !mesh.isDisposed?.())) return;
    buildRailSide(STAIR.minX + 0.34, 'oeste');
    buildRailSide(STAIR.maxX - 0.34, 'este');
    state.canonicalRailMeshes = state.railMeshes.length;
  }

  function createTerracePanel(name, x1, x2, z1, z2) {
    const mesh = B.MeshBuilder.CreateBox(name, { width:x2-x1, height:0.08, depth:z2-z1 }, state.scene);
    mesh.position.set((x1+x2)/2, LEVEL.roof + 0.04, (z1+z2)/2);
    mesh.material = terraceFloorMaterial();
    mesh.checkCollisions = false;
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    mesh.layerMask = ALL_LAYERS;
    mesh.metadata = { vrCanonicalV312:true, browserAndVrSame:true, walkable:true, teleportable:true, rooftop:true, vrCanonicalTerraceFloorV312:true };
    state.terraceMeshes.push(mesh);
  }

  function buildCanonicalTerraceFloor() {
    if (state.terraceMeshes.some(mesh => !mesh.isDisposed?.())) return;
    createTerracePanel('terraza canónica VR V312 oeste', -72, STAIR.minX, -60, 60);
    createTerracePanel('terraza canónica VR V312 este', STAIR.maxX, 72, -60, 60);
    createTerracePanel('terraza canónica VR V312 sur', STAIR.minX, STAIR.maxX, -60, 9.0);
    createTerracePanel('terraza canónica VR V312 norte', STAIR.minX, STAIR.maxX, 40.5, 60);
    state.canonicalTerracePanels = state.terraceMeshes.length;
  }

  function applyCanonicalVrEnvironment() {
    if (!state.scene) return;
    state.scans += 1;
    for (const mesh of [...(state.scene.meshes || [])]) {
      if (!mesh || mesh.isDisposed?.() || mesh.metadata?.vrCanonicalV312) continue;
      const bounds = worldBounds(mesh);
      if (isCentralTerrace(mesh, bounds)) {
        if (hide(mesh, 'central-terrace-feature')) state.hiddenCentralTerrace += 1;
        continue;
      }
      if (isRearRailing(mesh, bounds)) {
        if (hide(mesh, 'rear-stair-railing')) state.hiddenRearRails += 1;
        continue;
      }
      if (isLegacyStairRail(mesh)) {
        if (hide(mesh, 'legacy-stair-railing')) state.hiddenLegacyRails += 1;
        continue;
      }
      if (isGlassLike(mesh)) convertGlass(mesh);
    }
    buildCanonicalStairRailings();
    buildCanonicalTerraceFloor();
    for (const mesh of [...state.railMeshes, ...state.terraceMeshes]) {
      if (!mesh || mesh.isDisposed?.()) continue;
      mesh.setEnabled?.(true);
      mesh.isVisible = true;
      mesh.visibility = mesh.metadata?.stairGlassPanel ? GLASS_VISIBILITY : 1;
      mesh.layerMask = ALL_LAYERS;
    }
    updateAudit();
  }

  function updateAudit() {
    window.__UCAN_VR_CANONICAL_SCENE_V312__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      authoritativeEnvironment:'VR',
      browserUsesVrEnvironment:true,
      sameSceneBrowserVr:true,
      sameGeometryBrowserVr:true,
      floor3StairsCanonicalVr:true,
      environmentSpecificGeometry:false,
      cameraAndControlsOnlyDifference:true,
      scans:state.scans,
      convertedGlass:state.convertedGlass,
      hiddenLegacyRails:state.hiddenLegacyRails,
      hiddenRearRails:state.hiddenRearRails,
      hiddenCentralTerrace:state.hiddenCentralTerrace,
      canonicalRailMeshes:state.canonicalRailMeshes,
      canonicalTerracePanels:state.canonicalTerracePanels,
      lastError:state.lastError,
      refresh:applyCanonicalVrEnvironment,
      getState:() => ({
        installed:state.installed,
        authoritativeEnvironment:'VR',
        browserUsesVrEnvironment:true,
        floor3StairsCanonicalVr:true,
        canonicalRailMeshes:state.canonicalRailMeshes,
        canonicalTerracePanels:state.canonicalTerracePanels,
        convertedGlass:state.convertedGlass,
        lastError:state.lastError
      })
    };
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    if (!state.scene) return false;
    state.installed = true;
    applyCanonicalVrEnvironment();
    window.setInterval(() => {
      try { applyCanonicalVrEnvironment(); }
      catch (error) {
        state.lastError = { stage:'maintenance', message:String(error?.message || error), at:new Date().toISOString() };
        updateAudit();
      }
    }, 1500);
    window.__UCAN_API__?.setStatus?.('V312: el browser utiliza el mismo entorno visual canónico de VR.');
    console.info('[UCAN V312 R16] Entorno VR aplicado como escena canónica en browser y WebXR.');
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
