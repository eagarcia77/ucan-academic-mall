(() => {
  'use strict';

  const VERSION = 'V304';
  const BUILD = 'V304-20260724-XR-DIRECT-USER-GESTURE-VR-MR';
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
    diagnostics:null,
    diagnosticsBody:null,
    attempts:{ vr:0, mr:0 },
    successfulEntries:{ vr:0, mr:0 },
    exits:0,
    lastUserActivation:null,
    lastError:null
  };

  function status(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const element = document.getElementById('status');
    if (element && !window.__UCAN_API__?.setStatus) element.textContent = message;
  }

  function isTopLevel() {
    try { return window.top === window.self; }
    catch (_) { return false; }
  }

  function helperReady() {
    state.helper = window.__UCAN_XR_HELPER__ || state.helper;
    state.scene = window.__UCAN_API__?.getScene?.() || state.scene;
    return Boolean(state.helper?.baseExperience && state.scene);
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

  async function probeSupport(mode) {
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
      #ucanVrGogglesV304:disabled{opacity:.55;cursor:wait;transform:none}
      #ucanVrGogglesV304[aria-pressed="true"]{background:linear-gradient(145deg,#b8402e,#6f1d16)}
      #ucanVrGogglesV304 svg{width:48px;height:34px;display:block}
      #ucanVrGogglesV304 .label{position:absolute;bottom:3px;font:800 9px/1 Segoe UI,Arial,sans-serif;letter-spacing:.08em}
      #ucanXrDiagnosticV304{position:fixed;inset:0;z-index:130;display:none;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.78);backdrop-filter:blur(9px)}
      #ucanXrDiagnosticV304.open{display:flex}
      #ucanXrDiagnosticV304 .xr-card{width:min(620px,96vw);max-height:90vh;overflow:auto;border:2px solid #fed141;border-radius:18px;background:#071826;color:#fff;box-shadow:0 26px 90px rgba(0,0,0,.68)}
      #ucanXrDiagnosticV304 header{position:sticky;top:0;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 14px;background:#0b3d38;border-bottom:1px solid rgba(255,255,255,.18)}
      #ucanXrDiagnosticV304 h2{margin:0;font-size:18px}
      #ucanXrDiagnosticV304 .close{min-width:42px;background:#fff;color:#17302b;font-size:22px;padding:5px 10px}
      #ucanXrDiagnosticBodyV304{padding:14px;font-size:14px;line-height:1.48}
      #ucanXrDiagnosticBodyV304 .ok{color:#9ff0c8}#ucanXrDiagnosticBodyV304 .bad{color:#ffb4a8}#ucanXrDiagnosticBodyV304 code{color:#fed141;word-break:break-word}
      #ucanXrDiagnosticV304 .actions{display:flex;flex-wrap:wrap;gap:8px;padding:0 14px 14px}
      #ucanXrDiagnosticV304 .actions button{flex:1;min-width:180px}
      html.ucan-mr-active-v304,html.ucan-mr-active-v304 body,html.ucan-mr-active-v304 #renderCanvas{background:transparent!important}
      @media(max-width:820px){#ucanVrGogglesV304{right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom));width:68px;height:56px}}
    `;
    document.head.appendChild(style);
  }

  function ensureDiagnosticPanel() {
    ensureStyles();
    if (state.diagnostics?.isConnected) return;
    const panel = document.createElement('section');
    panel.id = 'ucanXrDiagnosticV304';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = `<div class="xr-card"><header><h2>Diagnóstico de entrada VR</h2><button id="ucanXrDiagnosticCloseV304" class="close" aria-label="Cerrar">×</button></header><div id="ucanXrDiagnosticBodyV304"></div><div class="actions"><button id="ucanXrRetryVrV304">Intentar entrar en VR</button><button id="ucanXrRetryMrV304">Intentar MR Beta</button><button id="ucanXrOpenDirectV304" class="secondary">Abrir página directamente</button></div></div>`;
    document.body.appendChild(panel);
    state.diagnostics = panel;
    state.diagnosticsBody = panel.querySelector('#ucanXrDiagnosticBodyV304');
    panel.querySelector('#ucanXrDiagnosticCloseV304')?.addEventListener('click', closeDiagnostics);
    panel.querySelector('#ucanXrRetryVrV304')?.addEventListener('click', event => {
      event.preventDefault();
      enterMode('immersive-vr');
    });
    panel.querySelector('#ucanXrRetryMrV304')?.addEventListener('click', event => {
      event.preventDefault();
      enterMode('immersive-ar');
    });
    panel.querySelector('#ucanXrOpenDirectV304')?.addEventListener('click', () => {
      try { window.open(location.href, '_blank', 'noopener'); }
      catch (_) { location.href = location.href; }
    });
  }

  function closeDiagnostics() {
    state.diagnostics?.classList.remove('open');
    state.diagnostics?.setAttribute('aria-hidden', 'true');
  }

  function diagnosticAdvice() {
    const items = [];
    if (!window.isSecureContext) items.push('Abra la dirección HTTPS del campus. WebXR no puede iniciar mediante HTTP normal.');
    if (!isTopLevel()) items.push('Abra el campus directamente en Meta Quest Browser; no use una vista previa incrustada de Codespaces o VS Code.');
    if (!navigator.xr) items.push('Meta Quest Browser no expuso la API WebXR. Actualice y reinicie el navegador del visor.');
    if (!helperReady()) items.push('La escena todavía no terminó de preparar Babylon WebXR. Espere unos segundos y vuelva a tocar el botón.');
    if (state.lastError?.name === 'NotAllowedError') items.push('El visor rechazó la activación. Toque nuevamente el botón VR después de cerrar cualquier otra sesión XR.');
    if (state.lastError?.name === 'InvalidStateError') items.push('Existe otra sesión XR activa o incompleta. Cierre otras pestañas VR y reinicie Meta Quest Browser.');
    if (state.lastError?.name === 'NotSupportedError') items.push('La página o el navegador no informó compatibilidad con el modo solicitado.');
    if (!items.length) items.push('Cierre otras pestañas XR, permanezca en esta página y toque Intentar entrar en VR.');
    return items;
  }

  function showDiagnostics(title = 'No se pudo entrar en VR') {
    ensureDiagnosticPanel();
    const row = (label, value, pass) => `<p class="${pass ? 'ok' : 'bad'}"><strong>${label}:</strong> ${value}</p>`;
    const activation = state.lastUserActivation;
    const error = state.lastError;
    state.diagnostics.querySelector('h2').textContent = title;
    state.diagnosticsBody.innerHTML = [
      row('HTTPS seguro', window.isSecureContext ? 'Sí' : 'No', window.isSecureContext),
      row('Página abierta directamente', isTopLevel() ? 'Sí' : 'No', isTopLevel()),
      row('API WebXR', navigator.xr ? 'Disponible' : 'No disponible', Boolean(navigator.xr)),
      row('Ayudante Babylon WebXR', helperReady() ? 'Preparado' : 'No preparado', helperReady()),
      row('Activación del último toque', activation === true ? 'Activa' : activation === false ? 'No activa' : 'Sin dato', activation === true),
      row('Compatibilidad VR informada', state.vrSupported === true ? 'Sí' : state.vrSupported === false ? 'No confirmada' : 'Pendiente', state.vrSupported !== false),
      `<p><strong>Dirección:</strong> <code>${location.href}</code></p>`,
      error ? `<p class="bad"><strong>Error:</strong> ${error.name}: ${error.message}</p>` : '',
      `<hr><p><strong>Acciones recomendadas:</strong></p><ol>${diagnosticAdvice().map(item => `<li>${item}</li>`).join('')}</ol>`
    ].join('');
    state.diagnostics.classList.add('open');
    state.diagnostics.setAttribute('aria-hidden', 'false');
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
        enterMode('immersive-vr');
      }, true);
      document.body.appendChild(button);
    }
    state.floatingButton = button;
    updateButtons();
  }

  function replaceAndBindButton(id, mode) {
    const existing = document.getElementById(id);
    if (!existing) return null;
    if (existing.dataset.ucanV304XrBound === 'direct-user-gesture') return existing;
    const button = existing.cloneNode(true);
    button.dataset.ucanV289Bound = 'true';
    button.dataset.ucanV304XrBound = 'direct-user-gesture';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      enterMode(mode);
    }, true);
    existing.replaceWith(button);
    return button;
  }

  function bindButtons() {
    state.xrButton = replaceAndBindButton('xrBtn', 'immersive-vr') || state.xrButton;
    state.mrButton = replaceAndBindButton('mrBtn', 'immersive-ar') || state.mrButton;
    ensureFloatingButton();
    ensureDiagnosticPanel();
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
      state.xrButton.disabled = state.entering;
      state.xrButton.textContent = active && mode === 'immersive-vr' ? 'Salir de VR' : state.entering && state.requestedMode === 'immersive-vr' ? 'Entrando en VR…' : 'Entrar en VR';
      state.xrButton.setAttribute('aria-pressed', String(active && mode === 'immersive-vr'));
      state.xrButton.title = helperReady() ? 'Entrar directamente en una sesión immersive-vr' : 'WebXR está inicializando; toque para ver el diagnóstico';
    }
    if (state.mrButton) {
      state.mrButton.disabled = state.entering;
      state.mrButton.textContent = active && mode === 'immersive-ar' ? 'Salir de MR' : state.entering && state.requestedMode === 'immersive-ar' ? 'Entrando en MR…' : 'MR beta';
      state.mrButton.setAttribute('aria-pressed', String(active && mode === 'immersive-ar'));
      state.mrButton.title = 'Intentar realidad mixta con passthrough';
    }
    if (state.floatingButton) {
      state.floatingButton.disabled = state.entering;
      state.floatingButton.setAttribute('aria-pressed', String(active && mode === 'immersive-vr'));
      state.floatingButton.setAttribute('aria-label', active ? 'Salir del entorno XR' : 'Entrar al entorno en realidad virtual');
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

  async function exitXR() {
    if (!helperReady()) {
      showDiagnostics('WebXR todavía no está preparado');
      return false;
    }
    try {
      await state.helper.baseExperience.exitXRAsync();
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
      status('No se pudo cerrar la sesión XR. Reinicie el navegador si permanece conectada.');
      showDiagnostics('No se pudo cerrar la sesión XR');
      return false;
    }
  }

  async function enterMode(mode) {
    if (state.entering) return false;

    const active = currentXRState() === XR_STATE.ENTERING_XR || currentXRState() === XR_STATE.IN_XR;
    if (active) return exitXR();

    state.lastUserActivation = Boolean(navigator.userActivation?.isActive);
    if (!helperReady() || !window.isSecureContext || !navigator.xr) {
      if (!helperReady()) recordError('pre-entry', new Error('No se encontró el ayudante WebXR de Babylon.js.'));
      else if (!window.isSecureContext) recordError('pre-entry', new DOMException('WebXR requiere HTTPS.', 'SecurityError'));
      else recordError('pre-entry', new DOMException('La API WebXR no está disponible.', 'NotSupportedError'));
      showDiagnostics('El campus todavía no puede entrar en XR');
      return false;
    }

    state.entering = true;
    state.requestedMode = mode;
    state.activeMode = mode;
    if (mode === 'immersive-ar') state.attempts.mr += 1;
    else state.attempts.vr += 1;
    updateButtons();
    closeDiagnostics();

    try {
      let enterPromise;
      if (mode === 'immersive-ar') {
        prepareMixedReality();
        const renderTarget = state.helper.renderTarget || state.helper.baseExperience?.renderTarget;
        const optionalFeatures = ['local-floor', 'bounded-floor', 'hand-tracking', 'hit-test', 'anchors', 'layers'];
        status('Solicitando realidad mixta directamente desde el toque del usuario…');
        enterPromise = state.helper.baseExperience.enterXRAsync('immersive-ar', 'local-floor', renderTarget, { optionalFeatures });
      } else {
        restoreMixedReality();
        status('Solicitando entrada directa al entorno VR…');
        enterPromise = state.helper.baseExperience.enterXRAsync('immersive-vr', 'local-floor');
      }

      await enterPromise;
      state.inXR = true;
      if (mode === 'immersive-ar') {
        state.successfulEntries.mr += 1;
        status('MR Beta activo: escena virtual conectada al passthrough.');
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
      status(`No se pudo iniciar ${mode === 'immersive-ar' ? 'MR' : 'VR'}: ${error?.name || 'Error'} — ${error?.message || error}`);
      showDiagnostics(mode === 'immersive-ar' ? 'MR Beta no pudo iniciar' : 'VR no pudo iniciar');
      return false;
    } finally {
      state.entering = false;
      updateButtons();
    }
  }

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

  async function detectSupportInBackground() {
    const [vr, mr] = await Promise.all([
      probeSupport('immersive-vr'),
      probeSupport('immersive-ar')
    ]);
    state.vrSupported = vr;
    state.mrSupported = mr;
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
      existingVrButtonRebound:state.xrButton?.dataset?.ucanV304XrBound === 'direct-user-gesture',
      mrBetaButtonRebound:state.mrButton?.dataset?.ucanV304XrBound === 'direct-user-gesture',
      directUserGestureEntryWithoutAwait:true,
      supportCheckAdvisoryOnly:true,
      vrButtonNeverDisabledBySupportProbe:true,
      diagnosticsVisibleOnFailure:true,
      vrUsesBabylonExperienceHelper:true,
      mrUsesBabylonExperienceHelper:true,
      mrSessionMode:'immersive-ar',
      vrSessionMode:'immersive-vr',
      referenceSpaceType:'local-floor',
      transparentPassthroughBackground:true,
      skyHiddenOnlyDuringMR:true,
      sceneRestoredAfterMR:true,
      secureContext:window.isSecureContext,
      topLevel:isTopLevel(),
      navigatorXR:Boolean(navigator.xr),
      vrSupported:state.vrSupported,
      mrSupported:state.mrSupported,
      entering:state.entering,
      inXR:state.inXR,
      activeMode:state.activeMode,
      lastUserActivation:state.lastUserActivation,
      attempts:{ ...state.attempts },
      successfulEntries:{ ...state.successfulEntries },
      exits:state.exits,
      lastError:state.lastError,
      enterVR:() => enterMode('immersive-vr'),
      enterMR:() => enterMode('immersive-ar'),
      exit:exitXR,
      showDiagnostics,
      getState:() => ({
        installed:state.installed,
        helperReady:Boolean(state.helper),
        floatingButtonVisible:Boolean(state.floatingButton?.isConnected),
        secureContext:window.isSecureContext,
        topLevel:isTopLevel(),
        navigatorXR:Boolean(navigator.xr),
        vrSupported:state.vrSupported,
        mrSupported:state.mrSupported,
        entering:state.entering,
        inXR:state.inXR,
        activeMode:state.activeMode,
        lastUserActivation:state.lastUserActivation,
        hiddenForMR:state.hiddenForMR.size,
        lastError:state.lastError
      })
    };
  }

  function install() {
    bindButtons();
    if (!helperReady()) {
      updateAudit();
      return false;
    }
    observeXRState();
    state.installed = true;
    detectSupportInBackground().catch(error => recordError('detectSupportInBackground', error));
    updateAudit();
    console.info(`[UCAN ${VERSION}] Entrada VR directa por gesto del usuario y MR Beta instalados.`);
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
