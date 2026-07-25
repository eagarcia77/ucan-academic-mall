(() => {
  'use strict';

  const VERSION = 'V304';
  const REVISION = 'R2';
  const BUILD = 'V304-20260724-QUEST-GLASS-SIGNS-VR-R2';
  const B = window.BABYLON;
  if (!B) return;

  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const FLOOR_TWO_Y = 8.2;
  const GLASS_RESTORE_REASONS = new Set([
    'dark-glass-global',
    'rooftop-stair-glass',
    'floor2-escalator-front-glass'
  ]);

  const state = {
    scene:null,
    helper:null,
    installed:false,
    observerInstalled:false,
    inXR:false,
    questDevice:false,
    glassMaterial:null,
    glassOriginals:new Map(),
    signOriginals:new Map(),
    signReplacements:new Map(),
    reboundButtons:new Map(),
    convertedGlass:0,
    restoredGlass:0,
    correctedSigns:0,
    vrAttempts:0,
    vrEntries:0,
    mrAttempts:0,
    mrEntries:0,
    exits:0,
    lastError:null
  };

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

  function helperReady() {
    state.helper = window.__UCAN_XR_HELPER__ || state.helper;
    state.scene = window.__UCAN_API__?.getScene?.() || state.scene;
    return Boolean(state.helper?.baseExperience && state.scene);
  }

  function xrState() {
    return state.helper?.baseExperience?.state ?? XR_STATE.NOT_IN_XR;
  }

  function xrActive() {
    const current = xrState();
    return current === XR_STATE.ENTERING_XR || current === XR_STATE.IN_XR;
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

  function isGlassLike(mesh) {
    const metadata = metadataChain(mesh);
    const material = mesh?.material;
    const text = `${nameChain(mesh)} ${String(material?.name || '')}`;
    const alpha = Number(material?.alpha ?? 1);
    return Boolean(
      metadata.stairGlassPanel === true ||
      metadata.glass === true ||
      metadata.glassPanel === true ||
      /cristal|glass|vidrio|mampara/i.test(text) ||
      (alpha < 0.97 && /baranda|panel|puerta|ventana|railing|guard/i.test(text))
    );
  }

  function excludedGlass(mesh) {
    const metadata = metadataChain(mesh);
    const text = nameChain(mesh);
    const reason = mesh?.metadata?.ucanQuestGeometryReasonV303;
    if (reason === 'floor3-rear-railing' || reason === 'rooftop-rear-railing') return true;
    return Boolean(
      metadata.centralTerraceFeature === true ||
      /tragaluz|centro.*terraza|terraza.*centro|baranda tragaluz rooftop|cristal.*centro.*terraza/i.test(text)
    );
  }

  function questGlassMaterial() {
    if (state.glassMaterial && !state.glassMaterial.isDisposed?.()) return state.glassMaterial;
    const material = new B.StandardMaterial('cristal transparente Meta Quest V304 R2', state.scene);
    material.diffuseColor = B.Color3.FromHexString('#9bc8d3');
    material.emissiveColor = B.Color3.FromHexString('#244c55').scale(0.32);
    material.specularColor = B.Color3.FromHexString('#d9f6ff');
    material.specularPower = 48;
    material.alpha = 0.34;
    material.backFaceCulling = false;
    material.needDepthPrePass = false;
    material.disableDepthWrite = true;
    material.forceDepthWrite = false;
    material.separateCullingPass = true;
    material.transparencyMode = B.Material?.MATERIAL_ALPHABLEND ?? 2;
    material.useAlphaFromDiffuseTexture = false;
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
      alwaysSelectAsActiveMesh:mesh.alwaysSelectAsActiveMesh,
      renderingGroupId:mesh.renderingGroupId,
      alphaIndex:mesh.alphaIndex
    });
  }

  function restoreAndStyleGlass() {
    if (!state.inXR || !state.questDevice || !state.scene) return;
    const material = questGlassMaterial();
    let index = 0;
    let converted = 0;
    let restored = 0;

    for (const mesh of state.scene.meshes || []) {
      if (!mesh || typeof mesh.getBoundingInfo !== 'function' || !isGlassLike(mesh) || excludedGlass(mesh)) continue;
      const reason = mesh.metadata?.ucanQuestGeometryReasonV303;
      if (reason && !GLASS_RESTORE_REASONS.has(reason)) continue;

      preserveGlass(mesh);
      const wasHidden = mesh.isEnabled?.() === false || mesh.isVisible === false || Number(mesh.visibility ?? 1) <= 0;
      try { mesh.setEnabled?.(true); } catch (_) {}
      mesh.isVisible = true;
      mesh.visibility = 1;
      mesh.isPickable = false;
      mesh.checkCollisions = false;
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.receiveShadows = false;
      mesh.material = material;
      mesh.renderingGroupId = 3;
      mesh.alphaIndex = 220 + index;
      mesh.metadata = {
        ...(mesh.metadata || {}),
        ucanQuestGlassRestoredV304R2:true,
        ucanQuestGlassTransparentV304R2:true
      };
      index += 1;
      converted += 1;
      if (wasHidden) restored += 1;
    }

    state.convertedGlass = converted;
    state.restoredGlass = restored;
  }

  function restoreGlassOriginals() {
    for (const [mesh, original] of state.glassOriginals) {
      try {
        if (mesh?.isDisposed?.()) continue;
        mesh.material = original.material;
        mesh.setEnabled?.(original.enabled);
        mesh.isVisible = original.isVisible;
        mesh.visibility = original.visibility;
        mesh.isPickable = original.isPickable;
        mesh.checkCollisions = original.checkCollisions;
        mesh.alwaysSelectAsActiveMesh = original.alwaysSelectAsActiveMesh;
        mesh.renderingGroupId = original.renderingGroupId;
        mesh.alphaIndex = original.alphaIndex;
        if (mesh.metadata) {
          delete mesh.metadata.ucanQuestGlassRestoredV304R2;
          delete mesh.metadata.ucanQuestGlassTransparentV304R2;
        }
      } catch (_) {}
    }
    state.glassOriginals.clear();
    state.convertedGlass = 0;
    state.restoredGlass = 0;
  }

  function absoluteY(mesh) {
    try { return Number(mesh.getAbsolutePosition?.().y ?? mesh.position?.y ?? 999); }
    catch (_) { return Number(mesh.position?.y ?? 999); }
  }

  function readableFloorOneSign(mesh) {
    if (!mesh || typeof mesh.getBoundingInfo !== 'function') return false;
    const metadata = metadataChain(mesh);
    const text = nameChain(mesh);
    if (absoluteY(mesh) >= FLOOR_TWO_Y - 0.2) return false;
    if (metadata.side === 'back' || /reverso/i.test(text)) return false;
    return Boolean(
      metadata.brandLogo === true ||
      metadata.readableSign === true ||
      /logo .*piso 1|cartel .*piso 1|rótulo .*piso 1|rotulo .*piso 1|directorio .*piso 1|letrero .*piso 1/i.test(text)
    );
  }

  function planeDimensions(mesh) {
    try {
      const box = mesh.getBoundingInfo().boundingBox;
      const width = Math.max(0.25, Math.abs(box.maximum.x - box.minimum.x));
      const height = Math.max(0.25, Math.abs(box.maximum.y - box.minimum.y));
      return { width, height };
    } catch (_) { return { width:4, height:2 }; }
  }

  function normalizeSignTexture(material) {
    for (const texture of [material?.diffuseTexture, material?.emissiveTexture, material?.albedoTexture]) {
      if (!texture) continue;
      if (Number(texture.uScale) < 0) texture.uScale = Math.abs(Number(texture.uScale)) || 1;
      if (Number(texture.vScale) < 0) texture.vScale = Math.abs(Number(texture.vScale)) || 1;
    }
    if (material) material.backFaceCulling = true;
  }

  function createReadableSignReplacement(mesh) {
    if (state.signReplacements.has(mesh) || !readableFloorOneSign(mesh)) return;
    const dimensions = planeDimensions(mesh);
    const replacement = B.MeshBuilder.CreatePlane(`${mesh.name} legible Meta Quest V304 R2`, {
      width:dimensions.width,
      height:dimensions.height,
      sideOrientation:B.Mesh.FRONTSIDE
    }, state.scene);
    replacement.parent = mesh.parent || null;
    replacement.position.copyFrom(mesh.position);
    replacement.rotationQuaternion = null;
    replacement.rotation.set(0, 0, 0);
    replacement.billboardMode = B.Mesh.BILLBOARDMODE_Y;
    replacement.material = mesh.material;
    normalizeSignTexture(replacement.material);
    replacement.isPickable = mesh.isPickable;
    replacement.checkCollisions = false;
    replacement.alwaysSelectAsActiveMesh = true;
    replacement.renderingGroupId = 3;
    replacement.alphaIndex = 250;
    replacement.metadata = {
      ...(mesh.metadata || {}),
      readableSign:true,
      floor:1,
      questReadableReplacementV304R2:true,
      orientation:'upright',
      sourceMeshName:mesh.name
    };

    state.signOriginals.set(mesh, {
      enabled:mesh.isEnabled?.() !== false,
      isVisible:mesh.isVisible,
      visibility:mesh.visibility
    });
    try { mesh.setEnabled?.(false); } catch (_) {}
    mesh.isVisible = false;
    mesh.visibility = 0;
    state.signReplacements.set(mesh, replacement);
  }

  function fixFloorOneSigns() {
    if (!state.inXR || !state.questDevice || !state.scene) return;
    for (const mesh of state.scene.meshes || []) createReadableSignReplacement(mesh);
    state.correctedSigns = state.signReplacements.size;
  }

  function restoreFloorOneSigns() {
    for (const replacement of state.signReplacements.values()) {
      try { replacement?.dispose?.(); } catch (_) {}
    }
    for (const [mesh, original] of state.signOriginals) {
      try {
        mesh.setEnabled?.(original.enabled);
        mesh.isVisible = original.isVisible;
        mesh.visibility = original.visibility;
      } catch (_) {}
    }
    state.signReplacements.clear();
    state.signOriginals.clear();
    state.correctedSigns = 0;
  }

  function showExistingDiagnostics(title) {
    try {
      window.__UCAN_XR_ENTRY_MR_V304__?.showDiagnostics?.(title);
      return;
    } catch (_) {}
    setStatus(title);
  }

  function enterModeDirect(mode) {
    if (!helperReady()) {
      recordError('pre-entry-r2', new Error('Babylon WebXR todavía no está preparado.'));
      showExistingDiagnostics('WebXR todavía no está preparado');
      return false;
    }
    if (!window.isSecureContext || !navigator.xr) {
      recordError('pre-entry-r2', new DOMException('WebXR requiere HTTPS y Meta Quest Browser.', 'SecurityError'));
      showExistingDiagnostics('El navegador no puede iniciar WebXR');
      return false;
    }

    const base = state.helper.baseExperience;
    if (xrActive()) {
      const exitPromise = base.exitXRAsync();
      Promise.resolve(exitPromise).then(() => {
        state.exits += 1;
        setStatus('Sesión XR finalizada.');
        updateAudit();
      }).catch(error => {
        recordError('exitXR-r2', error);
        showExistingDiagnostics('No se pudo salir de XR');
      });
      return true;
    }

    state.questDevice = questDetected();
    const renderTarget = state.helper.renderTarget || base.renderTarget;
    const optionalFeatures = mode === 'immersive-ar'
      ? ['bounded-floor', 'hand-tracking', 'hit-test', 'anchors', 'layers']
      : ['bounded-floor', 'hand-tracking', 'layers'];
    if (mode === 'immersive-ar') state.mrAttempts += 1;
    else state.vrAttempts += 1;

    setStatus(mode === 'immersive-ar'
      ? 'Solicitando MR Beta directamente en Meta Quest…'
      : 'Solicitando entrada directa al entorno VR…');

    let enterPromise;
    try {
      enterPromise = base.enterXRAsync(mode, 'local-floor', renderTarget, { optionalFeatures });
    } catch (firstError) {
      try {
        enterPromise = base.enterXRAsync(mode, 'local-floor');
      } catch (secondError) {
        recordError(mode === 'immersive-ar' ? 'enterMR-sync-r2' : 'enterVR-sync-r2', secondError || firstError);
        showExistingDiagnostics(mode === 'immersive-ar' ? 'MR Beta no pudo iniciar' : 'VR no pudo iniciar');
        return false;
      }
    }

    Promise.resolve(enterPromise).then(() => {
      if (mode === 'immersive-ar') state.mrEntries += 1;
      else state.vrEntries += 1;
      setStatus(mode === 'immersive-ar'
        ? 'MR Beta activo en Meta Quest.'
        : 'Entorno VR activo. Use los controles del Meta Quest para desplazarse.');
      updateAudit();
    }).catch(error => {
      recordError(mode === 'immersive-ar' ? 'enterMR-r2' : 'enterVR-r2', error);
      setStatus(`No se pudo iniciar ${mode === 'immersive-ar' ? 'MR' : 'VR'}: ${error?.name || 'Error'} — ${error?.message || error}`);
      showExistingDiagnostics(mode === 'immersive-ar' ? 'MR Beta no pudo iniciar' : 'VR no pudo iniciar');
    });
    return true;
  }

  function rebindButton(id, mode) {
    const existing = document.getElementById(id);
    if (!existing) return null;
    if (existing.dataset.ucanV304R2Bound === 'true') return existing;
    const button = existing.cloneNode(true);
    button.dataset.ucanV289Bound = 'true';
    button.dataset.ucanV304XrBound = 'direct-user-gesture';
    button.dataset.ucanV304R2Bound = 'true';
    button.disabled = false;
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      enterModeDirect(mode);
    }, true);
    existing.replaceWith(button);
    state.reboundButtons.set(id, button);
    return button;
  }

  function bindEntryButtons() {
    rebindButton('xrBtn', 'immersive-vr');
    rebindButton('mrBtn', 'immersive-ar');
    rebindButton('ucanVrGogglesV304', 'immersive-vr');
  }

  function enterRuntime() {
    state.inXR = true;
    state.questDevice = questDetected();
    if (state.questDevice) {
      restoreAndStyleGlass();
      fixFloorOneSigns();
      setStatus('Meta Quest V304 R2: cristal transparente y letreros legibles activados.');
    }
    updateAudit();
  }

  function exitRuntime() {
    state.inXR = false;
    restoreGlassOriginals();
    restoreFloorOneSigns();
    updateAudit();
  }

  function frame() {
    const active = xrActive();
    if (active && !state.inXR) enterRuntime();
    if (!active && state.inXR) exitRuntime();
    if (!state.inXR || !state.questDevice) return;
    restoreAndStyleGlass();
    fixFloorOneSigns();
  }

  function updateAudit() {
    window.__UCAN_QUEST_V304_R2__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      inXR:state.inXR,
      questDevice:state.questDevice,
      questOnlyVisualChanges:true,
      desktopVisualsUnchanged:true,
      transparentGlassColor:'#9bc8d3',
      transparentGlassAlpha:0.34,
      glassDepthPrePassDisabled:true,
      glassDepthWriteDisabled:true,
      blackGlassConvertedNotHidden:true,
      stairGlassRestoredTransparent:true,
      floorOneSignsFrontSideOnly:true,
      floorOneSignsBillboardY:true,
      floorOneSignsUpright:true,
      vrUsesBabylonRenderTarget:true,
      vrDirectUserGesture:true,
      vrSynchronousFallback:true,
      convertedGlass:state.convertedGlass,
      restoredGlass:state.restoredGlass,
      correctedSigns:state.correctedSigns,
      vrAttempts:state.vrAttempts,
      vrEntries:state.vrEntries,
      mrAttempts:state.mrAttempts,
      mrEntries:state.mrEntries,
      exits:state.exits,
      lastError:state.lastError,
      enterVR:() => enterModeDirect('immersive-vr'),
      enterMR:() => enterModeDirect('immersive-ar'),
      refresh:() => { restoreAndStyleGlass(); fixFloorOneSigns(); updateAudit(); },
      getState:() => ({
        installed:state.installed,
        inXR:state.inXR,
        questDevice:state.questDevice,
        convertedGlass:state.convertedGlass,
        restoredGlass:state.restoredGlass,
        correctedSigns:state.correctedSigns,
        vrAttempts:state.vrAttempts,
        vrEntries:state.vrEntries,
        lastError:state.lastError
      })
    };
  }

  function install() {
    if (state.installed || !helperReady()) return false;
    const v303Ready = window.__UCAN_QUEST_V303__?.installed === true;
    if (!v303Ready) return false;
    state.installed = true;
    bindEntryButtons();
    state.helper.baseExperience?.onStateChangedObservable?.add?.(current => {
      if (current === XR_STATE.ENTERING_XR || current === XR_STATE.IN_XR) enterRuntime();
      else if (current === XR_STATE.NOT_IN_XR) exitRuntime();
    });
    state.scene.onBeforeRenderObservable.add(() => {
      try { frame(); } catch (error) { recordError('frame-r2', error); }
    });
    state.observerInstalled = true;
    if (xrActive()) enterRuntime();
    updateAudit();
    console.info(`[UCAN ${VERSION} ${REVISION}] Cristal, letreros del Piso 1 y entrada VR corregidos.`);
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    bindEntryButtons();
    if (install() || attempts >= 420) window.clearInterval(timer);
  }, 100);

  window.setInterval(() => {
    try { bindEntryButtons(); } catch (error) { recordError('button-maintenance-r2', error); }
  }, 1500);

  updateAudit();
})();