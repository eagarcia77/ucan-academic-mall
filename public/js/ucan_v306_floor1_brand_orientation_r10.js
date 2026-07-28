(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V306';
  const REVISION = 'R10';
  const BUILD = 'V306-20260728-FLOOR1-BRAND-UPRIGHT-VR-R10';
  const TARGET_NAME = /logo\s+(?:ucan|inter).*piso\s*1/i;
  const state = {
    scene:null,
    installed:false,
    records:new Map(),
    correctedFaces:[],
    suppressedLegacy:0,
    maintenanceFrames:0,
    lastError:null
  };

  function worldPosition(mesh) {
    try {
      mesh.computeWorldMatrix?.(true);
      return mesh.getAbsolutePosition?.().clone?.() || mesh.position?.clone?.();
    } catch (_) {
      return mesh?.position?.clone?.() || null;
    }
  }

  function worldYaw(mesh) {
    try {
      mesh.computeWorldMatrix?.(true);
      const normal = B.Vector3.TransformNormal(new B.Vector3(0, 0, 1), mesh.getWorldMatrix());
      normal.y = 0;
      if (normal.lengthSquared() > 0.000001) {
        normal.normalize();
        return Math.atan2(normal.x, normal.z);
      }
    } catch (_) {}
    try {
      return Number(mesh.absoluteRotationQuaternion?.toEulerAngles?.().y ?? mesh.rotation?.y ?? 0);
    } catch (_) {
      return Number(mesh?.rotation?.y || 0);
    }
  }

  function worldDimensions(mesh) {
    try {
      mesh.computeWorldMatrix?.(true);
      const extend = mesh.getBoundingInfo().boundingBox.extendSizeWorld;
      return {
        width:Math.max(1, Math.max(Math.abs(extend.x), Math.abs(extend.z)) * 2),
        height:Math.max(1, Math.abs(extend.y) * 2)
      };
    } catch (_) {
      return { width:8, height:5 };
    }
  }

  function isOriginalBrand(mesh) {
    if (!mesh || mesh.isDisposed?.()) return false;
    if (mesh.metadata?.correctedFloor1BrandV306R10) return false;
    return mesh.metadata?.brandLogo === true && Number(mesh.metadata?.floor) === 1 && TARGET_NAME.test(String(mesh.name || ''));
  }

  function isLegacyBrandFace(mesh) {
    if (!mesh || mesh.isDisposed?.() || mesh.metadata?.correctedFloor1BrandV306R10) return false;
    const name = String(mesh.name || '');
    const metadata = mesh.metadata || {};
    return TARGET_NAME.test(name) && (
      metadata.brandLogo === true ||
      metadata.correctedFloor1AnnouncementV305R8 === true ||
      metadata.correctedFloor1AnnouncementV305R9 === true ||
      metadata.hiddenByFloor1R9 === true
    );
  }

  function prepareTexture(texture) {
    if (!texture) return;
    try {
      texture.wrapU = B.Texture.CLAMP_ADDRESSMODE;
      texture.wrapV = B.Texture.CLAMP_ADDRESSMODE;
      texture.uScale = Math.abs(Number(texture.uScale || 1));
      texture.vScale = Math.abs(Number(texture.vScale || 1));
      texture.uOffset = 0;
      texture.vOffset = 0;
    } catch (_) {}
  }

  function createMaterial(source, key) {
    const original = source.material;
    const material = new B.StandardMaterial(`material anuncio institucional R10 ${key}`, state.scene);
    material.disableLighting = true;
    material.backFaceCulling = true;
    material.zOffset = -12;
    material.diffuseColor = B.Color3.White();
    material.emissiveColor = B.Color3.White();
    material.specularColor = B.Color3.Black();
    material.alpha = Number.isFinite(Number(original?.alpha)) ? Number(original.alpha) : 1;
    material.diffuseTexture = original?.diffuseTexture || original?.emissiveTexture || null;
    material.emissiveTexture = original?.emissiveTexture || original?.diffuseTexture || null;
    material.opacityTexture = original?.opacityTexture || null;
    prepareTexture(material.diffuseTexture);
    prepareTexture(material.emissiveTexture);
    prepareTexture(material.opacityTexture);
    material.metadata = {
      correctedFloor1BrandMaterialV306R10:true,
      sourceName:source.name,
      noMirroredBackface:true
    };
    return material;
  }

  function createFace(record, side, yawOffset, positionOffset) {
    const face = B.MeshBuilder.CreatePlane(`Anuncio institucional piso 1 R10 ${record.key} ${side}`, {
      width:record.width,
      height:record.height,
      sideOrientation:B.Mesh.FRONTSIDE
    }, state.scene);
    face.material = record.material;
    face.rotationQuaternion = null;
    face.billboardMode = B.Mesh.BILLBOARDMODE_NONE;
    face.scaling.set(1, 1, 1);
    face.checkCollisions = false;
    face.isPickable = false;
    face.alwaysSelectAsActiveMesh = true;
    face.renderingGroupId = 7;
    face.alphaIndex = 310;
    face.metadata = {
      correctedFloor1BrandV306R10:true,
      correctedFloor1AnnouncementV305R9:true,
      independentFrontFace:true,
      sideOrientation:'FRONTSIDE',
      billboardDisabled:true,
      textureNotMirrored:true,
      sourceName:record.source.name,
      institution:record.source.metadata?.institution || record.key,
      side,
      yawOffset,
      positionOffset
    };
    return face;
  }

  function alignRecord(record) {
    const center = worldPosition(record.source) || record.center;
    if (!center) return;
    record.center = center;
    const yaw = worldYaw(record.source);
    const forward = new B.Vector3(Math.sin(yaw), 0, Math.cos(yaw));

    for (const face of record.faces) {
      const offset = Number(face.metadata?.positionOffset || 0);
      face.position.copyFrom(center.add(forward.scale(offset)));
      face.position.y += 0.01;
      face.rotationQuaternion = null;
      face.rotation.set(0, yaw + Number(face.metadata?.yawOffset || 0), 0);
      face.scaling.set(1, 1, 1);
      face.billboardMode = B.Mesh.BILLBOARDMODE_NONE;
      face.setEnabled?.(true);
      face.isVisible = true;
      face.visibility = 1;
    }
  }

  function createRecord(source) {
    const key = String(source.metadata?.institution || source.name || source.uniqueId);
    if (state.records.has(source.uniqueId)) return state.records.get(source.uniqueId);
    const dimensions = worldDimensions(source);
    const record = {
      source,
      key,
      width:dimensions.width,
      height:dimensions.height,
      center:worldPosition(source),
      material:createMaterial(source, key),
      faces:[]
    };
    record.faces.push(createFace(record, 'frente', 0, 0.035));
    record.faces.push(createFace(record, 'reverso', Math.PI, -0.035));
    state.records.set(source.uniqueId, record);
    state.correctedFaces.push(...record.faces);
    alignRecord(record);
    return record;
  }

  function suppressLegacyFaces() {
    let suppressed = 0;
    for (const mesh of [...(state.scene?.meshes || [])]) {
      if (!isLegacyBrandFace(mesh)) continue;
      try {
        mesh.isPickable = false;
        mesh.isVisible = false;
        mesh.visibility = 0;
        mesh.setEnabled?.(false);
        mesh.metadata = {
          ...(mesh.metadata || {}),
          hiddenByFloor1BrandV306R10:true
        };
        suppressed += 1;
      } catch (_) {}
    }
    state.suppressedLegacy = Math.max(state.suppressedLegacy, suppressed);
  }

  function scanOriginals() {
    for (const mesh of [...(state.scene?.meshes || [])]) {
      if (isOriginalBrand(mesh)) createRecord(mesh);
    }
  }

  function maintain() {
    state.maintenanceFrames += 1;
    scanOriginals();
    suppressLegacyFaces();
    for (const record of state.records.values()) alignRecord(record);
    updateAudit();
  }

  function updateAudit() {
    const activeFaces = state.correctedFaces.filter(face => !face.isDisposed?.() && face.isEnabled?.() !== false && face.isVisible !== false && face.visibility > 0);
    window.__UCAN_FLOOR1_BRAND_VR_V306_R10__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      exactMetadataTarget:'brandLogo',
      sourceUsesLegacyDoubleSide:true,
      replacementUsesTwoIndependentFrontFaces:true,
      frontSideOnly:true,
      billboardDisabled:true,
      textureMirroringDisabled:true,
      originalBrandSources:state.records.size,
      correctedFaces:state.correctedFaces.length,
      activeCorrectedFaces:activeFaces.length,
      suppressedLegacy:state.suppressedLegacy,
      maintenanceFrames:state.maintenanceFrames,
      lastError:state.lastError,
      refresh:maintain,
      getState:() => ({
        installed:state.installed,
        originalBrandSources:state.records.size,
        correctedFaces:state.correctedFaces.length,
        activeCorrectedFaces:activeFaces.length,
        suppressedLegacy:state.suppressedLegacy,
        lastError:state.lastError
      })
    };
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    if (!state.scene) return false;
    scanOriginals();
    if (!state.records.size) return false;
    state.installed = true;
    suppressLegacyFaces();
    state.scene.onBeforeRenderObservable.add(() => {
      try { maintain(); }
      catch (error) {
        state.lastError = {
          stage:'maintenance',
          message:String(error?.message || error),
          at:new Date().toISOString()
        };
        updateAudit();
      }
    });
    window.__UCAN_API__?.setStatus?.('Anuncios institucionales del piso 1 corregidos para VR mediante dos caras frontales independientes.');
    console.info('[UCAN V306 R10] Anuncios institucionales del piso 1 corregidos sin cara posterior espejada.');
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
      updateAudit();
      if (attempts >= 500) window.clearInterval(timer);
    }
  }, 100);

  updateAudit();
})();
