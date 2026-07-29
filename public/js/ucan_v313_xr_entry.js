(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V313';
  const REVISION = 'R17';
  const BUILD = 'V313-20260729-PARALLEL-XR-ENTRY-R17';
  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });

  const state = {
    helper:null,
    installed:false,
    entering:false,
    inXR:false,
    activeMode:'browser',
    requestedMode:null,
    vrSupported:null,
    mrSupported:null,
    xrButton:null,
    mrButton:null,
    floatingButton:null,
    attempts:{ vr:0, mr:0 },
    entries:{ vr:0, mr:0 },
    exits:0,
    lastError:null
  };

  function setStatus(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const element = document.getElementById('status');
    if (element && !window.__UCAN_API__?.setStatus) element.textContent = message;
  }

  function helperReady() {
    state.helper = window.__UCAN_XR_HELPER__ || state.helper;
    return Boolean(state.helper?.baseExperience);
  }

  function currentState() {
    return state.helper?.baseExperience?.state ?? XR_STATE.NOT_IN_XR;
  }

  function active() {
    const value = currentState();
    return value === XR_STATE.ENTERING_XR || value === XR_STATE.IN_XR;
  }

  async function probe(mode) {
    if (!window.isSecureContext || !navigator.xr?.isSessionSupported) return false;
    try { return await navigator.xr.isSessionSupported(mode); }
    catch (_) { return false; }
  }

  function recordError(stage, error) {
    state.lastError = {
      stage,
      name:String(error?.name || 'Error'),
      message:String(error?.message || error || 'Error XR'),
      at:new Date().toISOString()
    };
    console.error(`[UCAN ${VERSION} XR] ${stage}:`, error);
    updateAudit();
  }

  function updateButtons() {
    state.inXR = active();
    const mode = state.activeMode === 'browser' ? state.requestedMode : state.activeMode;
    if (state.xrButton) {
      state.xrButton.disabled = state.entering;
      state.xrButton.textContent = state.inXR && mode === 'immersive-vr' ? 'Salir de VR' : state.entering && state.requestedMode === 'immersive-vr' ? 'Entrando en VR…' : 'Entrar en VR';
      state.xrButton.setAttribute('aria-pressed', String(state.inXR && mode === 'immersive-vr'));
    }
    if (state.mrButton) {
      state.mrButton.disabled = state.entering;
      state.mrButton.textContent = state.inXR && mode === 'immersive-ar' ? 'Salir de MR' : state.entering && state.requestedMode === 'immersive-ar' ? 'Entrando en MR…' : 'MR · mismo entorno';
      state.mrButton.setAttribute('aria-pressed', String(state.inXR && mode === 'immersive-ar'));
      state.mrButton.title = 'Usa la misma escena, objetos e interacción del browser y VR.';
    }
    if (state.floatingButton) {
      state.floatingButton.disabled = state.entering;
      state.floatingButton.setAttribute('aria-pressed', String(state.inXR));
      state.floatingButton.textContent = state.inXR ? 'Salir XR' : 'VR';
    }
    updateAudit();
  }

  async function exitXR() {
    if (!helperReady()) return false;
    try {
      await state.helper.baseExperience.exitXRAsync();
      state.exits += 1;
      state.inXR = false;
      state.activeMode = 'browser';
      state.requestedMode = null;
      setStatus('Sesión XR finalizada. La escena continúa sin cambios en el browser.');
      window.__UCAN_PARALLEL_SCENE_V313__?.repair?.();
      updateButtons();
      return true;
    } catch (error) {
      recordError('exit', error);
      setStatus(`No se pudo cerrar XR: ${error?.message || error}`);
      return false;
    }
  }

  async function enter(mode) {
    if (state.entering) return false;
    if (active()) return exitXR();
    if (!helperReady() || !window.isSecureContext || !navigator.xr) {
      const error = !window.isSecureContext
        ? new DOMException('WebXR requiere HTTPS.', 'SecurityError')
        : !navigator.xr
          ? new DOMException('La API WebXR no está disponible.', 'NotSupportedError')
          : new Error('Babylon WebXR todavía no está preparado.');
      recordError('pre-entry', error);
      setStatus(`${error.name}: ${error.message}`);
      return false;
    }

    state.entering = true;
    state.requestedMode = mode;
    state.activeMode = mode;
    if (mode === 'immersive-ar') state.attempts.mr += 1;
    else state.attempts.vr += 1;
    updateButtons();

    try {
      window.__UCAN_PARALLEL_SCENE_V313__?.repair?.();
      let promise;
      if (mode === 'immersive-ar') {
        const renderTarget = state.helper.renderTarget || state.helper.baseExperience?.renderTarget;
        promise = state.helper.baseExperience.enterXRAsync('immersive-ar', 'local-floor', renderTarget, {
          optionalFeatures:['local-floor','bounded-floor','hand-tracking','hit-test','anchors','layers']
        });
      } else {
        promise = state.helper.baseExperience.enterXRAsync('immersive-vr', 'local-floor');
      }
      await promise;
      state.inXR = true;
      if (mode === 'immersive-ar') state.entries.mr += 1;
      else state.entries.vr += 1;
      window.setTimeout(() => window.__UCAN_PARALLEL_SCENE_V313__?.repair?.(), 0);
      window.setTimeout(() => window.__UCAN_PARALLEL_SCENE_V313__?.repair?.(), 180);
      setStatus(mode === 'immersive-ar'
        ? 'MR activo con la misma escena, geometría, materiales e interacción de los demás entornos.'
        : 'VR activo con la misma escena, geometría, materiales e interacción del browser.');
      return true;
    } catch (error) {
      recordError(mode === 'immersive-ar' ? 'enter-mr' : 'enter-vr', error);
      state.inXR = false;
      state.activeMode = 'browser';
      state.requestedMode = null;
      setStatus(`No se pudo iniciar ${mode === 'immersive-ar' ? 'MR' : 'VR'}: ${error?.name || 'Error'} — ${error?.message || error}`);
      return false;
    } finally {
      state.entering = false;
      updateButtons();
    }
  }

  function bindButton(id, mode) {
    const original = document.getElementById(id);
    if (!original) return null;
    if (original.dataset.ucanV313XrBound === 'true') return original;
    const button = original.cloneNode(true);
    button.dataset.ucanV313XrBound = 'true';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      enter(mode);
    }, true);
    original.replaceWith(button);
    return button;
  }

  function ensureFloatingButton() {
    let button = document.getElementById('ucanParallelXrV313');
    if (!button) {
      button = document.createElement('button');
      button.id = 'ucanParallelXrV313';
      button.type = 'button';
      button.className = 'secondary';
      button.textContent = 'VR';
      button.setAttribute('aria-label', 'Entrar o salir del entorno XR');
      button.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:46;min-width:64px;border:2px solid #fed141;box-shadow:0 12px 35px rgba(0,0,0,.45)';
      button.addEventListener('click', event => {
        event.preventDefault();
        enter('immersive-vr');
      }, true);
      document.body.appendChild(button);
    }
    state.floatingButton = button;
  }

  function bindHelperObserver() {
    if (!helperReady()) return false;
    const observable = state.helper.baseExperience.onStateChangedObservable;
    if (observable?.__ucanXrEntryV313Bound) return true;
    if (observable) {
      observable.__ucanXrEntryV313Bound = true;
      observable.add(value => {
        state.inXR = value === XR_STATE.ENTERING_XR || value === XR_STATE.IN_XR;
        if (value === XR_STATE.NOT_IN_XR) {
          state.activeMode = 'browser';
          state.requestedMode = null;
        }
        window.__UCAN_PARALLEL_SCENE_V313__?.repair?.();
        updateButtons();
      });
    }
    return true;
  }

  async function detectSupport() {
    const [vr, mr] = await Promise.all([probe('immersive-vr'), probe('immersive-ar')]);
    state.vrSupported = vr;
    state.mrSupported = mr;
    updateAudit();
  }

  function updateAudit() {
    window.__UCAN_XR_ENTRY_V313__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      activeMode:state.activeMode,
      inXR:state.inXR,
      entering:state.entering,
      vrSupported:state.vrSupported,
      mrSupported:state.mrSupported,
      sceneModifiedOnEntry:false,
      geometryHiddenForMr:false,
      skyHiddenForMr:false,
      materialsReplacedOnEntry:false,
      sameSceneAllModes:true,
      attempts:{ ...state.attempts },
      entries:{ ...state.entries },
      exits:state.exits,
      lastError:state.lastError,
      enterVr:() => enter('immersive-vr'),
      enterMr:() => enter('immersive-ar'),
      exit:exitXR,
      getState:() => ({
        installed:state.installed,
        activeMode:state.activeMode,
        inXR:state.inXR,
        sceneModifiedOnEntry:false,
        geometryHiddenForMr:false,
        sameSceneAllModes:true,
        lastError:state.lastError
      })
    };
  }

  function install() {
    if (state.installed) return true;
    state.xrButton = bindButton('xrBtn', 'immersive-vr');
    state.mrButton = bindButton('mrBtn', 'immersive-ar');
    ensureFloatingButton();
    if (!state.xrButton || !state.mrButton) return false;
    state.installed = true;
    bindHelperObserver();
    window.setInterval(bindHelperObserver, 400);
    detectSupport();
    updateButtons();
    console.info('[UCAN V313 R17] Entrada VR/MR unificada sin cambios de escena.');
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 600) window.clearInterval(timer);
    } catch (error) {
      recordError('install', error);
      if (attempts >= 600) window.clearInterval(timer);
    }
  }, 100);

  updateAudit();
})();
