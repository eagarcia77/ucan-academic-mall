(() => {
  'use strict';

  const VERSION = 'V304';
  const BUILD = 'V304-20260723-XR-FLOATING-VR-MR-BETA';
  const B = window.BABYLON;
  if (!B) return;

  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const state = {
    helper:null,
    scene:null,
    installed:false,
    entering:false,
    inXR:false,
    activeMode:null,
    requestedMode:null,
    vrSupported:null,
    mrSupported:null,
    floatingButton:null,
    xrButton:null,
    mrButton:null,
    observerInstalled:false,
    hiddenForMR:new Map(),
    savedScene:null,
    attempts:{ vr:0, mr:0 },
    successfulEntries:{ vr:0, mr:0 },
    exits:0,
    lastError:null
  };

  function status(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const element = document.getElementById('status');
    if (element && !window.__UCAN_API__?.setStatus) element.textContent = message;
  }

  function recordError(stage, error) {
    state.lastError = {
      stage,
      name:String(error?.name || 'Error'),
      message:String(error?.message || error || 'Error XR desconocido'),
      at:new Date().toISOString()
    };
    console.error(`[UCAN ${VERSION} XR] ${stage}:`, error);
    updateAudit();
  }

  function helperReady() {
    state.helper = window.__UCAN_XR_HELPER__ || state.helper;
    state.scene = window.__UCAN_API__?.getScene?.() || state.scene;
    return Boolean(state.helper?.baseExperience && state.scene);
  }

  async function sessionSupported(mode) {
    if (!window.isSecureContext || !navigator.xr?.isSessionSupported) return false;
    try { return await navigator.xr.isSessionSupported(mode); }
    catch (error) {
      recordError(`isSessionSupported:${mode}`, error);
      return false;
    }
  }

  function ensureStyles() {
    if (document.getElementById('ucanXrEntryStylesV304')) return;
    const style = document.createElement('style');
    style.id = 'ucanXrEntryStylesV304';
    style.textContent = `
      #ucanVrGogglesV304{
        position:fixed;
        right:max(18px,env(safe-area-inset-right));
        bottom:max(18px,env(safe-area-inset-bottom));
        z-index:44;
        width:74px;
        height:60px;
        display:grid;
        place-items:center;
        padding:0;
        border-radius:18px;
        border:2px solid rgba(255,255,255,.92);
        background:linear-gradient(145deg,#08725e,#063d35);
        color:#fff;
        box-shadow:0 14px 38px rgba(0,0,0,.48),0 0 0 4px rgba(254,209,65,.24);
        cursor:pointer;
        -webkit-tap-highlight-color:transparent;
      }
      #ucanVrGogglesV304:hover,#ucanVrGogglesV304:focus-visible{transform:translateY(-2px);box-shadow:0 18px 44px rgba(0,0,0,.58),0 0 0 5px rgba(254,209,65,.34)}
      #ucanVrGogglesV304:disabled{opacity:.5;cursor:not-allowed;transform:none}
      #ucanVrGogglesV304[aria-pressed="true"]{background:linear-gradient(145deg,#b8402e,#6f1d16)}
      #ucanVrGogglesV304 svg{width:48px;height:34px;display:block}
      #ucanVrGogglesV304 .label{position:absolute;bottom:3px;font:800 9px/1 Segoe UI,Arial,sans-serif;letter-spacing:.08em}
      html.ucan-mr-active-v304,html.ucan-mr-active-v304 body,html.ucan-mr-active-v304 #renderCanvas{background:transparent!important}
      @media(max-width:820px){#ucanVrGogglesV304{right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));width:68px;height:56px}}
    `;
    document.head.appendChild(style);
  }

  function ensureFloatingButton() {
    ensureStyles();
    let button = document.getElementById('ucanVrGogglesV304');
    if (!button) {
      button = document.createElement('button');
      button.id = 'ucanVrGogglesV304';
      button.type = 'button';
      button.setAttribute('aria-label', 'Entrar al entorno en realidad virtual');
      button.setAttribute('title', 'Entrar en VR');
      button.setAttribute('aria-pressed', 'false');
      button.innerHTML = `
        <svg viewBox="0 0 64 42" aria-hidden="true" focusable="false">
          <path d="M8 9.5h48c2.8 0 5 2.2 5 5v11.2c0 5.7-4.6 10.3-10.3 10.3h-8.2c-3.3 0-6.4-1.6-8.3-4.3L32 28.5l-2.2 3.2c-1.9 2.7-5 4.3-8.3 4.3h-8.2C7.6 36 3 31.4 3 25.7V14.5c0-2.8 2.2-5 5-5Z" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/>
          <path d="M23 17.5h18M32 17.5v10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
          <circle cx="17" cy="23" r="5.2" fill="none" stroke="currentColor" stroke-width="2.8"/>
          <circle cx="47" cy="23" r="5.2" fill="none" stroke="currentColor" stroke-width="2.8"/>
        </svg>
        <span class="label">VR</span>`;
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleVR();
      }, true);
      document.body.appendChild(button);
    }
    state.floatingButton = button;
    updateButtons();
  }

  function replaceAndBindButton(id, mode) {
    const existing = document.getElementById(id);
    if (!existing) return null;
    if (existing.dataset.ucanV304XrBound === 'true') return existing;
    const button = existing.cloneNode(true);
    button.dataset.ucanV289Bound = 'true';
    button.dataset.ucanV304XrBound = 'true';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (mode === 'immersive-ar') toggleMR();
      else toggleVR();
    }, true);
    existing.replaceWith(button);
    return button;
  }

  function bindButtons() {
    state.xrButton = replaceAndBindButton('xrBtn', 'immersive-vr') || state.xrButton;
    state.mrButton = replaceAndBindButton('mrBtn', 'immersive-ar') || state.mrButton;
    ensureFloatingButton();
    updateButtons();
  }

  function currentXRState() {
    return state.helper?.baseExperience?.state ?? XR_STATE.NOT_IN_XR;
  }

  function updateButtons() {
    const xrState = currentXRState();
    const active = xrState === XR_STATE.ENTERING_XR || xrState === XR_STATE.IN_XR;
    state.inXR = active;
    const mode = state.activeMode || state.requestedMode;

    if (state.xrButton) {
      state.xrButton.disabled = state.entering || !state.helper;
      state.xrButton.textContent = active && mode === 'immersive-vr' ? 'Salir de VR' : state.entering && state.requestedMode === 'immersive-vr' ? 'Entrando en VR…' : 'Entrar en VR';
      state.xrButton.setAttribute('aria-pressed', String(active && mode === 'immersive-vr'));
    }
    if (state.mrButton) {
      state.mrButton.disabled = state.entering || !state.helper || state.mrSupported === false;
      state.mrButton.textContent = active && mode === 'immersive-ar' ? 'Salir de MR' : state.entering && state.requestedMode === 'immersive-ar' ? 'Entrando en MR…' : state.mrSupported === false ? 'MR no disponible' : 'MR beta';
      state.mrButton.setAttribute('aria-pressed', String(active && mode === 'immersive-ar'));
      state.mrButton.title = state.mrSupported === false ? 'Este navegador no informó soporte para immersive-ar.' : 'Activar realidad mixta con passthrough';
    }
    if (state.floatingButton) {
      state.floatingButton.disabled = state.entering || !state.helper || state.vrSupported === false;
      state.floatingButton.setAttribute('aria-pressed', String(active && mode === 'immersive-vr'));
      state.floatingButton.setAttribute('aria-label', active ? 'Salir del entorno de realidad virtual' : 'Entrar al entorno en realidad virtual');
      state.floatingButton.title = active ? `Salir de ${mode === 'immersive-ar' ? 'MR' : 'VR'}` : 'Entrar en VR';
    }
    updateAudit();
  }

  function isSkyOrBackground(mesh) {
    const name = String(mesh?.name || '');
    const metadata = mesh?.metadata || {};
    if (metadata.skyObject || metadata.skyDome || metadata.celestialSky || metadata.environmentBackground) return true;
    return /(?:^|\s)(cielo|sky|domo|firmamento|fondo celeste|estrellas|sol visual|luna visual)(?:\s|$)/i.test(name);
  }

  function prepareMixedReality() {
    if (!state.scene || state.savedScene) return;
    const canvas = document.getElementById('renderCanvas');
    state.savedScene = {
      clearColor:state.scene.clearColor?.clone?.() || state.scene.clearColor,
      autoClear:state.scene.autoClear,
      canvasBackground:canvas?.style?.background || '',
      bodyBackground:document.body.style.background || ''
    };
    if (B.Color4) state.scene.clearColor = new B.Color4(0, 0, 0, 0);
    state.scene.autoClear = true;
    if (canvas) canvas.style.background = 'transparent';
    document.body.style.background = 'transparent';
    document.documentElement.classList.add('ucan-mr-active-v304');

    for (const mesh of state.scene.meshes || []) {
      if (!mesh || !isSkyOrBackground(mesh) || state.hiddenForMR.has(mesh)) continue;
      state.hiddenForMR.set(mesh, {
        enabled:mesh.isEnabled?.() !== false,
        isVisible:mesh.isVisible,
        visibility:mesh.visibility
      });
      mesh.setEnabled?.(false);
      mesh.isVisible = false;
      mesh.visibility = 0;
    }
  }

  function restoreMixedReality() {
    if (state.scene && state.savedScene) {
      if (state.savedScene.clearColor) state.scene.clearColor = state.savedScene.clearColor;
      state.scene.autoClear = state.savedScene.autoClear;
      const canvas = document.getElementById('renderCanvas');
      if (canvas) canvas.style.background = state.savedScene.canvasBackground;
      document.body.style.background = state.savedScene.bodyBackground;
    }
    for (const [mesh, original] of state.hiddenForMR) {
      try {
        mesh.setEnabled?.(original.enabled);
        mesh.isVisible = original.isVisible;
        mesh.visibility = original.visibility;
      } catch (_) {}
    }
    state.hiddenForMR.clear();
    state.savedScene = null;
    document.documentElement.classList.remove('ucan-mr-active-v304');
  }

  async function waitForNotInXR(timeoutMs = 5000) {
    const start = performance.now();
    while (currentXRState() !== XR_STATE.NOT_IN_XR && performance.now() - start < timeoutMs) {
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    return currentXRState() === XR_STATE.NOT_IN_XR;
  }

  async function exitXR() {
    if (!helperReady()) return false;
    try {
      await state.helper.baseExperience.exitXRAsync();
      await waitForNotInXR();
      restoreMixedReality();
      state.exits += 1;
      state.inXR = false;
      state.activeMode = null;
      state.requestedMode = null;
      status('Sesión XR finalizada.');
      updateButtons();
      return true;
    } catch (error) {
      recordError('exitXR', error);
      status('No se pudo cerrar la sesión XR. Recargue la página si el visor permanece conectado.');
      return false;
    }
  }

  async function enterMode(mode) {
    if (!helperReady()) {
      status('WebXR todavía está inicializando. Espere unos segundos y vuelva a intentarlo.');
      return false;
    }
    if (state.entering) return false;

    const active = currentXRState() === XR_STATE.ENTERING_XR || currentXRState() === XR_STATE.IN_XR;
    if (active) {
      if (state.activeMode === mode || state.requestedMode === mode) return exitXR();
      const exited = await exitXR();
      if (!exited) return false;
    }

    state.entering = true;
    state.requestedMode = mode;
    state.activeMode = mode;
    if (mode === 'immersive-ar') state.attempts.mr += 1;
    else state.attempts.vr += 1;
    updateButtons();

    try {
      if (!window.isSecureContext) throw new DOMException('WebXR requiere HTTPS.', 'SecurityError');
      if (!navigator.xr) throw new DOMException('La API WebXR no está disponible.', 'NotSupportedError');
      const supported = await sessionSupported(mode);
      if (mode === 'immersive-ar') state.mrSupported = supported;
      else state.vrSupported = supported;
      if (!supported) throw new DOMException(`${mode} no está disponible en este navegador o dispositivo.`, 'NotSupportedError');

      if (mode === 'immersive-ar') prepareMixedReality();
      else restoreMixedReality();

      const optionalFeatures = mode === 'immersive-ar'
        ? ['local-floor', 'bounded-floor', 'hand-tracking', 'hit-test', 'anchors', 'layers']
        : ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'];
      const renderTarget = state.helper.renderTarget || state.helper.baseExperience?.renderTarget;
      status(mode === 'immersive-ar' ? 'Solicitando realidad mixta y passthrough en Meta Quest…' : 'Solicitando entrada al entorno VR…');
      await state.helper.baseExperience.enterXRAsync(
        mode,
        'local-floor',
        renderTarget,
        { optionalFeatures }
      );

      state.inXR = true;
      if (mode === 'immersive-ar') {
        state.successfulEntries.mr += 1;
        status('MR Beta activo: la escena virtual está conectada al passthrough del Meta Quest.');
      } else {
        state.successfulEntries.vr += 1;
        status('Entorno VR activo. Use los controles del Meta Quest para desplazarse.');
      }
      return true;
    } catch (error) {
      recordError(mode === 'immersive-ar' ? 'enterMR' : 'enterVR', error);
      restoreMixedReality();
      state.inXR = false;
      state.activeMode = null;
      state.requestedMode = null;
      const name = String(error?.name || 'Error');
      if (mode === 'immersive-ar' && name === 'NotSupportedError') {
        status('MR Beta no está disponible en este navegador. Actualice Meta Quest Browser o use Entrar en VR.');
      } else if (name === 'SecurityError') {
        status('WebXR requiere abrir el campus directamente mediante HTTPS.');
      } else {
        status(`No se pudo iniciar ${mode === 'immersive-ar' ? 'MR' : 'VR'}: ${error?.message || error}`);
      }
      return false;
    } finally {
      state.entering = false;
      updateButtons();
    }
  }

  const toggleVR = () => enterMode('immersive-vr');
  const toggleMR = () => enterMode('immersive-ar');

  function observeXRState() {
    if (state.observerInstalled || !helperReady()) return;
    state.observerInstalled = true;
    state.helper.baseExperience.onStateChangedObservable?.add?.(xrState => {
      state.inXR = xrState === XR_STATE.ENTERING_XR || xrState === XR_STATE.IN_XR;
      if (xrState === XR_STATE.NOT_IN_XR) {
        restoreMixedReality();
        state.activeMode = null;
        state.requestedMode = null;
      }
      updateButtons();
    });
  }

  async function detectSupport() {
    state.vrSupported = await sessionSupported('immersive-vr');
    state.mrSupported = await sessionSupported('immersive-ar');
    updateButtons();
  }

  function updateAudit() {
    window.__UCAN_XR_ENTRY_MR_V304__ = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      helperReady:Boolean(state.helper),
      floatingVrGogglesVisible:Boolean(state.floatingButton?.isConnected),
      floatingVrGogglesLowerRight:true,
      existingVrButtonRebound:Boolean(state.xrButton?.dataset?.ucanV304XrBound),
      mrBetaButtonRebound:Boolean(state.mrButton?.dataset?.ucanV304XrBound),
      vrUsesBabylonExperienceHelper:true,
      mrUsesBabylonExperienceHelper:true,
      mrSessionMode:'immersive-ar',
      vrSessionMode:'immersive-vr',
      referenceSpaceType:'local-floor',
      transparentPassthroughBackground:true,
      skyHiddenOnlyDuringMR:true,
      sceneRestoredAfterMR:true,
      vrSupported:state.vrSupported,
      mrSupported:state.mrSupported,
      entering:state.entering,
      inXR:state.inXR,
      activeMode:state.activeMode,
      attempts:{ ...state.attempts },
      successfulEntries:{ ...state.successfulEntries },
      exits:state.exits,
      lastError:state.lastError,
      enterVR:toggleVR,
      enterMR:toggleMR,
      exit:exitXR,
      getState:() => ({
        installed:state.installed,
        helperReady:Boolean(state.helper),
        floatingButtonVisible:Boolean(state.floatingButton?.isConnected),
        vrSupported:state.vrSupported,
        mrSupported:state.mrSupported,
        entering:state.entering,
        inXR:state.inXR,
        activeMode:state.activeMode,
        hiddenForMR:state.hiddenForMR.size,
        lastError:state.lastError
      })
    };
  }

  function install() {
    if (!helperReady()) return false;
    bindButtons();
    observeXRState();
    state.installed = true;
    detectSupport().catch(error => recordError('detectSupport', error));
    updateAudit();
    console.info(`[UCAN ${VERSION}] Acceso flotante VR y MR Beta funcional instalados.`);
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    bindButtons();
    if (install() || attempts >= 300) window.clearInterval(timer);
  }, 100);

  window.setInterval(() => {
    try { bindButtons(); observeXRState(); } catch (error) { recordError('maintenance', error); }
  }, 2000);

  updateAudit();
})();
