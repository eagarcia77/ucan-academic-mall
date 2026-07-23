(() => {
  'use strict';

  const VERSION = 'V300';
  const BUILD = 'V300-20260723-DISABLE-V299-MOVEMENT';
  const state = { installed:false, removedObservers:0, attempts:0, lastError:null };

  window.__UCAN_QUEST_V300_SUPERSEDES_V299__ = true;

  function callbackLooksLikeV299(callback) {
    const source = String(callback || '');
    return source.includes("recordError('frame', error)") && source.includes('frame()');
  }

  function removeV299MovementObserver(scene) {
    const observable = scene?.onBeforeRenderObservable;
    const observers = Array.isArray(observable?.observers) ? [...observable.observers] : [];
    const candidates = observers.filter(observer => callbackLooksLikeV299(observer?.callback));
    if (!candidates.length) return false;
    const target = candidates[candidates.length - 1];
    observable.remove(target);
    state.removedObservers += 1;
    state.installed = true;
    window.__UCAN_V299_MOVEMENT_DISABLED_BY_V300__ = true;
    window.__UCAN_V300_V299_DISABLE_AUDIT__ = {
      version:VERSION,
      build:BUILD,
      installed:true,
      v299MovementObserverRemoved:true,
      removedObservers:state.removedObservers,
      attempts:state.attempts,
      lastError:state.lastError
    };
    console.info('[UCAN V300] Ciclo de movimiento V299 retirado; selección V299 preservada.');
    return true;
  }

  function boot() {
    state.attempts += 1;
    const scene = window.__UCAN_API__?.getScene?.();
    const v299Ready = window.__UCAN_BROWSER_XR_EMULATION_V299__?.version === 'V299';
    if (scene && v299Ready && removeV299MovementObserver(scene)) return;
    if (state.attempts < 500) window.setTimeout(boot, 50);
    else {
      state.lastError = { stage:'boot', message:'No se localizó el observador de movimiento V299.' };
      window.__UCAN_V300_V299_DISABLE_AUDIT__ = {
        version:VERSION,
        build:BUILD,
        installed:false,
        v299MovementObserverRemoved:false,
        removedObservers:state.removedObservers,
        attempts:state.attempts,
        lastError:state.lastError
      };
    }
  }

  window.__UCAN_V300_V299_DISABLE_AUDIT__ = {
    version:VERSION,
    build:BUILD,
    installed:false,
    v299MovementObserverRemoved:false,
    removedObservers:0,
    attempts:0,
    lastError:null
  };
  boot();
})();
