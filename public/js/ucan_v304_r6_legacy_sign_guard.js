(() => {
  'use strict';

  const VERSION = 'V304';
  const REVISION = 'R6-GUARD';
  const BUILD = 'V304-20260728-R6-LEGACY-SIGN-GUARD';
  const state = {
    scene:null,
    installed:false,
    legacyMeshes:new Set(),
    correctedFaces:new Set(),
    scans:0,
    suppressions:0,
    lastError:null
  };

  function isLegacySign(mesh) {
    const metadata = mesh?.metadata || {};
    return Boolean(
      metadata.globalBoardFaceV304R5 === true ||
      metadata.holidayBoardPuertoRicoV304R4 === true ||
      metadata.hiddenByCorrectedBoardV304R6 === true
    );
  }

  function isCorrectedFace(mesh) {
    return mesh?.metadata?.correctedBoardFaceV304R6 === true;
  }

  function scan() {
    state.scene = window.__UCAN_API__?.getScene?.() || state.scene;
    if (!state.scene) return;
    for (const mesh of [...(state.scene.meshes || [])]) {
      if (isLegacySign(mesh)) state.legacyMeshes.add(mesh);
      if (isCorrectedFace(mesh)) state.correctedFaces.add(mesh);
    }
    state.scans += 1;
    suppress();
    updateAudit();
  }

  function suppress() {
    if (window.__UCAN_VISUAL_INTERACTION_V304_R6__?.installed !== true) return;
    for (const mesh of [...state.legacyMeshes]) {
      try {
        if (!mesh || mesh.isDisposed?.()) {
          state.legacyMeshes.delete(mesh);
          continue;
        }
        const wasVisible = mesh.isEnabled?.() !== false || mesh.isVisible !== false || Number(mesh.visibility ?? 1) > 0;
        mesh.setEnabled?.(false);
        mesh.isVisible = false;
        mesh.visibility = 0;
        mesh.isPickable = false;
        if (wasVisible) state.suppressions += 1;
      } catch (_) {}
    }
    for (const face of [...state.correctedFaces]) {
      try {
        if (!face || face.isDisposed?.()) {
          state.correctedFaces.delete(face);
          continue;
        }
        face.setEnabled?.(true);
        face.isVisible = true;
        face.visibility = 1;
        face.isPickable = true;
        face.rotation.x = 0;
        face.rotation.z = 0;
        face.billboardMode = window.BABYLON?.Mesh?.BILLBOARDMODE_NONE ?? 0;
      } catch (_) {}
    }
  }

  function updateAudit() {
    window.__UCAN_R6_LEGACY_SIGN_GUARD__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      beforeRenderGuard:true,
      fullSceneScanPerFrame:false,
      r4FacesSuppressed:true,
      r5FacesSuppressed:true,
      correctedR6FacesForcedVisible:true,
      legacyMeshes:state.legacyMeshes.size,
      correctedFaces:state.correctedFaces.size,
      scans:state.scans,
      suppressions:state.suppressions,
      lastError:state.lastError,
      refresh:scan,
      getState:() => ({
        installed:state.installed,
        legacyMeshes:state.legacyMeshes.size,
        correctedFaces:state.correctedFaces.size,
        scans:state.scans,
        suppressions:state.suppressions,
        lastError:state.lastError
      })
    };
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    if (!state.scene || window.__UCAN_VISUAL_INTERACTION_V304_R6__?.installed !== true) return false;
    state.installed = true;
    scan();
    state.scene.onBeforeRenderObservable.add(() => {
      try { suppress(); }
      catch (error) {
        state.lastError = { name:String(error?.name || 'Error'), message:String(error?.message || error), at:new Date().toISOString() };
        updateAudit();
      }
    });
    let fastScans = 0;
    const fastTimer = window.setInterval(() => {
      scan();
      fastScans += 1;
      if (fastScans >= 40) window.clearInterval(fastTimer);
    }, 250);
    window.setInterval(scan, 1500);
    updateAudit();
    console.info('[UCAN V304 R6 Guard] Carteles antiguos R4/R5 bloqueados antes del renderizado.');
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (install() || attempts >= 420) window.clearInterval(timer);
  }, 100);

  updateAudit();
})();