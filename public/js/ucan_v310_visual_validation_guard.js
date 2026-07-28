(() => {
  'use strict';

  const VERSION = 'V310';
  const REVISION = 'R14';
  const state = {
    scene:null,
    installed:false,
    removals:0,
    scans:0,
    lastError:null
  };

  function removeContinuousTargets() {
    const scene = state.scene || window.__UCAN_API__?.getScene?.();
    if (!scene) return false;
    state.scene = scene;
    state.scans += 1;
    const targets = Array.isArray(scene.customRenderTargets) ? scene.customRenderTargets : [];
    for (let index = targets.length - 1; index >= 0; index -= 1) {
      const target = targets[index];
      if (target?.metadata?.validationRenderTargetV310 === true || /Render canónico de validación visual V310/i.test(String(target?.name || ''))) {
        targets.splice(index, 1);
        state.removals += 1;
      }
    }
    updateAudit();
    return true;
  }

  function updateAudit() {
    window.__UCAN_VISUAL_VALIDATION_GUARD_V310__ = {
      version:VERSION,
      revision:REVISION,
      installed:state.installed,
      manualRenderOnly:true,
      continuousRenderDisabled:true,
      removals:state.removals,
      scans:state.scans,
      lastError:state.lastError,
      refresh:removeContinuousTargets,
      getState:() => ({ installed:state.installed, manualRenderOnly:true, removals:state.removals, scans:state.scans, lastError:state.lastError })
    };
  }

  function protectKeyboard(event) {
    const panel = document.getElementById('ucanVisualValidationV310');
    if (!panel?.classList.contains('open')) return;
    if (!['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyR','Space'].includes(event.code)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    if (!state.scene) return false;
    state.installed = true;
    removeContinuousTargets();
    window.setInterval(removeContinuousTargets, 700);
    document.addEventListener('keydown', protectKeyboard, true);
    document.addEventListener('keyup', protectKeyboard, true);
    updateAudit();
    console.info('[UCAN V310 R14] Render de validación configurado para ejecución manual únicamente.');
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 600) window.clearInterval(timer);
    } catch (error) {
      state.lastError = { message:String(error?.message || error), at:new Date().toISOString() };
      updateAudit();
      if (attempts >= 600) window.clearInterval(timer);
    }
  }, 100);

  updateAudit();
})();
