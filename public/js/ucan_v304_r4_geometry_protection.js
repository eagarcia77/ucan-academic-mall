(() => {
  'use strict';

  const VERSION = 'V304';
  const REVISION = 'R4-PROTECTION';
  const BUILD = 'V304-20260725-R4-GEOMETRY-PROTECTION';
  const state = { scene:null, protectedMeshes:0, restoredMeshes:0, scans:0, lastError:null };

  function protect() {
    state.scene = window.__UCAN_API__?.getScene?.() || state.scene;
    if (!state.scene) return;
    let protectedMeshes = 0;
    let restoredMeshes = 0;
    for (const mesh of [...(state.scene.meshes || [])]) {
      if (mesh?.metadata?.ucanQuestTransparentSurfaceV304R4 !== true) continue;
      const hidden = mesh.isEnabled?.() === false || mesh.isVisible === false || Number(mesh.visibility ?? 1) <= 0;
      mesh.metadata = {
        ...(mesh.metadata || {}),
        // V303 preserva explícitamente las mallas con este marcador estructural.
        stairLowerRail:true,
        questProtectedTransparentSurfaceV304R4:true
      };
      delete mesh.metadata.ucanQuestGeometryRemovedV303;
      delete mesh.metadata.ucanQuestGeometryRevisionV303;
      delete mesh.metadata.ucanQuestGeometryReasonV303;
      try { mesh.setEnabled?.(true); } catch (_) {}
      mesh.isVisible = true;
      mesh.visibility = 0.46;
      mesh.isPickable = false;
      mesh.checkCollisions = false;
      protectedMeshes += 1;
      if (hidden) restoredMeshes += 1;
    }
    state.protectedMeshes = protectedMeshes;
    state.restoredMeshes += restoredMeshes;
    state.scans += 1;
    updateAudit();
  }

  function updateAudit() {
    window.__UCAN_QUEST_V304_R4_PROTECTION__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      protectedMeshes:state.protectedMeshes,
      restoredMeshes:state.restoredMeshes,
      scans:state.scans,
      v303RehidePrevented:true,
      lastError:state.lastError,
      refresh:protect,
      getState:() => ({ ...state })
    };
  }

  let fastScans = 0;
  const fastTimer = window.setInterval(() => {
    try {
      protect();
      fastScans += 1;
      if (fastScans >= 120) window.clearInterval(fastTimer);
    } catch (error) {
      state.lastError = { name:String(error?.name || 'Error'), message:String(error?.message || error), at:new Date().toISOString() };
      updateAudit();
    }
  }, 25);

  window.setInterval(() => {
    try { protect(); }
    catch (error) {
      state.lastError = { name:String(error?.name || 'Error'), message:String(error?.message || error), at:new Date().toISOString() };
      updateAudit();
    }
  }, 1200);

  updateAudit();
})();