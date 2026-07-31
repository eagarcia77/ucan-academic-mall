(() => {
  'use strict';

  const B = window.BABYLON;
  const VERSION = 'V325';
  const REVISION = 'R29';
  const BUILD = 'V325-20260731-STABLE-RENDER-NO-FLICKER-R29';
  const nativeSetInterval = window.setInterval.bind(window);
  const nativeClearInterval = window.clearInterval.bind(window);
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);
  const nativeObservableAdd = B?.Observable?.prototype?.add || null;

  const state = {
    installed:false,
    scene:null,
    helper:null,
    blockedIntervals:0,
    blockedTimeouts:0,
    blockedObservers:0,
    removedObservers:0,
    geometryStabilizations:0,
    hiddenGlassMaintained:0,
    visualNoOps:0,
    stablePasses:0,
    lastPassAt:null,
    lastError:null
  };

  const blockedTimerIds = new Set();
  const finite = value => Number.isFinite(Number(value));
  const close = (a,b,e=0.002) => Math.abs(Number(a)-Number(b)) <= e;

  function callbackSource(callback) {
    try { return typeof callback === 'function' ? Function.prototype.toString.call(callback) : ''; }
    catch (_) { return ''; }
  }

  function isConflictingInterval(callback, delay) {
    const source = callbackSource(callback);
    const maintenanceRate = Number(delay) >= 1500 && Number(delay) <= 2100;
    if (!maintenanceRate) return false;
    return (
      (/applyVrReferenceToEveryMode\(\)/.test(source) && /repairCanonical\(true\)/.test(source)) ||
      /clearStairGeometry\(\)/.test(source) ||
      /apply\(state\.mode\)/.test(source)
    );
  }

  function isConflictingTimeout(callback) {
    const source = callbackSource(callback);
    return /captureCanonical\(\).*repairCanonical\(true\)/s.test(source) ||
      (/repairCanonical\(true\)/.test(source) && !/V325/.test(source));
  }

  window.setInterval = function setStableInterval(callback, delay, ...args) {
    if (isConflictingInterval(callback, delay)) {
      state.blockedIntervals += 1;
      const id = nativeSetTimeout(() => blockedTimerIds.delete(id), 0x7fffffff);
      blockedTimerIds.add(id);
      publish();
      return id;
    }
    return nativeSetInterval(callback, delay, ...args);
  };

  window.clearInterval = function clearStableInterval(id) {
    if (blockedTimerIds.has(id)) {
      blockedTimerIds.delete(id);
      nativeClearTimeout(id);
      return;
    }
    nativeClearInterval(id);
  };

  window.setTimeout = function setStableTimeout(callback, delay, ...args) {
    if (isConflictingTimeout(callback)) {
      state.blockedTimeouts += 1;
      const id = nativeSetTimeout(() => blockedTimerIds.delete(id), 0x7fffffff);
      blockedTimerIds.add(id);
      publish();
      return id;
    }
    return nativeSetTimeout(callback, delay, ...args);
  };

  window.clearTimeout = function clearStableTimeout(id) {
    if (blockedTimerIds.has(id)) blockedTimerIds.delete(id);
    nativeClearTimeout(id);
  };

  function conflictingObserver(callback) {
    const source = callbackSource(callback);
    return /repairCanonical\(false\)/.test(source) ||
      (/profile\(\)/.test(source) && /repair\(false\)/.test(source)) ||
      (/repairCanonical\(true\)/.test(source) && /state\.inXR/.test(source)) ||
      (/setTimeout\(\(\)=>repair\(true\)/.test(source) && /st\.inXR/.test(source));
  }

  if (nativeObservableAdd && B?.Observable?.prototype) {
    B.Observable.prototype.add = function addStableObserver(callback, ...args) {
      if (conflictingObserver(callback)) {
        state.blockedObservers += 1;
        publish();
        return { callback:null, __ucanV325Blocked:true };
      }
      return nativeObservableAdd.call(this, callback, ...args);
    };
  }

  function wrapVisualApi(api) {
    if (!api || api.__ucanV325Wrapped) return api;
    const originalSetMode = typeof api.setMode === 'function' ? api.setMode.bind(api) : null;
    if (originalSetMode) {
      api.setMode = (mode, announce = true) => {
        const current = api.getState?.() || api;
        if (!announce && current.mode === mode) {
          state.visualNoOps += 1;
          publish();
          return true;
        }
        return originalSetMode(mode, announce);
      };
    }
    Object.defineProperty(api, '__ucanV325Wrapped', { value:true, configurable:true });
    return api;
  }

  function wrapParallelApi(api) {
    if (!api || api.__ucanV325Wrapped) return api;
    api.repair = () => 0;
    api.refresh = () => {
      stabilizeGeometry('parallel-refresh');
      return 0;
    };
    Object.defineProperty(api, '__ucanV325Wrapped', { value:true, configurable:true });
    return api;
  }

  function hookGlobal(name, wrapper) {
    let value = window[name];
    try {
      Object.defineProperty(window, name, {
        configurable:true,
        enumerable:true,
        get:() => value,
        set:next => {
          value = wrapper(next);
          nativeSetTimeout(() => stabilize(`global:${name}`), 0);
        }
      });
      if (value) value = wrapper(value);
    } catch (_) {}
  }

  hookGlobal('__UCAN_VISUAL_COMFORT_V323__', wrapVisualApi);
  hookGlobal('__UCAN_PARALLEL_SCENE_V313__', wrapParallelApi);

  function removeExistingObservers() {
    let removed = 0;
    const removeFrom = observable => {
      if (!observable?.observers || typeof observable.remove !== 'function') return;
      for (const observer of [...observable.observers]) {
        if (!observer || observer.__ucanV325Blocked) continue;
        if (conflictingObserver(observer.callback)) {
          try { observable.remove(observer); removed += 1; } catch (_) {}
        }
      }
    };
    removeFrom(state.scene?.onBeforeRenderObservable);
    removeFrom(state.helper?.baseExperience?.onStateChangedObservable);
    state.removedObservers += removed;
    return removed;
  }

  function maintainHiddenGeometry() {
    if (!state.scene) return 0;
    let changed = 0;
    for (const mesh of state.scene.meshes || []) {
      if (!mesh || mesh.isDisposed?.()) continue;
      const data = mesh.metadata || {};
      if (data.hiddenByV322 === true) {
        try { if (mesh.isEnabled?.() !== false) { mesh.setEnabled?.(false); changed += 1; } } catch (_) {}
        if (mesh.isVisible !== false) { mesh.isVisible = false; changed += 1; }
        if (Number(mesh.visibility ?? 1) !== 0) { mesh.visibility = 0; changed += 1; }
        if (mesh.isPickable !== false) { mesh.isPickable = false; changed += 1; }
        if (mesh.checkCollisions !== false) { mesh.checkCollisions = false; changed += 1; }
        mesh.metadata = { ...data, noCanonicalRepairV325:true, dynamicSharedV313:true };
      } else if (data.collisionClearedByV322 === true) {
        if (mesh.checkCollisions !== false) { mesh.checkCollisions = false; changed += 1; }
        if (mesh.isPickable !== false) { mesh.isPickable = false; changed += 1; }
      }
    }
    state.hiddenGlassMaintained += changed;
    return changed;
  }

  function stabilizeGeometry(reason = 'stability-pass') {
    try {
      const stair = window.__UCAN_STAIR_AUTHORITY_V322__;
      if (stair?.installed && typeof stair.clearStairGeometry === 'function') {
        stair.clearStairGeometry();
        state.geometryStabilizations += 1;
      }
      maintainHiddenGeometry();
      removeExistingObservers();
      state.lastPassAt = { reason, at:new Date().toISOString() };
      publish();
      return true;
    } catch (error) {
      state.lastError = { stage:'geometry', message:String(error?.message || error), at:new Date().toISOString() };
      publish();
      return false;
    }
  }

  function stabilize(reason = 'pass') {
    state.scene = window.__UCAN_API__?.getScene?.() || state.scene;
    state.helper = window.__UCAN_XR_HELPER__ || state.helper;
    removeExistingObservers();
    stabilizeGeometry(reason);
    const visual = window.__UCAN_VISUAL_COMFORT_V323__;
    const visualState = visual?.getState?.();
    if (visual?.setMode && visualState?.mode) visual.setMode(visualState.mode, false);
    state.stablePasses += 1;
    publish();
    return true;
  }

  function bindXr() {
    state.helper = window.__UCAN_XR_HELPER__ || state.helper;
    const observable = state.helper?.baseExperience?.onStateChangedObservable;
    if (!observable || observable.__ucanV325StableBound) return false;
    observable.__ucanV325StableBound = true;
    observable.add(() => {
      nativeSetTimeout(() => stabilize('xr-transition-120'), 120);
      nativeSetTimeout(() => stabilize('xr-transition-700'), 700);
    });
    return true;
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    state.helper = window.__UCAN_XR_HELPER__ || null;
    if (!state.scene) return false;
    state.installed = true;
    bindXr();
    for (const delay of [0,180,500,1100,2200,3600,5200,7600]) {
      nativeSetTimeout(() => stabilize(`startup-${delay}`), delay);
    }
    publish();
    console.info('[UCAN V325 R29] Render estable instalado; reparaciones visuales periódicas conflictivas desactivadas.');
    return true;
  }

  function getState() {
    return {
      installed:state.installed,
      singleStableVisualAuthority:true,
      periodicCanonicalRepairsDisabled:true,
      periodicGlassToggleDisabled:true,
      periodicLightReapplicationDisabled:true,
      perFrameRenderRepairDisabled:true,
      xrTransitionRepairLimited:true,
      movesCamera:false,
      changesGround:false,
      blockedIntervals:state.blockedIntervals,
      blockedTimeouts:state.blockedTimeouts,
      blockedObservers:state.blockedObservers,
      removedObservers:state.removedObservers,
      geometryStabilizations:state.geometryStabilizations,
      hiddenGlassMaintained:state.hiddenGlassMaintained,
      visualNoOps:state.visualNoOps,
      stablePasses:state.stablePasses,
      lastPassAt:state.lastPassAt,
      lastError:state.lastError
    };
  }

  function publish() {
    window.__UCAN_RENDER_STABILITY_V325__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      ...getState(),
      stabilize,
      getState
    };
  }

  let attempts = 0;
  if (install()) { publish(); return; }
  const timer = nativeSetInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 700) nativeClearInterval(timer);
    } catch (error) {
      state.lastError = { stage:'install', message:String(error?.message || error), at:new Date().toISOString() };
      publish();
      if (attempts >= 700) nativeClearInterval(timer);
    }
  }, 100);

  publish();
})();